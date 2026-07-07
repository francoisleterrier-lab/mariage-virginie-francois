// Supabase Edge Function : ghost-push
// Envoie le « push fantôme » à l'auteur d'une chanson au moment où elle
// passe (déclenché par la console Jour J). Idempotent : n'envoie qu'une
// fois par chanson (verrou push_a). Ne journalise JAMAIS le souvenir.
//
// Entrée : { submission_id }. Vérifie : appelant admin, chanson approuvée
// et jouée, push_a nul. Réutilise les clés VAPID existantes.
//
// Déploiement :  supabase functions deploy ghost-push

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@exemple.fr";

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return json({ error: "Non authentifié." }, 401);

  // 1) Appelant admin ?
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Session invalide." }, 401);
  const { data: moi } = await userClient.from("invites").select("role").eq("user_id", user.id).maybeSingle();
  if (moi?.role !== "admin") return json({ error: "Réservé à l'administrateur." }, 403);

  let submission_id = "";
  try {
    submission_id = (await req.json()).submission_id;
  } catch {
    return json({ error: "Corps invalide." }, 400);
  }
  if (!submission_id) return json({ error: "submission_id requis." }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // 2) Chanson éligible ? Verrou d'idempotence : on pose push_a d'abord.
  const { data: chanson } = await admin
    .from("chansons")
    .select("id, invite_id, titre, souvenir, statut, joue_a, push_a")
    .eq("id", submission_id)
    .maybeSingle();
  if (!chanson) return json({ error: "Chanson introuvable." }, 404);
  if (chanson.statut !== "approuvee" || !chanson.joue_a) return json({ skipped: "non éligible" });
  if (chanson.push_a) return json({ skipped: "déjà envoyé" });

  // pose le verrou tout de suite (évite le double envoi en cas de retry)
  const { error: lockErr } = await admin
    .from("chansons")
    .update({ push_a: new Date().toISOString() })
    .eq("id", submission_id)
    .is("push_a", null);
  if (lockErr) return json({ skipped: "verrou" });

  // 3) Abonnements de l'auteur.
  const { data: subs } = await admin.from("push_subscriptions").select("id, subscription").eq("invite_id", chanson.invite_id);
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const body = JSON.stringify({ title: `🎶 ${chanson.titre} — c'est pour vous`, body: chanson.souvenir, url: "./#bandeson" });

  let envoyes = 0;
  const morts: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, body);
        envoyes++;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) morts.push(row.id);
      }
    })
  );
  if (morts.length) await admin.from("push_subscriptions").delete().in("id", morts);

  // 4) Journal minimal — jamais le souvenir.
  return json({ id: submission_id, appareils: envoyes });
});

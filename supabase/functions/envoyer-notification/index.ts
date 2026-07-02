// Supabase Edge Function : envoyer-notification
// Envoie une notification Web Push à TOUS les abonnés.
// Déclenchée depuis le tableau de bord admin (formulaire titre + message).
//
// Sécurité :
//  - vérifie que l'appelant est bien un invité au rôle 'admin' (via son JWT) ;
//  - la clé privée VAPID reste ici (secret Supabase), jamais dans le front ;
//  - lit push_subscriptions avec la clé service_role (contourne la RLS) ;
//  - journalise l'envoi dans notifications_log et purge les abonnements morts.
//
// Déploiement :  supabase functions deploy envoyer-notification
// Secrets     :  supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@exemple.fr";

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "Non authentifié." }, 401);

  // 1) Vérifier que l'appelant est admin (client à la portée de son JWT).
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: "Session invalide." }, 401);

  const { data: moi } = await userClient
    .from("invites")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (moi?.role !== "admin") return json({ error: "Réservé à l'administrateur." }, 403);

  // 2) Corps de la notification.
  let payload: { titre?: string; message?: string; url?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Corps JSON invalide." }, 400);
  }
  const titre = (payload.titre ?? "").trim();
  const message = (payload.message ?? "").trim();
  if (!titre || !message) return json({ error: "Titre et message requis." }, 400);

  // 3) Lecture des abonnements (service_role → contourne la RLS).
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: subs, error: errSubs } = await admin.from("push_subscriptions").select("id, subscription");
  if (errSubs) return json({ error: errSubs.message }, 500);

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const body = JSON.stringify({ title: titre, body: message, url: payload.url ?? "./" });

  let envoyes = 0;
  const aSupprimer: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, body);
        envoyes++;
      } catch (e) {
        // 404/410 => abonnement expiré, on le purge.
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) aSupprimer.push(row.id);
      }
    })
  );

  if (aSupprimer.length) await admin.from("push_subscriptions").delete().in("id", aSupprimer);

  // 4) Journal.
  await admin.from("notifications_log").insert({ titre, message, envoyes });

  return json({ envoyes, total: subs?.length ?? 0, purges: aSupprimer.length });
});

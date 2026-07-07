// Edge Function : relance-invite
// Relance personnelle : l'admin envoie une notification ciblée à UN invité.
// Entrée : { invite_id, titre, message }.
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
  const URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return json({ error: "Non authentifié." }, 401);

  const { invite_id, titre, message } = await req.json().catch(() => ({}));
  if (!invite_id || !titre || !message) return json({ error: "invite_id, titre, message requis." }, 400);

  const uc = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await uc.auth.getUser();
  if (!user) return json({ error: "Session invalide." }, 401);
  const { data: moi } = await uc.from("invites").select("role").eq("user_id", user.id).maybeSingle();
  if (moi?.role !== "admin") return json({ error: "Réservé à l'administrateur." }, 403);

  const admin = createClient(URL, SERVICE);
  const { data: subs } = await admin.from("push_subscriptions").select("id, subscription").eq("invite_id", invite_id);
  if (!subs?.length) return json({ envoyes: 0, note: "Cet invité n'a pas activé les notifications." });

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@exemple.fr",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!
  );
  const body = JSON.stringify({ title: titre, body: message, url: "./" });
  let envoyes = 0;
  const morts: string[] = [];
  await Promise.all((subs ?? []).map(async (r) => {
    try { await webpush.sendNotification(r.subscription, body); envoyes++; }
    catch (e) { const c = (e as { statusCode?: number })?.statusCode; if (c === 404 || c === 410) morts.push(r.id); }
  }));
  if (morts.length) await admin.from("push_subscriptions").delete().in("id", morts);
  return json({ envoyes });
});

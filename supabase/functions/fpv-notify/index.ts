// Faire-part Vivant — envoi de notifications push pour UNE invitation.
// Le couple (propriétaire de l'invitation) envoie à ses abonnés.
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

  const URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const VPUB = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const VPRIV = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const VSUB = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@exemple.fr";

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth) return json({ error: "Non authentifié." }, 401);

  let body: { slug?: string; titre?: string; message?: string; url?: string };
  try { body = await req.json(); } catch { return json({ error: "JSON invalide." }, 400); }
  const slug = (body.slug ?? "").trim();
  const titre = (body.titre ?? "").trim();
  const message = (body.message ?? "").trim();
  if (!slug || !titre || !message) return json({ error: "slug, titre et message requis." }, 400);

  // 1) L'appelant est-il propriétaire de cette invitation ?
  const userClient = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Session invalide." }, 401);

  const admin = createClient(URL, SERVICE);
  const { data: inv } = await admin
    .from("fpv_invitations").select("id, owner_id").eq("slug", slug).maybeSingle();
  if (!inv) return json({ error: "Invitation introuvable." }, 404);
  if (inv.owner_id !== user.id) return json({ error: "Réservé au propriétaire de l'invitation." }, 403);

  // 2) Abonnés de cette invitation.
  const { data: subs } = await admin
    .from("fpv_push_subscriptions").select("id, subscription").eq("invitation_id", inv.id);

  webpush.setVapidDetails(VSUB, VPUB, VPRIV);
  const payload = JSON.stringify({ title: titre, body: message, url: body.url ?? "./" });
  let envoyes = 0;
  const morts: string[] = [];
  await Promise.all((subs ?? []).map(async (row) => {
    try { await webpush.sendNotification(row.subscription, payload); envoyes++; }
    catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) morts.push(row.id);
    }
  }));
  if (morts.length) await admin.from("fpv_push_subscriptions").delete().in("id", morts);

  return json({ envoyes, total: subs?.length ?? 0, purges: morts.length });
});

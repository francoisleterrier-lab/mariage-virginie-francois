// Edge Function : quiz-lifecycle (cron ~5 min)
// Ouvre/clôt le quiz automatiquement aux dates configurées et envoie UN
// push par transition (idempotence via quiz_push_log). Vocabulaire :
// « surprise » (jamais « cadeau »).
// Protégée par le secret partagé x-cron-secret == CRON_SECRET.

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function pushTous(admin: any, titre: string, message: string) {
  const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@exemple.fr";
  const { data: subs } = await admin.from("push_subscriptions").select("id, subscription");
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const body = JSON.stringify({ title: titre, body: message, url: "./#quiz" });
  const morts: string[] = [];
  await Promise.all((subs ?? []).map(async (r: any) => {
    try { await webpush.sendNotification(r.subscription, body); }
    catch (e) { const c = (e as any)?.statusCode; if (c === 404 || c === 410) morts.push(r.id); }
  }));
  if (morts.length) await admin.from("push_subscriptions").delete().in("id", morts);
  await admin.from("notifications_log").insert({ titre, message, envoyes: (subs?.length ?? 0) - morts.length });
}

Deno.serve(async (req) => {
  const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "Interdit." }, 403);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: params } = await admin.from("parametres").select("cle, valeur").in("cle", ["quiz_state", "quiz_reveal_at", "quiz_close_at", "quiz_push_log"]);
  const P = Object.fromEntries((params ?? []).map((r) => [r.cle, r.valeur]));
  const now = Date.now();
  const log: string[] = Array.isArray(P.quiz_push_log) ? P.quiz_push_log : [];
  const dejaFait = (k: string) => log.includes(k);
  const marquer = async (k: string) => { log.push(k); await admin.from("parametres").upsert({ cle: "quiz_push_log", valeur: log }); };

  if (P.quiz_state === "hidden" && P.quiz_reveal_at && Date.parse(P.quiz_reveal_at) <= now) {
    await admin.from("parametres").upsert({ cle: "quiz_state", valeur: "open" });
    if (!dejaFait("open")) {
      await pushTous(admin, "🎯 Le Quiz des Mariés est ouvert", "Une surprise attend les 3 premiers…");
      await marquer("open");
    }
    return json({ transition: "open" });
  }
  if (P.quiz_state === "open" && P.quiz_close_at && Date.parse(P.quiz_close_at) <= now) {
    await admin.from("parametres").upsert({ cle: "quiz_state", valeur: "closed" });
    if (!dejaFait("closed")) {
      await pushTous(admin, "🏆 Le quiz est clos", "Découvrez le podium et la correction.");
      await marquer("closed");
    }
    return json({ transition: "closed" });
  }
  return json({ transition: null, state: P.quiz_state });
});

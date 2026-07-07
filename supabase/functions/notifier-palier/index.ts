// Supabase Edge Function : notifier-palier
// À exécuter une fois par jour (cron). Si le site vient d'entrer dans une
// phase « remarquable » (bourgeons, floraison, veille) ET que les push de
// palier sont activés (parametre phase_push_enabled = true), envoie une
// notification Web Push à tous les abonnés — une seule fois par phase
// (idempotence via la table phase_push_log).
//
// Déclenchement :
//   - Cron quotidien (Supabase Dashboard → Edge Functions → Schedules),
//     ou pg_cron + pg_net appelant cette URL.
//   - Protégée par un secret partagé : en-tête `x-cron-secret` == CRON_SECRET.
//
// Déploiement :  supabase functions deploy notifier-palier
// Secrets     :  supabase secrets set CRON_SECRET=... (VAPID_* déjà présents)

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

// phases qui déclenchent un push + le message associé
const MESSAGES: Record<string, { titre: string; message: string }> = {
  bourgeons: { titre: "🌿 L'arbre bourgeonne", message: "Le site de Virginie & François se pare de bourgeons… venez voir !" },
  floraison: { titre: "🌸 Le site a fleuri", message: "La floraison est là — le grand jour approche. Un petit tour ?" },
  veille: { titre: "✨ Plus que quelques jours", message: "La veille du mariage approche. Retrouvez-nous sur le faire-part." },
};

function phaseCourante(phases: { id: string; starts_at: string }[]) {
  const auj = new Date();
  auj.setHours(0, 0, 0, 0);
  let c: { id: string; starts_at: string } | null = null;
  for (const p of phases) {
    const d = new Date(p.starts_at + "T00:00:00");
    if (d <= auj && (!c || d >= new Date(c.starts_at + "T00:00:00"))) c = p;
  }
  return c?.id ?? null;
}

Deno.serve(async (req) => {
  const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "Interdit." }, 403);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@exemple.fr";

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1) Push de palier activés ?
  const { data: param } = await admin.from("parametres").select("valeur").eq("cle", "phase_push_enabled").maybeSingle();
  if (param?.valeur !== true) return json({ skipped: "push de palier désactivés" });

  // 2) Phase courante remarquable ?
  const { data: phases } = await admin.from("site_phases").select("id, starts_at").order("ordre");
  const phase = phaseCourante(phases ?? []);
  if (!phase || !MESSAGES[phase]) return json({ skipped: `phase ${phase} sans notification` });

  // 3) Déjà notifiée ? (idempotence)
  const { data: deja } = await admin.from("phase_push_log").select("phase_id").eq("phase_id", phase).maybeSingle();
  if (deja) return json({ skipped: `phase ${phase} déjà notifiée` });

  // 4) Envoi à tous les abonnés.
  const { data: subs } = await admin.from("push_subscriptions").select("id, subscription");
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  const body = JSON.stringify({ ...MESSAGES[phase], url: "./" });

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

  // 5) Journalise (verrou d'idempotence) + notifications_log.
  await admin.from("phase_push_log").insert({ phase_id: phase });
  await admin.from("notifications_log").insert({ titre: MESSAGES[phase].titre, message: MESSAGES[phase].message, envoyes });

  return json({ phase, envoyes, total: subs?.length ?? 0 });
});

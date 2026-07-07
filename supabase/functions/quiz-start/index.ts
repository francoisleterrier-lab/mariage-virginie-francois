// Edge Function : quiz-start
// Démarre (ou reprend) la tentative d'un invité pour une manche donnée et
// sert la 1re question NON répondue. Ne renvoie jamais correct_key.
// Entrée : { round: 'main' | 'witness' }.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { melangeChoix, questionPublique } from "../_shared/quiz.ts";

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

  const round = (await req.json().catch(() => ({}))).round === "witness" ? "witness" : "main";

  const uc = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await uc.auth.getUser();
  if (!user) return json({ error: "Session invalide." }, 401);

  const admin = createClient(URL, SERVICE);
  const { data: moi } = await admin.from("invites").select("id").eq("user_id", user.id).maybeSingle();
  if (!moi) return json({ error: "Invité introuvable." }, 403);
  const inviteId = moi.id;

  const { data: params } = await admin.from("parametres").select("cle, valeur").in("cle", ["quiz_state", "quiz_witnesses"]);
  const P = Object.fromEntries((params ?? []).map((r) => [r.cle, r.valeur]));
  if (P.quiz_state !== "open") return json({ error: "Le quiz n'est pas ouvert." }, 409);
  if (round === "witness" && !((P.quiz_witnesses ?? []) as string[]).includes(inviteId))
    return json({ error: "Manche réservée aux témoins." }, 403);

  // questions de la manche
  const { data: questions } = await admin
    .from("quiz_questions")
    .select("id, position, body, choices, time_limit_s, points, correct_key")
    .eq("round", round)
    .order("position", { ascending: true });
  if (!questions?.length) return json({ error: "Aucune question." }, 404);

  // tentative (unique par invite+round)
  let { data: attempt } = await admin.from("quiz_attempts").select("*").eq("invite_id", inviteId).eq("round", round).maybeSingle();
  if (!attempt) {
    const ins = await admin.from("quiz_attempts").insert({ invite_id: inviteId, round }).select("*").single();
    attempt = ins.data;
  }
  if (attempt.finished_at) return json({ finished: true, score: attempt.total_score });

  // réponses déjà servies pour cette tentative
  const { data: answers } = await admin.from("quiz_answers").select("question_id, submitted_at, served_at").eq("attempt_id", attempt.id);
  const parQ = new Map((answers ?? []).map((a) => [a.question_id, a]));

  // 1re question sans réponse soumise
  const idx = questions.findIndex((q) => !parQ.get(q.id)?.submitted_at);
  if (idx === -1) {
    await admin.from("quiz_attempts").update({ finished_at: new Date().toISOString() }).eq("id", attempt.id).is("finished_at", null);
    return json({ finished: true, score: attempt.total_score });
  }
  const q = questions[idx];
  // sert (crée la ligne answer avec served_at si absente)
  if (!parQ.has(q.id)) {
    await admin.from("quiz_answers").insert({ attempt_id: attempt.id, question_id: q.id, served_at: new Date().toISOString() });
  }
  return json({
    total: questions.length,
    index: idx + 1,
    question: questionPublique(q, melangeChoix(q.choices, inviteId + q.id)),
  });
});

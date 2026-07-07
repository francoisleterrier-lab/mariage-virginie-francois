// Edge Function : quiz-answer
// Valide une réponse (chrono 100 % serveur, +2 s de grâce), met à jour le
// score, et sert la question suivante. Ne renvoie JAMAIS is_correct /
// correct_key (le suspense tient jusqu'à la clôture).
// Entrée : { round, question_id, answer_key | null }.

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

  const body = await req.json().catch(() => ({}));
  const round = body.round === "witness" ? "witness" : "main";
  const questionId = body.question_id;
  const answerKey = body.answer_key ?? null;
  if (!questionId) return json({ error: "question_id requis." }, 400);

  const uc = createClient(URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await uc.auth.getUser();
  if (!user) return json({ error: "Session invalide." }, 401);

  const admin = createClient(URL, SERVICE);
  const { data: moi } = await admin.from("invites").select("id").eq("user_id", user.id).maybeSingle();
  if (!moi) return json({ error: "Invité introuvable." }, 403);

  const { data: st } = await admin.from("parametres").select("valeur").eq("cle", "quiz_state").maybeSingle();
  if (st?.valeur !== "open") return json({ error: "Quiz fermé." }, 409);

  const { data: attempt } = await admin.from("quiz_attempts").select("*").eq("invite_id", moi.id).eq("round", round).maybeSingle();
  if (!attempt || attempt.finished_at) return json({ error: "Tentative absente ou close." }, 409);

  const { data: q } = await admin.from("quiz_questions").select("*").eq("id", questionId).maybeSingle();
  if (!q || q.round !== round) return json({ error: "Question invalide." }, 400);

  const { data: ans } = await admin.from("quiz_answers").select("*").eq("attempt_id", attempt.id).eq("question_id", questionId).maybeSingle();
  if (!ans || !ans.served_at) return json({ error: "Question non servie." }, 409);
  if (ans.submitted_at) return json({ error: "Déjà répondu." }, 409);

  const now = Date.now();
  const timeMs = now - new Date(ans.served_at).getTime();
  const horsDelai = timeMs > q.time_limit_s * 1000 + 2000;
  const correct = !horsDelai && answerKey === q.correct_key;

  await admin
    .from("quiz_answers")
    .update({ submitted_at: new Date(now).toISOString(), answer_key: answerKey, is_correct: correct, time_ms: timeMs })
    .eq("attempt_id", attempt.id)
    .eq("question_id", questionId);

  const nouveauScore = attempt.total_score + (correct ? q.points : 0);
  const nouveauTemps = attempt.total_time_ms + Math.max(0, timeMs);
  await admin.from("quiz_attempts").update({ total_score: nouveauScore, total_time_ms: nouveauTemps }).eq("id", attempt.id);

  // question suivante ?
  const { data: questions } = await admin
    .from("quiz_questions")
    .select("id, position, body, choices, time_limit_s, points")
    .eq("round", round)
    .order("position", { ascending: true });
  const { data: rep } = await admin.from("quiz_answers").select("question_id, submitted_at").eq("attempt_id", attempt.id);
  const repondu = new Set((rep ?? []).filter((r) => r.submitted_at).map((r) => r.question_id));
  const suivante = (questions ?? []).find((x) => !repondu.has(x.id));

  if (!suivante) {
    await admin.from("quiz_attempts").update({ finished_at: new Date().toISOString() }).eq("id", attempt.id).is("finished_at", null);
    return json({ accepted: true, finished: true, score: nouveauScore });
  }
  await admin.from("quiz_answers").insert({ attempt_id: attempt.id, question_id: suivante.id, served_at: new Date().toISOString() });
  return json({
    accepted: true,
    index: questions!.findIndex((x) => x.id === suivante.id) + 1,
    total: questions!.length,
    question: questionPublique(suivante, melangeChoix(suivante.choices, moi.id + suivante.id)),
  });
});

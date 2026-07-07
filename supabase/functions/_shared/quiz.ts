// Utilitaires partagés du quiz (Edge Functions).

// Mélange déterministe des choix par (invité, question) → équité + anti-triche.
export function melangeChoix(choix: { key: string; label: string }[], graine: string) {
  let h = 0;
  for (const c of graine) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  const rnd = () => ((h = (h * 1103515245 + 12345) & 0x7fffffff), h / 0x7fffffff);
  const a = [...choix];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Ne renvoie JAMAIS correct_key.
export function questionPublique(q: any, choixMelanges: any[]) {
  return {
    id: q.id,
    position: q.position,
    body: q.body,
    choices: choixMelanges,
    time_limit_s: q.time_limit_s,
    points: q.points,
  };
}

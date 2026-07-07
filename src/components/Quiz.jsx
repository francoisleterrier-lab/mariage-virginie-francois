import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   Le Quiz des Mariés + Duel des Témoins (côté invité).
   États pilotés par parametres.quiz_state : hidden (teaser « à venir »)
   | open (jeu chronométré) | closed (podium + correction + duel).
   Anti-triche : aucune donnée de question hors des Edge Functions ;
   la bonne réponse n'arrive jamais avant la clôture.
   ============================================================ */
function Minuteur({ secondes, total }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, secondes / total));
  return (
    <svg className="quiz-timer" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} className="quiz-timer-bg" />
      <circle cx="32" cy="32" r={r} className="quiz-timer-fg" style={{ strokeDasharray: c, strokeDashoffset: c * (1 - frac) }} />
      <text x="32" y="38" textAnchor="middle" className="quiz-timer-txt">
        {secondes}
      </text>
    </svg>
  );
}

export default function Quiz({ profile }) {
  const [state, setState] = useState(null);
  const [teaser, setTeaser] = useState("");
  const [revealAt, setRevealAt] = useState(null);
  const [estTemoin, setEstTemoin] = useState(false);
  const [monScore, setMonScore] = useState(null); // score final manche main si déjà jouée
  const [podium, setPodium] = useState([]);
  const [correction, setCorrection] = useState([]);
  const [duel, setDuel] = useState([]);

  // jeu en cours
  const [round, setRound] = useState(null); // 'main' | 'witness' | null
  const [q, setQ] = useState(null);
  const [prog, setProg] = useState({ index: 0, total: 0 });
  const [reste, setReste] = useState(0);
  const [fini, setFini] = useState(null); // score final de la manche jouée
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const tick = useRef(null);

  const charger = useCallback(async () => {
    const { data: params } = await supabase
      .from("parametres")
      .select("cle, valeur")
      .in("cle", ["quiz_state", "quiz_teaser", "quiz_reveal_at", "quiz_witnesses"]);
    const P = Object.fromEntries((params || []).map((r) => [r.cle, r.valeur]));
    setState(P.quiz_state || "hidden");
    setTeaser(P.quiz_teaser || "");
    setRevealAt(P.quiz_reveal_at || null);
    setEstTemoin(Array.isArray(P.quiz_witnesses) && P.quiz_witnesses.includes(profile.id));

    const { data: att } = await supabase.from("quiz_attempts").select("round, finished_at, total_score").eq("invite_id", profile.id);
    const main = (att || []).find((a) => a.round === "main");
    if (main?.finished_at) setMonScore(main.total_score);

    if (P.quiz_state === "closed") {
      const [{ data: pod }, { data: cor }, { data: du }] = await Promise.all([
        supabase.rpc("quiz_podium"),
        supabase.rpc("quiz_correction"),
        supabase.rpc("quiz_duel"),
      ]);
      setPodium(pod || []);
      setCorrection(cor || []);
      setDuel(du || []);
    }
  }, [profile.id]);

  useEffect(() => {
    charger();
  }, [charger]);

  // minuteur d'affichage (le chrono qui compte est côté serveur)
  useEffect(() => {
    if (!q) return;
    clearInterval(tick.current);
    tick.current = setInterval(() => {
      setReste((s) => {
        if (s <= 1) {
          clearInterval(tick.current);
          repondre(null); // timeout → réponse vide
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick.current);
  }, [q]);

  function poser(question, index, total) {
    setQ(question);
    setProg({ index, total });
    setReste(question.time_limit_s);
  }

  async function demarrer(r) {
    setErreur("");
    setBusy(true);
    setRound(r);
    const { data, error } = await supabase.functions.invoke("quiz-start", { body: { round: r } });
    setBusy(false);
    if (error) return setErreur("Le quiz ouvrira bientôt — réessayez dans un instant.");
    if (data.finished) return setFini(data.score);
    poser(data.question, data.index, data.total);
  }

  async function repondre(key) {
    if (busy || !q) return;
    clearInterval(tick.current);
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("quiz-answer", {
      body: { round, question_id: q.id, answer_key: key },
    });
    setBusy(false);
    if (error) return setErreur("Réponse non enregistrée, réessayez.");
    if (data.finished) {
      setQ(null);
      setFini(data.score);
      if (round === "main") setMonScore(data.score);
      return;
    }
    poser(data.question, data.index, data.total);
  }

  if (!state) return null;

  /* ---------- HIDDEN : teaser « à venir » ---------- */
  if (state === "hidden") {
    const j = revealAt ? Math.max(0, Math.ceil((Date.parse(revealAt) - Date.now()) / 86400000)) : null;
    return (
      <section className="quiz" id="quiz">
        <div className="wrap center reveal">
          <p className="eyebrow">Le quiz des mariés</p>
          <div className="quiz-sceau">
            <div className="quiz-cadenas" aria-hidden="true">🔒</div>
            <h2>Bientôt : <em>saurez-vous nous répondre ?</em></h2>
            <p className="bs-pitch">{teaser || "Quelque chose se prépare…"}</p>
            {j != null && <p className="quiz-compte">Ouverture dans {j} jour{j > 1 ? "s" : ""}</p>}
          </div>
        </div>
      </section>
    );
  }

  /* ---------- OPEN : jeu ---------- */
  if (state === "open") {
    // question en cours
    if (q) {
      return (
        <section className="quiz quiz-jeu" id="quiz">
          <div className="wrap center">
            <div className="quiz-haut">
              <span className="quiz-prog">{prog.index}/{prog.total}</span>
              <Minuteur secondes={reste} total={q.time_limit_s} />
            </div>
            <h2 className="quiz-question">{q.body}</h2>
            <div className="quiz-choix">
              {q.choices.map((c) => (
                <button key={c.key} className="quiz-choix-btn" disabled={busy} onClick={() => repondre(c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
            <p className="quiz-feedback">Une seule tentative · pas de retour en arrière</p>
          </div>
        </section>
      );
    }
    // écran final de la manche jouée
    if (fini != null) {
      return (
        <section className="quiz" id="quiz">
          <div className="wrap center reveal">
            <p className="eyebrow">Le quiz des mariés</p>
            <h2>Votre score : <em>{fini} points</em></h2>
            <p>Le podium sera révélé à la clôture. 🌿</p>
            {estTemoin && round !== "witness" && <CarteTemoin onGo={() => { setFini(null); demarrer("witness"); }} />}
          </div>
        </section>
      );
    }
    // écran d'avertissement + Démarrer
    return (
      <section className="quiz" id="quiz">
        <div className="wrap center reveal">
          <p className="eyebrow">Le quiz des mariés</p>
          <h2>Prêt·e à <em>jouer</em> ?</h2>
          <div className="quiz-regles">
            <p className="quiz-warning">
              ⏱️ <strong>15 secondes</strong> pour répondre à chaque question. Vous ne pourrez jouer qu'<strong>une seule
              fois</strong> : concentrez-vous, <strong>impossible de revenir en arrière</strong>.
            </p>
            <ul>
              <li>Les questions défilent une par une.</li>
              <li>Pas de réponse dans le temps = 0 point, on passe.</li>
              <li>Classement : score d'abord, rapidité ensuite.</li>
            </ul>
          </div>
          {erreur && <p className="gate-err" style={{ color: "#b3541e" }}>{erreur}</p>}
          {monScore != null ? (
            <p>Vous avez déjà joué — score : <strong>{monScore} points</strong>. Podium à la clôture.</p>
          ) : (
            <button className="btn-vert" disabled={busy} onClick={() => demarrer("main")}>
              {busy ? "…" : "Démarrer"}
            </button>
          )}
          {estTemoin && monScore != null && <CarteTemoin onGo={() => demarrer("witness")} />}
        </div>
      </section>
    );
  }

  /* ---------- CLOSED : podium + correction + duel ---------- */
  const marches = ["quiz-or", "quiz-argent", "quiz-bronze"];
  return (
    <section className="quiz" id="quiz">
      <div className="wrap center reveal">
        <p className="eyebrow">Le quiz des mariés</p>
        <h2>Le <em>podium</em></h2>
        <div className="quiz-podium">
          {podium.slice(0, 3).map((p, i) => (
            <div key={i} className={"quiz-marche " + marches[i]}>
              <div className="quiz-rang">{i + 1}</div>
              <div className="quiz-nom">{p.prenom}</div>
              <div className="quiz-score">{p.score} pts</div>
            </div>
          ))}
        </div>
        {podium.length > 3 && (
          <ol className="quiz-classement">
            {podium.slice(3).map((p, i) => (
              <li key={i}><span>{p.rang}. {p.prenom}</span><span>{p.score} pts</span></li>
            ))}
          </ol>
        )}
        <p className="quiz-surprise">Les 3 premiers recevront leur surprise le jour J ✨</p>

        {duel.length === 2 && <Duel duel={duel} />}

        {correction.length > 0 && (
          <div className="quiz-correction">
            <h3 className="admin-h3">La correction</h3>
            {correction.map((c) => {
              const bonne = (c.choices || []).find((x) => x.key === c.correct_key);
              const total = Object.values(c.stats || {}).reduce((s, n) => s + n, 0) || 1;
              const nBonne = (c.stats || {})[c.correct_key] || 0;
              return (
                <div key={c.pos} className="quiz-cor-item">
                  <p className="quiz-cor-q">{c.pos}. {c.body}</p>
                  <p className="quiz-cor-r">✅ {bonne?.label}</p>
                  <p className="quiz-cor-stat">{Math.round((nBonne / total) * 100)}% d'entre vous avaient trouvé.</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function CarteTemoin({ onGo }) {
  return (
    <div className="quiz-temoin">
      <h3>🗡️ Le Duel des Témoins</h3>
      <p>Réservé à Alan &amp; Mélane : des questions plus corsées sur les mariés. À vous l'honneur.</p>
      <button className="btn-vert" style={{ maxWidth: 260 }} onClick={onGo}>
        Relever le défi
      </button>
    </div>
  );
}

function Duel({ duel }) {
  const [a, b] = duel;
  const exaequo = a.joue && b.joue && a.score === b.score && a.temps_ms === b.temps_ms;
  const forfait = a.joue !== b.joue;
  const vainqueur = exaequo ? null : a; // duel est déjà trié : gagnant en tête
  return (
    <div className="quiz-duel">
      <h3 className="admin-h3">🗡️ Le Duel des Témoins</h3>
      <div className="quiz-versus">
        {[a, b].map((t, i) => (
          <div key={i} className={"quiz-temoin-med" + (!exaequo && i === 0 ? " gagnant" : "")}>
            <div className="quiz-temoin-nom">{t.prenom}</div>
            {t.joue ? (
              <div className="quiz-temoin-score">{t.score} pts</div>
            ) : (
              <div className="quiz-temoin-forfait">n'a pas relevé le défi…</div>
            )}
          </div>
        ))}
      </div>
      <p className="quiz-duel-verdict">
        {exaequo
          ? "Ex æquo — les mariés sont bien entourés."
          : forfait
          ? `${vainqueur.prenom} l'emporte par forfait.`
          : `${vainqueur.prenom} connaît le mieux les mariés !`}
      </p>
    </div>
  );
}

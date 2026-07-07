import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   Admin — Quiz des Mariés + Duel des Témoins.
   Cycle de vie (hidden/open/closed), teaser, dates auto, témoins,
   éditeur de questions (verrouillé dès `open`).
   ============================================================ */
const vide = () => ({ round: "main", position: 1, body: "", choices: [{ key: "a", label: "" }, { key: "b", label: "" }, { key: "c", label: "" }, { key: "d", label: "" }], correct_key: "a", time_limit_s: 15, points: 10 });

export default function QuizAdmin({ invites }) {
  const [state, setState] = useState("hidden");
  const [teaser, setTeaser] = useState("");
  const [revealAt, setRevealAt] = useState("");
  const [closeAt, setCloseAt] = useState("");
  const [witnesses, setWitnesses] = useState([]);
  const [reveal, setReveal] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState(null);

  const nomPar = useMemo(() => Object.fromEntries(invites.map((g) => [g.id, g.nom])), [invites]);

  const charger = useCallback(async () => {
    const [{ data: params }, { data: qs }] = await Promise.all([
      supabase.from("parametres").select("cle, valeur").in("cle", ["quiz_state", "quiz_teaser", "quiz_reveal_at", "quiz_close_at", "quiz_witnesses", "witness_reveal_answers"]),
      supabase.from("quiz_questions").select("*").order("round").order("position"),
    ]);
    const P = Object.fromEntries((params || []).map((r) => [r.cle, r.valeur]));
    setState(P.quiz_state || "hidden");
    setTeaser(P.quiz_teaser || "");
    setRevealAt(P.quiz_reveal_at ? P.quiz_reveal_at.slice(0, 16) : "");
    setCloseAt(P.quiz_close_at ? P.quiz_close_at.slice(0, 16) : "");
    setWitnesses(Array.isArray(P.quiz_witnesses) ? P.quiz_witnesses : []);
    setReveal(P.witness_reveal_answers !== false);
    setQuestions(qs || []);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const nbMain = questions.filter((q) => q.round === "main").length;
  const nbWitness = questions.filter((q) => q.round === "witness").length;
  const verrou = state === "open";

  async function setParam(cle, valeur) {
    await supabase.from("parametres").upsert({ cle, valeur });
  }
  async function changerEtat(nv) {
    if (nv === "open" && nbMain < 5) return setMsg("Au moins 5 questions principales pour ouvrir.");
    if (nv === "open" && nbWitness > 0 && witnesses.length !== 2) return setMsg("La manche témoin exige exactement 2 témoins configurés.");
    if (nv === "closed" && !confirm("Clore le quiz ? Le podium et la correction seront révélés (irréversible).")) return;
    setState(nv);
    await setParam("quiz_state", nv);
    setMsg(`État : ${nv}.`);
  }
  async function sauverReglages() {
    await Promise.all([
      setParam("quiz_teaser", teaser),
      setParam("quiz_reveal_at", revealAt ? new Date(revealAt).toISOString() : null),
      setParam("quiz_close_at", closeAt ? new Date(closeAt).toISOString() : null),
      setParam("witness_reveal_answers", reveal),
    ]);
    setMsg("Réglages enregistrés.");
  }
  function toggleTemoin(id) {
    setWitnesses((w) => (w.includes(id) ? w.filter((x) => x !== id) : w.length < 2 ? [...w, id] : w));
  }
  async function sauverTemoins() {
    await setParam("quiz_witnesses", witnesses);
    setMsg("Témoins enregistrés.");
  }

  async function sauverQuestion(q) {
    const row = { round: q.round, position: Number(q.position), body: q.body, choices: q.choices, correct_key: q.correct_key, time_limit_s: Number(q.time_limit_s), points: Number(q.points) };
    if (q.id) await supabase.from("quiz_questions").update(row).eq("id", q.id);
    else await supabase.from("quiz_questions").insert(row);
    setEdit(null);
    charger();
  }
  async function supprimerQuestion(id) {
    await supabase.from("quiz_questions").delete().eq("id", id);
    charger();
  }

  return (
    <div className="admin-bloc">
      <h2 className="admin-h2">Quiz des Mariés</h2>

      <div className="quiz-adm-etat">
        <span>État : <strong>{state}</strong></span>
        <div className="pp-actions" style={{ marginTop: 0 }}>
          <button className={"btn-ghost" + (state === "hidden" ? " on" : "")} style={btn} onClick={() => changerEtat("hidden")}>Teaser</button>
          <button className="btn-vert" style={{ margin: 0, width: "auto", padding: "0.5rem 1rem" }} onClick={() => changerEtat("open")}>Ouvrir</button>
          <button className="btn-ghost" style={btn} onClick={() => changerEtat("closed")}>Clore</button>
        </div>
      </div>
      {msg && <p className="pp-msg">{msg}</p>}

      <label className="pp-label">Teaser (surprise — jamais « cadeau »)</label>
      <input value={teaser} onChange={(e) => setTeaser(e.target.value)} style={inp} />
      <div className="duo" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <label className="pp-label" style={{ flex: 1 }}>Ouverture auto<input type="datetime-local" value={revealAt} onChange={(e) => setRevealAt(e.target.value)} style={inp} /></label>
        <label className="pp-label" style={{ flex: 1 }}>Clôture auto<input type="datetime-local" value={closeAt} onChange={(e) => setCloseAt(e.target.value)} style={inp} /></label>
      </div>
      <label className="switch" style={{ marginTop: "0.6rem" }}>
        <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
        <span>Révéler les réponses du duel des témoins</span>
      </label>
      <div><button className="btn-vert" style={{ margin: "0.8rem 0", width: "auto", padding: "0.55rem 1.2rem" }} onClick={sauverReglages}>Enregistrer les réglages</button></div>

      <h3 className="admin-h3">Témoins (exactement 2)</h3>
      <div className="quiz-temoins-liste">
        {invites.map((g) => (
          <label key={g.id} className={"quiz-temoin-choix" + (witnesses.includes(g.id) ? " on" : "")}>
            <input type="checkbox" checked={witnesses.includes(g.id)} onChange={() => toggleTemoin(g.id)} />
            <span>{g.nom}</span>
          </label>
        ))}
      </div>
      <button className="btn-vert" style={{ margin: "0.6rem 0", width: "auto", padding: "0.5rem 1.1rem" }} onClick={sauverTemoins} disabled={witnesses.length !== 2}>
        Enregistrer les témoins ({witnesses.length}/2)
      </button>

      <h3 className="admin-h3">Questions — principale ({nbMain}) · témoins ({nbWitness})</h3>
      {verrou && <p className="pp-hint">Édition verrouillée tant que le quiz est ouvert.</p>}
      {["main", "witness"].map((r) => (
        <div key={r}>
          <p className="pp-label">{r === "main" ? "Manche principale" : "Duel des témoins"}</p>
          {questions.filter((q) => q.round === r).map((q) => (
            <div key={q.id} className="quiz-q-ligne">
              <span><strong>{q.position}.</strong> {q.body}</span>
              {!verrou && (
                <span className="quiz-q-actions">
                  <button className="btn-lien" onClick={() => setEdit(q)}>Éditer</button>
                  <button className="btn-lien" onClick={() => supprimerQuestion(q.id)}>Suppr.</button>
                </span>
              )}
            </div>
          ))}
          {!verrou && (
            <button className="btn-lien" onClick={() => setEdit({ ...vide(), round: r, position: (r === "main" ? nbMain : nbWitness) + 1 })}>+ Ajouter une question</button>
          )}
        </div>
      ))}

      {edit && <EditeurQuestion q={edit} onClose={() => setEdit(null)} onSave={sauverQuestion} />}
    </div>
  );
}

const btn = { color: "var(--encre)", borderColor: "var(--ligne)", width: "auto", margin: 0, padding: "0.5rem 1rem" };
const inp = { width: "100%", padding: "0.55rem 0.7rem", border: "1px solid var(--ligne)", borderRadius: 8, font: "inherit", marginTop: 4 };

function EditeurQuestion({ q, onClose, onSave }) {
  const [f, setF] = useState(q);
  const majChoix = (i, label) => setF((s) => ({ ...s, choices: s.choices.map((c, j) => (j === i ? { ...c, label } : c)) }));
  return (
    <div className="modal-fond" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="admin-h3">Question ({f.round})</h3>
        <label className="pp-label">Énoncé</label>
        <input value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} style={inp} />
        <div className="duo" style={{ display: "flex", gap: "1rem" }}>
          <label className="pp-label" style={{ flex: 1 }}>Position<input type="number" min="1" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} style={inp} /></label>
          <label className="pp-label" style={{ flex: 1 }}>Temps (s)<input type="number" min="5" max="90" value={f.time_limit_s} onChange={(e) => setF({ ...f, time_limit_s: e.target.value })} style={inp} /></label>
          <label className="pp-label" style={{ flex: 1 }}>Points<input type="number" min="1" value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} style={inp} /></label>
        </div>
        <label className="pp-label">Choix (coche la bonne réponse)</label>
        {f.choices.map((c, i) => (
          <div key={c.key} style={{ display: "flex", gap: "0.6rem", alignItems: "center", marginBottom: 4 }}>
            <input type="radio" name="ck" checked={f.correct_key === c.key} onChange={() => setF({ ...f, correct_key: c.key })} />
            <span style={{ textTransform: "uppercase", color: "var(--sauge)" }}>{c.key}</span>
            <input value={c.label} onChange={(e) => majChoix(i, e.target.value)} style={{ ...inp, marginTop: 0 }} />
          </div>
        ))}
        <div className="pp-actions">
          <button className="btn-ghost" style={btn} onClick={onClose}>Annuler</button>
          <button className="btn-vert" style={{ margin: 0, width: "auto", padding: "0.55rem 1.3rem" }} onClick={() => onSave(f)} disabled={!f.body.trim() || f.choices.some((c) => !c.label.trim())}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

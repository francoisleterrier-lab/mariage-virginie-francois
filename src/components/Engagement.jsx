import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   Admin — Suivi d'engagement : qui a répondu / joué / proposé, qui est
   abonné aux notifications, et relance personnelle par notification.
   ============================================================ */
export default function Engagement({ invites }) {
  const [quiz, setQuiz] = useState(new Set());
  const [chansons, setChansons] = useState(new Set());
  const [abonnes, setAbonnes] = useState(new Set());
  const [aRelancer, setARelancer] = useState(false);
  const [cible, setCible] = useState(null); // invité en cours de relance
  const [texte, setTexte] = useState("");
  const [msg, setMsg] = useState("");

  const charger = useCallback(async () => {
    const [{ data: qa }, { data: ch }, { data: ab }] = await Promise.all([
      supabase.from("quiz_attempts").select("invite_id, round, finished_at"),
      supabase.from("chansons").select("invite_id"),
      supabase.rpc("abonnes_ids"),
    ]);
    setQuiz(new Set((qa || []).filter((a) => a.round === "main" && a.finished_at).map((a) => a.invite_id)));
    setChansons(new Set((ch || []).map((c) => c.invite_id)));
    setAbonnes(new Set(Array.isArray(ab) ? ab : []));
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const lignes = useMemo(() => {
    return invites
      .map((g) => {
        const rsvp = !!g.rsvp;
        const present = rsvp && !String(g.rsvp.presence || "").startsWith("Hélas");
        return {
          id: g.id,
          nom: g.nom,
          rsvp,
          present,
          quiz: quiz.has(g.id),
          chanson: chansons.has(g.id),
          abonne: abonnes.has(g.id),
        };
      })
      .filter((l) => !aRelancer || !(l.rsvp && l.quiz && l.chanson))
      .sort((a, b) => (a.rsvp + a.quiz + a.chanson) - (b.rsvp + b.quiz + b.chanson) || a.nom.localeCompare(b.nom));
  }, [invites, quiz, chansons, abonnes, aRelancer]);

  async function relancer(l) {
    if (!texte.trim()) return;
    setMsg("");
    const { data, error } = await supabase.functions.invoke("relance-invite", {
      body: { invite_id: l.id, titre: "🌿 Virginie & François", message: texte.trim() },
    });
    if (error) setMsg("Envoi impossible (fonction non déployée ?).");
    else setMsg(data.envoyes > 0 ? `Notification envoyée à ${l.nom}.` : `${l.nom} n'a pas activé les notifications.`);
    setCible(null);
    setTexte("");
  }

  const oui = (b) => (b ? "✅" : "—");

  return (
    <div className="admin-bloc">
      <h2 className="admin-h2">Suivi d'engagement</h2>
      <p className="admin-sous">
        Qui a répondu, joué au quiz, proposé une chanson, et qui est abonné aux notifications. Relance
        personnelle par notification (l'invité doit avoir activé les notifications 🔔).
      </p>
      <label className="switch" style={{ marginBottom: "0.8rem" }}>
        <input type="checkbox" checked={aRelancer} onChange={(e) => setARelancer(e.target.checked)} />
        <span>Afficher seulement ceux à relancer</span>
      </label>
      {msg && <p className="pp-msg">{msg}</p>}

      <div className="admin-table-wrap">
        <table className="eng-table">
          <thead>
            <tr>
              <th>Invité·e</th>
              <th>RSVP</th>
              <th>Quiz</th>
              <th>Bande-son</th>
              <th>🔔</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id}>
                <td>{l.nom}</td>
                <td>{l.rsvp ? (l.present ? "✅" : "🚫") : "—"}</td>
                <td>{oui(l.quiz)}</td>
                <td>{oui(l.chanson)}</td>
                <td>{l.abonne ? "🔔" : "🔕"}</td>
                <td>
                  {cible === l.id ? (
                    <span className="eng-relance">
                      <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Votre message…" autoFocus />
                      <button className="btn-vert" style={{ margin: 0, width: "auto", padding: "0.4rem 0.9rem" }} onClick={() => relancer(l)}>
                        Envoyer
                      </button>
                      <button className="btn-lien" onClick={() => setCible(null)}>Annuler</button>
                    </span>
                  ) : (
                    <button className="btn-editer" disabled={!l.abonne} title={l.abonne ? "" : "Non abonné aux notifications"} onClick={() => { setCible(l.id); setTexte(""); }}>
                      Relancer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

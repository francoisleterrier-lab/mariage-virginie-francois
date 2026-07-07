import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import { usePhase } from "../lib/phase.jsx";

/* ============================================================
   « La bande-son fantôme » côté invité.
   - Avant : formulaire (titre, artiste, lien, souvenir + consentements),
     quota (2), liste « Mes propositions » (état « Reçue 🌿 » / « Jouée ✨ »
     — jamais le statut de modération, lu via la vue mes_chansons).
   - Fermé (bandeson_ouverte = false) : message de scellement.
   - Phase souvenir : mur de la bande-son (RPC mur_bande_son).
   ============================================================ */
export default function BandeSon({ profile }) {
  const { phase } = usePhase();
  const estSouvenir = phase === "souvenir";

  const [mes, setMes] = useState([]);
  const [ouverte, setOuverte] = useState(true);
  const [aVenir, setAVenir] = useState(true);
  const [max, setMax] = useState(2);
  const [mur, setMur] = useState([]);
  const [f, setF] = useState({ titre: "", artiste: "", lien: "", souvenir: "", partage_jour_j: true, partage_apres: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const charger = useCallback(async () => {
    const [{ data: chansons }, { data: params }] = await Promise.all([
      supabase.from("mes_chansons").select("*").order("created_at", { ascending: true }),
      supabase.from("parametres").select("cle, valeur").in("cle", ["bandeson_ouverte", "bandeson_max", "bandeson_a_venir"]),
    ]);
    setMes(chansons || []);
    const p = Object.fromEntries((params || []).map((r) => [r.cle, r.valeur]));
    setOuverte(p.bandeson_ouverte !== false);
    setAVenir(p.bandeson_a_venir !== false);
    if (p.bandeson_max != null) setMax(Number(p.bandeson_max) || 2);
    if (estSouvenir) {
      const { data } = await supabase.rpc("mur_bande_son");
      setMur(Array.isArray(data) ? data : []);
    }
  }, [estSouvenir]);

  useEffect(() => {
    charger();
  }, [charger]);

  const restant = Math.max(0, max - mes.length);

  async function envoyer(e) {
    e.preventDefault();
    setErr("");
    if (f.souvenir.trim().length < 10) return setErr("Le souvenir doit faire au moins 10 caractères.");
    if (f.lien && !/^https:\/\//i.test(f.lien.trim())) return setErr("Le lien doit commencer par https://");
    setBusy(true);
    const { error } = await supabase.from("chansons").insert({
      invite_id: profile.id,
      titre: f.titre.trim(),
      artiste: f.artiste.trim(),
      souvenir: f.souvenir.trim(),
      lien: f.lien.trim() || null,
      partage_jour_j: f.partage_jour_j,
      partage_apres: f.partage_apres,
    });
    setBusy(false);
    if (error) return setErr("Oups, réessayez dans un instant.");
    setF({ titre: "", artiste: "", lien: "", souvenir: "", partage_jour_j: true, partage_apres: true });
    charger();
  }

  async function supprimer(id) {
    await supabase.from("chansons").delete().eq("id", id);
    charger();
  }

  /* ---------- Mur souvenir (après le mariage) ---------- */
  if (estSouvenir) {
    const joues = mur.filter((m) => m.joue);
    const autres = mur.filter((m) => !m.joue);
    return (
      <section className="bandeson" id="bandeson">
        <div className="wrap center reveal">
          <p className="eyebrow">La bande-son</p>
          <h2>
            Le livre d'or <em>sonore</em>
          </h2>
          <p>La soirée rejouée dans l'ordre, avec vos souvenirs.</p>
          <div className="bs-mur">
            {joues.map((m, i) => (
              <div key={i} className="bs-item">
                <div className="bs-titre">
                  {m.lien ? (
                    <a href={m.lien} target="_blank" rel="noopener noreferrer">
                      {m.titre}
                    </a>
                  ) : (
                    m.titre
                  )}
                  <span className="bs-artiste"> — {m.artiste}</span>
                </div>
                {m.souvenir && <p className="bs-souvenir">« {m.souvenir} »</p>}
                <p className="bs-auteur">proposée par {m.prenom}</p>
              </div>
            ))}
          </div>
          {autres.length > 0 && (
            <div className="bs-autres">
              <h3 className="admin-h3">Celles qu'on n'a pas eu le temps de danser</h3>
              <p>
                {autres.map((m, i) => (
                  <span key={i}>
                    {m.titre} — {m.artiste}
                    {i < autres.length - 1 ? " · " : ""}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  /* ---------- « À venir » : teaser, pas encore de collecte ---------- */
  if (aVenir) {
    return (
      <section className="bandeson" id="bandeson">
        <div className="wrap center reveal">
          <p className="eyebrow">La bande-son</p>
          <h2>
            Bientôt : <em>votre bande-son</em>
          </h2>
          <p className="bs-pitch">
            Très vite, vous pourrez proposer les chansons qui doivent absolument passer le jour J — et le souvenir
            qui va avec. Revenez nous voir. 🎶
          </p>
        </div>
      </section>
    );
  }

  /* ---------- Avant le mariage ---------- */
  return (
    <section className="bandeson" id="bandeson">
      <div className="wrap center reveal">
        <p className="eyebrow">La bande-son</p>
        <h2>
          Quelle chanson doit <em>absolument</em> passer ?
        </h2>
        <p className="bs-pitch">Racontez-nous pourquoi. Le jour J, elle vous répondra…</p>

        {ouverte ? (
          restant > 0 ? (
            <form className="bs-form" onSubmit={envoyer}>
              <div className="duo">
                <div>
                  <label htmlFor="bs-t">Titre</label>
                  <input id="bs-t" required maxLength={120} value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="bs-a">Artiste</label>
                  <input id="bs-a" required maxLength={120} value={f.artiste} onChange={(e) => setF({ ...f, artiste: e.target.value })} />
                </div>
              </div>
              <label htmlFor="bs-l">Lien d'écoute (facultatif)</label>
              <input id="bs-l" type="url" placeholder="https://…" value={f.lien} onChange={(e) => setF({ ...f, lien: e.target.value })} />
              <label htmlFor="bs-s">Le souvenir lié à cette chanson</label>
              <textarea
                id="bs-s"
                required
                minLength={10}
                maxLength={500}
                rows={3}
                placeholder="Celle qu'on hurlait dans la voiture en 2015…"
                value={f.souvenir}
                onChange={(e) => setF({ ...f, souvenir: e.target.value })}
              />
              <div className="bs-consent">
                <label className="switch">
                  <input type="checkbox" checked={f.partage_jour_j} onChange={(e) => setF({ ...f, partage_jour_j: e.target.checked })} />
                  <span>Ce souvenir peut être lu à voix haute le jour J</span>
                </label>
                <label className="switch">
                  <input type="checkbox" checked={f.partage_apres} onChange={(e) => setF({ ...f, partage_apres: e.target.checked })} />
                  <span>Il peut apparaître dans le livre d'or sonore après le mariage</span>
                </label>
              </div>
              {err && <p className="gate-err" style={{ color: "#b3541e" }}>{err}</p>}
              <button className="btn-vert" disabled={busy}>
                {busy ? "Envoi…" : "Proposer cette chanson"}
              </button>
              <p className="deadline">Il vous reste {restant} chanson{restant > 1 ? "s" : ""}.</p>
            </form>
          ) : (
            <p className="bs-quota">Vous avez proposé vos {max} chansons — merci ! 🎶</p>
          )
        ) : (
          <p className="bs-scelle">La bande-son est scellée. Rendez-vous sur le dancefloor. 🌙</p>
        )}

        {mes.length > 0 && (
          <div className="bs-mes">
            <h3 className="admin-h3">Mes propositions</h3>
            {mes.map((c) => (
              <div key={c.id} className="bs-item">
                <div className="bs-titre">
                  {c.titre}
                  <span className="bs-artiste"> — {c.artiste}</span>
                  <span className={"bs-etat" + (c.joue ? " joue" : "")}>{c.joue ? "Jouée ✨" : "Reçue 🌿"}</span>
                </div>
                <p className="bs-souvenir">« {c.souvenir} »</p>
                {!c.joue && (
                  <button className="btn-lien" onClick={() => supprimer(c.id)}>
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

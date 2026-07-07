import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   Admin — « Le site qui vit » : éditeur des paliers.
   Modifier dates / teintes / citations sans redéploiement, activer les
   push de palier, et vider le cache d'aperçu local (24 h).
   ============================================================ */
const ACCENTS = ["deep-green", "sage", "ivory", "gold"];
const CACHE_KEY = "vf-phases-v1";
const fmtJour = (iso) => (iso || "").slice(0, 10);

function phaseCourante(phases) {
  const auj = new Date();
  auj.setHours(0, 0, 0, 0);
  let c = null;
  for (const p of phases) {
    const d = new Date(p.starts_at + "T00:00:00");
    if (d <= auj && (!c || d >= new Date(c.starts_at + "T00:00:00"))) c = p;
  }
  return c?.id;
}

export default function PhasesEditor() {
  const [phases, setPhases] = useState([]);
  const [pushOn, setPushOn] = useState(false);
  const [okId, setOkId] = useState(null);

  const charger = useCallback(async () => {
    const [{ data: ph }, { data: params }] = await Promise.all([
      supabase.from("site_phases").select("*").order("ordre", { ascending: true }),
      supabase.from("parametres").select("cle, valeur").in("cle", ["phase_push_enabled"]),
    ]);
    setPhases(ph || []);
    const p = Object.fromEntries((params || []).map((r) => [r.cle, r.valeur]));
    setPushOn(p.phase_push_enabled === true);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  function maj(id, champ, val) {
    setPhases((ps) => ps.map((p) => (p.id === id ? { ...p, [champ]: val } : p)));
  }

  async function enregistrer(p) {
    await supabase
      .from("site_phases")
      .update({
        starts_at: p.starts_at,
        accent_token: p.accent_token,
        decoration_level: Number(p.decoration_level) || 0,
        quote: p.quote,
        quote_author: p.quote_author || null,
      })
      .eq("id", p.id);
    setOkId(p.id);
    setTimeout(() => setOkId((v) => (v === p.id ? null : v)), 1800);
  }

  async function togglePush() {
    const nv = !pushOn;
    setPushOn(nv);
    await supabase.from("parametres").upsert({ cle: "phase_push_enabled", valeur: nv });
  }

  function viderCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  }

  const courante = phaseCourante(phases);

  return (
    <div className="admin-bloc">
      <div className="plan-head">
        <h2 className="admin-h2">Le site qui vit — paliers</h2>
        <div className="plan-switches">
          <label className="switch">
            <input type="checkbox" checked={pushOn} onChange={togglePush} />
            <span>Notifications de palier</span>
          </label>
        </div>
      </div>
      <p className="admin-sous">
        Chaque palier applique une teinte, un niveau de décor botanique et une citation. La phase active est mise en
        évidence. Les modifications s'appliquent au site après expiration du cache (24 h) — utilise « Vider le cache »
        pour voir tout de suite. Aperçu d'un palier : ajoute <code>?phase=floraison</code> à l'URL du site.
      </p>
      <button className="btn-ghost" style={{ maxWidth: 260, color: "var(--encre)", borderColor: "var(--ligne)" }} onClick={viderCache}>
        Vider le cache d'aperçu
      </button>

      <div className="phases-liste">
        {phases.map((p) => (
          <div key={p.id} className={"phase-carte" + (p.id === courante ? " phase-active" : "")}>
            <div className="phase-tete">
              <strong>{p.id}</strong>
              {p.id === courante && <em className="phase-badge">phase active</em>}
            </div>
            <div className="phase-champs">
              <label>
                <span>Entrée le</span>
                <input type="date" value={fmtJour(p.starts_at)} onChange={(e) => maj(p.id, "starts_at", e.target.value)} />
              </label>
              <label>
                <span>Teinte</span>
                <select value={p.accent_token} onChange={(e) => maj(p.id, "accent_token", e.target.value)}>
                  {ACCENTS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Décor (0–6)</span>
                <input type="number" min="0" max="6" value={p.decoration_level} onChange={(e) => maj(p.id, "decoration_level", e.target.value)} />
              </label>
            </div>
            <label className="phase-quote">
              <span>Citation</span>
              <textarea rows={2} value={p.quote || ""} onChange={(e) => maj(p.id, "quote", e.target.value)} />
            </label>
            <label className="phase-quote">
              <span>Auteur (facultatif)</span>
              <input value={p.quote_author || ""} onChange={(e) => maj(p.id, "quote_author", e.target.value)} />
            </label>
            <div className="phase-actions">
              <button className="btn-vert" style={{ margin: 0, width: "auto", padding: "0.55rem 1.2rem" }} onClick={() => enregistrer(p)}>
                Enregistrer
              </button>
              {okId === p.id && <span className="ok">🌿 Enregistré</span>}
            </div>
          </div>
        ))}
        {phases.length === 0 && <p className="attente">Aucun palier chargé.</p>}
      </div>
    </div>
  );
}

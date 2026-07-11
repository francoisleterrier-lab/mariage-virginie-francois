import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* Admin — « Défis photo ». Une liste de défis (un par ligne) + une bascule
   d'affichage. Les invités relèvent chaque défi en photo. */
export default function DefisEditor() {
  const [active, setActive] = useState(false);
  const [texte, setTexte] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase.from("parametres").select("cle, valeur").in("cle", ["defis_active", "defis_liste"]);
    const p = Object.fromEntries((data || []).map((r) => [r.cle, r.valeur]));
    setActive(p.defis_active === true);
    if (Array.isArray(p.defis_liste)) setTexte(p.defis_liste.join("\n"));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  async function toggleActive() {
    const nv = !active;
    setActive(nv);
    await supabase.from("parametres").upsert({ cle: "defis_active", valeur: nv });
  }

  async function enregistrer() {
    setBusy(true);
    const liste = texte.split("\n").map((s) => s.trim()).filter(Boolean);
    await supabase.from("parametres").upsert({ cle: "defis_liste", valeur: liste });
    setBusy(false);
    setOk(true);
    setTimeout(() => setOk(false), 1600);
  }

  const n = texte.split("\n").map((s) => s.trim()).filter(Boolean).length;

  return (
    <div className="admin-bloc">
      <div className="plan-head">
        <h2 className="admin-h2">Défis photo 📸</h2>
        <div className="plan-switches">
          <label className="switch">
            <input type="checkbox" checked={active} onChange={toggleActive} />
            <span>Afficher les défis</span>
          </label>
        </div>
      </div>
      <p className="admin-sous">
        Un défi par ligne (ex. « une photo avec les mariés », « un selfie à 5 », « la plus belle danse »). Les invités
        les relèvent en photo pendant la fête — {n} défi{n > 1 ? "s" : ""} pour l'instant.
      </p>
      <div className="lieu-champs">
        <label>
          <span>Vos défis (un par ligne)</span>
          <textarea rows={6} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={"une photo avec les mariés\nun selfie à 5\nla plus belle danse\nun trinquons ensemble"} />
        </label>
      </div>
      <div className="phase-actions">
        <button className="btn-vert" style={{ margin: 0, width: "auto", padding: "0.55rem 1.2rem" }} disabled={busy} onClick={enregistrer}>
          {busy ? "…" : "Enregistrer"}
        </button>
        {ok && <span className="ok">🌿 Enregistré</span>}
      </div>
    </div>
  );
}

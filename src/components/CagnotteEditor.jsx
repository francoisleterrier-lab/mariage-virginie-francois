import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   Admin — « La cagnotte ».
   Objectif + montant déjà collecté (mis à jour à la main) + lien externe
   de participation (Leetchi, Lydia, PayPal, RIB…). Une bascule affiche ou
   masque la section pour les invités.
   ============================================================ */

export default function CagnotteEditor() {
  const [active, setActive] = useState(false);
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [objectif, setObjectif] = useState("");
  const [montant, setMontant] = useState("");
  const [lien, setLien] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("parametres")
      .select("cle, valeur")
      .in("cle", ["cagnotte_active", "cagnotte_titre", "cagnotte_texte", "cagnotte_objectif", "cagnotte_montant", "cagnotte_lien"]);
    const p = Object.fromEntries((data || []).map((r) => [r.cle, r.valeur]));
    setActive(p.cagnotte_active === true);
    if (typeof p.cagnotte_titre === "string") setTitre(p.cagnotte_titre);
    if (typeof p.cagnotte_texte === "string") setTexte(p.cagnotte_texte);
    if (p.cagnotte_objectif != null) setObjectif(String(p.cagnotte_objectif));
    if (p.cagnotte_montant != null) setMontant(String(p.cagnotte_montant));
    if (typeof p.cagnotte_lien === "string") setLien(p.cagnotte_lien);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function toggleActive() {
    const nv = !active;
    setActive(nv);
    await supabase.from("parametres").upsert({ cle: "cagnotte_active", valeur: nv });
  }

  async function enregistrer() {
    setBusy(true);
    await Promise.all([
      supabase.from("parametres").upsert({ cle: "cagnotte_titre", valeur: titre.trim() }),
      supabase.from("parametres").upsert({ cle: "cagnotte_texte", valeur: texte.trim() }),
      supabase.from("parametres").upsert({ cle: "cagnotte_objectif", valeur: Number(objectif) || 0 }),
      supabase.from("parametres").upsert({ cle: "cagnotte_montant", valeur: Number(montant) || 0 }),
      supabase.from("parametres").upsert({ cle: "cagnotte_lien", valeur: lien.trim() }),
    ]);
    setBusy(false);
    setOk(true);
    setTimeout(() => setOk(false), 1800);
  }

  const obj = Number(objectif) || 0;
  const col = Number(montant) || 0;
  const pct = obj > 0 ? Math.min(100, Math.round((col / obj) * 100)) : 0;

  return (
    <div className="admin-bloc">
      <div className="plan-head">
        <h2 className="admin-h2">La cagnotte — fonds commun</h2>
        <div className="plan-switches">
          <label className="switch">
            <input type="checkbox" checked={active} onChange={toggleActive} />
            <span>Afficher la cagnotte aux invités</span>
          </label>
        </div>
      </div>
      <p className="admin-sous">
        Une cagnotte avec objectif, barre de progression et petits mots des invités. La participation se fait via
        votre <strong>lien externe</strong> (Leetchi, Lydia, PayPal, RIB…). Le montant <strong>« déjà collecté »</strong>{" "}
        se met à jour à la main, quand vous voulez.
      </p>

      <div className="lieu-champs">
        <label>
          <span>Titre (facultatif)</span>
          <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="ex. Notre voyage de noces" />
        </label>
        <label>
          <span>Petit texte (facultatif)</span>
          <textarea rows={2} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Plutôt que des cadeaux, offrez-nous un souvenir de voyage…" />
        </label>
        <label>
          <span>Objectif (€, facultatif — vide = pas de barre)</span>
          <input type="number" min="0" value={objectif} onChange={(e) => setObjectif(e.target.value)} placeholder="3000" />
        </label>
        <label>
          <span>Déjà collecté (€)</span>
          <input type="number" min="0" value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0" />
          {obj > 0 && <small className="lieu-hint">Aperçu de la barre : {pct}% ({col} € / {obj} €).</small>}
        </label>
        <label>
          <span>Lien de participation (Leetchi, Lydia, PayPal, RIB…)</span>
          <input value={lien} onChange={(e) => setLien(e.target.value)} placeholder="https://www.leetchi.com/c/…" />
          <small className="lieu-hint">
            {lien.trim() === "" ? "Vide → le bouton « Participer » n'apparaît pas." : "Le bouton « Participer » ouvrira ce lien dans un nouvel onglet."}
          </small>
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

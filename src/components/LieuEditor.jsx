import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   Admin — « Le lieu ».
   Prépare à l'avance le domaine annoncé : lien Google Maps, coordonnées
   Waze, titre/texte, et une bascule pour révéler le lieu aux invités le
   moment venu. Tant que « révélé » est décoché, les invités voient la
   carte « à venir » (secret).
   ============================================================ */
const MAPS_DEFAUT =
  "https://maps.google.com/maps/place//data=!4m2!3m1!1s0x12aecb05d1c2e921:0x218fe3f7739b5e92?entry=s&hl=fr";

export default function LieuEditor() {
  const [revele, setRevele] = useState(false);
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [mapsUrl, setMapsUrl] = useState(MAPS_DEFAUT);
  const [waze, setWaze] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("parametres")
      .select("cle, valeur")
      .in("cle", ["lieu_revele", "lieu_titre", "lieu_texte", "lieu_maps_url", "lieu_waze"]);
    const p = Object.fromEntries((data || []).map((r) => [r.cle, r.valeur]));
    setRevele(p.lieu_revele === true);
    if (typeof p.lieu_titre === "string") setTitre(p.lieu_titre);
    if (typeof p.lieu_texte === "string") setTexte(p.lieu_texte);
    if (typeof p.lieu_maps_url === "string" && p.lieu_maps_url.trim()) setMapsUrl(p.lieu_maps_url.trim());
    if (typeof p.lieu_waze === "string") setWaze(p.lieu_waze);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function toggleRevele() {
    const nv = !revele;
    setRevele(nv);
    await supabase.from("parametres").upsert({ cle: "lieu_revele", valeur: nv });
  }

  async function enregistrer() {
    setBusy(true);
    await Promise.all([
      supabase.from("parametres").upsert({ cle: "lieu_titre", valeur: titre.trim() }),
      supabase.from("parametres").upsert({ cle: "lieu_texte", valeur: texte.trim() }),
      supabase.from("parametres").upsert({ cle: "lieu_maps_url", valeur: mapsUrl.trim() || MAPS_DEFAUT }),
      supabase.from("parametres").upsert({ cle: "lieu_waze", valeur: waze.trim() }),
    ]);
    setBusy(false);
    setOk(true);
    setTimeout(() => setOk(false), 1800);
  }

  const wazeCoords = /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(waze);

  return (
    <div className="admin-bloc">
      <div className="plan-head">
        <h2 className="admin-h2">Le lieu — préparer l'annonce du domaine</h2>
        <div className="plan-switches">
          <label className="switch">
            <input type="checkbox" checked={revele} onChange={toggleRevele} />
            <span>Révéler le lieu aux invités</span>
          </label>
        </div>
      </div>
      <p className="admin-sous">
        Tant que « Révéler » est décoché, les invités voient la carte <strong>« à venir »</strong> (secret). Une fois
        coché, la section affiche le domaine annoncé (sans photo) avec un bouton <strong>« Nous rejoindre »</strong> qui
        propose d'ouvrir l'itinéraire dans <strong>Google Maps</strong> ou <strong>Waze</strong>.
      </p>

      <div className="lieu-champs">
        <label>
          <span>Titre (facultatif)</span>
          <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="ex. Le Domaine des Oliviers" />
        </label>
        <label>
          <span>Petit texte (facultatif)</span>
          <textarea rows={2} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Voici enfin l'écrin qui nous accueillera…" />
        </label>
        <label>
          <span>Lien Google Maps</span>
          <input value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.google.com/…" />
        </label>
        <label>
          <span>Waze — coordonnées GPS « lat,lng » (ou adresse)</span>
          <input value={waze} onChange={(e) => setWaze(e.target.value)} placeholder="ex. 43.4123, 1.1876" />
          <small className="lieu-hint">
            {waze.trim() === ""
              ? "Vide → le bouton Waze n'apparaît pas (seul Google Maps est proposé)."
              : wazeCoords
              ? "✅ Coordonnées détectées — Waze naviguera précisément."
              : "ℹ️ Traité comme une adresse (Waze la recherchera). Des coordonnées « lat,lng » sont plus précises."}
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

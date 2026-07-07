import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   « Le lieu » côté invité.
   - Tant que lieu_revele = false → carte « à venir » (secret).
   - Une fois révélé (admin) → le domaine est annoncé : pas de photo,
     un bouton « Nous rejoindre » qui propose d'ouvrir l'itinéraire
     dans Google Maps ou dans Waze.
   Paramètres (table parametres) :
     lieu_revele (bool), lieu_titre, lieu_texte, lieu_maps_url, lieu_waze.
   ============================================================ */

// Lien Google Maps du domaine (fourni par les mariés) — utilisé par défaut.
const MAPS_DEFAUT =
  "https://maps.google.com/maps/place//data=!4m2!3m1!1s0x12aecb05d1c2e921:0x218fe3f7739b5e92?entry=s&hl=fr";

/* Construit un lien Waze depuis des coordonnées « lat,lng » ou une adresse. */
function lienWaze(valeur) {
  const v = (valeur || "").trim();
  if (!v) return null;
  const coords = v.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coords) return `https://waze.com/ul?ll=${coords[1]},${coords[2]}&navigate=yes`;
  return `https://waze.com/ul?q=${encodeURIComponent(v)}&navigate=yes`;
}

export default function Lieu() {
  const [prets, setPrets] = useState(false);
  const [revele, setRevele] = useState(false);
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [mapsUrl, setMapsUrl] = useState(MAPS_DEFAUT);
  const [waze, setWaze] = useState("");
  const [secret, setSecret] = useState(false); // carte « à venir » dépliée
  const [choix, setChoix] = useState(false); // chooser Waze / Maps

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
    setPrets(true);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  if (!prets) return null;

  /* ---------- Domaine annoncé ---------- */
  if (revele) {
    const wazeUrl = lienWaze(waze);
    return (
      <section className="mystere lieu-revele" id="lieu">
        <div className="wrap center reveal">
          <p className="eyebrow">Le lieu</p>
          <h2>{titre ? titre : <>Le <em>domaine</em></>}</h2>
          <p>{texte || "Voici enfin l'écrin qui nous accueillera. On vous y attend — le chemin est juste en dessous."}</p>

          <div className="lieu-rejoindre">
            {!choix ? (
              <button className="btn-vert lieu-cta" onClick={() => setChoix(true)}>
                Nous rejoindre
              </button>
            ) : (
              <div className="lieu-nav" role="group" aria-label="Ouvrir l'itinéraire">
                <p className="lieu-nav-titre">Ouvrir l'itinéraire dans…</p>
                <div className="lieu-nav-btns">
                  <a className="lieu-nav-btn" href={mapsUrl} target="_blank" rel="noopener noreferrer">
                    <span aria-hidden="true">📍</span> Google Maps
                  </a>
                  {wazeUrl && (
                    <a className="lieu-nav-btn" href={wazeUrl} target="_blank" rel="noopener noreferrer">
                      <span aria-hidden="true">🚗</span> Waze
                    </a>
                  )}
                </div>
                <button className="btn-lien" onClick={() => setChoix(false)}>
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  /* ---------- « À venir » : le lieu reste secret ---------- */
  return (
    <section className="mystere" id="lieu">
      <div className="wrap center reveal">
        <p className="eyebrow">À venir · Le lieu</p>
        <span className="pill-avenir">À venir</span>
        <h2>
          Chut… c'est encore <em>un secret</em>
        </h2>
        <p>
          Nous avons trouvé un écrin de verdure confidentiel, à quelques minutes de Toulouse.
          <br />
          Son nom et son adresse vous seront dévoilés quelques semaines avant le grand jour.
        </p>
        <div
          className={"carte-secrete" + (secret ? " ouverte" : "")}
          role="button"
          tabIndex={0}
          aria-expanded={secret}
          aria-label="Un indice sur le lieu — cliquer pour un teaser"
          onClick={() => setSecret((s) => !s)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSecret((s) => !s);
            }
          }}
        >
          <div className="q">?</div>
          <div className="flou" aria-hidden="true">
            Le ··· des ······
          </div>
          <p className="indice">Un domaine caché dans la campagne du Sud-Toulousain — cliquez, si vous osez.</p>
          <div className="reponse">Patience… 🌿 Un indice se glissera ici au fil des saisons. Revenez nous voir !</div>
        </div>
      </div>
    </section>
  );
}

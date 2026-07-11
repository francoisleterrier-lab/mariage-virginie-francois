import { useEffect, useMemo, useState } from "react";
import { sb } from "./supabaseFpv.js";

/* Élément interactif « Constellation » : chaque invité confirmé devient une
   étoile ; les étoiles se relient en une constellation qui grandit.
   Données via la même RPC fpv_arbre(slug) (rang + prénom des confirmés). */

// Positions déterministes (seedées) dans le cadre, stables d'un chargement à l'autre.
const POINTS = (() => {
  const n = 80;
  let g = 20260527;
  const rnd = () => ((g = (g * 1103515245 + 12345) % 2147483648), g / 2147483648);
  const pts = [];
  for (let i = 0; i < n; i++) {
    pts.push({ x: 8 + rnd() * 84, y: 14 + rnd() * 72, tw: 2.4 + rnd() * 2.6 });
  }
  return pts;
})();

export default function Constellation({ slug }) {
  const [feuilles, setFeuilles] = useState([]);
  const [actif, setActif] = useState(null);

  useEffect(() => {
    let vivant = true;
    const charger = () =>
      sb.rpc("fpv_arbre", { p_slug: slug }).then(({ data }) => {
        if (vivant) setFeuilles(Array.isArray(data) ? data : []);
      });
    charger();
    const onVoir = () => document.visibilityState === "visible" && charger();
    document.addEventListener("visibilitychange", onVoir);
    const id = setInterval(onVoir, 60000);
    return () => {
      vivant = false;
      document.removeEventListener("visibilitychange", onVoir);
      clearInterval(id);
    };
  }, [slug]);

  const nombre = feuilles.length;
  const compteur =
    nombre === 0
      ? "La constellation attend sa première étoile…"
      : nombre === 1
      ? "1 étoile s'est allumée"
      : `${nombre} étoiles se sont allumées`;

  // Points affichés = un par invité confirmé.
  const etoiles = useMemo(
    () => feuilles.map((f, i) => ({ ...f, p: POINTS[i % POINTS.length] })),
    [feuilles]
  );
  const ligne = etoiles.map((e) => `${e.p.x},${e.p.y}`).join(" ");

  return (
    <section className="fpv-sec" id="interactif">
      <h2>Notre constellation</h2>
      <p>Chaque personne qui confirme sa présence allume une étoile. Passez sur l'une d'elles pour découvrir qui nous rejoint.</p>

      <div className="fpv-constel">
        <svg className="fpv-constel-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {etoiles.length > 1 && <polyline points={ligne} className="fpv-constel-line" />}
        </svg>
        <div className="fpv-constel-stars" role="group" aria-label={`Constellation — ${compteur}`}>
          {etoiles.map((e, i) => (
            <button
              key={e.leaf_rank}
              type="button"
              className="fpv-star"
              style={{ left: `${e.p.x}%`, top: `${e.p.y}%`, animationDelay: `${Math.min(i * 45, 2600)}ms`, "--tw": `${e.p.tw}s` }}
              aria-label={e.prenom ? `Étoile de ${e.prenom}` : "Étoile allumée"}
              onMouseEnter={() => e.prenom && setActif(e.leaf_rank)}
              onMouseLeave={() => setActif((a) => (a === e.leaf_rank ? null : a))}
              onClick={() => e.prenom && setActif(actif === e.leaf_rank ? null : e.leaf_rank)}
            >
              <span className="fpv-star-dot" aria-hidden="true" />
              {actif === e.leaf_rank && e.prenom && <span className="fpv-star-tip">{e.prenom}</span>}
            </button>
          ))}
        </div>
      </div>
      <p className="fpv-arbre-compteur" aria-live="polite"><em>{compteur}</em></p>
    </section>
  );
}

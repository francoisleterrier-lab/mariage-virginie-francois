import { useEffect, useMemo, useState } from "react";
import { sb } from "./supabaseFpv.js";
import arbreImg from "../assets/arbre-vie.png";

/* Arbre de vie vivant (produit) : une lumière dorée par invité confirmé,
   nichée dans la ramure. Données via RPC security-definer fpv_arbre(slug)
   → rang + prénom uniquement (aucune donnée privée). */

// Points d'ancrage dans le feuillage (phyllotaxie déterministe + mélange stable).
const ANCRES = (() => {
  const n = 120, cx = 0.5, cy = 0.33, rx = 0.26, ry = 0.2;
  const or = Math.PI * (3 - Math.sqrt(5));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, r = Math.sqrt(t), a = i * or;
    pts.push({ x: cx + Math.cos(a) * r * rx, y: cy + Math.sin(a) * r * ry });
  }
  let g = 987654321;
  const rnd = () => ((g = (g * 1103515245 + 12345) % 2147483648), g / 2147483648);
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  return pts;
})();

export default function ArbreVivant({ slug }) {
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
  const compteur = useMemo(
    () =>
      nombre === 0
        ? "L'arbre attend ses premières lumières…"
        : nombre === 1
        ? "1 lumière s'est allumée"
        : `${nombre} lumières se sont allumées`,
    [nombre]
  );

  const idxActif = actif != null ? feuilles.findIndex((x) => x.leaf_rank === actif) : -1;
  const ancreActif = idxActif >= 0 ? ANCRES[idxActif % ANCRES.length] : null;
  const nomActif = idxActif >= 0 ? feuilles[idxActif]?.prenom : null;

  return (
    <section className="fpv-sec" id="arbre">
      <h2>Notre arbre de vie</h2>
      <p>Chaque personne qui confirme sa présence allume une lumière. Passez sur l'une d'elles pour découvrir qui nous rejoint.</p>

      <div className="fpv-arbre-scene">
        <img className="fpv-arbre-img" src={arbreImg} alt="Arbre de vie" draggable="false" />
        <div className="fpv-arbre-lum" role="group" aria-label={`Arbre de vie — ${compteur}`}>
          {feuilles.map((f, i) => {
            const p = ANCRES[i % ANCRES.length];
            const nom = f.prenom;
            return (
              <button
                key={f.leaf_rank}
                type="button"
                className="fpv-lum"
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, animationDelay: `${Math.min(i * 45, 2600)}ms` }}
                aria-label={nom ? `Lumière de ${nom}` : "Lumière allumée"}
                onMouseEnter={() => nom && setActif(f.leaf_rank)}
                onMouseLeave={() => setActif((a) => (a === f.leaf_rank ? null : a))}
                onClick={() => nom && setActif(actif === f.leaf_rank ? null : f.leaf_rank)}
              >
                <span className="fpv-orbe" aria-hidden="true" />
              </button>
            );
          })}
          {ancreActif && nomActif && (
            <div className="fpv-tip" style={{ left: `${ancreActif.x * 100}%`, top: `${ancreActif.y * 100}%` }}>
              {nomActif}
            </div>
          )}
        </div>
      </div>
      <p className="fpv-arbre-compteur" aria-live="polite"><em>{compteur}</em></p>
    </section>
  );
}

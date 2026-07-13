import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import arbreImg from "../assets/arbre-vie.png";

/* ============================================================
   ARBRE DE VIE VIVANT
   L'arbre de vie (illustration des mariés) s'illumine : chaque personne
   inscrite dépose une petite lumière dorée nichée dans la ramure.
   - données : RPC security-definer `arbre_feuilles` → { leaf_rank, display_name }
     (rang + prénom du foyer uniquement ; jamais e-mail/RSVP).
   - survol/tap d'une lumière → prénom ; l'arbre rayonne d'autant plus
     que le taux de confirmation approche l'objectif (halo doré).
   - rafraîchi au montage, au focus/retour d'onglet et toutes les 60 s.
   ============================================================ */

/* Points d'ancrage des lumières, répartis dans la canopée (ellipse au-dessus
   du tronc), distribution phyllotaxique déterministe puis mélange stable pour
   un remplissage harmonieux. Coordonnées normalisées (0..1) de l'image. */
const ANCRES = (() => {
  const n = 120;
  // Ellipse resserrée sur le feuillage (haut du médaillon) pour que les
  // lumières restent DANS la ramure et ne débordent pas.
  const cx = 0.5;
  const cy = 0.33;
  const rx = 0.26;
  const ry = 0.2;
  const or = Math.PI * (3 - Math.sqrt(5));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const r = Math.sqrt(t);
    const a = i * or;
    pts.push({ x: cx + Math.cos(a) * r * rx, y: cy + Math.sin(a) * r * ry });
  }
  // mélange déterministe (stable d'un chargement à l'autre)
  let g = 987654321;
  const rnd = () => ((g = (g * 1103515245 + 12345) % 2147483648), g / 2147483648);
  for (let i = pts.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pts[i], pts[j]] = [pts[j], pts[i]];
  }
  return pts;
})();

export default function TreeOfLife() {
  const [feuilles, setFeuilles] = useState([]);
  const [objectif, setObjectif] = useState(80);
  const [prenoms, setPrenoms] = useState(true);
  const [actif, setActif] = useState(null);
  const [nouvelles, setNouvelles] = useState(() => new Set());
  const rangsConnus = useRef(null);

  const charger = useCallback(async () => {
    const [{ data: f }, { data: params }] = await Promise.all([
      supabase.rpc("arbre_feuilles"),
      supabase.from("parametres").select("cle, valeur").in("cle", ["arbre_objectif", "arbre_prenoms"]),
    ]);
    const liste = Array.isArray(f) ? f : [];
    if (rangsConnus.current) {
      const avant = rangsConnus.current;
      const fraiches = new Set(liste.filter((x) => !avant.has(x.leaf_rank)).map((x) => x.leaf_rank));
      if (fraiches.size) setNouvelles(fraiches);
    }
    rangsConnus.current = new Set(liste.map((x) => x.leaf_rank));
    setFeuilles(liste);
    const p = Object.fromEntries((params || []).map((r) => [r.cle, r.valeur]));
    if (p.arbre_objectif != null) setObjectif(Number(p.arbre_objectif) || 80);
    if (p.arbre_prenoms != null) setPrenoms(p.arbre_prenoms === true);
  }, []);

  useEffect(() => {
    charger();
    const onRevoir = () => document.visibilityState === "visible" && charger();
    window.addEventListener("focus", onRevoir);
    document.addEventListener("visibilitychange", onRevoir);
    const id = setInterval(() => document.visibilityState === "visible" && charger(), 60000);
    return () => {
      window.removeEventListener("focus", onRevoir);
      document.removeEventListener("visibilitychange", onRevoir);
      clearInterval(id);
    };
  }, [charger]);

  const nombre = feuilles.length;
  const ratio = objectif > 0 ? Math.min(1, nombre / objectif) : 0;
  const stade = ratio >= 1 ? 4 : ratio >= 0.75 ? 3 : ratio >= 0.5 ? 2 : ratio >= 0.25 ? 1 : 0;

  const nomPar = useMemo(() => {
    const m = {};
    feuilles.forEach((f) => (m[f.leaf_rank] = f.display_name || ""));
    return m;
  }, [feuilles]);

  const tooltipsOk = prenoms;

  useEffect(() => {
    if (actif == null) return;
    const fermer = (e) => {
      if (!(e.target instanceof Element) || !e.target.closest(".lumiere")) setActif(null);
    };
    document.addEventListener("pointerdown", fermer, true);
    return () => document.removeEventListener("pointerdown", fermer, true);
  }, [actif]);

  const compteur =
    nombre === 0
      ? "L'arbre attend ses premières lumières…"
      : nombre === 1
      ? "1 lumière s'est allumée"
      : `${nombre} lumières se sont allumées`;

  const idxActif = actif != null ? feuilles.findIndex((x) => x.leaf_rank === actif) : -1;
  const ancreActif = idxActif >= 0 ? ANCRES[idxActif % ANCRES.length] : null;

  return (
    <section className="arbre-vivant" id="arbre">
      <div className="wrap center reveal">
        <p className="eyebrow">L'arbre de vie</p>
        <h2>
          Chacun·e de vous <em>illumine notre arbre</em>
        </h2>
        <p>
          Vous, votre moitié, vos enfants : chaque personne qui confirme sa venue allume une lumière dans notre
          arbre de vie. Passez sur l'une d'elles pour découvrir qui nous rejoint.
        </p>

        <div className={"arbre-scene stade-" + stade} style={{ "--lueur": ratio.toFixed(2) }}>
          <div className="arbre-halo-glow" aria-hidden="true" />
          <img className="arbre-photo" src={arbreImg} alt="Arbre de vie" draggable="false" />

          <div className="arbre-lumieres" role="group" aria-label={`Arbre de vie — ${compteur}`}>
            {feuilles.map((f, i) => {
              const p = ANCRES[i % ANCRES.length];
              const nom = nomPar[f.leaf_rank];
              const neuf = nouvelles.has(f.leaf_rank);
              const label = tooltipsOk && nom ? `Lumière de ${nom}` : "Lumière allumée";
              return (
                <button
                  key={f.leaf_rank}
                  type="button"
                  className={"lumiere" + (neuf ? " lumiere-neuve" : "")}
                  style={{
                    left: `${p.x * 100}%`,
                    top: `${p.y * 100}%`,
                    animationDelay: neuf ? "0ms" : `${Math.min(i * 45, 2600)}ms`,
                  }}
                  aria-label={label}
                  onClick={() => tooltipsOk && nom && setActif(actif === f.leaf_rank ? null : f.leaf_rank)}
                  onMouseEnter={() => tooltipsOk && nom && setActif(f.leaf_rank)}
                  onMouseLeave={() => setActif((a) => (a === f.leaf_rank ? null : a))}
                >
                  <span className="lumiere-orbe" aria-hidden="true" />
                </button>
              );
            })}

            {ancreActif && tooltipsOk && nomPar[actif] && (
              <div className="feuille-tip" style={{ left: `${ancreActif.x * 100}%`, top: `${ancreActif.y * 100}%` }}>
                {nomPar[actif]}
              </div>
            )}
          </div>
        </div>

        <p className="arbre-compteur" aria-live="polite">
          <em>{compteur}</em>
        </p>
      </div>
    </section>
  );
}

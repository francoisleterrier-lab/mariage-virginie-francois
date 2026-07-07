import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   ARBRE DE VIE VIVANT
   Chaque foyer ayant confirmé sa présence fait pousser une feuille.
   - données : RPC security-definer `arbre_feuilles` → { leaf_rank, display_name }
     (ne renvoie QUE le rang + le prénom du foyer, jamais l'e-mail/RSVP) ;
     `display_name` est vide si l'admin a masqué les prénoms.
   - objectif de floraison + visibilité prénoms lus dans `parametres`.
   - rafraîchi au montage, au focus/retour d'onglet et toutes les 60 s
     (la RLS interdit un Realtime cross-invités sans exposer les données).
   - silhouette identique au logo (même tracé que Rosette) ; feuilles
     placées du tronc vers la canopée selon le rang de confirmation.
   ============================================================ */

/* Tronc + branches + racines — repris à l'identique du logo (Rosette). */
/* Tronc plein, évasé à la base et effilé vers la ramure. */
const TRONC =
  "M90 164 C92 140 95 120 96 101 C96 95 104 95 104 101 C105 120 108 140 110 164 C104 168 96 168 90 164 Z";

/* Branches maîtresses — moitié DROITE + centre uniquement ; la moitié
   gauche est un miroir exact (symétrie parfaite). [tracé, épaisseur]. */
const BRANCHES_D = [
  ["M100 106 C112 98 122 86 126 68", 3.6],
  ["M126 68 C129 58 128 48 123 40", 2.1],
  ["M110 90 C121 84 130 75 135 62", 2.4],
  ["M135 62 C138 54 138 47 135 41", 1.5],
  ["M103 100 C112 87 118 73 119 57", 2.2],
  ["M119 57 C120 49 118 43 114 38", 1.4],
  ["M118 78 C127 73 134 66 138 57", 1.4],
  ["M129 74 C137 69 143 63 146 56", 1.2],
  ["M122 52 C126 46 127 40 125 34", 1.1],
  ["M114 68 C119 61 121 55 120 48", 1.1],
];

/* Branche centrale montante qui se divise en Y (dessinée une seule fois). */
const CENTRE_D = [
  ["M100 106 C100 90 100 74 100 58", 3.0],
  ["M100 66 C97 57 94 50 90 44", 1.6],
  ["M100 66 C103 57 106 50 110 44", 1.6],
  ["M100 56 C100 50 100 45 100 40", 1.3],
];

/* Racines gracieuses — moitié droite + centre, miroir à gauche. */
const RACINES_D = [
  ["M105 162 C118 166 130 170 143 168", 2.6],
  ["M143 168 C149 169 154 170 159 169", 1.5],
  ["M104 164 C112 172 121 178 131 182", 2.0],
  ["M131 182 C136 184 141 186 146 187", 1.2],
];
const RACINE_CENTRE = ["M100 164 C100 174 100 183 100 193", 2.0];

/* 120 ancres réparties harmonieusement dans la ramure (distribution
   phyllotaxique, déterministe), triées du tronc vers l'extérieur pour
   un remplissage « de l'intérieur vers la canopée ». */
function genererAncres(n) {
  const cx = 100;
  const cy = 62;
  const rx = 64;
  const ry = 50;
  const angleOr = Math.PI * (3 - Math.sqrt(5));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const r = Math.sqrt(t);
    const a = i * angleOr;
    const x = cx + Math.cos(a) * r * rx;
    let y = cy + Math.sin(a) * r * ry;
    if (y > 108) y = 108;
    pts.push({ x, y });
  }
  // fourche du tronc (100,106) → plus proche d'abord
  pts.sort((p, q) => {
    const dp = (p.x - 100) ** 2 + (p.y - 106) ** 2;
    const dq = (q.x - 100) ** 2 + (q.y - 106) ** 2;
    return dp - dq;
  });
  return pts;
}

const ANCRES = genererAncres(120);

/* Petite feuille orientée vers l'extérieur de la ramure. */
function cheminFeuille(x, y) {
  const ang = (Math.atan2(y - 62, x - 100) * 180) / Math.PI + 90;
  return { transform: `translate(${x} ${y}) rotate(${ang})` };
}

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
    // Repère les feuilles nouvelles depuis le dernier chargement (pour n'animer
    // que celles-là, pas tout l'arbre à chaque rafraîchissement).
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
  const ratio = objectif > 0 ? nombre / objectif : 0;
  // 0:sauge · 1:+bourgeons · 2:fleurs · 3:+or · 4:pleine floraison
  const stade = ratio >= 1 ? 4 : ratio >= 0.75 ? 3 : ratio >= 0.5 ? 2 : ratio >= 0.25 ? 1 : 0;

  const nomPar = useMemo(() => {
    const m = {};
    feuilles.forEach((f) => (m[f.leaf_rank] = f.display_name || ""));
    return m;
  }, [feuilles]);

  const tooltipsOk = prenoms;

  // Ferme le tooltip au clic ailleurs.
  useEffect(() => {
    if (actif == null) return;
    const fermer = (e) => {
      if (!(e.target instanceof Element) || !e.target.closest(".feuille-hit")) setActif(null);
    };
    document.addEventListener("pointerdown", fermer, true);
    return () => document.removeEventListener("pointerdown", fermer, true);
  }, [actif]);

  const compteur =
    nombre === 0
      ? "L'arbre attend ses premières feuilles…"
      : nombre === 1
      ? "1 feuille a poussé"
      : `${nombre} feuilles ont poussé`;

  return (
    <section className="arbre-vivant" id="arbre">
      <div className="wrap center reveal">
        <p className="eyebrow">L'arbre de vie</p>
        <h2>
          Chacun·e de vous fait <em>pousser une feuille</em>
        </h2>
        <p>
          Vous, votre moitié, vos enfants : chaque personne inscrite fait grandir notre arbre. Passez sur une
          feuille pour découvrir qui nous rejoint.
        </p>

        <div className={"arbre-scene stade-" + stade}>
          <svg
            className="arbre-svg"
            viewBox="0 0 200 232"
            role="group"
            aria-label={`Arbre de vie — ${compteur}`}
          >
            {stade >= 4 && <circle className="arbre-halo" cx="100" cy="82" r="92" />}
            <circle className="arbre-cercle" cx="100" cy="100" r="88" />
            {/* racines (derrière le tronc) */}
            <path className="arbre-branche" d={RACINE_CENTRE[0]} style={{ strokeWidth: RACINE_CENTRE[1] }} />
            {RACINES_D.map(([d, w], i) => (
              <path key={"rac" + i} className="arbre-branche" d={d} style={{ strokeWidth: w }} />
            ))}
            <g transform="translate(200 0) scale(-1 1)">
              {RACINES_D.map(([d, w], i) => (
                <path key={"racm" + i} className="arbre-branche" d={d} style={{ strokeWidth: w }} />
              ))}
            </g>
            {/* branches : centre + droite + miroir gauche */}
            {CENTRE_D.map(([d, w], i) => (
              <path key={"c" + i} className="arbre-branche" d={d} style={{ strokeWidth: w }} />
            ))}
            {BRANCHES_D.map(([d, w], i) => (
              <path key={"r" + i} className="arbre-branche" d={d} style={{ strokeWidth: w }} />
            ))}
            <g transform="translate(200 0) scale(-1 1)">
              {BRANCHES_D.map(([d, w], i) => (
                <path key={"l" + i} className="arbre-branche" d={d} style={{ strokeWidth: w }} />
              ))}
            </g>
            {/* tronc plein par-dessus la base des branches/racines */}
            <path className="arbre-tronc" d={TRONC} />

            {feuilles.map((f, i) => {
              const p = ANCRES[i] || ANCRES[ANCRES.length - 1];
              const nom = nomPar[f.leaf_rank];
              const estBourgeon = stade >= 1 && i % 5 === 0;
              const estFleur = stade >= 2 && estBourgeon;
              const estOr = stade >= 3 && i % 7 === 3;
              const neuf = nouvelles.has(f.leaf_rank);
              const label = tooltipsOk && nom ? `Feuille de ${nom}` : "Une feuille de l'arbre";
              return (
                <g
                  key={f.leaf_rank}
                  className={"feuille-g" + (neuf ? " feuille-neuve" : "")}
                  style={{ transformOrigin: `${p.x}px ${p.y}px`, animationDelay: neuf ? "0ms" : `${Math.min(i * 12, 1400)}ms` }}
                >
                  <g {...cheminFeuille(p.x, p.y)}>
                    {estFleur ? (
                      <g className="fleur">
                        {[0, 72, 144, 216, 288].map((a) => (
                          <ellipse key={a} className="fleur-petale" cx="0" cy="-3.1" rx="1.7" ry="3" transform={`rotate(${a})`} />
                        ))}
                        <circle className="fleur-coeur" cx="0" cy="0" r="1.5" />
                      </g>
                    ) : estBourgeon ? (
                      <circle className="bourgeon" cx="0" cy="0" r="2.1" />
                    ) : (
                      <path className={"feuille" + (estOr ? " feuille-or" : "")} d="M0 0 C3 -3 3 -8 0 -11 C-3 -8 -3 -3 0 0 Z" />
                    )}
                  </g>
                  {/* cible de tap élargie (≥ ~32px rendus) + accessibilité */}
                  <circle
                    className="feuille-hit"
                    cx={p.x}
                    cy={p.y}
                    r="9"
                    role="button"
                    tabIndex={0}
                    aria-label={label}
                    onClick={() => tooltipsOk && nom && setActif(actif === f.leaf_rank ? null : f.leaf_rank)}
                    onMouseEnter={() => tooltipsOk && nom && setActif(f.leaf_rank)}
                    onMouseLeave={() => setActif((a) => (a === f.leaf_rank ? null : a))}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && tooltipsOk && nom) {
                        e.preventDefault();
                        setActif(actif === f.leaf_rank ? null : f.leaf_rank);
                      }
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {/* tooltip HTML positionné sur la feuille active */}
          {actif != null && tooltipsOk && nomPar[actif] && (
            <div
              className="feuille-tip"
              style={{
                left: `${((ANCRES[feuilles.findIndex((x) => x.leaf_rank === actif)] || {}).x / 200) * 100}%`,
                top: `${((ANCRES[feuilles.findIndex((x) => x.leaf_rank === actif)] || {}).y / 232) * 100}%`,
              }}
            >
              {nomPar[actif]}
            </div>
          )}
        </div>

        <p className="arbre-compteur" aria-live="polite">
          <em>{compteur}</em>
        </p>
      </div>
    </section>
  );
}

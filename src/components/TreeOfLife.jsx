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
const BRANCHES = [
  ["M100 142 C99 122 100 104 100 78", 5.5],
  ["M100 104 C84 96 68 86 50 70", 3],
  ["M100 104 C116 96 132 86 150 70", 3],
  ["M100 90 C88 76 78 60 70 42", 2.6],
  ["M100 90 C112 76 122 60 130 42", 2.6],
  ["M100 80 C100 64 98 46 96 26", 2.6],
  ["M76 92 C62 88 46 88 32 92", 1.8],
  ["M124 92 C138 88 154 88 168 92", 1.8],
  ["M64 78 C52 70 42 62 34 50", 1.6],
  ["M136 78 C148 70 158 62 166 50", 1.6],
  ["M50 70 C44 62 42 52 40 42", 1.4],
  ["M150 70 C156 62 158 52 160 42", 1.4],
  ["M78 62 C70 50 64 40 62 28", 1.5],
  ["M122 62 C130 50 136 40 138 28", 1.5],
  ["M98 50 C90 40 84 32 78 22", 1.4],
  ["M98 50 C106 40 112 32 118 22", 1.4],
  ["M100 142 C88 150 74 154 58 154", 2.6],
  ["M100 142 C112 150 126 154 142 154", 2.6],
  ["M100 142 C100 154 100 164 100 178", 2.4],
  ["M100 142 C96 154 90 164 80 172", 2.2],
  ["M100 142 C104 154 110 164 120 172", 2.2],
];

/* 120 ancres réparties harmonieusement dans la canopée (distribution
   phyllotaxique, déterministe), triées du tronc vers l'extérieur pour
   un remplissage « de l'intérieur vers la canopée ». */
function genererAncres(n) {
  const cx = 100;
  const cy = 70;
  const rx = 72;
  const ry = 60;
  const angleOr = Math.PI * (3 - Math.sqrt(5));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const r = Math.sqrt(t);
    const a = i * angleOr;
    const x = cx + Math.cos(a) * r * rx;
    let y = cy + Math.sin(a) * r * ry;
    if (y > 116) y = 116;
    pts.push({ x, y });
  }
  // tronc (100,124) → nearest first
  pts.sort((p, q) => {
    const dp = (p.x - 100) ** 2 + (p.y - 124) ** 2;
    const dq = (q.x - 100) ** 2 + (q.y - 124) ** 2;
    return dp - dq;
  });
  return pts;
}

const ANCRES = genererAncres(120);

/* Petite feuille orientée vers l'extérieur de la canopée. */
function cheminFeuille(x, y) {
  const ang = (Math.atan2(y - 70, x - 100) * 180) / Math.PI + 90;
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
          Chaque « oui » fait <em>pousser une feuille</em>
        </h2>
        <p>
          À mesure que vous confirmez votre présence, notre arbre se couvre de feuilles. Passez sur l'une d'elles
          pour découvrir qui a répondu.
        </p>

        <div className={"arbre-scene stade-" + stade}>
          <svg
            className="arbre-svg"
            viewBox="0 0 200 232"
            role="group"
            aria-label={`Arbre de vie — ${compteur}`}
          >
            {stade >= 4 && <circle className="arbre-halo" cx="100" cy="86" r="92" />}
            <circle className="arbre-cercle" cx="100" cy="100" r="88" />
            {BRANCHES.map(([d, w], i) => (
              <path key={i} className="arbre-branche" d={d} style={{ strokeWidth: w }} />
            ))}

            {feuilles.map((f, i) => {
              const p = ANCRES[i] || ANCRES[ANCRES.length - 1];
              const nom = nomPar[f.leaf_rank];
              const estBourgeon = stade >= 1 && i % 5 === 0;
              const estFleur = stade >= 2 && estBourgeon;
              const estOr = stade >= 3 && i % 7 === 3;
              const neuf = nouvelles.has(f.leaf_rank);
              const label = tooltipsOk && nom ? `Feuille de ${nom}` : "Feuille confirmée";
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

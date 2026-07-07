import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   ARBRE DE VIE VIVANT
   Chaque personne inscrite fait pousser une feuille au bout d'une branche.
   - données : RPC security-definer `arbre_feuilles` → { leaf_rank, display_name }
     (ne renvoie QUE le rang + le prénom du foyer, jamais l'e-mail/RSVP).
   - la silhouette de l'arbre est GÉNÉRÉE par branchement récursif
     (fractal déterministe) → vraie ramure organique, pas un tracé « à la main ».
   - rafraîchi au montage, au focus/retour d'onglet et toutes les 60 s.
   ============================================================ */

/* ---------- Génération de l'arbre (déterministe) ----------
   Un générateur pseudo-aléatoire à graine fixe garantit exactement le
   même arbre à chaque rendu. On récursive depuis le tronc : chaque branche
   se courbe, s'affine et se divise ; on collecte les segments (pour le
   dessin) et les extrémités (pour poser les feuilles). */
function construireArbre() {
  let graine = 20280526; // clin d'œil à la date
  const rnd = () => {
    graine = (graine * 1664525 + 1013904223) % 4294967296;
    return graine / 4294967296;
  };
  const segments = [];
  const bouts = [];

  function branche(x, y, angle, longueur, largeur, prof) {
    // courbure douce : point de contrôle décalé perpendiculairement
    const bx = x + Math.cos(angle) * longueur;
    const by = y - Math.sin(angle) * longueur;
    // le tronc et les grosses branches restent quasi droits ; seules les
    // ramilles fines se courbent (évite un « pied » disgracieux à la base).
    const courbe = (rnd() - 0.5) * longueur * 0.5 * (largeur > 4 ? 0.12 : 1);
    const perp = angle + Math.PI / 2;
    const cx = x + Math.cos(angle) * longueur * 0.5 + Math.cos(perp) * courbe;
    const cy = y - Math.sin(angle) * longueur * 0.5 - Math.sin(perp) * courbe;
    segments.push({ x1: x, y1: y, cx, cy, x2: bx, y2: by, w: largeur });

    if (prof <= 0 || longueur < 4.5) {
      bouts.push({ x: bx, y: by, angle });
      return;
    }

    // nombre d'enfants : un rameau maître qui continue + des ramilles latérales
    let enfants;
    if (prof >= 6) enfants = 2;
    else enfants = rnd() < 0.32 ? 3 : 2;

    for (let i = 0; i < enfants; i++) {
      // écart angulaire réparti, avec une branche plutôt continue
      const base = (i - (enfants - 1) / 2);
      const ecart = base * (0.36 + rnd() * 0.16) + (rnd() - 0.5) * 0.14;
      const nl = longueur * (0.75 + rnd() * 0.12);
      const nw = Math.max(0.5, largeur * (0.68 + rnd() * 0.07));
      branche(bx, by, angle + ecart, nl, nw, prof - 1);
    }
  }

  // tronc : part du bas (base ancrée dans le cercle), monte tout droit
  branche(100, 186, Math.PI / 2, 40, 7.5, 8);
  return { segments, bouts };
}

const ARBRE = construireArbre();
const SEGMENTS = ARBRE.segments;
// Ordre de pose des feuilles : mélange déterministe des extrémités pour
// que le feuillage se répartisse harmonieusement sur toute la ramure
// (et non en paquets), tout en restant STABLE d'un chargement à l'autre.
const BOUTS = (() => {
  let g = 987654321;
  const rnd = () => {
    g = (g * 1103515245 + 12345) % 2147483648;
    return g / 2147483648;
  };
  const arr = [...ARBRE.bouts];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
})();

function orienterFeuille(bout) {
  const deg = 90 - (bout.angle * 180) / Math.PI;
  return { transform: `translate(${bout.x} ${bout.y}) rotate(${deg})` };
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

  const boutActif = actif != null ? BOUTS[feuilles.findIndex((x) => x.leaf_rank === actif)] : null;

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
          <svg className="arbre-svg" viewBox="0 0 200 232" role="group" aria-label={`Arbre de vie — ${compteur}`}>
            <defs>
              <linearGradient id="ecorce" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#3a2a1c" />
                <stop offset="55%" stopColor="#4a3826" />
                <stop offset="100%" stopColor="#5f7457" />
              </linearGradient>
            </defs>

            {stade >= 4 && <circle className="arbre-halo" cx="100" cy="96" r="96" />}
            <circle className="arbre-cercle" cx="100" cy="100" r="90" />

            {/* ramure générée */}
            <g className="arbre-ramure">
              {SEGMENTS.map((s, i) => (
                <path
                  key={i}
                  d={`M${s.x1} ${s.y1} Q${s.cx} ${s.cy} ${s.x2} ${s.y2}`}
                  stroke="url(#ecorce)"
                  strokeWidth={s.w}
                  strokeLinecap="round"
                  fill="none"
                />
              ))}
            </g>

            {/* feuilles au bout des branches */}
            {feuilles.map((f, i) => {
              const b = BOUTS[i % BOUTS.length];
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
                  style={{ transformOrigin: `${b.x}px ${b.y}px`, animationDelay: neuf ? "0ms" : `${Math.min(i * 14, 1500)}ms` }}
                >
                  <g {...orienterFeuille(b)}>
                    {estFleur ? (
                      <g className="fleur">
                        {[0, 72, 144, 216, 288].map((a) => (
                          <ellipse key={a} className="fleur-petale" cx="0" cy="-3.2" rx="1.8" ry="3.1" transform={`rotate(${a})`} />
                        ))}
                        <circle className="fleur-coeur" cx="0" cy="0" r="1.5" />
                      </g>
                    ) : estBourgeon ? (
                      <circle className="bourgeon" cx="0" cy="0" r="2.1" />
                    ) : (
                      <path className={"feuille" + (estOr ? " feuille-or" : "")} d="M0 0 C3.3 -3 3.3 -8.5 0 -12 C-3.3 -8.5 -3.3 -3 0 0 Z" />
                    )}
                  </g>
                  <circle
                    className="feuille-hit"
                    cx={b.x}
                    cy={b.y}
                    r="8"
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

          {boutActif && tooltipsOk && nomPar[actif] && (
            <div
              className="feuille-tip"
              style={{ left: `${(boutActif.x / 200) * 100}%`, top: `${(boutActif.y / 232) * 100}%` }}
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

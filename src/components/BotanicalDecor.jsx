import { usePhase } from "../lib/phase.jsx";

/* ============================================================
   Décor botanique évolutif : une brindille dont la richesse (feuilles,
   bourgeons, petites fleurs) et l'opacité dépendent du palier courant
   (decorationLevel 0..6). SVG inline léger, teinté par --accent-current.
   `cote` : 'g' (gauche) ou 'd' (droite, miroir). Décoratif → aria-hidden.
   ============================================================ */
export default function BotanicalDecor({ cote = "g" }) {
  const { decorationLevel: n } = usePhase();
  if (!n) return null;

  const feuilles = Math.min(6, n);
  const bourgeons = n >= 4 ? Math.min(3, n - 3) : 0;
  const fleurs = n >= 5 ? n - 4 : 0;
  const opacite = 0.22 + Math.min(6, n) * 0.055;

  return (
    <svg
      className={"deco-botanique deco-" + cote}
      viewBox="0 0 60 160"
      aria-hidden="true"
      style={{ opacity: opacite }}
    >
      {/* tige */}
      <path className="deco-tige" d="M30 158 C26 120 34 92 30 56 C28 40 30 24 30 8" />
      {/* feuilles réparties le long de la tige */}
      {Array.from({ length: feuilles }).map((_, i) => {
        const y = 138 - i * (120 / 6);
        const g = i % 2 === 0;
        return (
          <path
            key={"f" + i}
            className="deco-feuille"
            d={`M30 ${y} C${g ? 14 : 46} ${y - 4} ${g ? 8 : 52} ${y - 14} ${g ? 16 : 44} ${y - 20} C${g ? 26 : 34} ${y - 14} 30 ${y - 6} 30 ${y}Z`}
          />
        );
      })}
      {/* bourgeons */}
      {Array.from({ length: bourgeons }).map((_, i) => (
        <circle key={"b" + i} className="deco-bourgeon" cx="30" cy={40 - i * 12} r="2.6" />
      ))}
      {/* petites fleurs (floraison) */}
      {Array.from({ length: fleurs }).map((_, i) => (
        <g key={"fl" + i} transform={`translate(30 ${28 - i * 14})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} className="deco-petale" cx="0" cy="-3" rx="1.6" ry="2.8" transform={`rotate(${a})`} />
          ))}
          <circle className="deco-coeur" r="1.3" />
        </g>
      ))}
    </svg>
  );
}

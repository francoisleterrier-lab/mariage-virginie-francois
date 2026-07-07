import { usePhase } from "../lib/phase.jsx";

/* ============================================================
   Citation évolutive affichée près du compte à rebours.
   Le texte change selon le palier temporel (table site_phases) ;
   fondu doux au changement grâce à la clé React (remonte le nœud).
   ============================================================ */
export default function Citation() {
  const { quote, quoteAuthor, phase } = usePhase();
  if (!quote) return null;
  return (
    <figure className="citation" key={phase || "x"}>
      <span className="citation-orn" aria-hidden="true">
        ❦
      </span>
      <blockquote>{quote}</blockquote>
      {quoteAuthor && <figcaption>— {quoteAuthor}</figcaption>}
    </figure>
  );
}

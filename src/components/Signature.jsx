/* ============================================================
   Signature manuscrite des mariés (2 variantes) : texte Cormorant
   italique + une volute dessinée (SVG, trait vert profond).
   ============================================================ */
export default function Signature({ variant = "vf" }) {
  const texte = variant === "vfe" ? "Virginie, François, Lou, Tiago, Ugo & Eden" : "Virginie & François";
  return (
    <div className="signature-perso">
      <span className="signature-txt">{texte}</span>
      <svg className="signature-swash" viewBox="0 0 220 24" aria-hidden="true">
        <path
          d="M4 14 C40 4 70 4 104 12 C120 16 132 18 150 12 C168 6 186 6 214 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M198 10 C206 8 212 10 216 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

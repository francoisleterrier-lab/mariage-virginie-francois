import { useState, useEffect } from "react";

/* ---------- Compte à rebours vers le 26 mai 2028, 14 h ---------- */
export default function Countdown() {
  const cible = new Date("2028-05-26T14:00:00+02:00").getTime();
  const [t, setT] = useState(cible - Date.now());

  useEffect(() => {
    const id = setInterval(() => setT(cible - Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (t <= 0) return <div className="cd-done">C'est le grand jour ! 🌿</div>;

  const pad = (n) => String(n).padStart(2, "0");
  const cells = [
    [Math.floor(t / 864e5), "Jours"],
    [pad(Math.floor(t / 36e5) % 24), "Heures"],
    [pad(Math.floor(t / 6e4) % 60), "Minutes"],
    [pad(Math.floor(t / 1e3) % 60), "Secondes"],
  ];
  return (
    <div className="cd-grid" aria-label="Compte à rebours avant le mariage">
      {cells.map(([n, l]) => (
        <div key={l} className="cd-cell">
          <div className="cd-num">{n}</div>
          <div className="cd-lbl">{l}</div>
        </div>
      ))}
    </div>
  );
}

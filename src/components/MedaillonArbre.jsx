import { useState, useRef, useEffect } from "react";
import Rosette from "./Rosette.jsx";
import videoArbre from "../assets/arbre-de-vie.mp4";

/* ============================================================
   Médaillon vidéo « arbre de vie » (autoplay muted playsinline,
   clic = rejouer) + secours SVG animé si la lecture est impossible.
   Utilisé sur le héro (variant="hero", avec monogramme V & F) et
   sur le portail d'inscription (variant="gate").
   ============================================================ */
export default function MedaillonArbre({ variant = "hero", withMono = false }) {
  const [videoOk, setVideoOk] = useState(true);
  const vidRef = useRef(null);

  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    let vivant = true;
    const echec = () => {
      if (vivant) setVideoOk(false);
    };
    v.addEventListener("error", echec);

    // Fiabiliser le démarrage automatique : forcer le muet au niveau du DOM
    // (React ne pose pas toujours l'attribut `muted`, ce que certains
    // navigateurs interprètent comme « son actif » → autoplay refusé).
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    v.playsInline = true;

    const lire = () => {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    };
    lire();

    // Filet : si l'autoplay est refusé (mode économie d'énergie iOS…), la vidéo
    // démarre au tout premier geste sur la page — sans jamais basculer sur le
    // dessin. On ne retombe sur le SVG que si le média est réellement illisible.
    const surGeste = () => {
      if (v.paused) lire();
    };
    const evts = ["pointerdown", "touchstart", "keydown"];
    evts.forEach((ev) => document.addEventListener(ev, surGeste, { passive: true }));

    const t = setTimeout(() => {
      if (vivant && v.readyState < 1) echec(); // HAVE_NOTHING → média illisible
    }, 4000);
    return () => {
      vivant = false;
      clearTimeout(t);
      v.removeEventListener("error", echec);
      evts.forEach((ev) => document.removeEventListener(ev, surGeste));
    };
  }, []);

  const rejouer = () => {
    const v = vidRef.current;
    if (v) {
      v.currentTime = 0;
      v.play();
    }
  };

  if (!videoOk) return <Rosette size={variant === "gate" ? 210 : 260} />;

  return (
    <>
      <div
        className={"medaillon" + (variant === "gate" ? " medaillon-gate" : "")}
        role="button"
        tabIndex={0}
        aria-label="Arbre de vie animé — cliquer pour rejouer"
        onClick={rejouer}
        onKeyDown={(e) => {
          if (e.key === "Enter") rejouer();
        }}
      >
        <video ref={vidRef} src={videoArbre} autoPlay muted playsInline loop={variant === "gate"} preload="auto" />
      </div>
      {withMono && (
        <div className="mono-hero">
          V <em>&amp;</em> F
        </div>
      )}
    </>
  );
}

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
    const p = v.play();
    if (p && p.catch) p.catch(echec);
    // Si après 2,5 s la lecture n'a jamais démarré, on bascule sur le SVG.
    const t = setTimeout(() => {
      if (vivant && (v.readyState < 2 || (v.paused && v.currentTime === 0))) echec();
    }, 2500);
    return () => {
      vivant = false;
      clearTimeout(t);
      v.removeEventListener("error", echec);
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
        <video ref={vidRef} src={videoArbre} autoPlay muted playsInline preload="auto" />
      </div>
      {withMono && (
        <div className="mono-hero">
          V <em>&amp;</em> F
        </div>
      )}
    </>
  );
}

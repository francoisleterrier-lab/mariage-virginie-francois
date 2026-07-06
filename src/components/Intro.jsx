import { useRef, useEffect, useState } from "react";
import introPortrait from "../assets/intro-vegetal.mp4";
import introPaysage from "../assets/intro-vegetal-large.mp4";

/* ============================================================
   Écran d'intro : la vidéo se lance avant la page de connexion.
   - Mobile (portrait) : version verticale 9:16, plein écran (cover).
   - PC / tablette (large) : version 16:9 dédiée, affichée en entier
     (contain) — nette, non sur-zoomée ; le fond flouté comble les
     éventuels bords selon le ratio exact de l'écran.
   La source est choisie une fois au montage selon la largeur d'écran.
   Fond vers le portail à la fin, ou via « Entrer ».
   ============================================================ */
export default function Intro({ onFinish }) {
  const vidRef = useRef(null);
  const bgRef = useRef(null);
  const [sortie, setSortie] = useState(false);
  const fini = useRef(false);

  // Écran large (PC / tablette) → vidéo 16:9 ; sinon → vidéo verticale.
  const [videoSrc] = useState(() => {
    try {
      return window.matchMedia("(min-width: 760px)").matches ? introPaysage : introPortrait;
    } catch {
      return introPortrait;
    }
  });

  function terminer() {
    if (fini.current) return;
    fini.current = true;
    setSortie(true);
    setTimeout(onFinish, 700);
  }

  useEffect(() => {
    const v = vidRef.current;
    const bg = bgRef.current;
    if (!v) return;
    const onEnd = () => terminer();
    v.addEventListener("ended", onEnd);
    [v, bg].forEach((el) => {
      if (!el) return;
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
    });
    return () => v.removeEventListener("ended", onEnd);
  }, []);

  return (
    <div className={"intro" + (sortie ? " intro-out" : "")}>
      <video ref={bgRef} className="intro-bg" src={videoSrc} autoPlay muted playsInline preload="auto" aria-hidden="true" />
      <video ref={vidRef} className="intro-fg" src={videoSrc} autoPlay muted playsInline preload="auto" onClick={terminer} />
      <button className="intro-skip" onClick={terminer}>
        Entrer
      </button>
    </div>
  );
}

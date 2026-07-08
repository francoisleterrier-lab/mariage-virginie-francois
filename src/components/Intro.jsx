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
  const [bloque, setBloque] = useState(false); // autoplay refusé (ex. mode éco iOS)
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

  // Lance la lecture sur geste utilisateur quand l'autoplay a été bloqué.
  function lancer() {
    const bg = bgRef.current;
    if (bg?.play) bg.play().catch(() => {});
    const v = vidRef.current;
    const p = v?.play?.();
    if (p && p.then) p.then(() => setBloque(false)).catch(() => {});
    else setBloque(false);
  }

  useEffect(() => {
    const v = vidRef.current;
    const bg = bgRef.current;
    if (!v) return;
    const onEnd = () => terminer();
    v.addEventListener("ended", onEnd);
    if (bg?.play) {
      const pb = bg.play();
      if (pb && pb.catch) pb.catch(() => {});
    }
    // Si l'autoplay du premier plan est refusé, on affiche un bouton de lecture
    // (au lieu de laisser un tap sauter l'intro par erreur).
    const p = v.play();
    if (p && p.then) p.then(() => setBloque(false)).catch(() => setBloque(true));
    return () => v.removeEventListener("ended", onEnd);
  }, []);

  return (
    <div className={"intro" + (sortie ? " intro-out" : "")}>
      <video ref={bgRef} className="intro-bg" src={videoSrc} autoPlay muted playsInline preload="auto" aria-hidden="true" />
      <video ref={vidRef} className="intro-fg" src={videoSrc} autoPlay muted playsInline preload="auto" />
      {bloque && (
        <button className="intro-play" onClick={lancer} aria-label="Lire la vidéo d'introduction">
          <span className="intro-play-ic" aria-hidden="true">▶</span>
          <span className="intro-play-txt">Lancer la vidéo</span>
        </button>
      )}
      <button className="intro-skip" onClick={terminer}>
        {bloque ? "Passer" : "Entrer"}
      </button>
    </div>
  );
}

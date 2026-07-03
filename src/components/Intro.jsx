import { useRef, useEffect, useState } from "react";
import introVideo from "../assets/intro-vegetal.mp4";

/* ============================================================
   Écran d'intro : la vidéo (verticale) se lance avant la page
   de connexion. Elle est affichée EN ENTIER (nette, object-fit
   contain) ; les côtés sont comblés par une version floutée de
   la même vidéo (au lieu de barres vides) → net + élégant sur PC.
   Fond vers le portail à la fin, ou via « Entrer ».
   ============================================================ */
export default function Intro({ onFinish }) {
  const vidRef = useRef(null);
  const bgRef = useRef(null);
  const [sortie, setSortie] = useState(false);
  const fini = useRef(false);

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
      <video ref={bgRef} className="intro-bg" src={introVideo} autoPlay muted playsInline preload="auto" aria-hidden="true" />
      <video ref={vidRef} className="intro-fg" src={introVideo} autoPlay muted playsInline preload="auto" onClick={terminer} />
      <button className="intro-skip" onClick={terminer}>
        Entrer
      </button>
    </div>
  );
}

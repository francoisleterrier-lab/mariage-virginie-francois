import { useRef, useEffect, useState } from "react";
import introVideo from "../assets/intro-vegetal.mp4";

/* ============================================================
   Écran d'intro : la vidéo se lance avant la page de connexion,
   puis fond vers le portail (auto à la fin, ou via « Entrer »).
   ============================================================ */
export default function Intro({ onFinish }) {
  const vidRef = useRef(null);
  const [sortie, setSortie] = useState(false);
  const fini = useRef(false);

  function terminer() {
    if (fini.current) return;
    fini.current = true;
    setSortie(true); // déclenche le fondu
    setTimeout(onFinish, 700);
  }

  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const onEnd = () => terminer();
    v.addEventListener("ended", onEnd);
    const p = v.play();
    if (p && p.catch) p.catch(() => {}); // autoplay bloqué → l'invité clique « Entrer »
    // filet de sécurité : si la vidéo ne démarre pas du tout, on passe après 12 s
    const secours = setTimeout(() => {
      if (v.paused && v.currentTime === 0) return; // laisse le bouton faire le job
    }, 12000);
    return () => {
      v.removeEventListener("ended", onEnd);
      clearTimeout(secours);
    };
  }, []);

  return (
    <div className={"intro" + (sortie ? " intro-out" : "")}>
      <video ref={vidRef} src={introVideo} autoPlay muted playsInline preload="auto" onClick={terminer} />
      <button className="intro-skip" onClick={terminer}>
        Entrer
      </button>
    </div>
  );
}

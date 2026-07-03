import { useRef, useEffect, useState } from "react";
import piste from "../assets/musique.mp3";

/* ============================================================
   Bande-son du site.
   Les navigateurs bloquent le son en autoplay sans interaction.
   Stratégie « au plus tôt » :
   1) tenter la lecture AVEC son (OK en PWA installée / après engagement) ;
   2) sinon lecture EN SOURDINE auto (autorisée) + on retire le mute au
      tout premier contact (effleurement / clic / touche) → son quasi immédiat.
   Un seul lecteur au niveau racine, en boucle, avec bouton couper/activer.
   ============================================================ */
export default function Musique() {
  const audioRef = useRef(null);
  const [actif, setActif] = useState(false);
  const coupeManuel = useRef(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = 0.55;

    const evenements = ["pointerdown", "touchstart", "keydown", "click", "scroll"];
    const activerSon = () => {
      if (coupeManuel.current) return;
      a.muted = false;
      a.play().then(() => setActif(true)).catch(() => {});
      nettoyer();
    };
    const nettoyer = () => evenements.forEach((e) => window.removeEventListener(e, activerSon));

    a.muted = false;
    a
      .play()
      .then(() => setActif(true))
      .catch(() => {
        a.muted = true;
        a.play().catch(() => {});
        evenements.forEach((e) => window.addEventListener(e, activerSon, { passive: true }));
      });

    return nettoyer;
  }, []);

  function basculer() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused || a.muted || !actif) {
      coupeManuel.current = false;
      a.muted = false;
      a.play().then(() => setActif(true)).catch(() => {});
    } else {
      coupeManuel.current = true;
      a.pause();
      setActif(false);
    }
  }

  return (
    <>
      <audio ref={audioRef} src={piste} loop preload="auto" />
      <button
        className="musique-btn"
        onClick={basculer}
        aria-label={actif ? "Couper la musique" : "Activer la musique"}
        title={actif ? "Couper la musique" : "Activer la musique"}
      >
        {actif ? "🔊" : "🔈"}
      </button>
    </>
  );
}

import { useRef, useEffect, useState } from "react";
import piste from "../assets/musique.mp3";

/* ============================================================
   Bande-son du site.
   - Démarre au 1er geste de l'invité (les navigateurs bloquent le
     son en autoplay) — donc dès le tap sur l'intro / « Entrer ».
   - Continue sur tout le site (un seul lecteur, au niveau racine).
   - Bouton flottant pour couper / réactiver le son.
   ============================================================ */
export default function Musique() {
  const audioRef = useRef(null);
  const [joue, setJoue] = useState(false);
  const demarre = useRef(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = 0.55;

    const lancer = () => {
      if (demarre.current) return;
      a
        .play()
        .then(() => {
          demarre.current = true;
          setJoue(true);
          retirer();
        })
        .catch(() => {
          /* toujours bloqué : on réessaiera au prochain geste */
        });
    };
    const retirer = () => {
      ["pointerdown", "keydown", "touchstart", "click"].forEach((e) =>
        window.removeEventListener(e, lancer)
      );
    };

    // tentative immédiate (marche si l'utilisateur a déjà interagi avec le site)
    lancer();
    // sinon, au 1er geste
    ["pointerdown", "keydown", "touchstart", "click"].forEach((e) =>
      window.addEventListener(e, lancer, { passive: true })
    );
    return retirer;
  }, []);

  function basculer() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().then(() => setJoue(true)).catch(() => {});
    } else {
      a.pause();
      setJoue(false);
    }
  }

  return (
    <>
      <audio ref={audioRef} src={piste} loop preload="auto" />
      <button
        className="musique-btn"
        onClick={basculer}
        aria-label={joue ? "Couper la musique" : "Activer la musique"}
        title={joue ? "Couper la musique" : "Activer la musique"}
      >
        {joue ? "🔊" : "🔈"}
      </button>
    </>
  );
}

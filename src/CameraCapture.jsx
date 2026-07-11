import { useEffect, useRef, useState } from "react";

/* Appareil photo intégré : aperçu vidéo en direct + déclencheur.
   Sans dépendance (ni supabase, ni CSS externe) → réutilisable côté produit
   ET côté site V&F. onCapture(blob) reçoit la photo (JPEG). */
export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facing, setFacing] = useState("environment");
  const [pret, setPret] = useState(false);
  const [refuse, setRefuse] = useState(false);

  function stop() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  useEffect(() => {
    let annule = false;
    async function start() {
      stop();
      setPret(false);
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        if (annule) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
        setPret(true);
        setRefuse(false);
      } catch {
        setRefuse(true);
      }
    }
    if (navigator.mediaDevices?.getUserMedia) start();
    else setRefuse(true);
    return () => {
      annule = true;
      stop();
    };
  }, [facing]);

  function declencher() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob(
      (blob) => {
        if (blob) {
          stop();
          onCapture(blob);
        }
      },
      "image/jpeg",
      0.9
    );
  }

  function surFichier(e) {
    const f = e.target.files && e.target.files[0];
    if (f) {
      stop();
      onCapture(f);
    }
  }

  const O = {
    fond: { position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
    video: { width: "100%", height: "100%", objectFit: "cover", transform: facing === "user" ? "scaleX(-1)" : "none" },
    barre: { position: "absolute", left: 0, right: 0, bottom: "max(1.4rem, env(safe-area-inset-bottom))", display: "flex", alignItems: "center", justifyContent: "center", gap: "2.4rem" },
    shutter: { width: 74, height: 74, borderRadius: "50%", background: "#fff", border: "5px solid rgba(255,255,255,.45)", cursor: "pointer", boxShadow: "0 6px 24px rgba(0,0,0,.5)" },
    rond: { width: 48, height: 48, borderRadius: "50%", background: "rgba(0,0,0,.45)", color: "#fff", border: "1px solid rgba(255,255,255,.35)", fontSize: "1.3rem", cursor: "pointer", backdropFilter: "blur(4px)" },
    fermer: { position: "absolute", top: "max(1rem, env(safe-area-inset-top))", right: "1rem", width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,.45)", color: "#fff", border: "1px solid rgba(255,255,255,.35)", fontSize: "1.4rem", cursor: "pointer" },
    msg: { color: "#fff", textAlign: "center", padding: "2rem", maxWidth: "22rem" },
    lien: { display: "inline-block", marginTop: "1rem", padding: ".8rem 1.4rem", borderRadius: 999, background: "#fff", color: "#111", fontWeight: 700, cursor: "pointer" },
  };

  return (
    <div style={O.fond} role="dialog" aria-label="Appareil photo">
      {!refuse ? (
        <>
          <video ref={videoRef} style={O.video} playsInline muted autoPlay />
          <button style={O.fermer} onClick={() => { stop(); onClose(); }} aria-label="Fermer">×</button>
          <div style={O.barre}>
            <button style={O.rond} onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} aria-label="Changer de caméra" title="Changer de caméra">⟲</button>
            <button style={O.shutter} onClick={declencher} disabled={!pret} aria-label="Prendre la photo" />
            <span style={{ width: 48 }} aria-hidden="true" />
          </div>
        </>
      ) : (
        <div style={O.msg}>
          <p>La caméra n'est pas disponible (autorisation refusée ou non prise en charge).</p>
          <label style={O.lien}>
            📷 Utiliser l'appareil photo du téléphone
            <input type="file" accept="image/*" capture="environment" onChange={surFichier} hidden />
          </label>
          <div>
            <button style={{ ...O.lien, background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.4)" }} onClick={onClose}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

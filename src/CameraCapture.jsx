import { useEffect, useRef, useState } from "react";

/* Appareil photo & caméra intégrés : aperçu vidéo en direct + déclencheur
   (photo JPEG) ou enregistrement (vidéo). Sans dépendance (ni supabase, ni
   CSS externe) → réutilisable côté produit ET côté site V&F.
   onCapture(blob) reçoit la photo (image/jpeg) ou la vidéo (video/*). */

const MAX_SEC = 60; // durée max d'un clip

function meilleurMimeVideo() {
  if (typeof MediaRecorder === "undefined") return null;
  const cands = ["video/mp4", "video/webm;codecs=vp8,opus", "video/webm"];
  for (const c of cands) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return "";
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startRef = useRef(0);
  const capteRef = useRef(false);
  const [facing, setFacing] = useState("environment");
  const [mode, setMode] = useState("photo"); // "photo" | "video"
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pret, setPret] = useState(false);
  const [refuse, setRefuse] = useState(false);
  const peutFilmer = typeof MediaRecorder !== "undefined";

  function stopFlux() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }
  function nettoyer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recRef.current && recRef.current.state !== "inactive") {
      recRef.current.onstop = null; // annulation : on ne livre PAS le clip en cours
      try {
        recRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    recRef.current = null;
    stopFlux();
  }

  useEffect(() => {
    let annule = false;
    async function start() {
      stopFlux();
      setPret(false);
      try {
        let s;
        try {
          s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: mode === "video" });
        } catch (e) {
          // Micro refusé mais caméra OK → on garde la vidéo, sans le son.
          if (mode === "video") s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
          else throw e;
        }
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
      nettoyer();
    };
    // ré-acquisition quand on change de caméra ou de mode (audio requis pour la vidéo)
  }, [facing, mode]);

  function declencher() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || capteRef.current) return;
    capteRef.current = true; // évite une double-capture sur double-tap rapide
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    c.toBlob(
      (blob) => {
        if (blob) {
          stopFlux();
          onCapture(blob);
        } else {
          capteRef.current = false;
        }
      },
      "image/jpeg",
      0.9
    );
  }

  function demarrerVideo() {
    const s = streamRef.current;
    if (!s || !peutFilmer) return;
    chunksRef.current = [];
    const mime = meilleurMimeVideo();
    let rec;
    try {
      rec = new MediaRecorder(s, mime ? { mimeType: mime, videoBitsPerSecond: 2_000_000 } : undefined);
    } catch {
      try {
        rec = new MediaRecorder(s);
      } catch {
        return;
      }
    }
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const type = (rec.mimeType || mime || "video/webm").split(";")[0];
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      stopFlux();
      onCapture(blob);
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      return;
    }
    setRecording(true);
    setElapsed(0);
    startRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(sec);
      if (sec >= MAX_SEC) arreterVideo();
    }, 250);
  }

  function arreterVideo() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
  }

  function surDeclencheur() {
    if (!pret) return;
    if (mode === "photo") return declencher();
    if (recording) return arreterVideo();
    return demarrerVideo();
  }

  function surFichier(e) {
    const f = e.target.files && e.target.files[0];
    if (f) {
      stopFlux();
      onCapture(f);
    }
  }

  const O = {
    fond: { position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
    video: { width: "100%", height: "100%", objectFit: "cover", transform: facing === "user" ? "scaleX(-1)" : "none" },
    fermer: { position: "absolute", top: "max(1rem, env(safe-area-inset-top))", right: "1rem", width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,.45)", color: "#fff", border: "1px solid rgba(255,255,255,.35)", fontSize: "1.4rem", cursor: "pointer" },
    timer: { position: "absolute", top: "max(1rem, env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: ".45rem", background: "rgba(0,0,0,.5)", color: "#fff", padding: ".35rem .8rem", borderRadius: 999, fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: ".95rem" },
    point: { width: 10, height: 10, borderRadius: "50%", background: "#e5484d", animation: "none" },
    bas: { position: "absolute", left: 0, right: 0, bottom: "max(1.2rem, env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" },
    modes: { display: recording ? "none" : "inline-flex", background: "rgba(0,0,0,.45)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 999, padding: 3, backdropFilter: "blur(4px)" },
    modeOn: { border: "none", borderRadius: 999, padding: ".4rem 1.1rem", fontWeight: 700, fontSize: ".9rem", background: "#fff", color: "#111", cursor: "pointer" },
    modeOff: { border: "none", borderRadius: 999, padding: ".4rem 1.1rem", fontWeight: 600, fontSize: ".9rem", background: "transparent", color: "#fff", cursor: "pointer" },
    barre: { display: "flex", alignItems: "center", justifyContent: "center", gap: "2.4rem" },
    rond: { width: 48, height: 48, borderRadius: "50%", background: "rgba(0,0,0,.45)", color: "#fff", border: "1px solid rgba(255,255,255,.35)", fontSize: "1.3rem", cursor: "pointer", backdropFilter: "blur(4px)", opacity: recording ? 0.35 : 1 },
    shutter: { width: 74, height: 74, borderRadius: "50%", background: mode === "photo" ? "#fff" : "rgba(255,255,255,.15)", border: "5px solid rgba(255,255,255,.85)", cursor: "pointer", boxShadow: "0 6px 24px rgba(0,0,0,.5)", display: "grid", placeItems: "center", padding: 0 },
    recRond: { width: 50, height: 50, borderRadius: "50%", background: "#e5484d" },
    recCarre: { width: 30, height: 30, borderRadius: 8, background: "#e5484d" },
    msg: { color: "#fff", textAlign: "center", padding: "2rem", maxWidth: "22rem", display: "flex", flexDirection: "column", gap: ".8rem", alignItems: "center" },
    lien: { display: "inline-flex", alignItems: "center", padding: ".8rem 1.4rem", borderRadius: 999, background: "#fff", color: "#111", fontWeight: 700, cursor: "pointer" },
  };

  return (
    <div style={O.fond} role="dialog" aria-label="Appareil photo et caméra">
      {!refuse ? (
        <>
          <video ref={videoRef} style={O.video} playsInline muted autoPlay />
          <button style={O.fermer} onClick={() => { nettoyer(); onClose(); }} aria-label="Fermer">×</button>
          {recording && (
            <div style={O.timer}>
              <span style={O.point} /> {mmss(elapsed)}
            </div>
          )}
          <div style={O.bas}>
            {peutFilmer && (
              <div style={O.modes} role="tablist" aria-label="Mode de capture">
                <button style={mode === "photo" ? O.modeOn : O.modeOff} onClick={() => setMode("photo")} aria-pressed={mode === "photo"}>Photo</button>
                <button style={mode === "video" ? O.modeOn : O.modeOff} onClick={() => setMode("video")} aria-pressed={mode === "video"}>Vidéo</button>
              </div>
            )}
            <div style={O.barre}>
              <button style={O.rond} onClick={() => !recording && setFacing((f) => (f === "user" ? "environment" : "user"))} disabled={recording} aria-label="Changer de caméra" title="Changer de caméra">⟲</button>
              <button
                style={O.shutter}
                onClick={surDeclencheur}
                disabled={!pret}
                aria-label={mode === "photo" ? "Prendre la photo" : recording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
              >
                {mode === "video" && <span style={recording ? O.recCarre : O.recRond} />}
              </button>
              <span style={{ width: 48 }} aria-hidden="true" />
            </div>
          </div>
        </>
      ) : (
        <div style={O.msg}>
          <p>La caméra n'est pas disponible (autorisation refusée ou non prise en charge).</p>
          <label style={O.lien}>
            📷 Prendre une photo
            <input type="file" accept="image/*" capture="environment" onChange={surFichier} hidden />
          </label>
          <label style={O.lien}>
            🎬 Filmer une vidéo
            <input type="file" accept="video/*" capture="environment" onChange={surFichier} hidden />
          </label>
          <button style={{ ...O.lien, background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.4)" }} onClick={onClose}>Fermer</button>
        </div>
      )}
    </div>
  );
}

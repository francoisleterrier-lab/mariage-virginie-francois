import { useEffect, useRef, useState } from "react";

/* Diaporama « live » plein écran, à projeter pendant la soirée : fait défiler
   les photos des invités et leurs petits mots, en fondu, avec un léger effet
   de zoom. Sans dépendance (ni supabase, ni CSS externe) → réutilisable côté
   produit ET côté site V&F. `items` : [{kind:"photo",url,prenom} | {kind:"mot",message,prenom}]. */

const KF = `
@keyframes dpvIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes dpvKen { from { transform: scale(1.001) } to { transform: scale(1.07) } }
@keyframes dpvPulse { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
@keyframes dpvProg { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@media (prefers-reduced-motion: reduce) {
  .dpv-ken { animation: none !important }
}`;

const DUREE = { photo: 7000, mot: 6500 };

export default function Diaporama({ items = [], titre = "", onExit }) {
  const [pos, setPos] = useState(0);
  const [tick, setTick] = useState(0);
  const [plein, setPlein] = useState(false);
  const itemsRef = useRef(items);
  const posRef = useRef(0);
  itemsRef.current = items;

  function avancer() {
    const n = itemsRef.current.length;
    if (!n) return;
    posRef.current = (posRef.current + 1) % n;
    setPos(posRef.current);
    setTick((t) => t + 1);
  }

  // Boucle de défilement : durée selon le type, sondage quand c'est vide.
  useEffect(() => {
    let vivant = true;
    let t;
    function boucle() {
      if (!vivant) return;
      const list = itemsRef.current;
      const cur = list[posRef.current % (list.length || 1)];
      const d = list.length ? DUREE[cur?.kind] || 7000 : 2500;
      t = setTimeout(() => {
        if (itemsRef.current.length) avancer();
        boucle();
      }, d);
    }
    boucle();
    return () => {
      vivant = false;
      clearTimeout(t);
    };
  }, []);

  // Raccourcis : →/espace = suivant, F = plein écran, Échap = quitter.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); avancer(); }
      else if (e.key.toLowerCase() === "f") basculerPlein();
      else if (e.key === "Escape" && onExit) onExit();
    }
    window.addEventListener("keydown", onKey);
    const onFs = () => setPlein(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [onExit]);

  function basculerPlein() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  const cur = items.length ? items[Math.min(pos, items.length - 1)] : null;
  const dur = (DUREE[cur?.kind] || 7000) / 1000;

  const S = {
    fond: { position: "fixed", inset: 0, zIndex: 9999, background: "#0a0d0b", overflow: "hidden", color: "#f4efe6", fontFamily: "Georgia, 'Times New Roman', serif" },
    slide: { position: "absolute", inset: 0, animation: "dpvIn .9s ease" },
    backdrop: (u) => ({ position: "absolute", inset: 0, backgroundImage: `url("${u}")`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(40px) brightness(.34)", transform: "scale(1.12)" }),
    photo: { position: "absolute", top: "12%", bottom: "8%", left: 0, right: 0, margin: "auto", maxWidth: "92%", maxHeight: "80%", objectFit: "contain", borderRadius: 12, boxShadow: "0 30px 90px rgba(0,0,0,.6)" },
    chip: { position: "absolute", left: "50%", bottom: "8%", transform: "translateX(-50%)", padding: ".5rem 1.2rem", borderRadius: 999, background: "rgba(0,0,0,.5)", backdropFilter: "blur(6px)", fontStyle: "italic", fontSize: "clamp(1rem, 2.4vw, 1.6rem)", letterSpacing: ".02em" },
    mot: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "8vw" },
    quote: { margin: 0, fontStyle: "italic", fontSize: "clamp(1.6rem, 5vw, 4rem)", lineHeight: 1.25, maxWidth: "18ch", textWrap: "balance" },
    author: { marginTop: "1.6rem", fontSize: "clamp(1rem, 2.4vw, 1.7rem)", color: "#d9b779", letterSpacing: ".08em" },
    vide: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "2rem", fontStyle: "italic", fontSize: "clamp(1.2rem, 3vw, 2rem)", color: "#b8c2b0" },
    entete: { position: "absolute", top: "5%", left: 0, right: 0, textAlign: "center", pointerEvents: "none" },
    couple: { fontSize: "clamp(1.1rem, 2.6vw, 2rem)", letterSpacing: ".14em", textTransform: "uppercase" },
    live: { marginTop: ".5rem", fontSize: "clamp(.7rem, 1.4vw, 1rem)", letterSpacing: ".28em", textTransform: "uppercase", color: "#d9b779", display: "inline-flex", alignItems: "center", gap: ".5rem" },
    pastille: { width: 9, height: 9, borderRadius: "50%", background: "#d9b779", animation: "dpvPulse 1.6s ease-in-out infinite" },
    prog: { position: "absolute", left: 0, bottom: 0, height: 4, width: "100%", background: "#d9b779", transformOrigin: "left", transform: "scaleX(0)", animation: `dpvProg ${dur}s linear forwards` },
    ctrl: { position: "absolute", top: "1.1rem", right: "1.1rem", display: "flex", gap: ".5rem" },
    btn: { width: 44, height: 44, borderRadius: "50%", background: "rgba(0,0,0,.4)", color: "#f4efe6", border: "1px solid rgba(255,255,255,.25)", fontSize: "1.1rem", cursor: "pointer" },
  };

  return (
    <div style={S.fond} onClick={avancer} role="region" aria-label="Diaporama des souvenirs">
      <style>{KF}</style>

      {cur ? (
        <div key={tick} style={S.slide}>
          {cur.kind === "photo" ? (
            <>
              <div style={S.backdrop(cur.url)} />
              <img className="dpv-ken" src={cur.url} alt={cur.prenom ? `Photo de ${cur.prenom}` : "Souvenir d'invité"} style={{ ...S.photo, animation: `dpvKen ${dur}s ease forwards` }} />
              {cur.prenom && <div style={S.chip}>{cur.prenom}</div>}
            </>
          ) : (
            <div style={S.mot}>
              <p style={S.quote}>« {cur.message} »</p>
              {cur.prenom && <span style={S.author}>— {cur.prenom}</span>}
            </div>
          )}
        </div>
      ) : (
        <div style={S.vide}>En attente des premiers souvenirs… 🌿<br />Ajoutez vos photos, elles s'afficheront ici en direct.</div>
      )}

      <div style={S.entete}>
        {titre && <div style={S.couple}>{titre}</div>}
        <div style={S.live}><span style={S.pastille} /> en direct</div>
      </div>

      {cur && <div key={"pg" + tick} style={S.prog} />}

      <div style={S.ctrl} onClick={(e) => e.stopPropagation()}>
        <button style={S.btn} onClick={basculerPlein} aria-label="Plein écran" title="Plein écran (F)">{plein ? "🡖" : "⛶"}</button>
        {onExit && <button style={S.btn} onClick={onExit} aria-label="Quitter" title="Quitter (Échap)">×</button>}
      </div>
    </div>
  );
}

import { useRef, useEffect, useState, useCallback } from "react";

/* Carte à gratter (canvas, sans dépendance) : on gratte le « vernis » au doigt
   ou à la souris pour révéler le contenu placé derrière (children).
   Partagé produit + V&F. Props : hint (texte du vernis), accent, seuil (0-1),
   onReveal (callback quand c'est découvert). */

export default function ScratchCard({ children, hint = "✨ Grattez ici", accent = "#c9a24b", seuil = 0.5, onReveal }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const dessine = useRef(false);
  const dernier = useRef(null);
  const revele = useRef(false);
  const [fini, setFini] = useState(false);

  const peindreVernis = useCallback(() => {
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w === 0 || h === 0) return;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + "px";
    cv.style.height = h + "px";
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#e7dfca");
    g.addColorStop(0.5, "#d5c8a6");
    g.addColorStop(1, "#efe8d4");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // léger grain doré
    ctx.fillStyle = "rgba(201,162,75,0.10)";
    for (let i = 0; i < (w * h) / 900; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
    }
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 " + Math.max(15, Math.round(Math.min(w, h) / 11)) + "px 'Jost', sans-serif";
    ctx.fillText(hint, w / 2, h / 2);
    ctx.globalCompositeOperation = "destination-out";
  }, [accent, hint]);

  useEffect(() => {
    peindreVernis();
    const ro = new ResizeObserver(() => {
      if (!revele.current) peindreVernis();
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [peindreVernis]);

  function pos(e) {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function gratter(p) {
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineWidth = 36;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (dernier.current) {
      ctx.beginPath();
      ctx.moveTo(dernier.current.x, dernier.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.fill();
    dernier.current = p;
  }

  function ratioGratte() {
    const cv = canvasRef.current;
    const ctx = cv.getContext("2d");
    const img = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let vide = 0;
    let tot = 0;
    for (let i = 3; i < img.length; i += 4 * 16) {
      tot++;
      if (img[i] === 0) vide++;
    }
    return tot ? vide / tot : 0;
  }

  function onDown(e) {
    if (revele.current) return;
    dessine.current = true;
    dernier.current = null;
    canvasRef.current.setPointerCapture?.(e.pointerId);
    gratter(pos(e));
  }
  function onMove(e) {
    if (!dessine.current || revele.current) return;
    e.preventDefault();
    gratter(pos(e));
  }
  function onUp() {
    if (revele.current || !dessine.current) return;
    dessine.current = false;
    dernier.current = null;
    if (ratioGratte() > seuil) {
      revele.current = true;
      const cv = canvasRef.current;
      cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
      setFini(true);
      onReveal?.();
    }
  }

  return (
    <div ref={wrapRef} className={"scratch" + (fini ? " scratch-revele" : "")} style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>
      {children}
      {!fini && (
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          style={{ position: "absolute", inset: 0, cursor: "grab", touchAction: "none" }}
          aria-label="Carte à gratter — grattez pour révéler"
          role="img"
        />
      )}
    </div>
  );
}

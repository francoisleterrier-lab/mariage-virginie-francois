import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* « Le Tifo » — les écrans des invités deviennent une fresque de lumière.
   - mode "participant" : plein écran, chaque téléphone affiche une couleur
     calculée depuis sa position dans la salle (plan de table) → la fresque
     émerge sans qu'aucune image ne transite (juste un top départ Realtime).
   - mode "regie" (mariés/DJ) : lance les scènes + réveille les invités (push).
   Aucune table SQL : tout passe par un canal Realtime broadcast éphémère. */

const SCENES = [
  { id: "coeur", label: "❤️ Cœur qui bat" },
  { id: "vague", label: "🌊 Vague dorée" },
  { id: "mosaique", label: "✨ Mosaïque" },
  { id: "final", label: "💛 Plein feu" },
];

/* ---- helpers couleur ---- */
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const frac = (v) => v - Math.floor(v);
const smooth = (s) => s * s * (3 - 2 * s);
function bump(p, c, w) {
  const d = Math.abs(p - c) / w;
  return d < 1 ? 1 - d * d : 0;
}
function mix(a, b, t) {
  t = clamp01(t);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}
function hsl(h, s, l) {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(clamp01(l / 100) * 100)}%)`;
}
// position pseudo-aléatoire mais STABLE quand l'invité n'a pas de table
function hashPos(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  const x = frac(Math.abs(Math.sin(h)) * 43758.5453);
  const y = frac(Math.abs(Math.cos(h)) * 24634.6345);
  return { x, y };
}

function couleur(scene, x, y, t) {
  if (scene === "coeur") {
    const p = (t % 1.15) / 1.15;
    const beat = Math.max(bump(p, 0.04, 0.13), bump(p, 0.26, 0.13));
    return mix([34, 12, 18], [228, 58, 74], 0.22 + 0.78 * beat);
  }
  if (scene === "vague") {
    const s = 0.5 + 0.5 * Math.sin(t * 1.5 - x * 4.4);
    return mix([28, 24, 13], [232, 190, 92], smooth(s));
  }
  if (scene === "mosaique") {
    const h = frac(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
    const shimmer = 0.72 + 0.28 * Math.sin(t * 1.6 + h * 6.283);
    return hsl(22 + h * 66, 60, 30 + 26 * shimmer);
  }
  // final : plein feu doré, respiration douce
  return mix([150, 110, 44], [244, 208, 120], 0.7 + 0.3 * Math.sin(t * 1.9));
}

export default function Tifo({ mode = "participant", profile, etat, onSend, onExit }) {
  const estRegie = mode === "regie" && profile?.role === "admin";
  const [pos, setPos] = useState(() => hashPos(profile?.id || "x"));
  const [notif, setNotif] = useState("");
  const surface = useRef(null);
  const raf = useRef(0);

  // Position dans la salle (plan de table) — sinon position stable par hash.
  useEffect(() => {
    let vivant = true;
    (async () => {
      if (profile?.table_id) {
        const { data } = await supabase.from("tables_plan").select("pos_x, pos_y").eq("id", profile.table_id).maybeSingle();
        if (vivant && data) setPos({ x: (data.pos_x ?? 50) / 100, y: (data.pos_y ?? 50) / 100 });
      }
    })();
    return () => { vivant = false; };
  }, [profile?.table_id]);

  // Boucle d'animation : peint la surface plein écran selon la scène.
  const scene = etat?.scene || null;
  const t0 = etat?.t0 || 0;
  useEffect(() => {
    if (estRegie) return; // la régie ne peint pas le plein écran
    function tick() {
      const el = surface.current;
      if (el) {
        if (scene) {
          const t = (Date.now() - t0) / 1000;
          el.style.background = couleur(scene, pos.x, pos.y, t);
        } else {
          el.style.background = "#0b0f0c";
        }
      }
      raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [scene, t0, pos.x, pos.y, estRegie]);

  const lancer = useCallback((sceneId) => onSend?.({ scene: sceneId, t0: Date.now() }), [onSend]);
  const eteindre = useCallback(() => onSend?.({ scene: null, t0: Date.now() }), [onSend]);

  async function reveiller() {
    setNotif("Envoi…");
    const url = `${location.origin}${location.pathname}?tifo=1`;
    const { data, error } = await supabase.functions.invoke("envoyer-notification", {
      body: { titre: "✨ Levez vos téléphones !", message: "La surprise commence — gardez l'écran allumé 🌿", url },
    });
    setNotif(error ? "Envoi impossible : " + error.message : `Invités réveillés (${data?.envoyes ?? 0}).`);
  }

  /* ---------- RÉGIE (mariés / DJ) ---------- */
  if (estRegie) {
    return (
      <div className="tifo-regie">
        <div className="tifo-regie-box">
          <p className="eyebrow">Régie — Le Tifo</p>
          <h1>Orchestrez la salle</h1>
          <p className="tifo-regie-note">
            Faites d'abord ouvrir l'écran à tout le monde (bouton ci-dessous ou dites « ouvrez l'app »), puis lancez
            une scène. Les téléphones s'allument à l'unisson.
          </p>

          <button type="button" className="btn-vert tifo-reveil" onClick={reveiller}>
            🔔 Réveiller les invités (notification)
          </button>
          {notif && <p className="tifo-regie-notif">{notif}</p>}

          <div className="tifo-scenes">
            {SCENES.map((s) => (
              <button key={s.id} type="button" className={"tifo-scene-btn" + (scene === s.id ? " on" : "")} onClick={() => lancer(s.id)}>
                {s.label}
              </button>
            ))}
          </div>

          <div className="tifo-regie-actions">
            <button type="button" className="btn-ghost" onClick={eteindre}>⏹ Éteindre</button>
            <button type="button" className="btn-ghost" onClick={onExit}>Quitter la régie</button>
          </div>
          <p className="tifo-regie-etat">
            {scene ? `En cours : ${SCENES.find((s) => s.id === scene)?.label}` : "Aucune scène active"}
          </p>
        </div>
      </div>
    );
  }

  /* ---------- PARTICIPANT (plein écran) ---------- */
  return (
    <div className="tifo-surface" ref={surface}>
      {!scene && (
        <div className="tifo-attente">
          <div className="tifo-etoile" aria-hidden="true">✦</div>
          <p>Gardez votre écran allumé…</p>
          <span>La magie va commencer 🌿</span>
        </div>
      )}
      <button type="button" className="tifo-quitter" onClick={onExit} aria-label="Quitter">×</button>
    </div>
  );
}

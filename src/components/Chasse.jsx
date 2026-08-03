import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* « La Chasse au domaine » — radar chaud/froid vers des balises GPS ;
   sur place, une vidéo-souvenir se révèle. Les balises (points + vidéos)
   sont saisies par l'admin, idéalement sur le domaine. Section masquée
   tant qu'aucune balise active n'existe. */

const urlOf = (chemin) => supabase.storage.from("vf-photos").getPublicUrl(chemin).data.publicUrl;

function distance(a, b) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function chaleur(d) {
  if (d < 25) return { l: "Brûlant 🔥", c: "#c0392b", t: 1 };
  if (d < 60) return { l: "Très chaud", c: "#d9713a", t: 0.8 };
  if (d < 130) return { l: "Chaud", c: "#d8a24b", t: 0.6 };
  if (d < 300) return { l: "Tiède", c: "#8aa07f", t: 0.4 };
  if (d < 700) return { l: "Froid", c: "#5f83a0", t: 0.2 };
  return { l: "Glacial ❄️", c: "#4a6b8a", t: 0.08 };
}

export default function Chasse({ profile }) {
  const [dispo, setDispo] = useState(true);
  const [enService, setEnService] = useState(false);
  const [balises, setBalises] = useState([]);
  const [decouvertes, setDecouvertes] = useState([]);
  const [ma, setMa] = useState(null); // {lat,lng}
  const [geoErr, setGeoErr] = useState("");
  const [actif, setActif] = useState(false);
  const [reveal, setReveal] = useState(null); // balise révélée
  const watch = useRef(null);
  const estAdmin = profile?.role === "admin";

  // form admin
  const [form, setForm] = useState({ titre: "", indice: "", rayon_m: 20 });
  const [pt, setPt] = useState(null);

  const charger = useCallback(async () => {
    const [{ data: b, error }, { data: d }, { data: anim }] = await Promise.all([
      supabase.from("chasse_balises").select("*").order("ordre"),
      supabase.from("chasse_decouvertes").select("id, balise_id, invite_id"),
      supabase.from("parametres").select("valeur").eq("cle", "animations").maybeSingle(),
    ]);
    setEnService(!!anim?.valeur?.chasse);
    if (error) { setDispo(false); return; }
    setDispo(true);
    setBalises(b || []);
    setDecouvertes(d || []);
  }, []);

  useEffect(() => {
    charger();
    const t = setInterval(charger, 12000);
    return () => clearInterval(t);
  }, [charger]);

  function demarrer() {
    if (!navigator.geolocation) { setGeoErr("La géolocalisation n'est pas disponible."); return; }
    setActif(true);
    watch.current = navigator.geolocation.watchPosition(
      (p) => { setMa({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoErr(""); },
      () => setGeoErr("Autorisez la localisation pour jouer."),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 12000 }
    );
  }
  useEffect(() => () => { if (watch.current != null) navigator.geolocation?.clearWatch(watch.current); }, []);

  const balisesActives = balises.filter((b) => b.actif);
  const trouveesMoi = new Set(decouvertes.filter((d) => d.invite_id === profile?.id).map((d) => d.balise_id));

  async function decouvrir(b) {
    if (trouveesMoi.has(b.id)) return;
    await supabase.from("chasse_decouvertes").insert({ balise_id: b.id, invite_id: profile.id });
    setReveal(b);
    charger();
  }

  // Balise cible = la plus proche non trouvée (calcul pur pour le rendu).
  let cible = null, dCible = Infinity;
  if (ma) {
    for (const b of balisesActives) {
      if (trouveesMoi.has(b.id)) continue;
      const d = distance(ma, { lat: b.lat, lng: b.lng });
      if (d < dCible) { dCible = d; cible = b; }
    }
  }

  // Détection d'arrivée dans le rayon → révélation (effet, jamais pendant le rendu).
  useEffect(() => {
    if (!ma || !cible) return;
    if (dCible <= (cible.rayon_m || 20) && !trouveesMoi.has(cible.id)) decouvrir(cible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ma, cible?.id, dCible]);

  /* ---------- admin : ajouter une balise ---------- */
  async function capturer() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setPt({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeoErr("Localisation refusée."),
      { enableHighAccuracy: true }
    );
  }
  async function ajouter() {
    if (!form.titre.trim() || !pt) return;
    await supabase.from("chasse_balises").insert({
      titre: form.titre.trim(), indice: form.indice.trim() || null,
      lat: pt.lat, lng: pt.lng, rayon_m: Number(form.rayon_m) || 20, ordre: balises.length,
    });
    setForm({ titre: "", indice: "", rayon_m: 20 }); setPt(null);
    charger();
  }
  async function uploadVideo(b, file) {
    if (!file) return;
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    const path = `chasse/${b.id}.${ext}`;
    const { error } = await supabase.storage.from("vf-photos").upload(path, file, { contentType: file.type, upsert: true });
    if (!error) { await supabase.from("chasse_balises").update({ media_chemin: path }).eq("id", b.id); charger(); }
  }
  async function suppr(b) {
    if (!window.confirm("Supprimer cette balise ?")) return;
    await supabase.from("chasse_balises").delete().eq("id", b.id);
    charger();
  }

  if (!dispo) return null;
  if (!enService) return null; // animation en veille (réglage admin)
  if (balisesActives.length === 0 && !estAdmin) return null;

  const total = balisesActives.length;
  const nbMoi = balisesActives.filter((b) => trouveesMoi.has(b.id)).length;
  const chaud = ma && cible ? chaleur(dCible) : null;

  return (
    <section className="chasse" id="chasse">
      <div className="wrap center reveal">
        <p className="eyebrow">La chasse au domaine</p>
        <h2>Un radar vers nos <em>souvenirs cachés</em></h2>

        {balisesActives.length > 0 ? (
          <>
            <p>
              Votre téléphone vous guide vers des balises invisibles semées dans le parc. Approchez-vous : sur le bon
              endroit, un souvenir se dévoile. {total} à découvrir — vous en avez trouvé {nbMoi}.
            </p>

            {!actif ? (
              <button type="button" className="btn-vert" onClick={demarrer}>🧭 Activer le radar</button>
            ) : nbMoi >= total ? (
              <p className="chasse-fini">Bravo, vous avez tout trouvé ! 🎉</p>
            ) : (
              <div className="chasse-radar">
                <div className="chasse-jauge" style={{ "--t": chaud?.t ?? 0, "--c": chaud?.c ?? "#5f83a0" }}>
                  <span className="chasse-temp">{chaud ? chaud.l : "Recherche du signal…"}</span>
                </div>
                {cible?.indice && <p className="chasse-indice">Indice : {cible.indice}</p>}
                {geoErr && <p className="gate-err" style={{ color: "#b06a4f" }}>{geoErr}</p>}
              </div>
            )}
          </>
        ) : (
          estAdmin && <p className="album-vide">Aucune balise pour l'instant — ajoutez-les ci-dessous, sur place.</p>
        )}

        {estAdmin && (
          <details className="chasse-admin">
            <summary>Balises (admin) — à faire sur le domaine</summary>
            <div className="chasse-form">
              <input placeholder="Titre (ex. Le vieux chêne)" value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} />
              <input placeholder="Indice (optionnel)" value={form.indice} onChange={(e) => setForm((f) => ({ ...f, indice: e.target.value }))} />
              <input type="number" placeholder="Rayon (m)" value={form.rayon_m} onChange={(e) => setForm((f) => ({ ...f, rayon_m: e.target.value }))} />
              <button type="button" className="btn-ghost" onClick={capturer}>{pt ? `📍 ${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}` : "📍 Capturer ma position"}</button>
              <button type="button" className="btn-vert" onClick={ajouter} disabled={!form.titre.trim() || !pt}>Ajouter la balise</button>
            </div>
            <ul className="chasse-liste">
              {balises.map((b) => (
                <li key={b.id}>
                  <span><strong>{b.titre}</strong> — {b.rayon_m} m {b.media_chemin ? "🎬" : "(pas de vidéo)"}</span>
                  <span className="chasse-liste-act">
                    <label className="chasse-up">🎬<input type="file" accept="video/*,image/*" hidden onChange={(e) => uploadVideo(b, e.target.files?.[0])} /></label>
                    <button type="button" className="btn-ghost" onClick={() => suppr(b)}>×</button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {reveal && (
        <div className="chasse-reveal" onClick={() => setReveal(null)} role="button" tabIndex={0}>
          <div className="chasse-reveal-box" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow">Trouvé !</p>
            <h3>{reveal.titre}</h3>
            {reveal.media_chemin ? (
              /\.(mp4|webm|mov)$/i.test(reveal.media_chemin)
                ? <video src={urlOf(reveal.media_chemin)} controls autoPlay playsInline className="chasse-media" />
                : <img src={urlOf(reveal.media_chemin)} alt={reveal.titre} className="chasse-media" />
            ) : (
              <p>Un souvenir vous attend ici 🌿</p>
            )}
            <button type="button" className="btn-vert" onClick={() => setReveal(null)}>Continuer la chasse</button>
          </div>
        </div>
      )}
    </section>
  );
}

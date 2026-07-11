import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import CameraCapture from "../CameraCapture.jsx";

/* Album photo des invités (site V&F) : chaque invité connecté ajoute ses
   photos → mur commun, visible de tous. Stockage : bucket public vf-photos. */

const urlOf = (chemin) => supabase.storage.from("vf-photos").getPublicUrl(chemin).data.publicUrl;
const estVideo = (c) => /\.(mp4|webm|mov|m4v|ogg)$/i.test(c || "");

function extDe(file) {
  const type = file.type || "";
  if (type.startsWith("video/") || estVideo(file.name)) {
    const n = (file.name || "").split(".").pop();
    if (n && /^(mp4|webm|mov|m4v|ogg)$/i.test(n)) return n.toLowerCase();
    if (type.includes("mp4")) return "mp4";
    if (type.includes("quicktime")) return "mov";
    return "webm";
  }
  return type === "image/jpeg" ? "jpg" : ((file.name || "photo.jpg").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
}

export default function MurPhotos({ profile }) {
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cam, setCam] = useState(false);
  const estAdmin = profile?.role === "admin";
  const prenom = (profile?.nom || "").split(" ")[0];

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("photos_invites")
      .select("id, invite_id, chemin, prenom, created_at")
      .order("created_at", { ascending: false });
    setPhotos(data || []);
  }, []);

  useEffect(() => {
    charger();
    const onVoir = () => document.visibilityState === "visible" && charger();
    document.addEventListener("visibilitychange", onVoir);
    const id = setInterval(onVoir, 45000);
    return () => {
      document.removeEventListener("visibilitychange", onVoir);
      clearInterval(id);
    };
  }, [charger]);

  async function televerser(file) {
    if (!file) return;
    setErr("");
    const type = file.type || "";
    const vid = type.startsWith("video/") || estVideo(file.name);
    if (type && !type.startsWith("image/") && !type.startsWith("video/")) return setErr("Choisissez une image ou une vidéo.");
    const maxMo = vid ? 50 : 12;
    if (file.size > maxMo * 1024 * 1024) return setErr(`Fichier trop lourd (max ${maxMo} Mo).`);
    setBusy(true);
    const path = `${profile.id}/${crypto.randomUUID()}.${extDe(file)}`;
    const { error: upErr } = await supabase.storage.from("vf-photos").upload(path, file, { contentType: type || (vid ? "video/webm" : "image/jpeg") });
    if (upErr) {
      setBusy(false);
      return setErr("Envoi impossible, réessayez.");
    }
    await supabase.from("photos_invites").insert({ invite_id: profile.id, chemin: path, prenom });
    setBusy(false);
    charger();
  }

  function surFichier(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) televerser(file);
  }

  async function supprimer(p) {
    if (!window.confirm("Retirer cette photo ?")) return;
    await supabase.from("photos_invites").delete().eq("id", p.id);
    supabase.storage.from("vf-photos").remove([p.chemin]).catch(() => {});
    charger();
  }

  return (
    <section className="album" id="album">
      <div className="wrap center">
        <p className="eyebrow">L'album des invités</p>
        <h2>
          Vos souvenirs, <em>partagés</em>
        </h2>
        <p>
          Une belle photo, une petite vidéo de la fête, d'un moment ? Ajoutez-la ici : elle rejoint le mur, en
          direct, pour que tout le monde en profite.
        </p>

        <div className="album-add">
          <button className="btn-vert album-btn" disabled={busy} onClick={() => setCam(true)}>
            📷 Photo ou vidéo
          </button>
          <label className="album-gal">
            🖼 Depuis la galerie
            <input type="file" accept="image/*,video/*" onChange={surFichier} disabled={busy} hidden />
          </label>
        </div>
        {busy && <p className="album-vide" style={{ marginTop: ".4rem" }}>Envoi en cours…</p>}
        {err && <p className="gate-err" style={{ color: "#b06a4f" }}>{err}</p>}

        {photos.length === 0 ? (
          <p className="album-vide">Soyez le premier à partager un souvenir. 🌿</p>
        ) : (
          <div className="album-grid">
            {photos.map((p) => (
              <figure key={p.id} className="album-item">
                {estVideo(p.chemin) ? (
                  <video src={urlOf(p.chemin)} controls playsInline preload="metadata" />
                ) : (
                  <img src={urlOf(p.chemin)} alt={p.prenom ? `Photo de ${p.prenom}` : "Photo d'invité"} loading="lazy" />
                )}
                {p.prenom && <figcaption>{p.prenom}</figcaption>}
                {(estAdmin || p.invite_id === profile?.id) && (
                  <button className="album-x" onClick={() => supprimer(p)} aria-label="Retirer cette photo">
                    ×
                  </button>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>

      {cam && (
        <CameraCapture
          onCapture={(blob) => {
            setCam(false);
            televerser(blob);
          }}
          onClose={() => setCam(false)}
        />
      )}
    </section>
  );
}

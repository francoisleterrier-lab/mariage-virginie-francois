import { useEffect, useState, useCallback } from "react";
import { sb } from "./supabaseFpv.js";
import CameraCapture from "../CameraCapture.jsx";

/* Album photo des invités : chacun prend/ajoute ses photos → galerie live.
   Stockage : bucket public « fpv-photos » ; métadonnées : table fpv_photos. */

const urlOf = (chemin) => sb.storage.from("fpv-photos").getPublicUrl(chemin).data.publicUrl;
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

export default function AlbumInvites({ invitationId }) {
  const [photos, setPhotos] = useState([]);
  const [prenom, setPrenom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cam, setCam] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await sb
      .from("fpv_photos")
      .select("id, chemin, prenom, created_at")
      .eq("invitation_id", invitationId)
      .order("created_at", { ascending: false });
    setPhotos(data || []);
  }, [invitationId]);

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
    const path = `${invitationId}/${crypto.randomUUID()}.${extDe(file)}`;
    const { error: upErr } = await sb.storage.from("fpv-photos").upload(path, file, { contentType: type || (vid ? "video/webm" : "image/jpeg") });
    if (upErr) {
      setBusy(false);
      return setErr("Envoi impossible, réessayez.");
    }
    await sb.from("fpv_photos").insert({ invitation_id: invitationId, chemin: path, prenom: prenom.trim() });
    setBusy(false);
    charger();
  }

  function surFichier(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) televerser(file);
  }

  return (
    <section className="fpv-sec" id="album">
      <h2>L'album des invités</h2>
      <p>Prenez une photo ou une vidéo en direct, ou choisissez-en une : elle apparaît ici, tout de suite, pour tout le monde.</p>

      <input
        className="fpv-album-nom"
        value={prenom}
        onChange={(e) => setPrenom(e.target.value)}
        placeholder="Votre prénom (facultatif)"
        aria-label="Votre prénom"
        style={{ display: "block", margin: "1.2rem auto 0" }}
      />
      <div className="fpv-album-add">
        <button className="fpv-cta" disabled={busy} onClick={() => setCam(true)}>📷 Prendre une photo / vidéo</button>
        <label className="fpv-album-gal">
          🖼 Choisir dans la galerie
          <input type="file" accept="image/*,video/*" onChange={surFichier} disabled={busy} hidden />
        </label>
      </div>
      {busy && <p className="fpv-hint" style={{ marginTop: ".6rem" }}>Envoi en cours…</p>}
      {err && <p className="fpv-err" style={{ marginTop: ".6rem" }}>{err}</p>}

      {photos.length === 0 ? (
        <p className="fpv-album-vide">Soyez le premier à ajouter un souvenir. 🌿</p>
      ) : (
        <div className="fpv-album-grid">
          {photos.map((p) => (
            <figure key={p.id} className="fpv-album-item">
              {estVideo(p.chemin) ? (
                <video src={urlOf(p.chemin)} controls playsInline preload="metadata" />
              ) : (
                <img src={urlOf(p.chemin)} alt={p.prenom ? `Photo de ${p.prenom}` : "Photo d'invité"} loading="lazy" />
              )}
              {p.prenom && <figcaption>{p.prenom}</figcaption>}
            </figure>
          ))}
        </div>
      )}

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

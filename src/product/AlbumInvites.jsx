import { useEffect, useState, useCallback } from "react";
import { sb } from "./supabaseFpv.js";
import CameraCapture from "../CameraCapture.jsx";

/* Album photo des invités : chacun prend/ajoute ses photos → galerie live.
   Stockage : bucket public « fpv-photos » ; métadonnées : table fpv_photos. */

const urlOf = (chemin) => sb.storage.from("fpv-photos").getPublicUrl(chemin).data.publicUrl;

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
    setErr("");
    if (file.type && !file.type.startsWith("image/")) return setErr("Choisissez une image.");
    if (file.size > 12 * 1024 * 1024) return setErr("Photo trop lourde (max 12 Mo).");
    setBusy(true);
    const ext =
      file.type === "image/jpeg" ? "jpg" : ((file.name || "photo.jpg").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${invitationId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await sb.storage.from("fpv-photos").upload(path, file, { contentType: file.type || "image/jpeg" });
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
      <p>Prenez une photo en direct ou choisissez-en une : elle apparaît ici, tout de suite, pour tout le monde.</p>

      <input
        className="fpv-album-nom"
        value={prenom}
        onChange={(e) => setPrenom(e.target.value)}
        placeholder="Votre prénom (facultatif)"
        aria-label="Votre prénom"
        style={{ display: "block", margin: "1.2rem auto 0" }}
      />
      <div className="fpv-album-add">
        <button className="fpv-cta" disabled={busy} onClick={() => setCam(true)}>📷 Prendre une photo</button>
        <label className="fpv-album-gal">
          🖼 Depuis la galerie
          <input type="file" accept="image/*" onChange={surFichier} disabled={busy} hidden />
        </label>
      </div>
      {busy && <p className="fpv-hint" style={{ marginTop: ".6rem" }}>Envoi de la photo…</p>}
      {err && <p className="fpv-err" style={{ marginTop: ".6rem" }}>{err}</p>}

      {photos.length === 0 ? (
        <p className="fpv-album-vide">Soyez le premier à ajouter un souvenir. 🌿</p>
      ) : (
        <div className="fpv-album-grid">
          {photos.map((p) => (
            <figure key={p.id} className="fpv-album-item">
              <img src={urlOf(p.chemin)} alt={p.prenom ? `Photo de ${p.prenom}` : "Photo d'invité"} loading="lazy" />
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

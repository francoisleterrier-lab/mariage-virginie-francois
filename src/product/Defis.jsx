import { useEffect, useState, useCallback } from "react";
import { sb } from "./supabaseFpv.js";
import CameraCapture from "../CameraCapture.jsx";

/* Défis photo : le couple définit une liste de défis (config) ; les invités
   les relèvent en prenant une photo. Photos dans fpv-photos, sous « defis/ ». */

const urlOf = (c) => sb.storage.from("fpv-photos").getPublicUrl(c).data.publicUrl;

export default function Defis({ invitationId, defis }) {
  const liste = (defis || []).map((s) => s.trim()).filter(Boolean);
  const [photos, setPhotos] = useState([]);
  const [prenom, setPrenom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [camIdx, setCamIdx] = useState(null);

  const charger = useCallback(async () => {
    const { data } = await sb
      .from("fpv_defis_photos")
      .select("id, defi_idx, chemin, prenom, created_at")
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

  async function ajouter(idx, blob) {
    setErr("");
    setBusy(true);
    const ext = (blob.type || "").includes("png") ? "png" : "jpg";
    const path = `defis/${invitationId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await sb.storage.from("fpv-photos").upload(path, blob, { contentType: blob.type || "image/jpeg" });
    if (upErr) {
      setBusy(false);
      return setErr("Envoi impossible, réessayez.");
    }
    const { error } = await sb.from("fpv_defis_photos").insert({ invitation_id: invitationId, defi_idx: idx, chemin: path, prenom: prenom.trim() });
    setBusy(false);
    if (error) return setErr("Envoi impossible, réessayez.");
    charger();
  }

  if (!liste.length) return null;

  const parDefi = (idx) => photos.filter((p) => p.defi_idx === idx);
  const releves = new Set(photos.map((p) => p.defi_idx)).size;

  return (
    <section className="fpv-sec fpv-defis" id="defis">
      <h2>Défis photo</h2>
      <p>Relevez les défis pendant la fête, une photo à la fois ! <strong>{releves}/{liste.length}</strong> défis déjà relevés.</p>

      <input
        className="fpv-album-nom"
        value={prenom}
        onChange={(e) => setPrenom(e.target.value)}
        placeholder="Votre prénom (facultatif)"
        aria-label="Votre prénom"
        style={{ display: "block", margin: "1rem auto 0" }}
      />
      {err && <p className="fpv-err" style={{ marginTop: ".6rem" }}>{err}</p>}

      <div className="fpv-defis-grid">
        {liste.map((d, idx) => {
          const ph = parDefi(idx);
          return (
            <div key={idx} className={"fpv-defis-item" + (ph.length ? " fait" : "")}>
              <div className="fpv-defis-head">
                <span className="fpv-defis-num">{ph.length ? "✓" : idx + 1}</span>
                <h3>{d}</h3>
              </div>
              {ph.length > 0 && (
                <div className="fpv-defis-vignettes">
                  {ph.slice(0, 6).map((p) => (
                    <img key={p.id} src={urlOf(p.chemin)} alt={p.prenom ? `Par ${p.prenom}` : "Défi relevé"} loading="lazy" />
                  ))}
                </div>
              )}
              <button className="fpv-album-gal" disabled={busy} onClick={() => setCamIdx(idx)}>📸 Relever le défi{ph.length ? ` (${ph.length})` : ""}</button>
            </div>
          );
        })}
      </div>

      {camIdx !== null && (
        <CameraCapture
          onCapture={(blob) => { const i = camIdx; setCamIdx(null); ajouter(i, blob); }}
          onClose={() => setCamIdx(null)}
        />
      )}
    </section>
  );
}

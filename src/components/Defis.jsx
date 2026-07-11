import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import CameraCapture from "../CameraCapture.jsx";

/* Défis photo (site V&F) : liste de défis en config (parametres defis_liste),
   relevés par les invités en photo. Photos dans vf-photos, sous « defis/ ». */

const urlOf = (c) => supabase.storage.from("vf-photos").getPublicUrl(c).data.publicUrl;

export default function Defis({ profile }) {
  const [liste, setListe] = useState([]);
  const [active, setActive] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [camIdx, setCamIdx] = useState(null);
  const prenom = (profile?.nom || "").split(" ")[0];

  const chargerConf = useCallback(async () => {
    const { data } = await supabase.from("parametres").select("cle, valeur").in("cle", ["defis_active", "defis_liste"]);
    const p = Object.fromEntries((data || []).map((r) => [r.cle, r.valeur]));
    setActive(p.defis_active === true);
    setListe(Array.isArray(p.defis_liste) ? p.defis_liste : []);
  }, []);

  const chargerPhotos = useCallback(async () => {
    const { data } = await supabase.from("defis_photos").select("id, defi_idx, chemin, prenom, created_at").order("created_at", { ascending: false });
    setPhotos(data || []);
  }, []);

  useEffect(() => {
    chargerConf();
    chargerPhotos();
    const onVoir = () => document.visibilityState === "visible" && chargerPhotos();
    document.addEventListener("visibilitychange", onVoir);
    const id = setInterval(onVoir, 45000);
    return () => {
      document.removeEventListener("visibilitychange", onVoir);
      clearInterval(id);
    };
  }, [chargerConf, chargerPhotos]);

  async function ajouter(idx, blob) {
    setErr("");
    setBusy(true);
    const ext = (blob.type || "").includes("png") ? "png" : "jpg";
    const path = `defis/${profile.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("vf-photos").upload(path, blob, { contentType: blob.type || "image/jpeg" });
    if (upErr) {
      setBusy(false);
      return setErr("Envoi impossible, réessayez.");
    }
    const { error } = await supabase.from("defis_photos").insert({ invite_id: profile.id, defi_idx: idx, chemin: path, prenom });
    setBusy(false);
    if (error) return setErr("Envoi impossible, réessayez.");
    chargerPhotos();
  }

  const clean = liste.map((s) => (s || "").trim()).filter(Boolean);
  if (!active || !clean.length) return null;

  const parDefi = (idx) => photos.filter((p) => p.defi_idx === idx);
  const releves = new Set(photos.map((p) => p.defi_idx)).size;

  return (
    <section className="defis-sec" id="defis">
      <div className="wrap center">
        <p className="eyebrow">Défis photo</p>
        <h2>
          Jouez avec <em>nous</em>
        </h2>
        <p>Relevez les défis pendant la fête, une photo à la fois ! <strong>{releves}/{clean.length}</strong> défis déjà relevés.</p>
        {err && <p className="gate-err" style={{ color: "#b06a4f" }}>{err}</p>}

        <div className="defis-grid">
          {clean.map((d, idx) => {
            const ph = parDefi(idx);
            return (
              <div key={idx} className={"defis-item" + (ph.length ? " fait" : "")}>
                <div className="defis-head">
                  <span className="defis-num">{ph.length ? "✓" : idx + 1}</span>
                  <h3>{d}</h3>
                </div>
                {ph.length > 0 && (
                  <div className="defis-vignettes">
                    {ph.slice(0, 6).map((p) => (
                      <img key={p.id} src={urlOf(p.chemin)} alt={p.prenom ? `Par ${p.prenom}` : "Défi relevé"} loading="lazy" />
                    ))}
                  </div>
                )}
                <button className="album-gal defis-btn" disabled={busy} onClick={() => setCamIdx(idx)}>📸 Relever le défi{ph.length ? ` (${ph.length})` : ""}</button>
              </div>
            );
          })}
        </div>
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

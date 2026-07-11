import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* Album photo des invités (site V&F) : chaque invité connecté ajoute ses
   photos → mur commun, visible de tous. Stockage : bucket public vf-photos. */

const urlOf = (chemin) => supabase.storage.from("vf-photos").getPublicUrl(chemin).data.publicUrl;

export default function MurPhotos({ profile }) {
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
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

  async function ajouter(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    if (!file.type.startsWith("image/")) return setErr("Choisissez une image.");
    if (file.size > 12 * 1024 * 1024) return setErr("Photo trop lourde (max 12 Mo).");
    setBusy(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${profile.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("vf-photos").upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(false);
      return setErr("Envoi impossible, réessayez.");
    }
    await supabase.from("photos_invites").insert({ invite_id: profile.id, chemin: path, prenom });
    setBusy(false);
    charger();
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
          Une belle photo de nous, de la fête, d'un moment ? Ajoutez-la ici : elle rejoint le mur, en direct, pour
          que tout le monde en profite.
        </p>

        <div className="album-add">
          <label className="btn-vert album-btn">
            {busy ? "Envoi…" : "📸 Ajouter une photo"}
            <input type="file" accept="image/*" onChange={ajouter} disabled={busy} hidden />
          </label>
        </div>
        {err && <p className="gate-err" style={{ color: "#b06a4f" }}>{err}</p>}

        {photos.length === 0 ? (
          <p className="album-vide">Soyez le premier à partager un souvenir. 🌿</p>
        ) : (
          <div className="album-grid">
            {photos.map((p) => (
              <figure key={p.id} className="album-item">
                <img src={urlOf(p.chemin)} alt={p.prenom ? `Photo de ${p.prenom}` : "Photo d'invité"} loading="lazy" />
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
    </section>
  );
}

import { useEffect, useState, useCallback } from "react";
import { sb } from "./supabaseFpv.js";
import CameraCapture from "../CameraCapture.jsx";

/* Livre d'or vidéo : les invités laissent un message filmé (ou écrit) pour les
   mariés. Vidéos dans le bucket fpv-photos, sous « livredor/ ». */

const urlOf = (c) => sb.storage.from("fpv-photos").getPublicUrl(c).data.publicUrl;

export default function LivreDor({ invitationId }) {
  const [entrees, setEntrees] = useState([]);
  const [prenom, setPrenom] = useState("");
  const [mot, setMot] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [cam, setCam] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await sb
      .from("fpv_livredor")
      .select("id, prenom, message, chemin, created_at")
      .eq("invitation_id", invitationId)
      .order("created_at", { ascending: false });
    setEntrees(data || []);
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

  function fini(error) {
    setBusy(false);
    if (error) return setErr("Envoi impossible, réessayez.");
    setMot("");
    setOk(true);
    setTimeout(() => setOk(false), 2600);
    charger();
  }

  async function ajouterVideo(blob) {
    setErr("");
    if (blob.size > 50 * 1024 * 1024) return setErr("Vidéo trop lourde (max 50 Mo).");
    setBusy(true);
    const ext = (blob.type || "").includes("mp4") ? "mp4" : "webm";
    const path = `livredor/${invitationId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await sb.storage.from("fpv-photos").upload(path, blob, { contentType: blob.type || "video/webm" });
    if (upErr) return fini(upErr);
    const { error } = await sb.from("fpv_livredor").insert({ invitation_id: invitationId, prenom: prenom.trim(), message: mot.trim(), chemin: path });
    fini(error);
  }

  async function envoyerTexte(e) {
    e.preventDefault();
    if (!mot.trim()) return;
    setErr("");
    setBusy(true);
    const { error } = await sb.from("fpv_livredor").insert({ invitation_id: invitationId, prenom: prenom.trim(), message: mot.trim(), chemin: null });
    fini(error);
  }

  return (
    <section className="fpv-sec fpv-livredor" id="livredor">
      <h2>Le livre d'or</h2>
      <p>Un vœu, une anecdote, un éclat de rire ? Laissez un message <strong>vidéo</strong> aux mariés — ou écrivez-le, tout simplement.</p>

      <input
        className="fpv-album-nom"
        value={prenom}
        onChange={(e) => setPrenom(e.target.value)}
        placeholder="Votre prénom (facultatif)"
        aria-label="Votre prénom"
        style={{ display: "block", margin: "1.2rem auto 0" }}
      />
      <div className="fpv-album-add">
        <button className="fpv-cta" disabled={busy} onClick={() => setCam(true)}>🎥 Message vidéo</button>
      </div>
      <form className="fpv-cag-form" onSubmit={envoyerTexte} style={{ marginTop: "1rem" }}>
        <textarea rows={2} value={mot} onChange={(e) => setMot(e.target.value)} placeholder="…ou écrivez un petit mot (accompagne aussi la vidéo)" aria-label="Votre message" />
        <button className="fpv-album-gal" disabled={busy || !mot.trim()}>{busy ? "Envoi…" : "✍️ Envoyer le mot"}</button>
        {ok && <span className="fpv-push-ok" style={{ fontSize: "1rem" }}>🌿 Merci !</span>}
        {err && <span className="fpv-err">{err}</span>}
      </form>

      {entrees.length === 0 ? (
        <p className="fpv-album-vide">Soyez le premier à laisser un mot aux mariés. 🌿</p>
      ) : (
        <div className="fpv-livredor-grid">
          {entrees.map((en) => (
            <figure key={en.id} className="fpv-livredor-item">
              {en.chemin && <video src={urlOf(en.chemin)} controls playsInline preload="metadata" />}
              {en.message && <blockquote>« {en.message} »</blockquote>}
              {en.prenom && <figcaption>— {en.prenom}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {cam && (
        <CameraCapture
          defaultMode="video"
          onCapture={(blob) => { setCam(false); ajouterVideo(blob); }}
          onClose={() => setCam(false)}
        />
      )}
    </section>
  );
}

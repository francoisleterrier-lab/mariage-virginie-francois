import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import CameraCapture from "../CameraCapture.jsx";

/* Livre d'or vidéo (site V&F) : chaque invité connecté laisse un message filmé
   (ou écrit) pour les mariés. Vidéos dans le bucket vf-photos, sous « livredor/ ». */

const urlOf = (c) => supabase.storage.from("vf-photos").getPublicUrl(c).data.publicUrl;

export default function LivreDor({ profile }) {
  const [entrees, setEntrees] = useState([]);
  const [mot, setMot] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [cam, setCam] = useState(false);
  const estAdmin = profile?.role === "admin";
  const prenom = (profile?.nom || "").split(" ")[0];

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("livre_dor")
      .select("id, invite_id, prenom, message, chemin, created_at")
      .order("created_at", { ascending: false });
    setEntrees(data || []);
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
    const path = `livredor/${profile.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("vf-photos").upload(path, blob, { contentType: blob.type || "video/webm" });
    if (upErr) return fini(upErr);
    const { error } = await supabase.from("livre_dor").insert({ invite_id: profile.id, prenom, message: mot.trim(), chemin: path });
    fini(error);
  }

  async function envoyerTexte(e) {
    e.preventDefault();
    if (!mot.trim()) return;
    setErr("");
    setBusy(true);
    const { error } = await supabase.from("livre_dor").insert({ invite_id: profile.id, prenom, message: mot.trim(), chemin: null });
    fini(error);
  }

  async function supprimer(en) {
    if (!window.confirm("Retirer ce message ?")) return;
    await supabase.from("livre_dor").delete().eq("id", en.id);
    if (en.chemin) supabase.storage.from("vf-photos").remove([en.chemin]).catch(() => {});
    charger();
  }

  return (
    <section className="livredor" id="livredor">
      <div className="wrap center">
        <p className="eyebrow">Le livre d'or</p>
        <h2>
          Un mot pour <em>nous</em>
        </h2>
        <p>Un vœu, une anecdote, un éclat de rire ? Laissez-nous un message <strong>vidéo</strong> — ou écrivez-le, tout simplement. Il rejoint le livre d'or, en direct.</p>

        <div className="album-add">
          <button className="btn-vert album-btn" disabled={busy} onClick={() => setCam(true)}>🎥 Message vidéo</button>
        </div>
        <form className="cag-form" onSubmit={envoyerTexte} style={{ marginTop: "1rem" }}>
          <textarea rows={2} value={mot} onChange={(e) => setMot(e.target.value)} placeholder="…ou écrivez un petit mot (accompagne aussi la vidéo)" aria-label="Votre message" />
          <button className="album-gal cag-envoi" disabled={busy || !mot.trim()}>{busy ? "Envoi…" : "✍️ Envoyer le mot"}</button>
          {ok && <span className="ok">🌿 Merci !</span>}
          {err && <span className="gate-err" style={{ color: "#b06a4f" }}>{err}</span>}
        </form>

        {entrees.length === 0 ? (
          <p className="album-vide">Soyez le premier à nous laisser un mot. 🌿</p>
        ) : (
          <div className="livredor-grid">
            {entrees.map((en) => (
              <figure key={en.id} className="livredor-item">
                {en.chemin && <video src={urlOf(en.chemin)} controls playsInline preload="metadata" />}
                {en.message && <blockquote>« {en.message} »</blockquote>}
                {en.prenom && <figcaption>— {en.prenom}</figcaption>}
                {(estAdmin || en.invite_id === profile?.id) && (
                  <button className="livredor-x" onClick={() => supprimer(en)} aria-label="Retirer ce message">×</button>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>

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

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* « Le Télégramme » — l'invité écrit un mot qui s'imprime en vrai près du bar.
   Le mot rejoint une file ; un agent branché à une imprimante thermique
   l'imprime. Section visible seulement si les mariés l'ont activée. */

export default function Telegramme({ profile }) {
  const [dispo, setDispo] = useState(true);
  const [actif, setActif] = useState(false);
  const [texte, setTexte] = useState("");
  const [fichier, setFichier] = useState(null);
  const [nb, setNb] = useState(0);
  const [envoye, setEnvoye] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const estAdmin = profile?.role === "admin";

  const charger = useCallback(async () => {
    const [{ data: par, error }, { count }] = await Promise.all([
      supabase.from("parametres").select("valeur").eq("cle", "telegramme").maybeSingle(),
      supabase.from("telegrammes").select("id", { count: "exact", head: true }),
    ]);
    if (error) { setDispo(false); return; }
    setDispo(true);
    setActif(!!par?.valeur?.actif);
    setNb(count || 0);
  }, []);

  useEffect(() => {
    charger();
    const t = setInterval(charger, 15000);
    return () => clearInterval(t);
  }, [charger]);

  async function basculer() {
    const next = !actif;
    setActif(next);
    await supabase.from("parametres").upsert({ cle: "telegramme", valeur: { actif: next } }, { onConflict: "cle" });
  }

  async function envoyer() {
    if (!texte.trim()) return;
    setBusy(true); setErr("");
    try {
      let photo_chemin = null;
      if (fichier) {
        const ext = (fichier.name.split(".").pop() || "jpg").toLowerCase();
        const path = `telegramme/${profile.id}-${Date.now()}.${ext}`;
        const { error: up } = await supabase.storage.from("vf-photos").upload(path, fichier, { contentType: fichier.type || "image/jpeg" });
        if (up) throw up;
        photo_chemin = path;
      }
      const prenom = (profile.nom || "").split(" ")[0];
      const { error } = await supabase.from("telegrammes").insert({ invite_id: profile.id, prenom, texte: texte.trim(), photo_chemin });
      if (error) throw error;
      setTexte(""); setFichier(null); setEnvoye(true);
      setTimeout(() => setEnvoye(false), 4000);
      charger();
    } catch (e) {
      setErr(e.message || "Envoi impossible.");
    }
    setBusy(false);
  }

  if (!dispo) return null;
  if (!actif && !estAdmin) return null;

  return (
    <section className="telegramme" id="telegramme">
      <div className="wrap center reveal">
        <p className="eyebrow">Le télégramme</p>
        <h2>Un mot qui <em>s'imprime en vrai</em></h2>
        <p>
          Écrivez un petit mot : quelques secondes plus tard, il s'imprime sur un vrai télégramme près du bar et tombe
          dans le bocal des mariés. {nb > 0 && <>Déjà <strong>{nb}</strong> télégramme{nb > 1 ? "s" : ""} ce soir.</>}
        </p>

        {actif ? (
          envoye ? (
            <p className="telegramme-ok">✨ Votre télégramme part à l'impression… allez le récupérer près du bar !</p>
          ) : (
            <div className="telegramme-form">
              <textarea rows={3} maxLength={220} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Votre petit mot aux mariés…" />
              <div className="telegramme-actions">
                <label className="album-gal">🖼 Photo (option)<input type="file" accept="image/*" hidden onChange={(e) => setFichier(e.target.files?.[0] || null)} /></label>
                <button type="button" className="btn-vert" disabled={busy || !texte.trim()} onClick={envoyer}>{busy ? "…" : "Imprimer mon télégramme"}</button>
              </div>
              {fichier && <p className="telegramme-fichier">📎 {fichier.name}</p>}
              {err && <p className="gate-err" style={{ color: "#b06a4f" }}>{err}</p>}
            </div>
          )
        ) : (
          <p className="album-vide">Section inactive — activez-la quand l'imprimante est prête.</p>
        )}

        {estAdmin && (
          <label className="telegramme-toggle">
            <input type="checkbox" checked={actif} onChange={basculer} />
            {actif ? "Télégramme actif (imprimante branchée)" : "Activer le télégramme"}
          </label>
        )}
      </div>
    </section>
  );
}

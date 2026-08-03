import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* Admin du « Canal » : le couple crée une annonce (brouillon), la publie,
   puis envoie la notification push (réutilise l'edge function existante). */

const TYPES = [
  { v: "naissance", l: "Naissance 👶" },
  { v: "demenagement", l: "Déménagement 🏡" },
  { v: "voyage", l: "Voyage ✈️" },
  { v: "anniversaire", l: "Anniversaire de mariage 💍" },
  { v: "autre", l: "Autre 🌿" },
];

export default function CanalAdmin() {
  const [annonces, setAnnonces] = useState([]);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ type: "naissance", titre: "", message: "" });
  const [fichier, setFichier] = useState(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from("annonces").select("*").order("created_at", { ascending: false });
    if (error) {
      setErr("Les tables du Canal n'existent pas encore. Exécutez d'abord le SQL fourni dans Supabase (SQL Editor).");
      return;
    }
    setErr("");
    setAnnonces(data || []);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function creer() {
    if (!form.titre.trim() || !form.message.trim()) {
      setErr("Titre et message requis.");
      return;
    }
    setBusy(true);
    setErr("");
    setInfo("");
    try {
      let media_chemin = null;
      if (fichier) {
        const ext = (fichier.name.split(".").pop() || "jpg").toLowerCase();
        const path = `canal/${Date.now()}.${ext}`;
        const { error: up } = await supabase.storage.from("vf-photos").upload(path, fichier, { contentType: fichier.type || "image/jpeg" });
        if (up) throw up;
        media_chemin = path;
      }
      const { error } = await supabase.from("annonces").insert({
        type: form.type, titre: form.titre.trim(), message: form.message.trim(), media_chemin, publiee: false,
      });
      if (error) throw error;
      setForm({ type: "naissance", titre: "", message: "" });
      setFichier(null);
      setInfo("Annonce créée en brouillon. Publiez-la puis envoyez la notification.");
      charger();
    } catch (e) {
      setErr(e.message || "Erreur.");
    }
    setBusy(false);
  }

  async function togglePubli(a) {
    await supabase.from("annonces").update({ publiee: !a.publiee }).eq("id", a.id);
    charger();
  }

  async function supprimer(a) {
    if (!window.confirm("Supprimer cette annonce ?")) return;
    await supabase.from("annonces").delete().eq("id", a.id);
    if (a.media_chemin) supabase.storage.from("vf-photos").remove([a.media_chemin]).catch(() => {});
    charger();
  }

  async function pousser(a) {
    setInfo("");
    setErr("");
    const { data, error } = await supabase.functions.invoke("envoyer-notification", {
      body: { titre: `Virginie & François — ${a.titre}`, message: a.message.slice(0, 140), url: "./#canal" },
    });
    if (error) {
      setErr("Envoi impossible : " + error.message);
      return;
    }
    setInfo(`Notification envoyée (${data?.envoyes ?? 0} destinataire${(data?.envoyes ?? 0) > 1 ? "s" : ""}).`);
  }

  return (
    <div className="admin-bloc">
      <h2 className="admin-h2">Le Canal — annonces après le mariage 🌿</h2>
      <p className="admin-sous">
        Publiez une nouvelle (naissance, déménagement…) : elle réveille l'app des invités et rouvre votre faire-part
        comme un cercle privé. Créez d'abord un brouillon, publiez-le, puis envoyez la notification.
      </p>
      {err && <p className="gate-err" style={{ color: "#b06a4f" }}>{err}</p>}
      {info && <p className="admin-sous" style={{ color: "#5f7758" }}>{info}</p>}

      <div className="canal-form">
        <label className="admin-partage-l">
          Type
          <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </label>
        <label className="admin-partage-l">
          Titre
          <input value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} placeholder="Ex. Bienvenue à Jules 👶" />
        </label>
        <label className="admin-partage-l">
          Message
          <textarea rows={3} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Votre annonce…" />
        </label>
        <label className="admin-partage-l">
          Photo (optionnelle)
          <input type="file" accept="image/*" onChange={(e) => setFichier(e.target.files?.[0] || null)} />
        </label>
        <button type="button" className="btn-vert" disabled={busy} onClick={creer}>
          {busy ? "…" : "Créer l'annonce (brouillon)"}
        </button>
      </div>

      <ul className="canal-liste">
        {annonces.map((a) => (
          <li key={a.id}>
            <div className="canal-liste-txt">
              <strong>{a.titre}</strong>
              <span className={"canal-badge" + (a.publiee ? " on" : "")}>{a.publiee ? "Publiée" : "Brouillon"}</span>
              <p>{a.message}</p>
            </div>
            <div className="canal-actions">
              <button type="button" className="btn-ghost" onClick={() => togglePubli(a)}>{a.publiee ? "Dépublier" : "Publier"}</button>
              <button type="button" className="btn-ghost" onClick={() => pousser(a)} disabled={!a.publiee}>🔔 Notifier</button>
              <button type="button" className="btn-ghost" onClick={() => supprimer(a)}>Supprimer</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

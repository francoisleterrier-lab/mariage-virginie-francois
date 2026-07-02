import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

const fmt = (iso) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/* ============================================================
   Admin — envoi d'une notification push à tous les abonnés.
   Appelle l'Edge Function envoyer-notification (VAPID côté serveur).
   ============================================================ */
export default function PushAdmin() {
  const [titre, setTitre] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [retour, setRetour] = useState(null); // {ok, texte}
  const [log, setLog] = useState([]);
  const [nbAbonnes, setNbAbonnes] = useState(null);

  async function rafraichir() {
    // Le total d'abonnés passe par une fonction security definer :
    // push_subscriptions n'est pas lisible globalement depuis le front.
    const [{ data: l }, { data: n }] = await Promise.all([
      supabase.from("notifications_log").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.rpc("nb_abonnes"),
    ]);
    setLog(l || []);
    setNbAbonnes(typeof n === "number" ? n : null);
  }

  useEffect(() => {
    rafraichir();
  }, []);

  async function envoyer(e) {
    e.preventDefault();
    setBusy(true);
    setRetour(null);
    const { data, error } = await supabase.functions.invoke("envoyer-notification", {
      body: { titre: titre.trim(), message: message.trim() },
    });
    setBusy(false);
    if (error) {
      setRetour({ ok: false, texte: error.message || "Échec de l'envoi." });
      return;
    }
    setRetour({ ok: true, texte: `Envoyée à ${data.envoyes}/${data.total} abonné·e·s.` });
    setTitre("");
    setMessage("");
    rafraichir();
  }

  return (
    <div className="admin-bloc">
      <h2 className="admin-h2">Notifications push</h2>
      <p className="admin-sous">
        {nbAbonnes === null ? "…" : `${nbAbonnes} appareil·s abonné·s`} — révélation du lieu, programme du samedi,
        rappel RSVP, infos jour J.
      </p>

      <form className="push-form" onSubmit={envoyer}>
        <label htmlFor="n-titre">Titre</label>
        <input
          id="n-titre"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          required
          maxLength={60}
          placeholder="Le lieu est révélé ! 🌿"
        />
        <label htmlFor="n-msg">Message</label>
        <textarea
          id="n-msg"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={180}
          placeholder="Rendez-vous au cœur du Sud-Toulousain… découvrez l'adresse sur le site."
        />
        <button className="btn-vert" disabled={busy || !titre.trim() || !message.trim()}>
          {busy ? "Envoi…" : "Envoyer à tous les abonnés"}
        </button>
        {retour && (
          <p className={retour.ok ? "ok" : "gate-err"} style={retour.ok ? null : { color: "#b06a4f" }}>
            {retour.texte}
          </p>
        )}
      </form>

      <h3 className="admin-h3">Historique des envois</h3>
      {log.length === 0 ? (
        <p className="attente">Aucune notification envoyée pour l'instant.</p>
      ) : (
        <ul className="push-log">
          {log.map((n) => (
            <li key={n.id}>
              <div>
                <strong>{n.titre}</strong>
                <span>{n.message}</span>
              </div>
              <em>
                {fmt(n.created_at)} · {n.envoyes} envoi·s
              </em>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

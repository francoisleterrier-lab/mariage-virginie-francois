import { useEffect, useState, useCallback } from "react";
import { sb } from "./supabaseFpv.js";

/* Playlist collaborative : les invités proposent des chansons ; le couple (et
   son DJ) récupère la liste. */
export default function Playlist({ invitationId }) {
  const [items, setItems] = useState([]);
  const [f, setF] = useState({ titre: "", artiste: "", prenom: "" });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const charger = useCallback(async () => {
    const { data } = await sb
      .from("fpv_playlist")
      .select("id, titre, artiste, prenom, created_at")
      .eq("invitation_id", invitationId)
      .order("created_at", { ascending: false });
    setItems(data || []);
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

  async function ajouter(e) {
    e.preventDefault();
    if (!f.titre.trim()) return;
    setErr("");
    setBusy(true);
    const { error } = await sb.from("fpv_playlist").insert({ invitation_id: invitationId, titre: f.titre.trim(), artiste: f.artiste.trim(), prenom: f.prenom.trim() });
    setBusy(false);
    if (error) return setErr("Envoi impossible, réessayez.");
    setF((s) => ({ titre: "", artiste: "", prenom: s.prenom }));
    setOk(true);
    setTimeout(() => setOk(false), 2400);
    charger();
  }

  return (
    <section className="fpv-sec fpv-playlist" id="playlist">
      <h2>La playlist</h2>
      <p>Une chanson qui doit absolument passer ? Proposez-la — on la transmet au DJ. 🎵</p>

      <form className="fpv-pl-form" onSubmit={ajouter}>
        <input value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} placeholder="Titre de la chanson" aria-label="Titre de la chanson" />
        <input value={f.artiste} onChange={(e) => setF({ ...f, artiste: e.target.value })} placeholder="Artiste (facultatif)" aria-label="Artiste" />
        <input value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} placeholder="Votre prénom (facultatif)" aria-label="Votre prénom" />
        <button className="fpv-cta" disabled={busy || !f.titre.trim()}>{busy ? "…" : "Proposer"}</button>
        {ok && <span className="fpv-push-ok" style={{ fontSize: "1rem" }}>🌿 Ajoutée !</span>}
        {err && <span className="fpv-err">{err}</span>}
      </form>

      {items.length === 0 ? (
        <p className="fpv-album-vide">Aucune chanson proposée pour l'instant. Ouvrez le bal ! 🎶</p>
      ) : (
        <ul className="fpv-pl-liste">
          {items.map((s) => (
            <li key={s.id}>
              <span className="fpv-pl-note" aria-hidden="true">🎵</span>
              <span className="fpv-pl-txt">
                <strong>{s.titre}</strong>
                {s.artiste ? ` — ${s.artiste}` : ""}
                {s.prenom ? <em> · proposé par {s.prenom}</em> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

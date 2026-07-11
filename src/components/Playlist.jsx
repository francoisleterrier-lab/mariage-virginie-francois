import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* Playlist collaborative (site V&F) : les invités proposent des chansons. */
export default function Playlist({ profile }) {
  const [items, setItems] = useState([]);
  const [f, setF] = useState({ titre: "", artiste: "" });
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const estAdmin = profile?.role === "admin";
  const prenom = (profile?.nom || "").split(" ")[0];

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("playlist")
      .select("id, invite_id, titre, artiste, prenom, created_at")
      .order("created_at", { ascending: false });
    setItems(data || []);
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
    e.preventDefault();
    if (!f.titre.trim()) return;
    setErr("");
    setBusy(true);
    const { error } = await supabase.from("playlist").insert({ invite_id: profile.id, titre: f.titre.trim(), artiste: f.artiste.trim(), prenom });
    setBusy(false);
    if (error) return setErr("Envoi impossible, réessayez.");
    setF({ titre: "", artiste: "" });
    setOk(true);
    setTimeout(() => setOk(false), 2400);
    charger();
  }

  async function supprimer(s) {
    await supabase.from("playlist").delete().eq("id", s.id);
    charger();
  }

  return (
    <section className="playlist-sec" id="playlist">
      <div className="wrap center">
        <p className="eyebrow">La playlist</p>
        <h2>
          Vos <em>chansons</em>
        </h2>
        <p>Une chanson qui doit absolument passer ? Proposez-la — on la transmet au DJ. 🎵</p>

        <form className="pl-form" onSubmit={ajouter}>
          <input value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} placeholder="Titre de la chanson" aria-label="Titre de la chanson" />
          <input value={f.artiste} onChange={(e) => setF({ ...f, artiste: e.target.value })} placeholder="Artiste (facultatif)" aria-label="Artiste" />
          <button className="btn-vert pl-btn" disabled={busy || !f.titre.trim()}>{busy ? "…" : "Proposer"}</button>
          {ok && <span className="ok">🌿 Ajoutée !</span>}
          {err && <span className="gate-err" style={{ color: "#b06a4f" }}>{err}</span>}
        </form>

        {items.length === 0 ? (
          <p className="album-vide">Aucune chanson proposée pour l'instant. Ouvrez le bal ! 🎶</p>
        ) : (
          <ul className="pl-liste">
            {items.map((s) => (
              <li key={s.id}>
                <span className="pl-note" aria-hidden="true">🎵</span>
                <span className="pl-txt">
                  <strong>{s.titre}</strong>
                  {s.artiste ? ` — ${s.artiste}` : ""}
                  {s.prenom ? <em> · {s.prenom}</em> : null}
                </span>
                {(estAdmin || s.invite_id === profile?.id) && (
                  <button className="pl-x" onClick={() => supprimer(s)} aria-label="Retirer">×</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

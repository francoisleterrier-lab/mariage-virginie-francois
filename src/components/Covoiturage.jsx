import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* Covoiturage (site V&F) : les invités proposent ou cherchent une place. */
const VIDE = { type: "offre", ville: "", quand: "", places: "2", contact: "" };

export default function Covoiturage({ profile }) {
  const [items, setItems] = useState([]);
  const [f, setF] = useState(VIDE);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const estAdmin = profile?.role === "admin";
  const prenom = (profile?.nom || "").split(" ")[0];

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("covoiturage")
      .select("id, invite_id, type, ville, quand, places, prenom, contact, created_at")
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
    if (!f.ville.trim()) return setErr("Indiquez au moins la ville de départ.");
    setErr("");
    setBusy(true);
    const { error } = await supabase.from("covoiturage").insert({
      invite_id: profile.id,
      type: f.type,
      ville: f.ville.trim(),
      quand: f.quand.trim(),
      places: f.type === "offre" ? parseInt(f.places) || 1 : 0,
      prenom,
      contact: f.contact.trim(),
    });
    setBusy(false);
    if (error) return setErr("Envoi impossible, réessayez.");
    setF((s) => ({ ...VIDE, type: s.type }));
    setOk(true);
    setTimeout(() => setOk(false), 2400);
    charger();
  }

  async function supprimer(c) {
    await supabase.from("covoiturage").delete().eq("id", c.id);
    charger();
  }

  return (
    <section className="covoit-sec" id="covoiturage">
      <div className="wrap center">
        <p className="eyebrow">Covoiturage</p>
        <h2>
          La route <em>ensemble</em>
        </h2>
        <p>Le domaine est un peu à l'écart : proposez ou cherchez une place, et partagez le trajet. 🚗</p>

        <a className="covoit-vol" href="https://www.volotea.com/fr/" target="_blank" rel="noopener noreferrer">
          <span className="covoit-vol-ico" aria-hidden="true">✈️</span>
          <span className="covoit-vol-txt">
            <strong>Vous venez de Normandie ?</strong> Volotea relie <strong>Caen-Carpiquet</strong> à{" "}
            <strong>Toulouse-Blagnac</strong> en direct. L'idéal : aller le <strong>jeudi 25 mai</strong>, retour le{" "}
            <strong>dimanche 28</strong> ou <strong>lundi 29 mai</strong>. Pensez à réserver tôt — et à vous
            regrouper pour l'aéroport ! 🌿
            <span className="covoit-vol-lien">Voir les vols Volotea →</span>
          </span>
        </a>

        <form className="pl-form" onSubmit={ajouter}>
          <div className="covoit-type">
            <button type="button" className={f.type === "offre" ? "on" : ""} onClick={() => setF({ ...f, type: "offre" })}>🚗 Je propose</button>
            <button type="button" className={f.type === "recherche" ? "on" : ""} onClick={() => setF({ ...f, type: "recherche" })}>🙋 Je cherche</button>
          </div>
          <input value={f.ville} onChange={(e) => setF({ ...f, ville: e.target.value })} placeholder="Ville / secteur de départ" aria-label="Ville de départ" />
          <input value={f.quand} onChange={(e) => setF({ ...f, quand: e.target.value })} placeholder="Quand ? (ex. vendredi 18h)" aria-label="Quand" />
          {f.type === "offre" && (
            <input type="number" min="1" max="8" value={f.places} onChange={(e) => setF({ ...f, places: e.target.value })} placeholder="Places disponibles" aria-label="Places" />
          )}
          <input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="Comment vous joindre (tél, e-mail…)" aria-label="Contact" />
          <button className="btn-vert pl-btn" disabled={busy}>{busy ? "…" : "Publier"}</button>
          {ok && <span className="ok">🌿 Publié !</span>}
          {err && <span className="gate-err" style={{ color: "#b06a4f" }}>{err}</span>}
        </form>

        {items.length === 0 ? (
          <p className="album-vide">Aucune annonce pour l'instant. Lancez le covoiturage ! 🚙</p>
        ) : (
          <ul className="covoit-liste">
            {items.map((c) => (
              <li key={c.id} className={"covoit-item " + c.type}>
                <span className="covoit-badge">{c.type === "offre" ? `🚗 Propose ${c.places} place${c.places > 1 ? "s" : ""}` : "🙋 Cherche une place"}</span>
                <div className="covoit-info">
                  <strong>Depuis {c.ville}</strong>
                  {c.quand ? ` · ${c.quand}` : ""}
                  {c.prenom ? ` · ${c.prenom}` : ""}
                  {c.contact ? <span className="covoit-contact"> · {c.contact}</span> : null}
                </div>
                {(estAdmin || c.invite_id === profile?.id) && (
                  <button className="covoit-x" onClick={() => supprimer(c)} aria-label="Retirer">×</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

import { useEffect, useState, useCallback } from "react";
import { sb } from "./supabaseFpv.js";

/* Covoiturage : les invités proposent ou cherchent une place. */
const VIDE = { type: "offre", ville: "", quand: "", places: "2", prenom: "", contact: "" };

export default function Covoiturage({ invitationId }) {
  const [items, setItems] = useState([]);
  const [f, setF] = useState(VIDE);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const charger = useCallback(async () => {
    const { data } = await sb
      .from("fpv_covoit")
      .select("id, type, ville, quand, places, prenom, contact, created_at")
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
    if (!f.ville.trim()) return setErr("Indiquez au moins la ville de départ.");
    setErr("");
    setBusy(true);
    const { error } = await sb.from("fpv_covoit").insert({
      invitation_id: invitationId,
      type: f.type,
      ville: f.ville.trim(),
      quand: f.quand.trim(),
      places: f.type === "offre" ? parseInt(f.places) || 1 : 0,
      prenom: f.prenom.trim(),
      contact: f.contact.trim(),
    });
    setBusy(false);
    if (error) return setErr("Envoi impossible, réessayez.");
    setF((s) => ({ ...VIDE, type: s.type, prenom: s.prenom }));
    setOk(true);
    setTimeout(() => setOk(false), 2400);
    charger();
  }

  return (
    <section className="fpv-sec fpv-covoit" id="covoiturage">
      <h2>Covoiturage</h2>
      <p>Le domaine est un peu à l'écart : proposez ou cherchez une place, et faites la route ensemble. 🚗</p>

      <form className="fpv-pl-form" onSubmit={ajouter}>
        <div className="fpv-covoit-type">
          <button type="button" className={f.type === "offre" ? "on" : ""} onClick={() => setF({ ...f, type: "offre" })}>🚗 Je propose</button>
          <button type="button" className={f.type === "recherche" ? "on" : ""} onClick={() => setF({ ...f, type: "recherche" })}>🙋 Je cherche</button>
        </div>
        <input value={f.ville} onChange={(e) => setF({ ...f, ville: e.target.value })} placeholder="Ville / secteur de départ" aria-label="Ville de départ" />
        <input value={f.quand} onChange={(e) => setF({ ...f, quand: e.target.value })} placeholder="Quand ? (ex. vendredi 18h)" aria-label="Quand" />
        {f.type === "offre" && (
          <input type="number" min="1" max="8" value={f.places} onChange={(e) => setF({ ...f, places: e.target.value })} placeholder="Places disponibles" aria-label="Places" />
        )}
        <input value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} placeholder="Votre prénom" aria-label="Votre prénom" />
        <input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="Comment vous joindre (tél, e-mail…)" aria-label="Contact" />
        <button className="fpv-cta" disabled={busy}>{busy ? "…" : "Publier"}</button>
        {ok && <span className="fpv-push-ok" style={{ fontSize: "1rem" }}>🌿 Publié !</span>}
        {err && <span className="fpv-err">{err}</span>}
      </form>

      {items.length === 0 ? (
        <p className="fpv-album-vide">Aucune annonce pour l'instant. Lancez le covoiturage ! 🚙</p>
      ) : (
        <ul className="fpv-covoit-liste">
          {items.map((c) => (
            <li key={c.id} className={"fpv-covoit-item " + c.type}>
              <span className="fpv-covoit-badge">{c.type === "offre" ? `🚗 Propose ${c.places} place${c.places > 1 ? "s" : ""}` : "🙋 Cherche une place"}</span>
              <div className="fpv-covoit-info">
                <strong>Depuis {c.ville}</strong>
                {c.quand ? ` · ${c.quand}` : ""}
                {c.prenom ? ` · ${c.prenom}` : ""}
                {c.contact ? <span className="fpv-covoit-contact"> · {c.contact}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

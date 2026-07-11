import { useEffect, useState, useCallback } from "react";
import { sb } from "./supabaseFpv.js";

/* Cagnotte / liste de mariage (fonds commun).
   Le montant collecté est géré par le couple (mise à jour manuelle), la
   participation passe par un lien externe (Leetchi, Lydia, PayPal, RIB…).
   Ici : présentation + barre de progression + mur de petits mots. */

const eur = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " €";

export default function Cagnotte({ invitationId, cfg }) {
  const { titre, texte, objectif, montant, lien } = cfg || {};
  const [messages, setMessages] = useState([]);
  const [prenom, setPrenom] = useState("");
  const [mot, setMot] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await sb
      .from("fpv_cagnotte_messages")
      .select("id, prenom, message, created_at")
      .eq("invitation_id", invitationId)
      .order("created_at", { ascending: false });
    setMessages(data || []);
  }, [invitationId]);
  useEffect(() => {
    charger();
  }, [charger]);

  const obj = Number(objectif) || 0;
  const col = Number(montant) || 0;
  const pct = obj > 0 ? Math.min(100, Math.round((col / obj) * 100)) : 0;
  const url = (lien || "").trim();

  async function envoyer(e) {
    e.preventDefault();
    if (!mot.trim()) return;
    setBusy(true);
    await sb.from("fpv_cagnotte_messages").insert({ invitation_id: invitationId, prenom: prenom.trim(), message: mot.trim() });
    setBusy(false);
    setMot("");
    setOk(true);
    setTimeout(() => setOk(false), 2600);
    charger();
  }

  return (
    <section className="fpv-sec fpv-cagnotte" id="cagnotte">
      <h2>{(titre || "").trim() || "Notre cagnotte"}</h2>
      {(texte || "").trim() &&
        texte.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}

      {obj > 0 && (
        <div className="fpv-cag-jauge" role="img" aria-label={`${eur(col)} collectés sur un objectif de ${eur(obj)}`}>
          <div className="fpv-cag-bar"><span style={{ width: pct + "%" }} /></div>
          <div className="fpv-cag-chiffres">
            <strong>{eur(col)}</strong> sur {eur(obj)} · {pct}%
          </div>
        </div>
      )}

      {url && (
        <a className="fpv-cta fpv-cag-cta" href={url} target="_blank" rel="noopener noreferrer">
          💝 Participer à la cagnotte
        </a>
      )}

      <div className="fpv-cag-mots">
        <form className="fpv-cag-form" onSubmit={envoyer}>
          <input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Votre prénom (facultatif)" aria-label="Votre prénom" />
          <textarea rows={2} value={mot} onChange={(e) => setMot(e.target.value)} placeholder="Un petit mot pour les mariés…" aria-label="Votre message" />
          <button className="fpv-album-gal" disabled={busy || !mot.trim()}>{busy ? "Envoi…" : "Laisser un mot"}</button>
          {ok && <span className="fpv-push-ok" style={{ fontSize: "1rem" }}>🌿 Merci !</span>}
        </form>

        {messages.length > 0 && (
          <ul className="fpv-cag-liste">
            {messages.map((m) => (
              <li key={m.id}>
                <p>« {m.message} »</p>
                {m.prenom && <span>— {m.prenom}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   « La cagnotte » côté invité (site V&F).
   Fonds commun : objectif + barre de progression + mur de petits mots.
   La participation passe par un lien externe (Leetchi, Lydia, PayPal, RIB…) ;
   le montant collecté est tenu à jour par les mariés (admin).
   Config : table parametres (cagnotte_active, cagnotte_titre, cagnotte_texte,
   cagnotte_objectif, cagnotte_montant, cagnotte_lien).
   ============================================================ */

const eur = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " €";

export default function Cagnotte({ profile }) {
  const [prets, setPrets] = useState(false);
  const [active, setActive] = useState(false);
  const [titre, setTitre] = useState("");
  const [texte, setTexte] = useState("");
  const [objectif, setObjectif] = useState(0);
  const [montant, setMontant] = useState(0);
  const [lien, setLien] = useState("");
  const [messages, setMessages] = useState([]);
  const [mot, setMot] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const estAdmin = profile?.role === "admin";
  const prenom = (profile?.nom || "").split(" ")[0];

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from("parametres")
      .select("cle, valeur")
      .in("cle", ["cagnotte_active", "cagnotte_titre", "cagnotte_texte", "cagnotte_objectif", "cagnotte_montant", "cagnotte_lien"]);
    const p = Object.fromEntries((data || []).map((r) => [r.cle, r.valeur]));
    setActive(p.cagnotte_active === true);
    if (typeof p.cagnotte_titre === "string") setTitre(p.cagnotte_titre);
    if (typeof p.cagnotte_texte === "string") setTexte(p.cagnotte_texte);
    setObjectif(Number(p.cagnotte_objectif) || 0);
    setMontant(Number(p.cagnotte_montant) || 0);
    if (typeof p.cagnotte_lien === "string") setLien(p.cagnotte_lien);
    setPrets(true);
  }, []);

  const chargerMsgs = useCallback(async () => {
    const { data } = await supabase
      .from("cagnotte_messages")
      .select("id, invite_id, prenom, message, created_at")
      .order("created_at", { ascending: false });
    setMessages(data || []);
  }, []);

  useEffect(() => {
    charger();
    chargerMsgs();
  }, [charger, chargerMsgs]);

  if (!prets || !active) return null;

  const obj = Number(objectif) || 0;
  const col = Number(montant) || 0;
  const pct = obj > 0 ? Math.min(100, Math.round((col / obj) * 100)) : 0;
  const url = (lien || "").trim();

  async function envoyer(e) {
    e.preventDefault();
    if (!mot.trim()) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase.from("cagnotte_messages").insert({ invite_id: profile.id, prenom, message: mot.trim() });
    setBusy(false);
    if (error) {
      setErr("Envoi impossible, réessayez.");
      return;
    }
    setMot("");
    setOk(true);
    setTimeout(() => setOk(false), 2600);
    chargerMsgs();
  }

  async function supprimer(m) {
    if (!window.confirm("Retirer ce mot ?")) return;
    await supabase.from("cagnotte_messages").delete().eq("id", m.id);
    chargerMsgs();
  }

  return (
    <section className="cagnotte" id="cagnotte">
      <div className="wrap center">
        <p className="eyebrow">La cagnotte</p>
        <h2>{titre.trim() ? titre : <>Notre <em>cagnotte</em></>}</h2>
        {texte.trim() ? (
          texte.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)
        ) : (
          <p>Votre présence est notre plus beau cadeau. Si le cœur vous en dit, vous pouvez aussi participer à notre cagnotte — un coup de pouce pour notre voyage de noces. 🌿</p>
        )}

        {obj > 0 && (
          <div className="cag-jauge" role="img" aria-label={`${eur(col)} collectés sur un objectif de ${eur(obj)}`}>
            <div className="cag-bar"><span style={{ width: pct + "%" }} /></div>
            <div className="cag-chiffres">
              <strong>{eur(col)}</strong> sur {eur(obj)} · {pct}%
            </div>
          </div>
        )}

        {url && (
          <a className="btn-vert cag-cta" href={url} target="_blank" rel="noopener noreferrer">
            💝 Participer à la cagnotte
          </a>
        )}

        <div className="cag-mots">
          <form className="cag-form" onSubmit={envoyer}>
            <textarea rows={2} value={mot} onChange={(e) => setMot(e.target.value)} placeholder="Un petit mot pour les mariés…" aria-label="Votre message" />
            <button className="album-gal cag-envoi" disabled={busy || !mot.trim()}>{busy ? "Envoi…" : "Laisser un mot"}</button>
            {ok && <span className="ok">🌿 Merci !</span>}
            {err && <span className="gate-err" style={{ color: "#b06a4f" }}>{err}</span>}
          </form>

          {messages.length > 0 && (
            <ul className="cag-liste">
              {messages.map((m) => (
                <li key={m.id}>
                  <p>« {m.message} »</p>
                  {m.prenom && <span>— {m.prenom}</span>}
                  {(estAdmin || m.invite_id === profile?.id) && (
                    <button className="cag-x" onClick={() => supprimer(m)} aria-label="Retirer ce mot">×</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

import { useMemo, useState } from "react";

/* Diffusion de l'invitation : pré-remplit un message (texte + lien) et ouvre
   WhatsApp / SMS / e-mail en un tap. Pas d'envoi serveur (donc ni compte
   payant, ni API) — le couple choisit ses destinataires et envoie. */

const fmtDate = (d) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";

export default function Partage({ lien, couple, date }) {
  const defaut = useMemo(() => {
    const qui = (couple || "").trim() || "Nous";
    const quand = date ? ` — ${fmtDate(date)}` : "";
    return `${qui}, nous nous marions${quand} ! 🌿\nDécouvrez notre faire-part et répondez ici : ${lien}`;
  }, [couple, date, lien]);

  const [msg, setMsg] = useState(defaut);
  const [copie, setCopie] = useState(false);

  const enc = encodeURIComponent(msg);
  const wa = `https://wa.me/?text=${enc}`;
  const sms = `sms:?&body=${enc}`;
  const mail = `mailto:?subject=${encodeURIComponent("Notre faire-part de mariage")}&body=${enc}`;
  const partageNatif = typeof navigator !== "undefined" && !!navigator.share;

  async function copier() {
    try {
      await navigator.clipboard.writeText(msg);
      setCopie(true);
      setTimeout(() => setCopie(false), 1800);
    } catch {
      /* ignore */
    }
  }

  async function partager() {
    try {
      await navigator.share({ title: "Notre faire-part de mariage", text: msg });
    } catch {
      /* annulé */
    }
  }

  return (
    <div className="fpv-partage">
      <label className="fpv-l" style={{ marginTop: ".4rem" }}>Message à envoyer (modifiable)
        <textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} aria-label="Message à partager" />
      </label>
      <div className="fpv-partage-btns">
        <a className="fpv-btn accent" href={wa} target="_blank" rel="noopener noreferrer">📱 WhatsApp</a>
        <a className="fpv-btn ghost" href={sms}>💬 SMS</a>
        <a className="fpv-btn ghost" href={mail}>✉️ E-mail</a>
        <button type="button" className="fpv-btn ghost" onClick={copier}>{copie ? "✓ Copié" : "📋 Copier"}</button>
        {partageNatif && <button type="button" className="fpv-btn ghost" onClick={partager}>Partager…</button>}
      </div>
      <span className="fpv-hint">Ouvre l'application avec le message pré-rempli : vous choisissez les destinataires et envoyez. Pratique pour diffuser à toute la famille, groupe par groupe.</span>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";

/* Diffuser l'invitation (site V&F) : pré-remplit un message + le lien du site
   et ouvre WhatsApp / SMS / e-mail en un tap. Pas d'envoi serveur (ni compte
   payant, ni API) — vous choisissez les destinataires et envoyez, groupe par
   groupe. Les invités arrivent sur le portail et créent leur accès. */

const COUPLE = "Virginie & François";
const DATE_ISO = "2028-05-26";
const fmtDate = (d) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";

function lienSite() {
  if (typeof window === "undefined") return "";
  const { origin, pathname } = window.location;
  return origin + pathname.replace(/index\.html$/, "");
}

export default function Partage() {
  const lien = lienSite();
  const defaut = useMemo(
    () =>
      `${COUPLE} 🌿 On se marie le ${fmtDate(DATE_ISO)} !\n` +
      `Découvrez notre faire-part (ajoutez-le à votre écran d'accueil) et répondez ici : ${lien}`,
    [lien]
  );
  const [msg, setMsg] = useState(defaut);
  const [modifie, setModifie] = useState(false);
  const [copie, setCopie] = useState(false);

  // Tant que le message n'a pas été édité à la main, on garde le lien à jour.
  useEffect(() => {
    if (!modifie) setMsg(defaut);
  }, [defaut, modifie]);

  const enc = encodeURIComponent(msg);
  const wa = `https://wa.me/?text=${enc}`;
  const sms = `sms:?&body=${enc}`;
  const mail = `mailto:?subject=${encodeURIComponent("Notre faire-part de mariage 🌿")}&body=${enc}`;
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
    <div className="admin-bloc">
      <h2 className="admin-h2">Diffuser l'invitation 📣</h2>
      <p className="admin-sous">
        Un seul geste : « Envoyer l'invitation » ouvre le menu de partage de votre téléphone — choisissez un contact ou
        un groupe (famille, amis…) et c'est parti. Aucun envoi automatique : c'est vous qui gardez la main.
      </p>
      <label className="admin-partage-l">
        Message à envoyer (modifiable)
        <textarea
          rows={4}
          value={msg}
          onChange={(e) => {
            setModifie(true);
            setMsg(e.target.value);
          }}
          aria-label="Message à partager"
        />
      </label>

      {partageNatif && (
        <button type="button" className="btn-vert admin-partage-hero" onClick={partager}>
          📤 Envoyer l'invitation
        </button>
      )}

      <p className="admin-partage-ou">{partageNatif ? "ou choisissez directement :" : "Envoyer via :"}</p>
      <div className="admin-partage-btns">
        <a className="btn-ghost" href={wa} target="_blank" rel="noopener noreferrer">📱 WhatsApp</a>
        <a className="btn-ghost" href={sms}>💬 SMS</a>
        <a className="btn-ghost" href={mail}>✉️ E-mail</a>
        <button type="button" className="btn-ghost" onClick={copier}>{copie ? "✓ Copié" : "📋 Copier"}</button>
      </div>
      <p className="admin-partage-hint">
        Le lien s'affiche en belle carte (photo + vos prénoms) et ouvre l'app directement. Astuce : dans un groupe
        WhatsApp familial, tout le monde reçoit l'invitation d'un coup.
      </p>
    </div>
  );
}

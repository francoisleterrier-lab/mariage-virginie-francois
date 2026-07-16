import { useState } from "react";

/* Demander un avis Google par e-mail (site V&F) : ouvre la messagerie avec un
   message pré-rempli + le lien d'avis, invités en copie cachée. Pas d'envoi
   serveur — l'admin garde la main. Robuste PWA (ouverture forcée + copier). */

const LIEN_AVIS = "https://g.page/r/CWocELClfSW1EAE/review";

export default function DemandeAvis({ invites }) {
  const [copie, setCopie] = useState("");
  const [from, setFrom] = useState(() => {
    try {
      return localStorage.getItem("vf-mail-from") || "";
    } catch {
      return "";
    }
  });

  // Tous les invités avec un vrai e-mail (ils ont vu le site).
  const destinataires = (invites || []).filter(
    (g) => !g.rattache_a && g.email && !g.email.endsWith("@vf2028.local")
  );
  const emails = [...new Set(destinataires.map((g) => (g.email || "").trim()).filter(Boolean))];

  const sujet = "Un petit avis ? 🌿";
  const corps =
    "Bonjour,\n\n" +
    "Nous espérons que notre faire-part en ligne vous plaît ! Il a été imaginé et réalisé par François " +
    "(francoisleterrier.fr).\n" +
    "Si vous avez apprécié, un petit avis Google sur son travail lui ferait très plaisir — 2 minutes suffisent :\n" +
    LIEN_AVIS +
    "\n\nMerci beaucoup, et à très vite !\nVirginie & François";

  const mailto =
    `mailto:${encodeURIComponent(from)}` +
    `?bcc=${encodeURIComponent(emails.join(","))}` +
    `&subject=${encodeURIComponent(sujet)}` +
    `&body=${encodeURIComponent(corps)}`;

  function envoyer() {
    try {
      if (from) localStorage.setItem("vf-mail-from", from.trim());
    } catch {
      /* ignore */
    }
    window.location.href = mailto;
  }

  async function copier(quoi, texte) {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(quoi);
      setTimeout(() => setCopie(""), 1800);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="admin-bloc">
      <h2 className="admin-h2">Demander un avis Google ⭐</h2>
      <p className="admin-sous">
        Envoyez à vos invités (<strong>{emails.length}</strong> e-mail{emails.length > 1 ? "s" : ""}) une demande d'avis
        Google sur la réalisation du site. Message pré-rempli avec le lien d'avis, tout le monde en copie cachée.
      </p>

      <label className="admin-partage-l">
        Votre adresse e-mail (recommandé — sinon la messagerie peut refuser de s'ouvrir)
        <input
          type="email"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="vous@exemple.fr"
          autoComplete="email"
        />
      </label>

      <div className="admin-partage-btns">
        <button type="button" className="btn-vert" onClick={envoyer} disabled={emails.length === 0}>
          ⭐ Envoyer la demande d'avis
        </button>
        <button type="button" className="btn-ghost" onClick={() => copier("mails", emails.join(", "))}>
          {copie === "mails" ? "✓ Copié" : "📋 Copier les e-mails"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => copier("msg", corps)}>
          {copie === "msg" ? "✓ Copié" : "📝 Copier le message"}
        </button>
      </div>

      <p className="admin-partage-hint">
        Si votre messagerie ne s'ouvre pas (app installée sur iPhone), utilisez « Copier les e-mails » et « Copier le
        message », puis collez-les dans un nouveau mail (les e-mails dans le champ Cci).
      </p>
    </div>
  );
}

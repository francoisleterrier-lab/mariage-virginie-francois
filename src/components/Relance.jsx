import { useState } from "react";

/* Relancer les invités sans réponse (site V&F) : ouvre la messagerie avec un
   rappel pré-rempli + le lien, tous les destinataires en copie cachée (Cci).
   Pas d'envoi serveur. Robuste PWA : ouverture forcée + secours « copier ». */

function lienSite() {
  if (typeof window === "undefined") return "";
  const { origin, pathname } = window.location;
  return origin + pathname.replace(/index\.html$/, "");
}

export default function Relance({ invites }) {
  const [copie, setCopie] = useState("");
  const [from, setFrom] = useState(() => {
    try {
      return localStorage.getItem("vf-relance-from") || "";
    } catch {
      return "";
    }
  });

  const lien = lienSite();

  // Un couple est confirmé dès qu'UN membre répond (sa réponse vaut pour les deux).
  // On ne relance donc pas un conjoint dont l'autre moitié a déjà répondu.
  const parId = Object.fromEntries((invites || []).map((g) => [g.id, g]));
  const partenaireARepondu = (g) => {
    if (!g.couple_id) return false;
    const p = parId[g.couple_id];
    return !!(p && p.couple_id === g.id && p.rsvp);
  };

  const sansReponse = (invites || []).filter(
    (g) => !g.rsvp && !g.rattache_a && g.email && !g.email.endsWith("@vf2028.local") && !partenaireARepondu(g)
  );
  const emails = [...new Set(sansReponse.map((g) => (g.email || "").trim()).filter(Boolean))];

  const sujet = "Un petit rappel — votre présence 🌿";
  const corps =
    "Bonjour,\n\n" +
    "Nous préparons avec joie notre mariage des 26 & 27 mai 2028 et nous n'avons pas encore reçu votre réponse.\n" +
    "Ce serait un immense bonheur de vous compter parmi nous ! Merci de nous indiquer si vous serez présent·e ici :\n" +
    lien +
    "\n\nAvec toute notre affection,\nVirginie & François";

  // Un destinataire dans « À : » (l'expéditeur lui-même) fiabilise l'ouverture ;
  // les invités passent en copie cachée pour ne pas se voir entre eux.
  const mailto =
    `mailto:${encodeURIComponent(from)}` +
    `?bcc=${encodeURIComponent(emails.join(","))}` +
    `&subject=${encodeURIComponent(sujet)}` +
    `&body=${encodeURIComponent(corps)}`;

  function relancer() {
    try {
      if (from) localStorage.setItem("vf-relance-from", from.trim());
    } catch {
      /* ignore */
    }
    window.location.href = mailto; // plus fiable que <a> dans l'app installée
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

  if (sansReponse.length === 0) {
    return (
      <div className="admin-bloc">
        <h2 className="admin-h2">Relancer les sans-réponse ✉️</h2>
        <p className="admin-sous">🎉 Tout le monde a répondu — personne à relancer !</p>
      </div>
    );
  }

  return (
    <div className="admin-bloc">
      <h2 className="admin-h2">Relancer les sans-réponse ✉️</h2>
      <p className="admin-sous">
        <strong>{sansReponse.length}</strong> personne{sansReponse.length > 1 ? "s n'ont" : " n'a"} pas encore répondu.
        Le bouton ouvre votre messagerie avec un rappel pré-rempli, tout le monde en copie cachée. Les couples dont
        l'un des deux a déjà répondu sont considérés confirmés (une réponse vaut pour le couple) : ils ne sont pas relancés.
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
        <button type="button" className="btn-vert" onClick={relancer}>✉️ Relancer par e-mail</button>
        <button type="button" className="btn-ghost" onClick={() => copier("mails", emails.join(", "))}>
          {copie === "mails" ? "✓ Copié" : "📋 Copier les e-mails"}
        </button>
        <button type="button" className="btn-ghost" onClick={() => copier("msg", corps)}>
          {copie === "msg" ? "✓ Copié" : "📝 Copier le message"}
        </button>
      </div>

      <p className="admin-partage-hint">
        Si votre messagerie ne s'ouvre toujours pas (fréquent avec l'app installée sur iPhone), utilisez « Copier les
        e-mails » et « Copier le message », puis collez-les dans un nouveau mail (les e-mails dans le champ Cci).
      </p>

      <ul className="relance-liste">
        {sansReponse.map((g) => (
          <li key={g.id}>
            {g.nom} <span className="relance-mail">· {g.email}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

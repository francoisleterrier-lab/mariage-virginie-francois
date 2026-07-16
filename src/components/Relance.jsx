import { useState } from "react";

/* Relancer les invités sans réponse (site V&F) : ouvre la messagerie avec un
   rappel pré-rempli + le lien, tous les destinataires en copie cachée (Cci).
   Pas d'envoi serveur (ni API) — l'admin choisit et envoie. */

function lienSite() {
  if (typeof window === "undefined") return "";
  const { origin, pathname } = window.location;
  return origin + pathname.replace(/index\.html$/, "");
}

export default function Relance({ invites }) {
  const [copie, setCopie] = useState(false);
  const lien = lienSite();

  const sansReponse = (invites || []).filter(
    (g) => !g.rsvp && !g.rattache_a && g.email && !g.email.endsWith("@vf2028.local")
  );
  const emails = [...new Set(sansReponse.map((g) => (g.email || "").trim()).filter(Boolean))];

  const sujet = "Un petit rappel — votre présence 🌿";
  const corps =
    "Bonjour,\n\n" +
    "Nous préparons avec joie notre mariage des 26 & 27 mai 2028 et nous n'avons pas encore reçu votre réponse.\n" +
    "Ce serait un immense bonheur de vous compter parmi nous ! Merci de nous indiquer si vous serez présent·e ici :\n" +
    lien +
    "\n\nAvec toute notre affection,\nVirginie & François";
  const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;

  async function copier() {
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setCopie(true);
      setTimeout(() => setCopie(false), 1800);
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
        Le bouton ouvre votre messagerie avec un rappel pré-rempli (tout le monde en copie cachée) — vous n'avez plus
        qu'à cliquer sur « Envoyer ».
      </p>
      <div className="admin-partage-btns">
        <a className="btn-vert" href={mailto}>✉️ Relancer par e-mail</a>
        <button type="button" className="btn-ghost" onClick={copier}>
          {copie ? "✓ Copié" : "📋 Copier les e-mails"}
        </button>
      </div>
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

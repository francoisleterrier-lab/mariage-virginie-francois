import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { renderRichText } from "../lib/markdown.jsx";
import Signature from "./Signature.jsx";
import PolaroidPhoto from "./PolaroidPhoto.jsx";

/* ============================================================
   Accueil personnalisé par foyer — « Bonjour Tante Monique ».
   - invité : on récupère SA page (la RLS ne renvoie que la sienne, si
     publiée). Aucune page → on ne rend RIEN (accueil générique, pas
     d'état vide visible).
   - admin (aperçu) : `apercu` fournit directement la page à afficher.
   Confidentialité : le message n'est jamais journalisé ni notifié.
   ============================================================ */
export default function PersonalWelcome({ profile, apercu }) {
  const [page, setPage] = useState(apercu || null);
  const [charge, setCharge] = useState(!!apercu);

  useEffect(() => {
    if (apercu) {
      setPage(apercu);
      setCharge(true);
      return;
    }
    let vivant = true;
    supabase
      .from("pages_foyer")
      .select("foyer_id, greeting_name, message, photo_path, photo_caption, signature_variant, published")
      .maybeSingle()
      .then(({ data }) => {
        if (!vivant) return;
        setPage(data && data.published ? data : null);
        setCharge(true);
      });
    return () => {
      vivant = false;
    };
  }, [apercu]);

  if (!charge || !page) return null;

  const r = profile?.rsvp;
  const decline = r && String(r.presence || "").startsWith("Hélas");
  const statut = !r ? "attente" : decline ? "decline" : "confirme";

  return (
    <section className="perso" aria-label={`Accueil personnalisé — ${page.greeting_name}`}>
      <div className="wrap center">
        <p className="perso-bonjour">
          Bonjour <em>{page.greeting_name}</em>
        </p>

        {page.message && (
          <div className="perso-carte">
            <div className="perso-message">{renderRichText(page.message)}</div>
            <Signature variant={page.signature_variant} />
          </div>
        )}

        {page.photo_path && (
          <PolaroidPhoto path={page.photo_path} caption={page.photo_caption} foyerId={page.foyer_id} />
        )}

        {!apercu && (
          <p className="perso-rsvp">
            {statut === "confirme" && (
              <a href="#arbre">Votre lumière brille sur l'arbre de vie 🌿</a>
            )}
            {statut === "attente" && (
              <>
                Vous n'avez pas encore répondu — <a href="#rsvp">dites-nous oui</a>.
              </>
            )}
            {statut === "decline" && <span>Nous penserons à vous. 💛</span>}
          </p>
        )}
      </div>
    </section>
  );
}

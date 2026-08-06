import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Message clair en dev/console si le .env.local n'est pas renseigné.
  console.error(
    "Configuration Supabase manquante : renseignez VITE_SUPABASE_URL et " +
      "VITE_SUPABASE_ANON_KEY dans .env.local (voir .env.example)."
  );
}

// persistSession + autoRefreshToken => l'invité reste connecté même après
// avoir fermé le navigateur (refresh token géré par Supabase).
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "vf2028-auth",
  },
});

/* Traduit les erreurs Supabase Auth en messages français précis. */
export function messageErreurAuth(error) {
  const m = (error?.message || "").toLowerCase();
  // Erreur réseau (le navigateur n'a pas pu joindre le serveur) : très souvent
  // un navigateur intégré (WhatsApp/Facebook/Instagram…), la traduction de page,
  // un bloqueur de pub/VPN ou une connexion instable.
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed") || m.includes("network request failed"))
    return "Impossible de joindre le serveur. Ouvrez le lien dans votre navigateur (Chrome ou Safari) plutôt que dans l'application (WhatsApp, Facebook…), désactivez la traduction de la page et un éventuel VPN/bloqueur, puis réessayez.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Cet e-mail est déjà inscrit — utilisez « Déjà inscrit·e ».";
  if (m.includes("invalid login credentials"))
    return "E-mail ou mot de passe incorrect.";
  if (m.includes("email not confirmed"))
    return "Votre e-mail n'est pas encore confirmé. Vérifiez votre boîte mail.";
  if (m.includes("password should be at least"))
    return "Le mot de passe doit faire au moins 6 caractères.";
  return error?.message || "Une erreur est survenue. Réessayez.";
}

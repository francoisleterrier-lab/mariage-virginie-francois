import { createClient } from "@supabase/supabase-js";

/* Client Supabase dédié au produit « Faire-part Vivant ».
   storageKey distinct → la session « client du produit » ne se mélange pas
   avec la session « invité » du site de mariage V&F (même origine GitHub Pages). */
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const sb = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "fpv-auth" },
});

export function messageAuth(error) {
  const m = (error?.message || "").toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Cet e-mail a déjà un compte — connectez-vous.";
  if (m.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Confirmez votre e-mail (lien reçu par mail), puis connectez-vous.";
  if (m.includes("password should be at least")) return "Le mot de passe doit faire au moins 6 caractères.";
  return error?.message || "Une erreur est survenue. Réessayez.";
}

/* Slug URL-safe à partir d'un texte libre (« Camille & Alex » → « camille-alex »). */
export function versSlug(txt) {
  return (txt || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

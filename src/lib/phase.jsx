import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase.js";

/* ============================================================
   « Le site qui vit » — résolution du palier temporel courant.
   Les paliers (dates, teintes, citations) sont pilotés par la table
   `site_phases` : on peut les ajuster sans redéploiement. Cache local
   24 h pour éviter un aller-retour à chaque visite.
   Expose { phase, accent, decorationLevel, quote, quoteAuthor }.
   Un override ?phase=floraison force une phase (aperçu).
   ============================================================ */

const CACHE_KEY = "vf-phases-v1";
const CACHE_TTL = 24 * 3600 * 1000;

// tokens d'accent → couleurs de la charte (décoratif, pas du texte courant)
const ACCENTS = {
  "deep-green": "#3f5a45",
  sage: "#5f7457",
  ivory: "#b9a86a",
  gold: "#a67c2b",
};

const PhaseContext = createContext(null);

function phaseCourante(phases) {
  if (!phases || !phases.length) return null;
  const auj = new Date();
  auj.setHours(0, 0, 0, 0);
  let choisie = phases[0];
  for (const p of phases) {
    const d = new Date(p.starts_at + "T00:00:00");
    if (d <= auj && (!choisie || d >= new Date(choisie.starts_at + "T00:00:00"))) choisie = p;
  }
  return choisie;
}

export function PhaseProvider({ children }) {
  const [phases, setPhases] = useState(null);

  useEffect(() => {
    let vivant = true;
    // 1) cache local frais ?
    try {
      const brut = localStorage.getItem(CACHE_KEY);
      if (brut) {
        const { t, data } = JSON.parse(brut);
        if (Date.now() - t < CACHE_TTL && Array.isArray(data)) setPhases(data);
      }
    } catch {
      /* stockage indisponible */
    }
    // 2) rafraîchit depuis la base
    supabase
      .from("site_phases")
      .select("id, starts_at, accent_token, decoration_level, quote, quote_author")
      .order("ordre", { ascending: true })
      .then(({ data }) => {
        if (!vivant || !Array.isArray(data)) return;
        setPhases(data);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
        } catch {
          /* ignore */
        }
      });
    return () => {
      vivant = false;
    };
  }, []);

  const valeur = useMemo(() => {
    let liste = phases;
    // override d'aperçu ?phase=xxx
    let forcee = null;
    try {
      forcee = new URLSearchParams(window.location.search).get("phase");
    } catch {
      /* ignore */
    }
    const p = forcee && liste ? liste.find((x) => x.id === forcee) || phaseCourante(liste) : phaseCourante(liste);
    if (!p) return { phase: null, accent: ACCENTS.gold, decorationLevel: 0, quote: "", quoteAuthor: null };
    return {
      phase: p.id,
      accent: ACCENTS[p.accent_token] || ACCENTS.gold,
      decorationLevel: p.decoration_level || 0,
      quote: p.quote || "",
      quoteAuthor: p.quote_author || null,
    };
  }, [phases]);

  // applique la teinte d'accent au niveau racine (transition douce)
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent-current", valeur.accent);
    root.style.setProperty("--phase-deco", String(valeur.decorationLevel));
  }, [valeur.accent, valeur.decorationLevel]);

  return <PhaseContext.Provider value={valeur}>{children}</PhaseContext.Provider>;
}

export function usePhase() {
  return useContext(PhaseContext) || { phase: null, accent: "#a67c2b", decorationLevel: 0, quote: "", quoteAuthor: null };
}

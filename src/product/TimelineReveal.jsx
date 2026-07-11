import { useEffect, useState, useCallback } from "react";
import { sb } from "./supabaseFpv.js";
import Timeline from "../Timeline.jsx";

/* Timeline qui se dévoile (produit) : lit fpv_timeline (contenu masqué côté
   serveur tant que non révélé), et re-vérifie régulièrement pour qu'un palier
   s'ouvre en direct. */
export default function TimelineReveal({ slug }) {
  const [moments, setMoments] = useState([]);

  const charger = useCallback(async () => {
    const { data } = await sb.rpc("fpv_timeline", { p_slug: slug });
    setMoments(data || []);
  }, [slug]);

  useEffect(() => {
    charger();
    const onVoir = () => document.visibilityState === "visible" && charger();
    document.addEventListener("visibilitychange", onVoir);
    const id = setInterval(charger, 60000);
    return () => {
      document.removeEventListener("visibilitychange", onVoir);
      clearInterval(id);
    };
  }, [charger]);

  if (!moments.length) return null;

  return (
    <section className="fpv-sec" id="timeline">
      <h2>Au fil des jours</h2>
      <p>Notre faire-part se dévoile petit à petit — revenez le voir, de nouveaux moments s'ouvrent à l'approche du grand jour.</p>
      <Timeline moments={moments} accent="var(--accent)" />
    </section>
  );
}

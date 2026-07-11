import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import Timeline from "../Timeline.jsx";

/* Timeline qui se dévoile (site V&F) : lit vf_timeline (contenu masqué côté
   serveur tant que non révélé), re-vérifie régulièrement (dévoilement en direct). */
export default function TimelineReveal() {
  const [moments, setMoments] = useState([]);

  const charger = useCallback(async () => {
    const { data } = await supabase.rpc("vf_timeline");
    setMoments(data || []);
  }, []);

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
    <section className="timeline-reveal" id="timeline">
      <div className="wrap center">
        <p className="eyebrow">Au fil des jours</p>
        <h2>
          Le faire-part <em>se dévoile</em>
        </h2>
        <p>De nouveaux moments s'ouvrent à l'approche du grand jour. Revenez nous voir — il y aura toujours du nouveau. 🌿</p>
        <Timeline moments={moments} accent="var(--vert, #3f5d3a)" />
      </div>
    </section>
  );
}

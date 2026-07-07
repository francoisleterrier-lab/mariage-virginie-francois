import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   Photo souvenir façon polaroid. La photo du bucket privé est servie
   via une URL signée (1 h), jamais mise en cache persistant. Rotation
   stable seedée par l'id du foyer (identique à chaque visite).
   ============================================================ */
function angleSeed(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 100000;
  return ((h % 41) - 20) / 10; // -2.0° .. +2.0°
}

export default function PolaroidPhoto({ path, caption, foyerId }) {
  const [url, setUrl] = useState(null);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    let vivant = true;
    if (!path) return;
    supabase.storage
      .from("household-photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (vivant && data?.signedUrl) setUrl(data.signedUrl);
      });
    return () => {
      vivant = false;
    };
  }, [path]);

  if (!path) return null;
  const rot = angleSeed(foyerId || path);

  return (
    <figure className="polaroid" style={{ transform: `rotate(${rot}deg)` }}>
      <div className={"polaroid-img" + (charge ? " chargee" : "")}>
        {url && <img src={url} alt={caption || "Photo souvenir"} loading="lazy" onLoad={() => setCharge(true)} />}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

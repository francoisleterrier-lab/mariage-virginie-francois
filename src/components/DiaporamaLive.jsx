import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import Diaporama from "../Diaporama.jsx";

/* Diaporama live du site V&F : photos de l'album + petits mots de la cagnotte,
   entremêlés et rafraîchis en direct. Ouvert par les mariés (connectés) sur la
   TV / le vidéoprojecteur de la soirée. Accès : ?diaporama=1. */

const urlOf = (c) => supabase.storage.from("vf-photos").getPublicUrl(c).data.publicUrl;
const estImage = (c) => !/\.(mp4|webm|mov|m4v|ogg)$/i.test(c || "");

function melange(photos, mots) {
  if (!photos.length) return mots;
  const out = [];
  let mi = 0;
  photos.forEach((p, i) => {
    out.push(p);
    if ((i + 1) % 4 === 0 && mi < mots.length) out.push(mots[mi++]);
  });
  while (mi < mots.length) out.push(mots[mi++]);
  return out;
}

export default function DiaporamaLive({ profile, onExit }) {
  const [items, setItems] = useState([]);

  const charger = useCallback(async () => {
    const [{ data: photos }, { data: mots }] = await Promise.all([
      supabase.from("photos_invites").select("id, chemin, prenom, created_at").order("created_at", { ascending: false }),
      supabase.from("cagnotte_messages").select("id, prenom, message, created_at").order("created_at", { ascending: false }),
    ]);
    const ph = (photos || []).filter((p) => estImage(p.chemin)).map((p) => ({ kind: "photo", url: urlOf(p.chemin), prenom: p.prenom, key: "p" + p.id }));
    const mo = (mots || []).map((m) => ({ kind: "mot", message: m.message, prenom: m.prenom, key: "m" + m.id }));
    setItems(melange(ph, mo));
  }, []);

  useEffect(() => {
    charger();
    const id = setInterval(charger, 20000);
    return () => clearInterval(id);
  }, [charger]);

  return <Diaporama items={items} titre="Virginie & François" onExit={onExit} />;
}

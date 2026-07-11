import { useEffect, useState, useCallback } from "react";
import { sb } from "./supabaseFpv.js";
import Diaporama from "../Diaporama.jsx";

/* Alimente le diaporama live (produit) : photos de l'album + petits mots de la
   cagnotte, entremêlés, rafraîchis en direct. Accès via ?i=slug&live=1. */

const urlOf = (c) => sb.storage.from("fpv-photos").getPublicUrl(c).data.publicUrl;
const estImage = (c) => !/\.(mp4|webm|mov|m4v|ogg)$/i.test(c || "");

/* Entremêle : surtout des photos, un petit mot tous les ~4 visuels. */
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

export default function DiaporamaLive({ slug }) {
  const [couple, setCouple] = useState("");
  const [items, setItems] = useState([]);

  const charger = useCallback(async () => {
    const { data: inv } = await sb
      .from("fpv_invitations")
      .select("id, couple")
      .eq("slug", slug)
      .eq("publie", true)
      .maybeSingle();
    if (!inv) return;
    setCouple(inv.couple || "");
    const [{ data: photos }, { data: mots }] = await Promise.all([
      sb.from("fpv_photos").select("id, chemin, prenom, created_at").eq("invitation_id", inv.id).order("created_at", { ascending: false }),
      sb.from("fpv_cagnotte_messages").select("id, prenom, message, created_at").eq("invitation_id", inv.id).order("created_at", { ascending: false }),
    ]);
    const ph = (photos || []).filter((p) => estImage(p.chemin)).map((p) => ({ kind: "photo", url: urlOf(p.chemin), prenom: p.prenom, key: "p" + p.id }));
    const mo = (mots || []).map((m) => ({ kind: "mot", message: m.message, prenom: m.prenom, key: "m" + m.id }));
    setItems(melange(ph, mo));
  }, [slug]);

  useEffect(() => {
    charger();
    const id = setInterval(charger, 20000);
    return () => clearInterval(id);
  }, [charger]);

  function quitter() {
    const u = new URL(location.href);
    u.searchParams.delete("live");
    location.href = u.toString();
  }

  return <Diaporama items={items} titre={couple} onExit={quitter} />;
}

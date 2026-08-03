import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* « Le Canal » — le faire-part qui ne meurt jamais.
   Après le mariage, le couple publie des annonces (naissance, déménagement…).
   Chaque annonce a ses réactions emoji + un mur de mots.
   Si les tables n'existent pas encore, la section ne s'affiche pas. */

const urlOf = (chemin) => supabase.storage.from("vf-photos").getPublicUrl(chemin).data.publicUrl;
const EMOJIS = ["❤️", "🎉", "👏", "🥹", "🌿"];
const TYPE_LABEL = {
  naissance: "Une naissance", demenagement: "On déménage", voyage: "Des nouvelles du voyage",
  anniversaire: "Anniversaire de mariage", autre: "Des nouvelles",
};
const TYPE_EMOJI = { naissance: "👶", demenagement: "🏡", voyage: "✈️", anniversaire: "💍", autre: "🌿" };

export default function Canal({ profile }) {
  const [annonces, setAnnonces] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [brouillon, setBrouillon] = useState({});

  const charger = useCallback(async () => {
    const { data: ann, error } = await supabase
      .from("annonces")
      .select("id, type, titre, message, media_chemin, created_at")
      .eq("publiee", true)
      .order("created_at", { ascending: false });
    if (error || !ann || ann.length === 0) {
      setAnnonces([]);
      return;
    }
    setAnnonces(ann);
    const ids = ann.map((a) => a.id);
    const [{ data: r }, { data: m }] = await Promise.all([
      supabase.from("annonce_reactions").select("id, annonce_id, invite_id, emoji").in("annonce_id", ids),
      supabase.from("annonce_messages").select("id, annonce_id, prenom, texte, invite_id, created_at").in("annonce_id", ids).order("created_at", { ascending: true }),
    ]);
    setReactions(r || []);
    setMessages(m || []);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function reagir(annonceId, emoji) {
    if (!profile?.id) return;
    const mien = reactions.find((x) => x.annonce_id === annonceId && x.invite_id === profile.id && x.emoji === emoji);
    if (mien) {
      setReactions((rs) => rs.filter((x) => x !== mien));
      if (!String(mien.id).startsWith("tmp-")) await supabase.from("annonce_reactions").delete().eq("id", mien.id);
    } else {
      setReactions((rs) => [...rs, { id: `tmp-${Date.now()}`, annonce_id: annonceId, invite_id: profile.id, emoji }]);
      await supabase.from("annonce_reactions").insert({ annonce_id: annonceId, invite_id: profile.id, emoji });
      charger();
    }
  }

  async function envoyerMot(annonceId) {
    const texte = (brouillon[annonceId] || "").trim();
    if (!texte || !profile?.id) return;
    const prenom = (profile.nom || "").split(" ")[0];
    setBrouillon((b) => ({ ...b, [annonceId]: "" }));
    await supabase.from("annonce_messages").insert({ annonce_id: annonceId, invite_id: profile.id, prenom, texte });
    charger();
  }

  if (annonces.length === 0) return null;

  return (
    <section className="canal" id="canal">
      <div className="wrap">
        {annonces.map((a) => {
          const ra = reactions.filter((x) => x.annonce_id === a.id);
          const ma = messages.filter((x) => x.annonce_id === a.id);
          return (
            <article className="canal-carte reveal" key={a.id}>
              <p className="canal-type">{TYPE_EMOJI[a.type] || "🌿"} {TYPE_LABEL[a.type] || "Des nouvelles"}</p>
              <h2 className="canal-titre">{a.titre}</h2>
              {a.media_chemin && <img className="canal-media" src={urlOf(a.media_chemin)} alt="" loading="lazy" />}
              <p className="canal-message">{a.message}</p>

              <div className="canal-reactions">
                {EMOJIS.map((e) => {
                  const n = ra.filter((x) => x.emoji === e).length;
                  const mine = ra.some((x) => x.emoji === e && x.invite_id === profile?.id);
                  return (
                    <button key={e} type="button" className={"canal-reac" + (mine ? " on" : "")} onClick={() => reagir(a.id, e)}>
                      <span aria-hidden="true">{e}</span>
                      {n > 0 && <span className="canal-reac-n">{n}</span>}
                    </button>
                  );
                })}
              </div>

              <div className="canal-mur">
                <h3>Vos mots</h3>
                {ma.length === 0 ? (
                  <p className="canal-vide">Soyez le premier à laisser un mot 🌿</p>
                ) : (
                  <ul>
                    {ma.map((m) => (
                      <li key={m.id}><strong>{m.prenom || "Un invité"}</strong> {m.texte}</li>
                    ))}
                  </ul>
                )}
                <div className="canal-ajout">
                  <input
                    value={brouillon[a.id] || ""}
                    onChange={(e) => setBrouillon((b) => ({ ...b, [a.id]: e.target.value }))}
                    placeholder="Un mot de félicitations…"
                    maxLength={280}
                  />
                  <button type="button" className="btn-vert" onClick={() => envoyerMot(a.id)}>Envoyer</button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

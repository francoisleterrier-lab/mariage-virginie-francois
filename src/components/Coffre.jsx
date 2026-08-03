import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* « Le Coffre des invités » — jeu de rencontres coopératif.
   Chaque invité a un SCEAU (emoji + code de 5 lettres) dérivé de son id.
   Pour récolter le sceau d'un autre, on le rencontre et on saisit son code.
   Assez de rencontres → le coffre s'ouvre pour tous → récompense.
   Validation 100 % client via la vue invites_public (id, nom). */

const urlOf = (chemin) => supabase.storage.from("vf-photos").getPublicUrl(chemin).data.publicUrl;
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const EMOJIS = ["🌿", "🌸", "⭐", "🕊️", "🔥", "🌙", "🍃", "💫", "🌻", "🦋", "🍀", "🎐", "🌷", "🐝", "🌺"];

function sceau(id) {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  let code = "", n = h;
  for (let i = 0; i < 5; i++) { code += ALPHA[n % ALPHA.length]; n = Math.floor(n / ALPHA.length) + (i + 1) * 131; }
  return { code, emoji: EMOJIS[h % EMOJIS.length] };
}

export default function Coffre({ profile }) {
  const [dispo, setDispo] = useState(true);
  const [tous, setTous] = useState([]); // invites_public : {id, nom}
  const [echanges, setEchanges] = useState([]);
  const [config, setConfig] = useState({ objectif: 25, texte: "", media: null });
  const [saisie, setSaisie] = useState("");
  const [msg, setMsg] = useState("");
  const estAdmin = profile?.role === "admin";
  const moi = profile?.id ? sceau(profile.id) : { code: "", emoji: "🌿" };

  const charger = useCallback(async () => {
    const [{ data: inv }, { data: ech, error }, { data: par }] = await Promise.all([
      supabase.from("invites_public").select("id, nom"),
      supabase.from("coffre_echanges").select("id, collecteur_id, cible_id"),
      supabase.from("parametres").select("valeur").eq("cle", "coffre").maybeSingle(),
    ]);
    if (error) { setDispo(false); return; }
    setDispo(true);
    setTous(inv || []);
    setEchanges(ech || []);
    if (par?.valeur) setConfig({ objectif: 25, texte: "", media: null, ...par.valeur });
  }, []);

  useEffect(() => {
    charger();
    const t = setInterval(charger, 10000);
    return () => clearInterval(t);
  }, [charger]);

  async function collecter() {
    setMsg("");
    const code = saisie.trim().toUpperCase();
    if (code.length < 5) { setMsg("Entrez le sceau (5 lettres)."); return; }
    if (code === moi.code) { setMsg("C'est votre propre sceau 🙂"); return; }
    const cible = tous.find((inv) => sceau(inv.id).code === code);
    if (!cible) { setMsg("Ce sceau n'existe pas — revérifiez les lettres."); return; }
    if (cible.id === profile.id) { setMsg("C'est votre propre sceau 🙂"); return; }
    if (echanges.some((e) => e.collecteur_id === profile.id && e.cible_id === cible.id)) {
      setMsg(`Vous avez déjà rencontré ${(cible.nom || "").split(" ")[0]} ✓`);
      return;
    }
    const { error } = await supabase.from("coffre_echanges").insert({ collecteur_id: profile.id, cible_id: cible.id });
    if (error && !/duplicate|unique/i.test(error.message)) { setMsg(error.message); return; }
    setSaisie("");
    setMsg(`✨ Vous avez rencontré ${(cible.nom || "un invité").split(" ")[0]} !`);
    charger();
  }

  async function sauverConfig(next) {
    setConfig(next);
    await supabase.from("parametres").upsert({ cle: "coffre", valeur: next }, { onConflict: "cle" });
  }

  async function uploadRecompense(file) {
    if (!file) return;
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    const path = `coffre/recompense-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("vf-photos").upload(path, file, { contentType: file.type });
    if (!error) sauverConfig({ ...config, media: path });
  }

  if (!dispo) return null;

  const total = echanges.length;
  const objectif = Math.max(1, config.objectif || 25);
  const ratio = Math.min(1, total / objectif);
  const ouvert = total >= objectif;
  const mesRencontres = echanges.filter((e) => e.collecteur_id === profile?.id).length;

  return (
    <section className="coffre" id="coffre">
      <div className="wrap center reveal">
        <p className="eyebrow">Le coffre des invités</p>
        <h2>Un secret qui s'ouvre <em>ensemble</em></h2>

        {ouvert ? (
          <div className="coffre-ouvert">
            <div className="coffre-cadenas" aria-hidden="true">🔓</div>
            <p className="coffre-bravo">Le coffre est ouvert ! Merci à tous 🌿</p>
            {config.texte && <p className="coffre-recompense-txt">{config.texte}</p>}
            {config.media && (
              /\.(mp4|webm|mov)$/i.test(config.media)
                ? <video className="coffre-media" src={urlOf(config.media)} controls playsInline />
                : <img className="coffre-media" src={urlOf(config.media)} alt="La récompense" />
            )}
          </div>
        ) : (
          <>
            <p>
              Chaque invité porte un <strong>sceau</strong> secret. Pour récolter celui d'un autre, il faut le
              rencontrer en vrai et lire son code. Quand nous aurons assez de rencontres, le coffre s'ouvrira
              <strong> pour tout le monde</strong> et révélera notre surprise.
            </p>

            <div className="coffre-mon-sceau">
              <span className="coffre-emoji">{moi.emoji}</span>
              <div>
                <p className="coffre-sceau-l">Votre sceau — montrez-le</p>
                <p className="coffre-code">{moi.code}</p>
              </div>
            </div>

            <div className="coffre-ajout">
              <input
                value={saisie}
                onChange={(e) => setSaisie(e.target.value.toUpperCase())}
                placeholder="Sceau d'un invité (5 lettres)"
                maxLength={5}
                autoCapitalize="characters"
              />
              <button type="button" className="btn-vert" onClick={collecter}>Récolter</button>
            </div>
            {msg && <p className="coffre-msg">{msg}</p>}

            <div className="coffre-barre" aria-hidden="true"><span style={{ width: `${ratio * 100}%` }} /></div>
            <p className="coffre-compte">
              {total} rencontre{total > 1 ? "s" : ""} sur {objectif} — vous en avez fait {mesRencontres}
            </p>
          </>
        )}

        {estAdmin && (
          <details className="coffre-admin">
            <summary>Réglages (admin)</summary>
            <label className="admin-partage-l">
              Objectif de rencontres
              <input type="number" min="1" value={config.objectif}
                onChange={(e) => sauverConfig({ ...config, objectif: Number(e.target.value) || 25 })} />
            </label>
            <label className="admin-partage-l">
              Message de récompense
              <textarea rows={2} value={config.texte || ""}
                onChange={(e) => setConfig({ ...config, texte: e.target.value })}
                onBlur={() => sauverConfig(config)} placeholder="Ex. Merci ! Rendez-vous sur la piste de danse 💛" />
            </label>
            <label className="admin-partage-l">
              Vidéo / photo de récompense (optionnelle)
              <input type="file" accept="video/*,image/*" onChange={(e) => uploadRecompense(e.target.files?.[0])} />
            </label>
          </details>
        )}
      </div>
    </section>
  );
}

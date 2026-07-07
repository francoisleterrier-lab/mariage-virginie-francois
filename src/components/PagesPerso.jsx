import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../lib/supabase.js";
import PersonalWelcome from "./PersonalWelcome.jsx";

/* ============================================================
   Admin — Pages personnalisées par foyer.
   Liste des foyers (état ⬜/✏️/✅), éditeur (accueil, mot, photo
   compressée, légende, signature, brouillon/publié), aperçu invité.
   ============================================================ */

// Compression client : max 1600 px de large, JPEG 0.82 (< ~400 Ko).
async function compresser(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bmp.width);
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(bmp, 0, 0, w, h);
  return await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
}

export default function PagesPerso({ invites }) {
  const [pages, setPages] = useState({});
  const [sel, setSel] = useState(null); // foyer sélectionné
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [apercu, setApercu] = useState(false);

  // Regroupe les invités en foyers (couple → 1 foyer ; sinon invité seul).
  const foyers = useMemo(() => {
    const parId = Object.fromEntries(invites.map((g) => [g.id, g]));
    const map = new Map();
    for (const g of invites) {
      const canon = g.couple_id && parId[g.couple_id] ? [g.id, g.couple_id].sort()[0] : g.id;
      if (!map.has(canon)) map.set(canon, { id: canon, membres: [] });
      map.get(canon).membres.push(g);
    }
    return [...map.values()].map((f) => ({
      ...f,
      noms: f.membres
        .map((m) => m.nom)
        .sort()
        .join(" & "),
    }));
  }, [invites]);

  const charger = useCallback(async () => {
    const { data } = await supabase.from("pages_foyer").select("*");
    setPages(Object.fromEntries((data || []).map((p) => [p.foyer_id, p])));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  function etat(f) {
    const p = pages[f.id];
    if (!p) return "vide";
    return p.published ? "publie" : "brouillon";
  }
  const ordreEtat = { vide: 0, brouillon: 1, publie: 2 };
  const foyersTri = useMemo(
    () => [...foyers].sort((a, b) => ordreEtat[etat(a)] - ordreEtat[etat(b)] || a.noms.localeCompare(b.noms)),
    [foyers, pages]
  );

  function ouvrir(f) {
    const p = pages[f.id];
    setSel(f);
    setApercu(false);
    setMsg("");
    setForm({
      greeting_name: p?.greeting_name || f.noms,
      message: p?.message || "",
      photo_path: p?.photo_path || null,
      photo_caption: p?.photo_caption || "",
      signature_variant: p?.signature_variant || "vf",
      published: p?.published || false,
    });
  }

  async function choisirPhoto(e) {
    const file = e.target.files?.[0];
    if (!file || !sel) return;
    setBusy(true);
    setMsg("Compression & envoi de la photo…");
    try {
      const blob = await compresser(file);
      const path = `${sel.id}/photo-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("household-photos")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (error) throw error;
      setForm((f) => ({ ...f, photo_path: path }));
      setMsg(`Photo envoyée (${Math.round(blob.size / 1024)} Ko).`);
    } catch (err) {
      setMsg("Échec de l'envoi : " + (err.message || err));
    }
    setBusy(false);
  }

  async function enregistrer(publier) {
    if (!sel) return;
    if (publier && (!form.greeting_name.trim() || !form.message.trim())) {
      setMsg("Un accueil et un mot sont requis pour publier.");
      return;
    }
    setBusy(true);
    const row = {
      foyer_id: sel.id,
      greeting_name: form.greeting_name.trim(),
      message: form.message,
      photo_path: form.photo_path,
      photo_caption: form.photo_caption,
      signature_variant: form.signature_variant,
      published: publier,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("pages_foyer").upsert(row);
    setBusy(false);
    if (error) return setMsg("Erreur : " + error.message);
    setForm((f) => ({ ...f, published: publier }));
    setMsg(publier ? "✅ Page publiée." : "✏️ Brouillon enregistré.");
    charger();
  }

  const compteur = form?.message?.length || 0;

  return (
    <div className="admin-bloc">
      <h2 className="admin-h2">Pages personnalisées</h2>
      <p className="admin-sous">
        Un mot et une photo par foyer, adressés à tous ses membres. La page n'apparaît chez l'invité qu'une fois
        <strong> publiée</strong> ; sinon il voit l'accueil habituel. ⬜ à écrire · ✏️ brouillon · ✅ publié.
      </p>

      <div className="pp-grille">
        <ul className="pp-liste">
          {foyersTri.map((f) => {
            const e = etat(f);
            return (
              <li key={f.id}>
                <button className={"pp-foyer" + (sel?.id === f.id ? " on" : "")} onClick={() => ouvrir(f)}>
                  <span className="pp-etat">{e === "publie" ? "✅" : e === "brouillon" ? "✏️" : "⬜"}</span>
                  <span>{f.noms}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="pp-editeur">
          {!sel ? (
            <p className="attente">Choisissez un foyer à gauche pour écrire sa page.</p>
          ) : apercu ? (
            <div>
              <button className="btn-lien" onClick={() => setApercu(false)}>
                ← Retour à l'édition
              </button>
              <div className="pp-apercu">
                <PersonalWelcome apercu={{ ...form, foyer_id: sel.id }} />
              </div>
            </div>
          ) : (
            <>
              <h3 className="admin-h3">{sel.noms}</h3>
              <label className="pp-label">Accueil (« Bonjour … »)</label>
              <input value={form.greeting_name} onChange={(e) => setForm({ ...form, greeting_name: e.target.value })} placeholder="Tante Monique, Alan & Mélane…" />

              <label className="pp-label">
                Le mot des mariés <em className="pp-hint">({compteur} car. — idéal 300–600 ; **gras**, *italique*)</em>
              </label>
              <textarea rows={7} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Écrivez ici votre mot personnel…" />

              <label className="pp-label">Photo souvenir (compressée automatiquement)</label>
              <input type="file" accept="image/*" onChange={choisirPhoto} disabled={busy} />
              {form.photo_path && <p className="pp-hint">Photo actuelle : {form.photo_path.split("/").pop()}</p>}

              <label className="pp-label">Légende de la photo</label>
              <input value={form.photo_caption} onChange={(e) => setForm({ ...form, photo_caption: e.target.value })} placeholder="Été 2019, Cabourg" />

              <label className="pp-label">Signature</label>
              <select value={form.signature_variant} onChange={(e) => setForm({ ...form, signature_variant: e.target.value })}>
                <option value="vf">Virginie & François</option>
                <option value="vfe">Virginie, François, Lou, Tiago, Ugo & Eden</option>
              </select>

              <div className="pp-actions">
                <button className="btn-ghost" style={{ color: "var(--encre)", borderColor: "var(--ligne)", width: "auto", margin: 0, padding: "0.6rem 1.1rem" }} onClick={() => setApercu(true)}>
                  👁 Voir comme l'invité
                </button>
                <button className="btn-ghost" style={{ color: "var(--encre)", borderColor: "var(--ligne)", width: "auto", margin: 0, padding: "0.6rem 1.1rem" }} disabled={busy} onClick={() => enregistrer(false)}>
                  Brouillon
                </button>
                <button className="btn-vert" style={{ margin: 0, width: "auto", padding: "0.6rem 1.4rem" }} disabled={busy} onClick={() => enregistrer(true)}>
                  Publier
                </button>
              </div>
              {msg && <p className="pp-msg">{msg}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

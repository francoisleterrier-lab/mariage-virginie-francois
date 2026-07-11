import { useEffect, useState, useCallback } from "react";
import { sb } from "./supabaseFpv.js";

/* Gestion des moments de la timeline (côté couple). Chaque moment a un titre
   (visible en teaser), un contenu (masqué jusqu'à la date) et une date de
   révélation. Le contenu ne part aux invités qu'une fois la date atteinte. */

const VIDE = { titre: "", contenu: "", date: "" };
const isoDe = (d) => new Date(d + "T09:00:00").toISOString();
const dateDe = (iso) => { try { return new Date(iso).toISOString().slice(0, 10); } catch { return ""; } };
const fmt = (iso) => { try { return new Date(iso).toLocaleDateString("fr-FR"); } catch { return ""; } };

export default function MomentsEditeur({ invitationId }) {
  const [items, setItems] = useState([]);
  const [n, setN] = useState(VIDE);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await sb.from("fpv_moments").select("*").eq("invitation_id", invitationId).order("ordre").order("reveal_at");
    setItems(data || []);
  }, [invitationId]);

  useEffect(() => { charger(); }, [charger]);

  async function ajouter() {
    if (!n.titre.trim() || !n.date) return;
    setBusy(true);
    await sb.from("fpv_moments").insert({
      invitation_id: invitationId,
      titre: n.titre.trim(),
      contenu: n.contenu.trim(),
      reveal_at: isoDe(n.date),
      ordre: items.length,
    });
    setBusy(false);
    setN(VIDE);
    charger();
  }

  async function supprimer(id) {
    await sb.from("fpv_moments").delete().eq("id", id);
    charger();
  }

  return (
    <div className="fpv-cad-edit">
      {items.length > 0 && (
        <div className="fpv-list" style={{ marginBottom: "1rem" }}>
          {items.map((m) => {
            const revele = new Date(m.reveal_at) <= new Date();
            return (
              <div key={m.id} className="fpv-item">
                <div className="grow">
                  <div className="nm">{revele ? "" : "🔒 "}{m.titre}</div>
                  <div className="meta">{revele ? `révélé le ${fmt(m.reveal_at)}` : `se dévoile le ${fmt(m.reveal_at)}`}{m.contenu ? " · contenu ✓" : ""}</div>
                </div>
                <button className="fpv-btn ghost" onClick={() => supprimer(m.id)}>Retirer</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="fpv-row">
        <label className="fpv-l">Titre du moment (visible avant)
          <input value={n.titre} onChange={(e) => setN({ ...n, titre: e.target.value })} placeholder="ex. Le lieu se dévoile" />
        </label>
        <label className="fpv-l">Date de révélation
          <input type="date" value={n.date} onChange={(e) => setN({ ...n, date: e.target.value })} />
        </label>
        <label className="fpv-l" style={{ gridColumn: "1 / -1" }}>Contenu (masqué jusqu'à la date)
          <textarea rows={2} value={n.contenu} onChange={(e) => setN({ ...n, contenu: e.target.value })} placeholder="Le domaine, l'adresse, l'itinéraire…" />
        </label>
      </div>
      <button className="fpv-btn accent" disabled={busy || !n.titre.trim() || !n.date} onClick={ajouter} style={{ marginTop: ".6rem" }}>＋ Ajouter le moment</button>
    </div>
  );
}

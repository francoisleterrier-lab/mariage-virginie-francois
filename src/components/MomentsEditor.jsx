import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* Admin — « La timeline qui se dévoile ».
   Le titre est visible tout de suite (teaser) ; le contenu n'est envoyé aux
   invités qu'à la date de révélation (masquage côté serveur via vf_timeline). */

const VIDE = { titre: "", contenu: "", date: "" };
const isoDe = (d) => new Date(d + "T09:00:00").toISOString();
const fmt = (iso) => { try { return new Date(iso).toLocaleDateString("fr-FR"); } catch { return ""; } };

export default function MomentsEditor() {
  const [items, setItems] = useState([]);
  const [n, setN] = useState(VIDE);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase.from("moments").select("*").order("ordre").order("reveal_at");
    setItems(data || []);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  async function ajouter() {
    if (!n.titre.trim() || !n.date) return;
    setBusy(true);
    await supabase.from("moments").insert({ titre: n.titre.trim(), contenu: n.contenu.trim(), reveal_at: isoDe(n.date), ordre: items.length });
    setBusy(false);
    setN(VIDE);
    setOk(true);
    setTimeout(() => setOk(false), 1600);
    charger();
  }

  async function supprimer(id) {
    if (!window.confirm("Retirer ce moment ?")) return;
    await supabase.from("moments").delete().eq("id", id);
    charger();
  }

  return (
    <div className="admin-bloc">
      <div className="plan-head">
        <h2 className="admin-h2">La timeline qui se dévoile ⏳</h2>
      </div>
      <p className="admin-sous">
        Planifiez des moments : le <strong>titre</strong> est visible tout de suite (teaser), le <strong>contenu</strong>{" "}
        n'apparaît aux invités qu'à la <strong>date de révélation</strong>. Parfait pour dévoiler le lieu, le programme,
        le déroulé du week-end…
      </p>

      {items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1.1rem", display: "flex", flexDirection: "column", gap: ".5rem" }}>
          {items.map((m) => {
            const rev = new Date(m.reveal_at) <= new Date();
            return (
              <li key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".8rem", padding: ".6rem .8rem", border: "1px solid var(--ligne, #d8ddd2)", borderRadius: 8 }}>
                <span>
                  {rev ? "" : "🔒 "}<strong>{m.titre}</strong>{" — "}
                  <span style={{ opacity: 0.7 }}>{rev ? `révélé le ${fmt(m.reveal_at)}` : `se dévoile le ${fmt(m.reveal_at)}`}{m.contenu ? " · contenu ✓" : ""}</span>
                </span>
                <button className="btn-lien" onClick={() => supprimer(m.id)}>Retirer</button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="lieu-champs">
        <label>
          <span>Titre (visible avant la révélation)</span>
          <input value={n.titre} onChange={(e) => setN({ ...n, titre: e.target.value })} placeholder="ex. Le lieu se dévoile" />
        </label>
        <label>
          <span>Date de révélation</span>
          <input type="date" value={n.date} onChange={(e) => setN({ ...n, date: e.target.value })} />
        </label>
        <label>
          <span>Contenu (masqué jusqu'à la date)</span>
          <textarea rows={2} value={n.contenu} onChange={(e) => setN({ ...n, contenu: e.target.value })} placeholder="Le Domaine des Oliviers, à Muret — itinéraire ci-dessous…" />
        </label>
      </div>

      <div className="phase-actions">
        <button className="btn-vert" style={{ margin: 0, width: "auto", padding: "0.55rem 1.2rem" }} disabled={busy || !n.titre.trim() || !n.date} onClick={ajouter}>
          {busy ? "…" : "Ajouter le moment"}
        </button>
        {ok && <span className="ok">🌿 Ajouté</span>}
      </div>
    </div>
  );
}

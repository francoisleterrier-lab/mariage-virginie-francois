import { useEffect, useState, useCallback } from "react";
import { sb } from "./supabaseFpv.js";

/* Gestion de la liste de cadeaux (côté couple, dans l'éditeur).
   Ajout / retrait d'articles, et « libérer » une réservation au besoin. */

const VIDE = { titre: "", prix: "", lien: "", description: "" };

export default function CadeauxEditeur({ invitationId }) {
  const [items, setItems] = useState([]);
  const [n, setN] = useState(VIDE);
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await sb
      .from("fpv_gifts")
      .select("*")
      .eq("invitation_id", invitationId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    setItems(data || []);
  }, [invitationId]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function ajouter() {
    if (!n.titre.trim()) return;
    setBusy(true);
    await sb.from("fpv_gifts").insert({
      invitation_id: invitationId,
      titre: n.titre.trim(),
      description: n.description.trim(),
      prix: n.prix === "" ? null : Number(n.prix),
      lien: n.lien.trim(),
      position: items.length,
    });
    setBusy(false);
    setN(VIDE);
    charger();
  }

  async function supprimer(id) {
    await sb.from("fpv_gifts").delete().eq("id", id);
    charger();
  }

  async function liberer(id) {
    await sb.from("fpv_gifts").update({ reserve_par: null, reserve_at: null }).eq("id", id);
    charger();
  }

  return (
    <div className="fpv-cad-edit">
      {items.length > 0 && (
        <div className="fpv-list" style={{ marginBottom: "1rem" }}>
          {items.map((g) => (
            <div key={g.id} className="fpv-item">
              <div className="grow">
                <div className="nm">{g.titre}{g.prix != null && g.prix !== "" ? ` · ${g.prix} €` : ""}</div>
                <div className="meta">{g.reserve_par ? `Réservé par ${g.reserve_par}` : "Disponible"}{g.lien ? " · lien ✓" : ""}</div>
              </div>
              {g.reserve_par && <button className="fpv-btn ghost" onClick={() => liberer(g.id)}>Libérer</button>}
              <button className="fpv-btn ghost" onClick={() => supprimer(g.id)}>Retirer</button>
            </div>
          ))}
        </div>
      )}

      <div className="fpv-row">
        <label className="fpv-l">Cadeau
          <input value={n.titre} onChange={(e) => setN({ ...n, titre: e.target.value })} placeholder="ex. Nuit à l'hôtel" />
        </label>
        <label className="fpv-l">Prix (€, facultatif)
          <input type="number" min="0" value={n.prix} onChange={(e) => setN({ ...n, prix: e.target.value })} placeholder="120" />
        </label>
        <label className="fpv-l">Lien (facultatif)
          <input value={n.lien} onChange={(e) => setN({ ...n, lien: e.target.value })} placeholder="https://…" />
        </label>
        <label className="fpv-l">Description (facultatif)
          <input value={n.description} onChange={(e) => setN({ ...n, description: e.target.value })} placeholder="Une nuit pour deux…" />
        </label>
      </div>
      <button className="fpv-btn accent" disabled={busy || !n.titre.trim()} onClick={ajouter} style={{ marginTop: ".6rem" }}>＋ Ajouter le cadeau</button>
    </div>
  );
}

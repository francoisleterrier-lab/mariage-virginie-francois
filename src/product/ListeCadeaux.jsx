import { useEffect, useState, useCallback } from "react";
import { sb } from "./supabaseFpv.js";

/* Liste de mariage : des cadeaux que les invités réservent un par un.
   Réservation via la fonction sécurisée fpv_reserver_cadeau (ne réserve
   que si le cadeau est encore libre → pas de doublon). */

const eur = (n) => new Intl.NumberFormat("fr-FR").format(Number(n)) + " €";

export default function ListeCadeaux({ invitationId }) {
  const [items, setItems] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [nom, setNom] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const charger = useCallback(async () => {
    const { data } = await sb
      .from("fpv_gifts")
      .select("id, titre, description, prix, lien, reserve_par, position, created_at")
      .eq("invitation_id", invitationId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    setItems(data || []);
  }, [invitationId]);

  useEffect(() => {
    charger();
    const onVoir = () => document.visibilityState === "visible" && charger();
    document.addEventListener("visibilitychange", onVoir);
    return () => document.removeEventListener("visibilitychange", onVoir);
  }, [charger]);

  async function reserver(id) {
    setBusy(true);
    setErr("");
    const { data, error } = await sb.rpc("fpv_reserver_cadeau", { p_gift: id, p_nom: nom.trim() });
    setBusy(false);
    if (error || data === false) {
      setErr("Ce cadeau vient d'être réservé par quelqu'un d'autre — la liste a été rafraîchie.");
      charger();
      return;
    }
    setOpenId(null);
    setNom("");
    charger();
  }

  const dispo = items.filter((g) => !g.reserve_par).length;
  if (items.length === 0) return null;

  return (
    <section className="fpv-sec fpv-cadeaux" id="cadeaux">
      <h2>Liste de mariage</h2>
      <p>Un cadeau vous ferait plaisir à offrir ? Réservez-le ici : les autres verront qu'il est pris, pas de doublon.</p>

      <div className="fpv-cad-grid">
        {items.map((g) => {
          const pris = !!g.reserve_par;
          return (
            <div key={g.id} className={"fpv-cad-item" + (pris ? " pris" : "")}>
              <div className="fpv-cad-h">
                <h3>{g.titre}</h3>
                {g.prix != null && g.prix !== "" && <span className="fpv-cad-prix">{eur(g.prix)}</span>}
              </div>
              {g.description && <p className="fpv-cad-desc">{g.description}</p>}
              {g.lien && (
                <a className="fpv-cad-lien" href={g.lien} target="_blank" rel="noopener noreferrer">Voir le cadeau ↗</a>
              )}

              {pris ? (
                <span className="fpv-cad-badge">✓ Réservé</span>
              ) : openId === g.id ? (
                <div className="fpv-cad-resa">
                  <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Votre prénom (facultatif)" aria-label="Votre prénom" />
                  <div className="fpv-cad-resa-btns">
                    <button className="fpv-cta" disabled={busy} onClick={() => reserver(g.id)}>{busy ? "…" : "Confirmer"}</button>
                    <button className="fpv-album-gal" type="button" onClick={() => { setOpenId(null); setErr(""); }}>Annuler</button>
                  </div>
                </div>
              ) : (
                <button className="fpv-album-gal fpv-cad-reserver" onClick={() => { setOpenId(g.id); setNom(""); setErr(""); }}>Réserver</button>
              )}
            </div>
          );
        })}
      </div>

      {err && <p className="fpv-err" style={{ marginTop: "1rem" }}>{err}</p>}
      <p className="fpv-hint" style={{ marginTop: "1.2rem" }}>{dispo} cadeau{dispo > 1 ? "x" : ""} encore disponible{dispo > 1 ? "s" : ""} sur {items.length}.</p>
    </section>
  );
}

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* Covoiturage (site V&F) : les invités proposent ou cherchent une place. */
const VIDE = { type: "offre", ville: "", quand: "", places: "2", contact: "", arrivee: "", depart: "" };

// Fenêtre autour de l'événement (26-27 mai 2028) : on arrive dès le 24, on repart jusqu'au 30.
const DATE_MIN = "2028-05-24";
const DATE_MAX = "2028-05-30";

function fmtJour(d) {
  if (!d) return "";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return d;
  }
}

export default function Covoiturage({ profile }) {
  const [items, setItems] = useState([]);
  const [resas, setResas] = useState([]);
  const [f, setF] = useState(VIDE);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");
  const [qte, setQte] = useState({}); // nb de places choisi par trajet
  const [resaBusy, setResaBusy] = useState(null); // id du trajet en cours
  const [resaErr, setResaErr] = useState({}); // erreur par trajet
  const estAdmin = profile?.role === "admin";
  const prenom = (profile?.nom || "").split(" ")[0];

  const charger = useCallback(async () => {
    const [{ data }, { data: r }] = await Promise.all([
      supabase
        .from("covoiturage")
        .select("id, invite_id, type, ville, quand, places, prenom, contact, arrivee, depart, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("covoiturage_reservations").select("id, trajet_id, invite_id, prenom, places"),
    ]);
    setItems(data || []);
    setResas(r || []);
  }, []);

  async function reserver(trajet) {
    const n = Math.max(1, parseInt(qte[trajet.id]) || 1);
    setResaErr((e) => ({ ...e, [trajet.id]: "" }));
    setResaBusy(trajet.id);
    const { error } = await supabase.rpc("vf_reserver_covoit", { p_trajet: trajet.id, p_places: n });
    setResaBusy(null);
    if (error) {
      const msg = /complet/i.test(error.message) ? "Plus assez de places libres." : "Réservation impossible, réessayez.";
      return setResaErr((e) => ({ ...e, [trajet.id]: msg }));
    }
    setQte((q) => ({ ...q, [trajet.id]: 1 }));
    charger();
  }

  async function annuler(resaId) {
    await supabase.from("covoiturage_reservations").delete().eq("id", resaId);
    charger();
  }

  useEffect(() => {
    charger();
    const onVoir = () => document.visibilityState === "visible" && charger();
    document.addEventListener("visibilitychange", onVoir);
    const id = setInterval(onVoir, 45000);
    return () => {
      document.removeEventListener("visibilitychange", onVoir);
      clearInterval(id);
    };
  }, [charger]);

  async function ajouter(e) {
    e.preventDefault();
    if (!f.ville.trim()) return setErr("Indiquez au moins la ville de départ.");
    setErr("");
    setBusy(true);
    const { error } = await supabase.from("covoiturage").insert({
      invite_id: profile.id,
      type: f.type,
      ville: f.ville.trim(),
      quand: f.quand.trim(),
      places: f.type === "offre" ? parseInt(f.places) || 1 : 0,
      prenom,
      contact: f.contact.trim(),
      arrivee: f.arrivee || null,
      depart: f.depart || null,
    });
    setBusy(false);
    if (error) return setErr("Envoi impossible, réessayez.");
    setF((s) => ({ ...VIDE, type: s.type }));
    setOk(true);
    setTimeout(() => setOk(false), 2400);
    charger();
  }

  async function supprimer(c) {
    await supabase.from("covoiturage").delete().eq("id", c.id);
    charger();
  }

  return (
    <section className="covoit-sec" id="covoiturage">
      <div className="wrap center">
        <p className="eyebrow">Covoiturage</p>
        <h2>
          La route <em>ensemble</em>
        </h2>
        <p>Le domaine est un peu à l'écart : proposez ou cherchez une place, et partagez le trajet. 🚗</p>

        <a className="covoit-vol" href="https://www.volotea.com/fr/" target="_blank" rel="noopener noreferrer">
          <span className="covoit-vol-ico" aria-hidden="true">✈️</span>
          <span className="covoit-vol-txt">
            <strong>Vous venez de Normandie ?</strong> Volotea relie <strong>Caen-Carpiquet</strong> à{" "}
            <strong>Toulouse-Blagnac</strong> en direct. L'idéal : aller le <strong>jeudi 25 mai</strong>, retour le{" "}
            <strong>dimanche 28</strong> ou <strong>lundi 29 mai</strong>. Pensez à réserver tôt — et à vous
            regrouper pour l'aéroport ! 🌿
            <span className="covoit-vol-lien">Voir les vols Volotea →</span>
          </span>
        </a>

        <form className="pl-form" onSubmit={ajouter}>
          <div className="covoit-type">
            <button type="button" className={f.type === "offre" ? "on" : ""} onClick={() => setF({ ...f, type: "offre" })}>🚗 Je propose</button>
            <button type="button" className={f.type === "recherche" ? "on" : ""} onClick={() => setF({ ...f, type: "recherche" })}>🙋 Je cherche</button>
          </div>
          <input value={f.ville} onChange={(e) => setF({ ...f, ville: e.target.value })} placeholder="Ville / secteur de départ" aria-label="Ville de départ" />
          <div className="covoit-dates">
            <label>
              <span>Arrivée sur place</span>
              <input type="date" min={DATE_MIN} max={DATE_MAX} value={f.arrivee} onChange={(e) => setF({ ...f, arrivee: e.target.value })} aria-label="Jour d'arrivée" />
            </label>
            <label>
              <span>Repartir le</span>
              <input type="date" min={DATE_MIN} max={DATE_MAX} value={f.depart} onChange={(e) => setF({ ...f, depart: e.target.value })} aria-label="Jour de départ" />
            </label>
          </div>
          <input value={f.quand} onChange={(e) => setF({ ...f, quand: e.target.value })} placeholder="Heure / précisions (ex. départ vendredi 18h)" aria-label="Heure ou précisions" />
          {f.type === "offre" && (
            <input type="number" min="1" max="8" value={f.places} onChange={(e) => setF({ ...f, places: e.target.value })} placeholder="Places disponibles" aria-label="Places" />
          )}
          <input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="Comment vous joindre (tél, e-mail…)" aria-label="Contact" />
          <button className="btn-vert pl-btn" disabled={busy}>{busy ? "…" : "Publier"}</button>
          {ok && <span className="ok">🌿 Publié !</span>}
          {err && <span className="gate-err" style={{ color: "#b06a4f" }}>{err}</span>}
        </form>

        {items.length === 0 ? (
          <p className="album-vide">Aucune annonce pour l'instant. Lancez le covoiturage ! 🚙</p>
        ) : (
          <ul className="covoit-liste">
            {items.map((c) => {
              const rs = resas.filter((r) => r.trajet_id === c.id);
              const pris = rs.reduce((s, r) => s + (parseInt(r.places) || 0), 0);
              const restant = Math.max(0, (parseInt(c.places) || 0) - pris);
              const maResa = rs.find((r) => r.invite_id === profile?.id);
              const monOffre = c.invite_id === profile?.id;
              const n = Math.max(1, parseInt(qte[c.id]) || 1);
              return (
                <li key={c.id} className={"covoit-item " + c.type}>
                  <span className="covoit-badge">{c.type === "offre" ? `🚗 Propose ${c.places} place${c.places > 1 ? "s" : ""}` : "🙋 Cherche une place"}</span>
                  <div className="covoit-info">
                    <strong>Depuis {c.ville}</strong>
                    {c.quand ? ` · ${c.quand}` : ""}
                    {c.prenom ? ` · ${c.prenom}` : ""}
                    {c.contact ? <span className="covoit-contact"> · {c.contact}</span> : null}
                  </div>
                  {(c.arrivee || c.depart) && (
                    <div className="covoit-trajet-dates">
                      {c.arrivee ? <span>🛬 Arrivée {fmtJour(c.arrivee)}</span> : null}
                      {c.depart ? <span>🛫 Retour {fmtJour(c.depart)}</span> : null}
                    </div>
                  )}

                  {c.type === "offre" && (
                    <div className="covoit-resa">
                      <span className={"covoit-restant" + (restant === 0 ? " complet" : "")}>
                        {restant === 0 ? "Complet 🚗" : `${restant} place${restant > 1 ? "s" : ""} restante${restant > 1 ? "s" : ""}`}
                      </span>
                      {rs.length > 0 && (
                        <span className="covoit-passagers">
                          · {rs.map((r) => `${r.prenom || "Invité"}${r.places > 1 ? ` (${r.places})` : ""}`).join(", ")}
                        </span>
                      )}

                      {maResa ? (
                        <div className="covoit-maresa">
                          <span>✅ Vous avez réservé {maResa.places} place{maResa.places > 1 ? "s" : ""}</span>
                          <button type="button" className="btn-lien" onClick={() => annuler(maResa.id)}>Annuler</button>
                        </div>
                      ) : monOffre ? (
                        <span className="covoit-monoffre">C'est votre offre 🌿</span>
                      ) : restant > 0 ? (
                        <div className="covoit-reserver">
                          {restant > 1 && (
                            <select value={n} onChange={(e) => setQte((q) => ({ ...q, [c.id]: e.target.value }))} aria-label="Nombre de places">
                              {Array.from({ length: restant }, (_, i) => i + 1).map((v) => (
                                <option key={v} value={v}>{v} place{v > 1 ? "s" : ""}</option>
                              ))}
                            </select>
                          )}
                          <button type="button" className="btn-vert covoit-resa-btn" disabled={resaBusy === c.id} onClick={() => reserver(c)}>
                            {resaBusy === c.id ? "…" : restant > 1 ? "Réserver" : "Réserver ma place"}
                          </button>
                        </div>
                      ) : null}
                      {resaErr[c.id] && <span className="gate-err" style={{ color: "#b06a4f" }}>{resaErr[c.id]}</span>}
                    </div>
                  )}

                  {(estAdmin || monOffre) && (
                    <button className="covoit-x" onClick={() => supprimer(c)} aria-label="Retirer">×</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   « Ma table » côté invité.
   - Réservations fermées + plan non publié → carte mystère.
   - Réservations ouvertes → l'invité choisit / change sa table
     (comptage en adultes ; tables bloquées = mariés/enfants).
   - Plan publié (admin) → sa table + voisins + mini-plan.
   ============================================================ */
export default function MaTable({ profile, onReload }) {
  const [prets, setPrets] = useState(false);
  const [planVisible, setPlanVisible] = useState(false);
  const [reservationOuverte, setReservationOuverte] = useState(false);
  const [aVenir, setAVenir] = useState(true);
  const [tables, setTables] = useState([]);
  const [voisins, setVoisins] = useState([]);
  const [choix, setChoix] = useState(false); // afficher la liste de tables
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const charger = useCallback(async () => {
    const [{ data: params }, { data: t }, { data: v }] = await Promise.all([
      supabase.from("parametres").select("cle, valeur").in("cle", ["plan_visible", "reservation_ouverte", "tables_a_venir"]),
      supabase.rpc("tables_dispo"),
      supabase.rpc("mes_voisins"),
    ]);
    const p = Object.fromEntries((params || []).map((r) => [r.cle, r.valeur === true]));
    const brut = Object.fromEntries((params || []).map((r) => [r.cle, r.valeur]));
    setPlanVisible(!!p.plan_visible);
    setReservationOuverte(!!p.reservation_ouverte);
    setAVenir(brut.tables_a_venir !== false); // « à venir » par défaut
    setTables(t || []);
    setVoisins((v || []).map((r) => r.nom));
    setPrets(true);
  }, []);

  useEffect(() => {
    charger();
  }, [charger, profile.table_id]);

  if (!prets) return null;

  /* « À venir » : le plan de table n'est pas encore ouvert aux invités. */
  if (aVenir) {
    return (
      <section className="matable" id="matable">
        <div className="wrap center">
          <p className="eyebrow">À venir · Votre place</p>
          <span className="pill-avenir">À venir</span>
          <h2>
            Votre place se <em>prépare</em>…
          </h2>
          <div className="matable-mystere">
            <div className="q">🌿</div>
            <p>
              Le plan de salle arrive bientôt. Vous pourrez choisir votre table ici — on vous préviendra le
              moment venu.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const maTable = tables.find((t) => t.id === profile.table_id);

  async function rejoindre(tableId) {
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("reserver_table", { p_table: tableId });
    setBusy(false);
    if (error) return setErr(error.message || "Réservation impossible.");
    setChoix(false);
    await onReload?.(); // recharge le profil (table_id) → l'effet relance charger()
  }

  async function seRetirer() {
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("liberer_table");
    setBusy(false);
    if (error) return setErr(error.message || "Impossible de se retirer.");
    await onReload?.();
  }

  /* Liste des tables à choisir (rejoindre / changer). */
  const liste = (
    <div className="tables-choix">
      {err && <p className="gate-err" style={{ color: "#b06a4f" }}>{err}</p>}
      {tables.map((t) => {
        const restantes = t.capacite - t.pris;
        const complet = restantes <= 0;
        const ici = t.id === profile.table_id;
        return (
          <div key={t.id} className={"table-carte" + (t.bloquee ? " bloquee" : "") + (ici ? " ici" : "")}>
            <div className="table-info">
              <strong>{t.nom}</strong>
              {t.bloquee ? (
                <span className="table-etat verrou">🔒 Réservée</span>
              ) : ici ? (
                <span className="table-etat ok">Votre table</span>
              ) : complet ? (
                <span className="table-etat complet">Complet</span>
              ) : (
                <span className="table-etat">
                  {restantes} place{restantes > 1 ? "s" : ""} sur {t.capacite}
                </span>
              )}
            </div>
            {!t.bloquee && !ici && !complet && (
              <button className="btn-vert table-btn" disabled={busy} onClick={() => rejoindre(t.id)}>
                Rejoindre
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  const miniPlan = (
    <div className="miniplan" role="img" aria-label="Plan de salle">
      {tables.map((t) => {
        const moi = t.id === profile.table_id;
        return (
          <div
            key={t.id}
            className={"miniplan-t" + (moi ? " moi" : "") + (t.forme === "rectangle" ? " rect" : "") + (t.bloquee ? " verr" : "")}
            style={{ left: `${t.pos_x}%`, top: `${t.pos_y}%` }}
            title={t.nom}
          >
            <span>{moi ? "★" : t.bloquee ? "🔒" : ""}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <section className="matable" id="matable">
      <div className="wrap center">
        <p className="eyebrow">Votre place</p>

        {/* 1) Réservations ouvertes */}
        {reservationOuverte ? (
          maTable && !choix ? (
            <>
              <h2>
                Vous êtes à la <em>{maTable.nom}</em>
              </h2>
              {voisins.length > 0 && (
                <p className="matable-voisins">
                  À vos côtés : <strong>{voisins.join(", ")}</strong>
                </p>
              )}
              {miniPlan}
              <p className="miniplan-legende">★ votre table · 🔒 réservée</p>
              <div className="matable-actions">
                <button className="btn-lien" onClick={() => setChoix(true)}>
                  Changer de table
                </button>
                <button className="btn-lien" disabled={busy} onClick={seRetirer}>
                  Me retirer
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>
                Choisissez <em>votre table</em>
              </h2>
              <p>
                Installez-vous où vous voulez — la table des mariés et la table des enfants sont réservées.
                {" "}Votre réservation garde la place de votre foyer : vous, votre conjoint·e et vos accompagnants adultes.
              </p>
              {liste}
              {maTable && (
                <button className="btn-lien" style={{ marginTop: "1rem" }} onClick={() => setChoix(false)}>
                  Annuler
                </button>
              )}
            </>
          )
        ) : planVisible && maTable ? (
          /* 2) Plan publié par l'admin (placement imposé) */
          <>
            <h2>
              Vous êtes à la <em>{maTable.nom}</em>
            </h2>
            {voisins.length > 0 && (
              <p className="matable-voisins">
                À vos côtés : <strong>{voisins.join(", ")}</strong>
              </p>
            )}
            {miniPlan}
            <p className="miniplan-legende">★ votre table · 🔒 réservée</p>
          </>
        ) : (
          /* 3) Rien encore : carte mystère */
          <>
            <h2>
              Votre place se <em>prépare</em>…
            </h2>
            <div className="matable-mystere">
              <div className="q">🌿</div>
              <p>
                Le plan de salle arrive bientôt. Vous pourrez choisir votre table ici — on vous préviendra le
                moment venu.
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

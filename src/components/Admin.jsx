import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import PushAdmin from "./PushAdmin.jsx";
import PlanEditor from "./PlanEditor.jsx";
import PhasesEditor from "./PhasesEditor.jsx";
import LieuEditor from "./LieuEditor.jsx";
import PagesPerso from "./PagesPerso.jsx";
import AdminBandeSon from "./AdminBandeSon.jsx";
import QuizAdmin from "./QuizAdmin.jsx";
import Engagement from "./Engagement.jsx";
import Familles from "./Familles.jsx";
import EditInvite from "./EditInvite.jsx";

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";

/* Échappe une valeur pour le CSV (guillemets + point-virgule Excel FR). */
function csvCell(v) {
  const s = String(v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

/* ============================================================
   ADMIN : réponses (stats + tableau + CSV), plan de table, notifications.
   RLS : is_admin() autorise la lecture de toutes les lignes.
   ============================================================ */
export default function Admin({ onLogout, onApercuInvite }) {
  const [invites, setInvites] = useState(null);
  const [tables, setTables] = useState([]);
  const [erreur, setErreur] = useState("");
  const [onglet, setOnglet] = useState("reponses"); // reponses | plan | notifications
  const [edit, setEdit] = useState(null); // invité en cours d'édition

  const charger = useCallback(async () => {
    const [{ data, error }, { data: t }] = await Promise.all([
      supabase
        .from("invites")
        .select("id, nom, email, couple_id, table_id, role, rsvp, rsvp_date, created_at, rattache_a, rattache_role")
        .order("created_at", { ascending: true }),
      supabase.from("tables_plan").select("id, nom").order("nom"),
    ]);
    if (error) setErreur(error.message);
    else setInvites(data || []);
    setTables(t || []);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  if (erreur)
    return (
      <div className="admin">
        <p className="attente">Erreur de chargement : {erreur}</p>
        <button className="btn-ghost" onClick={onLogout}>
          Se déconnecter
        </button>
      </div>
    );

  if (!invites)
    return (
      <div className="gate">
        <p className="gate-note">Chargement…</p>
      </div>
    );

  const nomParId = Object.fromEntries(invites.map((g) => [g.id, g.nom]));

  /* Regroupe les invités par foyer : un couple (lien réciproque couple_id)
     forme un seul « foyer » → une seule ligne. Les ados inscrits seuls et
     rattachés à une famille (rattache_a) sont nichés dans ce foyer. */
  const ados = invites.filter((g) => g.rattache_a);
  const base = invites.filter((g) => !g.rattache_a);
  const vus = new Set();
  const foyers = [];
  for (const g of base) {
    if (vus.has(g.id)) continue;
    const partenaire = g.couple_id ? base.find((x) => x.id === g.couple_id && x.couple_id === g.id) : null;
    let membres;
    if (partenaire) {
      vus.add(g.id);
      vus.add(partenaire.id);
      membres = [g, partenaire].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else {
      vus.add(g.id);
      membres = [g];
    }
    const ids = new Set(membres.map((m) => m.id));
    const adosFoyer = ados.filter((a) => ids.has(a.rattache_a));
    foyers.push({ key: g.id, membres, ados: adosFoyer });
  }

  const repondu = invites.filter((g) => g.rsvp);
  const presents = repondu.filter((g) => g.rsvp && !String(g.rsvp.presence || "").startsWith("Hélas"));
  const totalAdultes = presents.reduce((s, g) => s + (parseInt(g.rsvp.adultes) || 0), 0);
  const totalEnfants = presents.reduce((s, g) => s + (parseInt(g.rsvp.enfants) || 0), 0);

  function exporterCsv() {
    const entetes = ["Invité", "E-mail", "Inscrit le", "Couple", "Présence", "Adultes", "Enfants", "Prénoms enfants", "Régime", "Message", "Réponse le"];
    const lignes = invites.map((g) => [
      g.nom,
      g.email,
      fmtDate(g.created_at),
      g.couple_id ? nomParId[g.couple_id] || "" : "",
      g.rsvp?.presence || "",
      g.rsvp?.adultes || "",
      g.rsvp?.enfants || "",
      (g.rsvp?.enfantsNoms || []).filter(Boolean).join(", "),
      g.rsvp?.regime || "",
      g.rsvp?.mot || "",
      g.rsvp_date ? fmtDate(g.rsvp_date) : "",
    ]);
    const contenu = "﻿" + [entetes, ...lignes].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob([contenu], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reponses-mariage-vf-2028.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="admin">
      <div className="admin-head">
        <h1>Tableau de bord</h1>
        <div className="admin-actions">
          {onglet === "reponses" && (
            <button className="btn-ghost" onClick={exporterCsv} disabled={invites.length === 0}>
              Exporter en CSV
            </button>
          )}
          {onApercuInvite && (
            <button className="btn-ghost" onClick={onApercuInvite}>
              👁 Voir le site en invité
            </button>
          )}
          <button className="btn-ghost" onClick={onLogout}>
            Se déconnecter
          </button>
        </div>
      </div>

      <div className="admin-onglets" role="tablist">
        <button role="tab" aria-selected={onglet === "reponses"} className={onglet === "reponses" ? "on" : ""} onClick={() => setOnglet("reponses")}>
          Réponses
        </button>
        <button role="tab" aria-selected={onglet === "plan"} className={onglet === "plan" ? "on" : ""} onClick={() => setOnglet("plan")}>
          Plan de table
        </button>
        <button role="tab" aria-selected={onglet === "notifications"} className={onglet === "notifications" ? "on" : ""} onClick={() => setOnglet("notifications")}>
          Notifications
        </button>
        <button role="tab" aria-selected={onglet === "site"} className={onglet === "site" ? "on" : ""} onClick={() => setOnglet("site")}>
          Le site
        </button>
        <button role="tab" aria-selected={onglet === "pages"} className={onglet === "pages" ? "on" : ""} onClick={() => setOnglet("pages")}>
          Pages perso
        </button>
        <button role="tab" aria-selected={onglet === "bandeson"} className={onglet === "bandeson" ? "on" : ""} onClick={() => setOnglet("bandeson")}>
          Bande-son
        </button>
        <button role="tab" aria-selected={onglet === "quiz"} className={onglet === "quiz" ? "on" : ""} onClick={() => setOnglet("quiz")}>
          Quiz
        </button>
        <button role="tab" aria-selected={onglet === "familles"} className={onglet === "familles" ? "on" : ""} onClick={() => setOnglet("familles")}>
          Familles
        </button>
        <button role="tab" aria-selected={onglet === "engagement"} className={onglet === "engagement" ? "on" : ""} onClick={() => setOnglet("engagement")}>
          Engagement
        </button>
      </div>

      {onglet === "reponses" && (
        <>
          <div className="admin-stats">
            <div>
              <strong>{invites.length}</strong>
              <span>inscrit·e·s</span>
            </div>
            <div>
              <strong>{repondu.length}</strong>
              <span>réponses RSVP</span>
            </div>
            <div>
              <strong>{totalAdultes}</strong>
              <span>adultes attendus</span>
            </div>
            <div>
              <strong>{totalEnfants}</strong>
              <span>enfants attendus</span>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invité·e</th>
                  <th>E-mail</th>
                  <th>Inscrit·e le</th>
                  <th>Couple</th>
                  <th>Présence</th>
                  <th>Adultes / Enfants</th>
                  <th>Régime</th>
                  <th>Message</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {foyers.map(({ key, membres, ados: adosFoyer = [] }) => {
                  const prenom = (n) => (n || "").split(" ")[0];
                  const couple = membres.length > 1;
                  const tous = [...membres, ...adosFoyer];
                  const emails = tous.map((m) => m.email).filter((e) => e && !e.endsWith("@vf2028.local"));
                  const repsMembres = membres.filter((m) => m.rsvp);
                  const reps = tous.filter((m) => m.rsvp);
                  // représentant pour les compteurs : le parent ayant saisi le plus d'adultes
                  const lead = repsMembres.slice().sort((a, b) => (parseInt(b.rsvp.adultes) || 0) - (parseInt(a.rsvp.adultes) || 0))[0] || null;
                  const presences = [...new Set(reps.map((m) => m.rsvp.presence).filter(Boolean))];
                  const regimes = [...new Set(tous.map((m) => m.rsvp?.regime).filter(Boolean))];
                  const messages = tous.map((m) => m.rsvp?.mot).filter(Boolean);
                  const noms = lead ? (lead.rsvp.enfantsNoms || []).filter(Boolean) : [];
                  return (
                    <tr key={key}>
                      <td>
                        {membres.map((m) => m.nom).join(" & ")}
                        {adosFoyer.map((a) => (
                          <span key={a.id} className="foyer-ado">
                            <span className="ado-tag">{a.rattache_role === "enfant" ? "enfant" : "ado"}</span> {a.nom}
                          </span>
                        ))}
                      </td>
                      <td>{emails.length ? emails.join(" · ") : "—"}</td>
                      <td>{fmtDate(membres[0].created_at)}</td>
                      <td>{couple ? "💍" : "—"}</td>
                      <td>
                        {reps.length === 0 ? (
                          <em className="attente">en attente</em>
                        ) : presences.length <= 1 ? (
                          presences[0] || "—"
                        ) : (
                          reps.map((m) => (
                            <div key={m.id}>
                              {prenom(m.nom)} : {m.rsvp.presence}
                            </div>
                          ))
                        )}
                      </td>
                      <td>
                        {lead ? `${lead.rsvp.adultes} / ${lead.rsvp.enfants}` : "—"}
                        {noms.length > 0 && <span className="enfants-liste">{noms.join(", ")}</span>}
                      </td>
                      <td>{regimes.length ? regimes.join(" · ") : "—"}</td>
                      <td className="msg">{messages.length ? messages.join(" · ") : "—"}</td>
                      <td>
                        <div className="foyer-edit">
                          {tous.map((m) => (
                            <button key={m.id} className="btn-editer" onClick={() => setEdit(m)}>
                              {couple || adosFoyer.length ? `Éditer ${prenom(m.nom)}` : "Éditer"}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {invites.length === 0 && (
                  <tr>
                    <td colSpan="9" className="attente">
                      Personne ne s'est encore inscrit. Partagez le lien à vos invités !
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {onglet === "plan" && <PlanEditor invites={invites} onReloadInvites={charger} />}
      {onglet === "notifications" && <PushAdmin />}
      {onglet === "site" && (
        <>
          <LieuEditor />
          <PhasesEditor />
        </>
      )}
      {onglet === "pages" && <PagesPerso invites={invites} />}
      {onglet === "bandeson" && <AdminBandeSon invites={invites} />}
      {onglet === "quiz" && <QuizAdmin invites={invites} />}
      {onglet === "familles" && <Familles invites={invites} onReload={charger} />}
      {onglet === "engagement" && <Engagement invites={invites} />}

      {edit && (
        <EditInvite
          invite={edit}
          invites={invites}
          tables={tables}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            charger();
          }}
        />
      )}
    </div>
  );
}

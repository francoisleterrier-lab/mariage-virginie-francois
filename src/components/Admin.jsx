import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import PushAdmin from "./PushAdmin.jsx";
import PlanEditor from "./PlanEditor.jsx";
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
        .select("id, nom, email, couple_id, table_id, role, rsvp, rsvp_date, created_at")
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
                {invites.map((g) => {
                  const noms = (g.rsvp?.enfantsNoms || []).filter(Boolean);
                  return (
                    <tr key={g.id}>
                      <td>{g.nom}</td>
                      <td>{g.email}</td>
                      <td>{fmtDate(g.created_at)}</td>
                      <td>{g.couple_id ? nomParId[g.couple_id] || "—" : "—"}</td>
                      <td>{g.rsvp ? g.rsvp.presence : <em className="attente">en attente</em>}</td>
                      <td>
                        {g.rsvp ? `${g.rsvp.adultes} / ${g.rsvp.enfants}` : "—"}
                        {noms.length > 0 && <span className="enfants-liste">{noms.join(", ")}</span>}
                      </td>
                      <td>{g.rsvp?.regime || "—"}</td>
                      <td className="msg">{g.rsvp?.mot || "—"}</td>
                      <td>
                        <button className="btn-editer" onClick={() => setEdit(g)}>
                          Éditer
                        </button>
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

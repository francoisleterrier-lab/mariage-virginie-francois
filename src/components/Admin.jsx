import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";

/* Échappe une valeur pour le CSV (guillemets + point-virgule Excel FR). */
function csvCell(v) {
  const s = String(v ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

/* ============================================================
   ADMIN : inscrits, couples, réponses, totaux, export CSV
   RLS : la policy invite_select_self_or_admin autorise l'admin
   à lire toutes les lignes (is_admin()).
   ============================================================ */
export default function Admin({ onLogout }) {
  const [invites, setInvites] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    supabase
      .from("invites")
      .select("id, nom, email, couple_id, rsvp, rsvp_date, created_at")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) setErreur(error.message);
        else setInvites(data || []);
      });
  }, []);

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
    const entetes = [
      "Invité",
      "E-mail",
      "Inscrit le",
      "Couple",
      "Présence",
      "Adultes",
      "Enfants",
      "Régime",
      "Message",
      "Réponse le",
    ];
    const lignes = invites.map((g) => [
      g.nom,
      g.email,
      fmtDate(g.created_at),
      g.couple_id ? nomParId[g.couple_id] || "" : "",
      g.rsvp?.presence || "",
      g.rsvp?.adultes || "",
      g.rsvp?.enfants || "",
      g.rsvp?.regime || "",
      g.rsvp?.mot || "",
      g.rsvp_date ? fmtDate(g.rsvp_date) : "",
    ]);
    const contenu =
      "﻿" + // BOM pour Excel (accents)
      [entetes, ...lignes].map((row) => row.map(csvCell).join(";")).join("\r\n");
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
          <button className="btn-ghost" onClick={exporterCsv} disabled={invites.length === 0}>
            Exporter en CSV
          </button>
          <button className="btn-ghost" onClick={onLogout}>
            Se déconnecter
          </button>
        </div>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {invites.map((g) => (
              <tr key={g.id}>
                <td>{g.nom}</td>
                <td>{g.email}</td>
                <td>{fmtDate(g.created_at)}</td>
                <td>{g.couple_id ? nomParId[g.couple_id] || "—" : "—"}</td>
                <td>{g.rsvp ? g.rsvp.presence : <em className="attente">en attente</em>}</td>
                <td>{g.rsvp ? `${g.rsvp.adultes} / ${g.rsvp.enfants}` : "—"}</td>
                <td>{g.rsvp?.regime || "—"}</td>
                <td className="msg">{g.rsvp?.mot || "—"}</td>
              </tr>
            ))}
            {invites.length === 0 && (
              <tr>
                <td colSpan="8" className="attente">
                  Personne ne s'est encore inscrit. Partagez le lien à vos invités !
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

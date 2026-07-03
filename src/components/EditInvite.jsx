import { useState } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   Modale d'édition d'un invité (admin) — modifie tout :
   nom, e-mail, rôle, présence, adultes, enfants (+ prénoms),
   régime, message, table, couple. Suppression possible.
   ============================================================ */
export default function EditInvite({ invite, invites, tables, onClose, onSaved }) {
  const r = invite.rsvp || {};
  const [nom, setNom] = useState(invite.nom || "");
  const [email, setEmail] = useState(invite.email || "");
  const [role, setRole] = useState(invite.role || "invite");
  const [presence, setPresence] = useState(r.presence || "Les deux jours 🌿");
  const [adultes, setAdultes] = useState(String(r.adultes || "1"));
  const [enfants, setEnfants] = useState(String(r.enfants || "0"));
  const [enfantsNoms, setEnfantsNoms] = useState(Array.isArray(r.enfantsNoms) ? r.enfantsNoms : []);
  const [regime, setRegime] = useState(r.regime || "");
  const [mot, setMot] = useState(r.mot || "");
  const [tableId, setTableId] = useState(invite.table_id || "");
  const [coupleId, setCoupleId] = useState(invite.couple_id || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function majEnfants(n) {
    const nb = parseInt(n) || 0;
    const noms = [...enfantsNoms];
    noms.length = nb;
    for (let i = 0; i < nb; i++) if (noms[i] == null) noms[i] = "";
    setEnfants(n);
    setEnfantsNoms(noms);
  }

  async function majCouple(aId, oldPid, newPid) {
    if ((oldPid || "") === (newPid || "")) return;
    const ops = {};
    if (oldPid) ops[oldPid] = null; // délier l'ancien partenaire de A
    if (newPid) {
      const P = invites.find((x) => x.id === newPid);
      if (P?.couple_id && P.couple_id !== aId) ops[P.couple_id] = null; // délier l'ancien partenaire de P
      ops[newPid] = aId;
    }
    ops[aId] = newPid || null;
    for (const [id, cid] of Object.entries(ops)) {
      await supabase.from("invites").update({ couple_id: cid }).eq("id", id);
    }
  }

  async function enregistrer(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const rsvp = {
      presence,
      adultes,
      enfants,
      enfantsNoms: enfantsNoms.slice(0, parseInt(enfants) || 0).map((s) => (s || "").trim()),
      regime,
      mot,
    };
    const { error } = await supabase
      .from("invites")
      .update({
        nom: nom.trim(),
        email: email.trim().toLowerCase(),
        role,
        rsvp,
        rsvp_date: invite.rsvp_date || new Date().toISOString(),
        table_id: tableId || null,
      })
      .eq("id", invite.id);
    if (error) {
      setBusy(false);
      return setErr(error.message || "Enregistrement impossible.");
    }
    await majCouple(invite.id, invite.couple_id || "", coupleId || "");
    setBusy(false);
    onSaved();
  }

  async function supprimer() {
    if (!window.confirm(`Supprimer définitivement « ${invite.nom} » ? Cette action est irréversible.`)) return;
    setBusy(true);
    setErr("");
    // délier le couple d'abord (le FK est on delete set null, mais on nettoie proprement)
    if (invite.couple_id) await supabase.from("invites").update({ couple_id: null }).eq("id", invite.couple_id);
    const { error } = await supabase.from("invites").delete().eq("id", invite.id);
    setBusy(false);
    if (error) return setErr(error.message || "Suppression impossible.");
    onSaved();
  }

  const autres = invites.filter((x) => x.id !== invite.id);

  return (
    <div className="modal-fond" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={`Modifier ${invite.nom}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Modifier l'invité·e</h3>
          <button className="modal-x" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <form className="modal-form" onSubmit={enregistrer}>
          <label>Prénom &amp; nom</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} required />

          <label>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <div className="modal-duo">
            <div>
              <label>Rôle</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="invite">Invité·e</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label>Présence</label>
              <select value={presence} onChange={(e) => setPresence(e.target.value)}>
                <option>Les deux jours 🌿</option>
                <option>Vendredi 26 mai uniquement</option>
                <option>Samedi 27 mai uniquement</option>
                <option>Hélas, je ne pourrai pas venir</option>
              </select>
            </div>
          </div>

          <div className="modal-duo">
            <div>
              <label>Adultes</label>
              <select value={adultes} onChange={(e) => setAdultes(e.target.value)}>
                {["0", "1", "2", "3", "4", "5"].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Enfants / ados</label>
              <select value={enfants} onChange={(e) => majEnfants(e.target.value)}>
                {["0", "1", "2", "3", "4", "5"].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {parseInt(enfants) > 0 && (
            <>
              <label>Prénom (et âge) des enfants / ados</label>
              {Array.from({ length: parseInt(enfants) }).map((_, i) => (
                <input
                  key={i}
                  value={enfantsNoms[i] || ""}
                  onChange={(e) => {
                    const noms = [...enfantsNoms];
                    noms[i] = e.target.value;
                    setEnfantsNoms(noms);
                  }}
                  placeholder={`Enfant ${i + 1}`}
                />
              ))}
            </>
          )}

          <label>Allergies / régime</label>
          <input value={regime} onChange={(e) => setRegime(e.target.value)} />

          <label>Message</label>
          <textarea rows={2} value={mot} onChange={(e) => setMot(e.target.value)} />

          <div className="modal-duo">
            <div>
              <label>Table</label>
              <select value={tableId} onChange={(e) => setTableId(e.target.value)}>
                <option value="">— aucune —</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Couple avec</label>
              <select value={coupleId} onChange={(e) => setCoupleId(e.target.value)}>
                <option value="">— personne —</option>
                {autres.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nom}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {err && <p className="gate-err" style={{ color: "#b06a4f" }}>{err}</p>}

          <div className="modal-actions">
            <button type="button" className="modal-suppr" disabled={busy} onClick={supprimer}>
              Supprimer
            </button>
            <div className="modal-actions-droite">
              <button type="button" className="btn-lien" onClick={onClose}>
                Annuler
              </button>
              <button className="btn-vert" style={{ margin: 0, width: "auto", padding: "0.7rem 1.4rem" }} disabled={busy}>
                {busy ? "…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

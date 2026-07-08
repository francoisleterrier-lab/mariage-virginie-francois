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
  const [adultesNoms, setAdultesNoms] = useState(Array.isArray(r.adultesNoms) ? r.adultesNoms : []);
  const [regime, setRegime] = useState(r.regime || "");
  const [mot, setMot] = useState(r.mot || "");
  const [tableId, setTableId] = useState(invite.table_id || "");
  const [coupleId, setCoupleId] = useState(invite.couple_id || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [conjNom, setConjNom] = useState("");
  const [conjOuvert, setConjOuvert] = useState(false);
  const [ratId, setRatId] = useState("");
  const [ratCat, setRatCat] = useState("ado");

  async function creerConjoint() {
    if (!conjNom.trim()) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("admin_creer_conjoint", { p_invite: invite.id, p_nom: conjNom.trim() });
    setBusy(false);
    if (error) return setErr(error.message || "Création impossible.");
    onSaved();
  }

  // Personnes déjà inscrites, seules (ni couple, ni déjà rattachées), rattachables ici.
  const inscritsSeuls = (invites || []).filter(
    (x) =>
      x.id !== invite.id &&
      !x.couple_id &&
      !x.rattache_a &&
      x.role !== "admin" &&
      !(x.email || "").endsWith("@vf2028.local")
  );

  // Rattache une personne déjà inscrite (seule) à ce foyer en enfant / ado.
  async function rattacherPersonne() {
    if (!ratId) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase.from("invites").update({ rattache_a: invite.id, rattache_role: ratCat }).eq("id", ratId);
    setBusy(false);
    if (error) return setErr(error.message || "Rattachement impossible.");
    setRatId("");
    onSaved();
  }

  // Intègre une personne (non inscrite) dans la catégorie enfant / ado du foyer.
  function ajouterEnfant() {
    const noms = [...enfantsNoms, ""];
    setEnfantsNoms(noms);
    setEnfants(String(noms.length));
  }
  function retirerEnfant(i) {
    const noms = enfantsNoms.filter((_, j) => j !== i);
    setEnfantsNoms(noms);
    setEnfants(String(noms.length));
  }

  // Adultes accompagnants (non inscrits) : nom & prénom.
  function ajouterAdulte() {
    setAdultesNoms([...adultesNoms, ""]);
  }
  function retirerAdulte(i) {
    setAdultesNoms(adultesNoms.filter((_, j) => j !== i));
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
    const nomsPropres = enfantsNoms.map((s) => (s || "").trim()).filter(Boolean);
    const adultesPropres = adultesNoms.map((s) => (s || "").trim()).filter(Boolean);
    const rsvp = {
      presence,
      adultes,
      enfants: String(nomsPropres.length),
      enfantsNoms: nomsPropres,
      adultesNoms: adultesPropres,
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

  // Pour « Couple avec » : on masque les personnes déjà affectées à quelqu'un
  // (déjà en couple avec un autre, ou rattachées comme enfant/ado). On garde
  // le/la partenaire actuel·le de cet invité pour que la sélection reste juste.
  const autres = invites.filter(
    (x) =>
      x.id !== invite.id &&
      !x.rattache_a &&
      (!x.couple_id || x.couple_id === invite.id || x.id === coupleId)
  );

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
              <input value={enfantsNoms.length} readOnly aria-label="Nombre d'enfants / ados (géré par la liste ci-dessous)" />
            </div>
          </div>

          <div className="enfants-edit">
            <label>Adultes accompagnants (nom &amp; prénom)</label>
            {adultesNoms.map((nom, i) => (
              <div className="enfant-ligne" key={i}>
                <input
                  value={nom || ""}
                  onChange={(e) => {
                    const noms = [...adultesNoms];
                    noms[i] = e.target.value;
                    setAdultesNoms(noms);
                  }}
                  placeholder="Nom & prénom de l'adulte accompagnant"
                />
                <button type="button" className="enfant-x" onClick={() => retirerAdulte(i)} aria-label={`Retirer ${nom || "cet adulte"}`}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="btn-lien" onClick={ajouterAdulte}>
              ＋ Ajouter un adulte accompagnant
            </button>
          </div>

          <div className="enfants-edit">
            <label>Enfants / ados du foyer</label>
            {enfantsNoms.map((nom, i) => (
              <div className="enfant-ligne" key={i}>
                <input
                  value={nom || ""}
                  onChange={(e) => {
                    const noms = [...enfantsNoms];
                    noms[i] = e.target.value;
                    setEnfantsNoms(noms);
                  }}
                  placeholder="Prénom — enfant ou ado (ex. Léa, 8 ans)"
                />
                <button type="button" className="enfant-x" onClick={() => retirerEnfant(i)} aria-label={`Retirer ${nom || "cet enfant"}`}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="btn-lien" onClick={ajouterEnfant}>
              ＋ Ajouter un enfant / ado <span className="pp-hint">(personne non inscrite)</span>
            </button>

            <div className="rattacher-inscrit">
              <label>Ou rattacher une personne déjà inscrite (encore seule)</label>
              {inscritsSeuls.length === 0 ? (
                <p className="pp-hint">Aucune personne inscrite seule à rattacher pour le moment.</p>
              ) : (
                <div className="rattacher-ligne">
                  <select value={ratId} onChange={(e) => setRatId(e.target.value)}>
                    <option value="">— choisir une personne inscrite —</option>
                    {inscritsSeuls.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nom}
                      </option>
                    ))}
                  </select>
                  <select value={ratCat} onChange={(e) => setRatCat(e.target.value)} aria-label="Catégorie">
                    <option value="ado">Ado</option>
                    <option value="enfant">Enfant</option>
                  </select>
                  <button type="button" className="btn-vert" style={{ margin: 0, width: "auto", padding: "0.6rem 1.1rem" }} disabled={busy || !ratId} onClick={rattacherPersonne}>
                    Rattacher
                  </button>
                </div>
              )}
              <p className="pp-hint">La personne apparaîtra dans ce foyer, sur une seule ligne, dans l'onglet « Réponses ».</p>
            </div>
          </div>

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

          {!coupleId && (
            <div className="conjoint-manuel">
              {!conjOuvert ? (
                <button type="button" className="btn-lien" onClick={() => setConjOuvert(true)}>
                  ＋ Ajouter un conjoint non inscrit
                </button>
              ) : (
                <>
                  <label>Conjoint·e non inscrit·e (prénom &amp; nom)</label>
                  <div className="conjoint-ligne">
                    <input value={conjNom} onChange={(e) => setConjNom(e.target.value)} placeholder="ex. Marie Dupont" />
                    <button type="button" className="btn-vert" style={{ margin: 0, width: "auto", padding: "0.6rem 1.1rem" }} disabled={busy || !conjNom.trim()} onClick={creerConjoint}>
                      Créer &amp; lier
                    </button>
                    <button type="button" className="btn-lien" onClick={() => { setConjOuvert(false); setConjNom(""); }}>
                      Annuler
                    </button>
                  </div>
                  <p className="pp-hint">Crée une personne sans compte, liée en couple. Utile si le/la conjoint·e ne s'inscrit pas.</p>
                </>
              )}
            </div>
          )}

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

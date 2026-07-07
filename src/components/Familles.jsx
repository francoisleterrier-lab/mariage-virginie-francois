import { useState, useMemo } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   Admin — « Familles / Ados ».
   Rattacher une personne inscrite seule (avec compte) à une famille
   en tant qu'« ado ». Le lien est stocké dans invites.rattache_a.
   ============================================================ */
export default function Familles({ invites, onReload }) {
  const [adoId, setAdoId] = useState("");
  const [familleId, setFamilleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const nomParId = useMemo(() => Object.fromEntries(invites.map((g) => [g.id, g.nom])), [invites]);

  // Foyers cibles (couples + personnes seules), hors ados déjà rattachés.
  const foyers = useMemo(() => {
    const base = invites.filter((g) => !g.rattache_a);
    const vus = new Set();
    const out = [];
    for (const g of base) {
      if (vus.has(g.id)) continue;
      const p = g.couple_id ? base.find((x) => x.id === g.couple_id && x.couple_id === g.id) : null;
      if (p) {
        vus.add(g.id);
        vus.add(p.id);
        out.push({ id: g.id, membres: [g, p] });
      } else {
        vus.add(g.id);
        out.push({ id: g.id, membres: [g] });
      }
    }
    return out;
  }, [invites]);

  // Ados déjà rattachés, groupés par famille.
  const adosParFamille = useMemo(() => {
    const m = {};
    for (const a of invites.filter((g) => g.rattache_a)) {
      (m[a.rattache_a] = m[a.rattache_a] || []).push(a);
    }
    return m;
  }, [invites]);

  // Candidats : inscrits seuls (pas en couple, pas déjà ado, vrai compte).
  const candidats = useMemo(
    () =>
      invites
        .filter(
          (g) =>
            !g.couple_id &&
            !g.rattache_a &&
            g.role !== "admin" &&
            !(g.email || "").endsWith("@vf2028.local") &&
            !adosParFamille[g.id] // pas déjà parent d'un ado
        )
        .sort((a, b) => (a.nom || "").localeCompare(b.nom || "")),
    [invites, adosParFamille]
  );

  const labelFoyer = (f) => f.membres.map((m) => m.nom).join(" & ");

  async function rattacher() {
    if (!adoId || !familleId) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase.from("invites").update({ rattache_a: familleId }).eq("id", adoId);
    setBusy(false);
    if (error) return setErr(error.message || "Rattachement impossible.");
    setAdoId("");
    setFamilleId("");
    onReload?.();
  }

  async function detacher(id) {
    setBusy(true);
    setErr("");
    const { error } = await supabase.from("invites").update({ rattache_a: null }).eq("id", id);
    setBusy(false);
    if (error) return setErr(error.message || "Détachement impossible.");
    onReload?.();
  }

  return (
    <div className="admin-bloc">
      <h2 className="admin-h2">Familles — rattacher un ado</h2>
      <p className="admin-sous">
        Certaines personnes se sont inscrites <strong>seules</strong> (avec leur propre compte) alors qu'elles font
        partie d'une famille. Rattachez-les ici comme <strong>ado</strong> : elles apparaîtront dans le foyer choisi,
        sur une seule ligne, dans l'onglet « Réponses ».
      </p>

      <div className="fam-form">
        <label>
          <span>Personne inscrite seule</span>
          <select value={adoId} onChange={(e) => setAdoId(e.target.value)}>
            <option value="">— choisir un ado —</option>
            {candidats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Rattacher à la famille de</span>
          <select value={familleId} onChange={(e) => setFamilleId(e.target.value)}>
            <option value="">— choisir une famille —</option>
            {foyers
              .filter((f) => f.id !== adoId)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {labelFoyer(f)}
                </option>
              ))}
          </select>
        </label>
        <button className="btn-vert" style={{ margin: 0, width: "auto", padding: "0.55rem 1.3rem" }} disabled={busy || !adoId || !familleId} onClick={rattacher}>
          {busy ? "…" : "Rattacher comme ado"}
        </button>
      </div>
      {err && <p className="gate-err" style={{ color: "#b06a4f" }}>{err}</p>}

      <h3 className="admin-h3" style={{ marginTop: "1.6rem" }}>Rattachements actuels</h3>
      {Object.keys(adosParFamille).length === 0 ? (
        <p className="attente">Aucun ado rattaché pour l'instant.</p>
      ) : (
        <div className="fam-liste">
          {Object.entries(adosParFamille).map(([parentId, liste]) => (
            <div key={parentId} className="fam-carte">
              <strong>Famille {nomParId[parentId] || "—"}</strong>
              <ul>
                {liste.map((a) => (
                  <li key={a.id}>
                    <span>
                      <span className="ado-tag">ado</span> {a.nom}
                    </span>
                    <button className="btn-lien" disabled={busy} onClick={() => detacher(a.id)}>
                      Détacher
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   Admin — éditeur de plan de table.
   - créer / supprimer des tables (nom, forme, capacité)
   - positionner par glisser-déposer sur un canevas (pos en %)
   - affecter les invités à une table (fonction affecter_table)
   - basculer la visibilité invité (paramètre plan_visible)
   - alerte si un couple est séparé (tables différentes)
   ============================================================ */
export default function PlanEditor({ invites, onReloadInvites }) {
  const [tables, setTables] = useState([]);
  const [planVisible, setPlanVisible] = useState(false);
  const [reservationOuverte, setReservationOuverte] = useState(false);
  const [tablesAVenir, setTablesAVenir] = useState(true);
  const [nom, setNom] = useState("");
  const [forme, setForme] = useState("ronde");
  const [capacite, setCapacite] = useState(8);
  const [busy, setBusy] = useState(false);
  const [arbreObjectif, setArbreObjectif] = useState(80);
  const [arbrePrenoms, setArbrePrenoms] = useState(true);
  const canvasRef = useRef(null);
  const drag = useRef(null);

  async function charger() {
    const [{ data: t }, { data: params }] = await Promise.all([
      supabase.from("tables_plan").select("*").order("nom"),
      supabase
        .from("parametres")
        .select("cle, valeur")
        .in("cle", ["plan_visible", "reservation_ouverte", "tables_a_venir", "arbre_objectif", "arbre_prenoms"]),
    ]);
    setTables(t || []);
    const brut = Object.fromEntries((params || []).map((r) => [r.cle, r.valeur]));
    setPlanVisible(brut.plan_visible === true);
    setReservationOuverte(brut.reservation_ouverte === true);
    setTablesAVenir(brut.tables_a_venir !== false);
    if (brut.arbre_objectif != null) setArbreObjectif(Number(brut.arbre_objectif) || 80);
    setArbrePrenoms(brut.arbre_prenoms !== false);
  }

  async function toggleArbrePrenoms() {
    const nv = !arbrePrenoms;
    setArbrePrenoms(nv);
    await supabase.from("parametres").upsert({ cle: "arbre_prenoms", valeur: nv });
  }

  async function majArbreObjectif(v) {
    const n = Math.max(1, parseInt(v, 10) || 80);
    setArbreObjectif(n);
    await supabase.from("parametres").upsert({ cle: "arbre_objectif", valeur: n });
  }

  useEffect(() => {
    charger();
  }, []);

  const nomParId = Object.fromEntries(invites.map((g) => [g.id, g.nom]));
  const compteParTable = invites.reduce((acc, g) => {
    if (g.table_id) acc[g.table_id] = (acc[g.table_id] || 0) + 1;
    return acc;
  }, {});

  // Couples séparés (partenaires sur des tables différentes, ou l'un placé l'autre non).
  const couplesSepares = [];
  const vus = new Set();
  for (const g of invites) {
    if (!g.couple_id || vus.has(g.id)) continue;
    const p = invites.find((x) => x.id === g.couple_id);
    if (!p) continue;
    vus.add(g.id);
    vus.add(p.id);
    if ((g.table_id || null) !== (p.table_id || null)) couplesSepares.push([g.nom, p.nom]);
  }

  async function toggleVisible() {
    const nouvelle = !planVisible;
    setPlanVisible(nouvelle);
    await supabase.from("parametres").upsert({ cle: "plan_visible", valeur: nouvelle });
  }

  async function toggleReservation() {
    const nouvelle = !reservationOuverte;
    setReservationOuverte(nouvelle);
    await supabase.from("parametres").upsert({ cle: "reservation_ouverte", valeur: nouvelle });
  }

  async function toggleTablesAVenir() {
    const nouvelle = !tablesAVenir;
    setTablesAVenir(nouvelle);
    await supabase.from("parametres").upsert({ cle: "tables_a_venir", valeur: nouvelle });
  }

  async function toggleBloquee(t) {
    const val = !t.bloquee;
    setTables((ts) => ts.map((x) => (x.id === t.id ? { ...x, bloquee: val } : x)));
    await supabase.from("tables_plan").update({ bloquee: val }).eq("id", t.id);
  }

  async function ajouterTable(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    setBusy(true);
    const { data } = await supabase
      .from("tables_plan")
      .insert({ nom: nom.trim(), forme, capacite: Number(capacite) || 8, pos_x: 50, pos_y: 50 })
      .select()
      .single();
    setBusy(false);
    if (data) setTables((ts) => [...ts, data]);
    setNom("");
  }

  async function supprimerTable(id) {
    setTables((ts) => ts.filter((t) => t.id !== id));
    await supabase.from("tables_plan").delete().eq("id", id);
    onReloadInvites?.(); // des invités peuvent avoir été désaffectés (on delete set null)
  }

  async function affecter(inviteId, tableId) {
    await supabase.rpc("affecter_table", { p_invite: inviteId, p_table: tableId || null });
    onReloadInvites?.();
  }

  /* ---------- glisser-déposer des tables ---------- */
  function onPointerDown(e, t) {
    e.preventDefault();
    drag.current = { id: t.id };
    e.target.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e) {
    const d = drag.current;
    if (!d || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.min(96, Math.max(4, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(92, Math.max(6, ((e.clientY - rect.top) / rect.height) * 100));
    d.x = x;
    d.y = y;
    // On fige l'id dans `d` : l'updater de setTables peut s'exécuter APRÈS
    // que le pointer soit relâché (drag.current remis à null) — lire
    // drag.current.id à ce moment planterait tout l'arbre (page blanche).
    setTables((ts) => ts.map((t) => (t.id === d.id ? { ...t, pos_x: x, pos_y: y } : t)));
  }
  async function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    // On persiste la dernière position mémorisée dans le ref (pas via `tables`
    // en closure, qui peut être périmé) — uniquement si la table a bougé.
    if (d && d.x != null) {
      await supabase.from("tables_plan").update({ pos_x: d.x, pos_y: d.y }).eq("id", d.id);
    }
  }

  const nonPlaces = invites.filter((g) => !g.table_id);

  return (
    <div className="admin-bloc">
      <div className="plan-head">
        <h2 className="admin-h2">Plan de table</h2>
        <div className="plan-switches">
          <label className="switch">
            <input type="checkbox" checked={tablesAVenir} onChange={toggleTablesAVenir} />
            <span>Section « Ma table » en « à venir »</span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={reservationOuverte} onChange={toggleReservation} disabled={tablesAVenir} />
            <span>Réservations ouvertes</span>
          </label>
          <label className="switch">
            <input type="checkbox" checked={planVisible} onChange={toggleVisible} disabled={tablesAVenir} />
            <span>Plan visible (placement imposé)</span>
          </label>
        </div>
      </div>
      <p className="admin-sous">
        <strong>Réservations ouvertes</strong> : les invités choisissent eux-mêmes leur table (comptage en
        adultes ; les tables 🔒 <em>bloquées</em> — mariés, enfants — ne sont pas réservables). Utilise le
        cadenas sur une table pour la bloquer. <br />
        <strong>Plan visible</strong> : à utiliser si tu préfères placer toi-même les invités (via l'affectation
        ci-dessous) et leur montrer le résultat.
      </p>

      {/* Arbre de vie vivant */}
      <div className="arbre-admin">
        <h3 className="admin-h3">🌿 Arbre de vie</h3>
        <div className="arbre-admin-lignes">
          <label className="switch">
            <input type="checkbox" checked={arbrePrenoms} onChange={toggleArbrePrenoms} />
            <span>Afficher les prénoms au survol des feuilles</span>
          </label>
          <label className="arbre-obj">
            <span>Objectif de pleine floraison</span>
            <input
              type="number"
              min="1"
              max="500"
              value={arbreObjectif}
              onChange={(e) => setArbreObjectif(e.target.value)}
              onBlur={(e) => majArbreObjectif(e.target.value)}
            />
          </label>
        </div>
        <p className="admin-sous">
          Chaque foyer qui confirme sa présence fait pousser une feuille. Les invités ne voient jamais le
          nombre cible — seulement la poésie des feuilles. Décoche les prénoms si certains ne souhaitent pas
          apparaître.
        </p>
      </div>

      {couplesSepares.length > 0 && (
        <div className="alerte-couple">
          ⚠️ Couple·s séparé·s :{" "}
          {couplesSepares.map(([a, b], i) => (
            <span key={i}>
              {a} &amp; {b}
              {i < couplesSepares.length - 1 ? " · " : ""}
            </span>
          ))}
        </div>
      )}

      <form className="plan-add" onSubmit={ajouterTable}>
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de la table (ex. Table Olivier)" aria-label="Nom de la table" />
        <select value={forme} onChange={(e) => setForme(e.target.value)} aria-label="Forme">
          <option value="ronde">Ronde</option>
          <option value="rectangle">Rectangle</option>
        </select>
        <input type="number" min="1" max="20" value={capacite} onChange={(e) => setCapacite(e.target.value)} aria-label="Capacité" style={{ width: 80 }} />
        <button className="btn-vert" style={{ margin: 0, width: "auto", padding: "0.7rem 1.2rem" }} disabled={busy}>
          Ajouter
        </button>
      </form>

      {/* canevas de positionnement */}
      <div
        className="plan-canvas"
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {tables.length === 0 && <p className="plan-vide">Ajoutez des tables, puis glissez-les pour dessiner la salle.</p>}
        {tables.map((t) => (
          <div
            key={t.id}
            className={"plan-t" + (t.forme === "rectangle" ? " rect" : "") + (t.bloquee ? " bloquee" : "")}
            style={{ left: `${t.pos_x}%`, top: `${t.pos_y}%` }}
            onPointerDown={(e) => onPointerDown(e, t)}
            title="Glisser pour positionner"
          >
            <strong>{t.nom}</strong>
            <span>
              {compteParTable[t.id] || 0}/{t.capacite}
            </span>
            <button
              type="button"
              className="plan-lock"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => toggleBloquee(t)}
              aria-label={t.bloquee ? `Débloquer ${t.nom}` : `Bloquer ${t.nom} (non réservable)`}
              title={t.bloquee ? "Table bloquée (non réservable) — cliquer pour débloquer" : "Bloquer cette table"}
            >
              {t.bloquee ? "🔒" : "🔓"}
            </button>
            <button
              type="button"
              className="plan-del"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => supprimerTable(t.id)}
              aria-label={`Supprimer ${t.nom}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* affectation des invités */}
      <h3 className="admin-h3">
        Affectation {nonPlaces.length > 0 && <em className="attente">· {nonPlaces.length} non placé·s</em>}
      </h3>
      <div className="plan-affect">
        {invites.map((g) => (
          <div key={g.id} className="affect-ligne">
            <span>
              {g.nom}
              {g.couple_id && nomParId[g.couple_id] && <em className="affect-couple"> 💍 {nomParId[g.couple_id]}</em>}
            </span>
            <select value={g.table_id || ""} onChange={(e) => affecter(g.id, e.target.value)}>
              <option value="">— aucune —</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nom}
                </option>
              ))}
            </select>
          </div>
        ))}
        {invites.length === 0 && <p className="attente">Aucun invité inscrit pour l'instant.</p>}
      </div>
    </div>
  );
}

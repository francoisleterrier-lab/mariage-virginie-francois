import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   Admin — Bande-son : modération (avant) + console soirée (jour J).
   ============================================================ */
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const QUEUE_KEY = "bs-queue";

export default function AdminBandeSon({ invites }) {
  const [mode, setMode] = useState("moderation"); // moderation | console
  const [chansons, setChansons] = useState([]);
  const [ouverte, setOuverte] = useState(true);
  const [recherche, setRecherche] = useState("");
  const undo = useRef({});

  const nomPar = useMemo(() => Object.fromEntries(invites.map((g) => [g.id, (g.nom || "").split(" ")[0]])), [invites]);

  const charger = useCallback(async () => {
    const [{ data }, { data: params }] = await Promise.all([
      supabase.from("chansons").select("*").order("created_at", { ascending: true }),
      supabase.from("parametres").select("cle, valeur").eq("cle", "bandeson_ouverte"),
    ]);
    setChansons(data || []);
    const p = Object.fromEntries((params || []).map((r) => [r.cle, r.valeur]));
    setOuverte(p.bandeson_ouverte !== false);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  // rejoue la file hors-ligne au retour du réseau
  useEffect(() => {
    async function vider() {
      let q = [];
      try {
        q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
      } catch {
        q = [];
      }
      if (!q.length) return;
      for (const id of [...new Set(q)]) await pousser(id);
      localStorage.removeItem(QUEUE_KEY);
      charger();
    }
    window.addEventListener("online", vider);
    vider();
    return () => window.removeEventListener("online", vider);
  }, []);

  async function moderer(id, statut) {
    setChansons((cs) => cs.map((c) => (c.id === id ? { ...c, statut } : c)));
    await supabase.from("chansons").update({ statut }).eq("id", id);
  }
  async function noter(id, note_admin) {
    setChansons((cs) => cs.map((c) => (c.id === id ? { ...c, note_admin } : c)));
  }
  async function sauverNote(id, note_admin) {
    await supabase.from("chansons").update({ note_admin }).eq("id", id);
  }
  async function toggleOuverte() {
    const nv = !ouverte;
    setOuverte(nv);
    await supabase.from("parametres").upsert({ cle: "bandeson_ouverte", valeur: nv });
  }

  // envoie le push fantôme (idempotent côté fonction via push_a)
  async function pousser(id) {
    try {
      await supabase.functions.invoke("ghost-push", { body: { submission_id: id } });
    } catch {
      /* réseau : la file locale rejouera */
      let q = [];
      try {
        q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
      } catch {
        q = [];
      }
      q.push(id);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    }
  }

  async function jouer(c) {
    const t = new Date().toISOString();
    setChansons((cs) => cs.map((x) => (x.id === c.id ? { ...x, joue_a: t } : x)));
    // fenêtre d'annulation de 5 s avant d'écrire + pousser
    undo.current[c.id] = setTimeout(async () => {
      delete undo.current[c.id];
      await supabase.from("chansons").update({ joue_a: t }).eq("id", c.id);
      await pousser(c.id);
    }, 5000);
  }
  function annuler(c) {
    if (undo.current[c.id]) {
      clearTimeout(undo.current[c.id]);
      delete undo.current[c.id];
      setChansons((cs) => cs.map((x) => (x.id === c.id ? { ...x, joue_a: null } : x)));
    }
  }

  function exporterCsv() {
    const app = chansons.filter((c) => c.statut === "approuvee");
    const entetes = ["Titre", "Artiste", "Lien", "Auteur", "Souvenir (si autorisé)", "Note"];
    const lignes = app.map((c) => [
      c.titre,
      c.artiste,
      c.lien || "",
      nomPar[c.invite_id] || "",
      c.partage_jour_j ? c.souvenir : "",
      c.note_admin || "",
    ]);
    const contenu = "﻿" + [entetes, ...lignes].map((r) => r.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "bande-son-dj.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // regroupe les doublons (même titre+artiste normalisés)
  const groupes = useMemo(() => {
    const m = new Map();
    for (const c of chansons) {
      const k = norm(c.titre) + "|" + norm(c.artiste);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(c);
    }
    return m;
  }, [chansons]);
  const doublonAuteurs = (c) => {
    const k = norm(c.titre) + "|" + norm(c.artiste);
    return (groupes.get(k) || []).filter((x) => x.id !== c.id).map((x) => nomPar[x.invite_id]).filter(Boolean);
  };

  const recues = chansons.filter((c) => c.statut === "recue");
  const approuvees = chansons
    .filter((c) => c.statut === "approuvee")
    .filter((c) => !recherche || (c.titre + " " + c.artiste).toLowerCase().includes(recherche.toLowerCase()))
    .sort((a, b) => (a.joue_a ? 1 : 0) - (b.joue_a ? 1 : 0));

  return (
    <div className="admin-bloc">
      <div className="plan-head">
        <h2 className="admin-h2">Bande-son</h2>
        <div className="admin-onglets" role="tablist" style={{ borderBottom: "none" }}>
          <button className={mode === "moderation" ? "on" : ""} onClick={() => setMode("moderation")}>
            Modération
          </button>
          <button className={mode === "console" ? "on" : ""} onClick={() => setMode("console")}>
            Console soirée
          </button>
        </div>
      </div>

      {mode === "moderation" ? (
        <>
          <div className="bs-admin-actions">
            <label className="switch">
              <input type="checkbox" checked={ouverte} onChange={toggleOuverte} />
              <span>Soumissions ouvertes</span>
            </label>
            <button className="btn-ghost" style={{ width: "auto", margin: 0, padding: "0.55rem 1.1rem", color: "var(--encre)", borderColor: "var(--ligne)" }} onClick={exporterCsv}>
              Export DJ (CSV)
            </button>
          </div>

          <h3 className="admin-h3">À modérer ({recues.length})</h3>
          {recues.map((c) => (
            <ChansonAdmin key={c.id} c={c} auteur={nomPar[c.invite_id]} doublons={doublonAuteurs(c)} onNote={noter} onSaveNote={sauverNote} onModer={moderer} />
          ))}
          {recues.length === 0 && <p className="attente">Rien à modérer.</p>}

          <h3 className="admin-h3">Approuvées ({chansons.filter((c) => c.statut === "approuvee").length})</h3>
          {chansons.filter((c) => c.statut === "approuvee").map((c) => (
            <ChansonAdmin key={c.id} c={c} auteur={nomPar[c.invite_id]} doublons={doublonAuteurs(c)} onNote={noter} onSaveNote={sauverNote} onModer={moderer} approuvee />
          ))}
        </>
      ) : (
        <div className="bs-console">
          <input className="bs-search" placeholder="Rechercher un titre / artiste…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          {approuvees.map((c) => (
            <div key={c.id} className={"bs-live" + (c.joue_a ? " joue" : "")}>
              <div className="bs-live-info">
                <strong>{c.titre}</strong>
                <span>
                  {c.artiste} · {nomPar[c.invite_id] || "?"} {c.partage_jour_j ? "🔊" : ""}
                </span>
                {c.partage_jour_j && <p className="bs-live-souvenir">« {c.souvenir} »</p>}
              </div>
              {c.joue_a ? (
                undo.current[c.id] ? (
                  <button className="bs-undo" onClick={() => annuler(c)}>
                    Annuler
                  </button>
                ) : (
                  <span className="bs-joue">✨ Jouée</span>
                )
              ) : (
                <button className="bs-play" onClick={() => jouer(c)}>
                  Jouée
                </button>
              )}
            </div>
          ))}
          {approuvees.length === 0 && <p className="attente" style={{ color: "#cfe0c6" }}>Aucune chanson approuvée.</p>}
        </div>
      )}
    </div>
  );
}

function ChansonAdmin({ c, auteur, doublons, onNote, onSaveNote, onModer, approuvee }) {
  return (
    <div className="bs-mod">
      <div className="bs-mod-tete">
        <strong>{c.titre}</strong> — {c.artiste}
        <em className="bs-mod-auteur"> · {auteur}</em>
        {doublons.length > 0 && <em className="bs-doublon"> aussi proposée par {doublons.join(", ")}</em>}
      </div>
      <p className="bs-souvenir">« {c.souvenir} »</p>
      {c.lien && (
        <a className="btn-lien" href={c.lien} target="_blank" rel="noopener noreferrer">
          Écouter ↗
        </a>
      )}
      <input
        className="bs-note"
        placeholder="Note interne (jamais vue par l'invité)"
        defaultValue={c.note_admin || ""}
        onChange={(e) => onNote(c.id, e.target.value)}
        onBlur={(e) => onSaveNote(c.id, e.target.value)}
      />
      <div className="bs-mod-actions">
        {!approuvee && (
          <button className="btn-vert" style={{ margin: 0, width: "auto", padding: "0.45rem 1rem" }} onClick={() => onModer(c.id, "approuvee")}>
            Approuver
          </button>
        )}
        <button className="btn-lien" onClick={() => onModer(c.id, "refusee")}>
          {approuvee ? "Retirer" : "Refuser"}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from "react";
import { sb, messageAuth, versSlug } from "./supabaseFpv.js";

/* Éditeur self-service « Faire-part Vivant » :
   le couple se connecte, crée/édite son invitation, choisit un thème,
   publie, partage le lien, et lit les réponses RSVP. */

const THEMES = [
  { id: "canopee", nom: "Canopée", bg: "linear-gradient(135deg,#12201a,#4d6b3f)" },
  { id: "sceau", nom: "Le Sceau", bg: "linear-gradient(135deg,#3a1c22,#9c5a44)" },
  { id: "brume", nom: "La Brume", bg: "linear-gradient(135deg,#26343f,#6f8aa0)" },
];

const VIDE = {
  couple: "",
  slug: "",
  date_event: "",
  lieu_teaser: "",
  theme: "canopee",
  intro: "",
  sections: { compte: true, infos: false, infosTexte: "", rsvp: true },
  rsvp_ouvert: true,
  publie: false,
};

function lienPublic(slug) {
  return `${location.origin}${location.pathname}?i=${slug}`;
}

/* ---------- Authentification ---------- */
function Auth() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  async function go(e) {
    e.preventDefault();
    setErr(""); setInfo(""); setBusy(true);
    const key = email.trim().toLowerCase();
    if (mode === "signup") {
      const { data, error } = await sb.auth.signUp({ email: key, password: pass });
      setBusy(false);
      if (error) return setErr(messageAuth(error));
      if (!data.session) return setInfo("Compte créé ! Confirmez votre e-mail, puis connectez-vous.");
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: key, password: pass });
      setBusy(false);
      if (error) return setErr(messageAuth(error));
    }
  }

  return (
    <div className="fpv-admin fpv-auth">
      <p className="fpv-brand">Faire-part Vivant</p>
      <h1 className="fpv-h1">Espace création</h1>
      <p className="fpv-sub">Créez et gérez votre faire-part numérique — l'invitation qui vit et notifie vos invités.</p>
      <div className="fpv-card">
        <div className="fpv-toggles" style={{ marginBottom: "1rem" }}>
          <button className={"fpv-btn " + (mode === "login" ? "accent" : "ghost")} onClick={() => setMode("login")}>Se connecter</button>
          <button className={"fpv-btn " + (mode === "signup" ? "accent" : "ghost")} onClick={() => setMode("signup")}>Créer un compte</button>
        </div>
        <form onSubmit={go} className="fpv-row" style={{ gridTemplateColumns: "1fr" }}>
          <label className="fpv-l">E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="fpv-l">Mot de passe
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          </label>
          {err && <p className="fpv-err">{err}</p>}
          {info && <p className="fpv-ok">{info}</p>}
          <button className="fpv-btn accent" disabled={busy}>{busy ? "…" : mode === "signup" ? "Créer mon espace" : "Entrer"}</button>
        </form>
      </div>
    </div>
  );
}

/* ---------- Formulaire d'édition ---------- */
function Editer({ invite, onRetour }) {
  const [v, setV] = useState(() => ({ ...VIDE, ...invite, sections: { ...VIDE.sections, ...(invite?.sections || {}) } }));
  const [slugManuel, setSlugManuel] = useState(!!invite?.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [rsvps, setRsvps] = useState([]);
  const [nAb, setNAb] = useState(0);
  const [nt, setNt] = useState("");
  const [nm, setNm] = useState("");
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifRet, setNotifRet] = useState(null);
  const estNouveau = !invite?.id;

  const slug = slugManuel ? v.slug : versSlug(v.couple);

  const chargerRsvps = useCallback(async () => {
    if (!invite?.id) return;
    const [{ data }, { count }] = await Promise.all([
      sb.from("fpv_rsvps").select("*").eq("invitation_id", invite.id).order("created_at", { ascending: false }),
      sb.from("fpv_push_subscriptions").select("id", { count: "exact", head: true }).eq("invitation_id", invite.id),
    ]);
    setRsvps(data || []);
    setNAb(count || 0);
  }, [invite]);
  useEffect(() => { chargerRsvps(); }, [chargerRsvps]);

  async function envoyerNotif(e) {
    e.preventDefault();
    if (!nt.trim() || !nm.trim()) return;
    setNotifBusy(true);
    setNotifRet(null);
    const { data, error } = await sb.functions.invoke("fpv-notify", {
      body: { slug: invite.slug, titre: nt.trim(), message: nm.trim() },
    });
    setNotifBusy(false);
    if (error) return setNotifRet({ ok: false, t: "Échec de l'envoi." });
    setNotifRet({ ok: true, t: `Envoyée à ${data.envoyes}/${data.total} abonné·e·s.` });
    setNt(""); setNm("");
  }

  function maj(champ, val) { setV((s) => ({ ...s, [champ]: val })); }
  function majSec(champ, val) { setV((s) => ({ ...s, sections: { ...s.sections, [champ]: val } })); }

  async function enregistrer(publier) {
    setErr(""); setOk(false);
    if (!v.couple.trim()) return setErr("Indiquez les prénoms du couple (ex. « Camille & Alex »).");
    if (!slug) return setErr("Le lien (slug) ne peut pas être vide.");
    setBusy(true);
    const { data: { user } } = await sb.auth.getUser();
    const payload = {
      owner_id: user.id,
      slug,
      couple: v.couple.trim(),
      date_event: v.date_event || null,
      lieu_teaser: v.lieu_teaser.trim(),
      theme: v.theme,
      intro: v.intro.trim(),
      sections: v.sections,
      rsvp_ouvert: v.rsvp_ouvert,
      publie: publier != null ? publier : v.publie,
      updated_at: new Date().toISOString(),
    };
    let res;
    if (estNouveau) res = await sb.from("fpv_invitations").insert(payload).select().single();
    else res = await sb.from("fpv_invitations").update(payload).eq("id", invite.id).select().single();
    setBusy(false);
    if (res.error) {
      if ((res.error.message || "").includes("duplicate") || res.error.code === "23505")
        return setErr("Ce lien est déjà pris — changez le « lien de l'invitation ».");
      return setErr(res.error.message || "Enregistrement impossible.");
    }
    setV((s) => ({ ...s, ...res.data, sections: { ...VIDE.sections, ...(res.data.sections || {}) } }));
    setSlugManuel(true);
    setOk(true);
    if (publier != null) onRetour(true);
  }

  return (
    <div className="fpv-admin">
      <button className="fpv-btn ghost" onClick={() => onRetour(false)} style={{ marginBottom: "1.2rem" }}>← Mes invitations</button>
      <h1 className="fpv-h1">{estNouveau ? "Nouvelle invitation" : v.couple}</h1>

      <div className="fpv-card">
        <h2>L'essentiel</h2>
        <div className="fpv-row">
          <label className="fpv-l">Prénoms du couple
            <input value={v.couple} onChange={(e) => maj("couple", e.target.value)} placeholder="Camille & Alex" />
          </label>
          <label className="fpv-l">Date du mariage
            <input type="date" value={v.date_event || ""} onChange={(e) => maj("date_event", e.target.value)} />
          </label>
          <label className="fpv-l">Lien de l'invitation
            <input value={slug} onChange={(e) => { setSlugManuel(true); maj("slug", versSlug(e.target.value)); }} placeholder="camille-alex" />
            <span className="fpv-hint">{lienPublic(slug || "…")}</span>
          </label>
          <label className="fpv-l">Petit teaser du lieu
            <input value={v.lieu_teaser} onChange={(e) => maj("lieu_teaser", e.target.value)} placeholder="Quelque part en Provence…" />
          </label>
        </div>
      </div>

      <div className="fpv-card">
        <h2>L'univers</h2>
        <div className="fpv-themepick">
          {THEMES.map((t) => (
            <button key={t.id} type="button" className={"fpv-theme" + (v.theme === t.id ? " on" : "")} onClick={() => maj("theme", t.id)}>
              <div className="sw" style={{ background: t.bg }} />
              <div className="nm">{t.nom}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="fpv-card">
        <h2>Contenu</h2>
        <label className="fpv-l" style={{ marginBottom: "1rem" }}>Notre histoire (facultatif)
          <textarea rows={4} value={v.intro} onChange={(e) => maj("intro", e.target.value)} placeholder="Quelques lignes sur vous, votre rencontre…" />
        </label>
        <div className="fpv-toggles" style={{ marginBottom: "1rem" }}>
          <label className="fpv-toggle"><input type="checkbox" checked={v.sections.compte !== false} onChange={(e) => majSec("compte", e.target.checked)} /> Compte à rebours</label>
          <label className="fpv-toggle"><input type="checkbox" checked={v.sections.interactif === true || v.sections.arbre === true} onChange={(e) => majSec("interactif", e.target.checked)} /> Élément interactif ✨</label>
          <label className="fpv-toggle"><input type="checkbox" checked={v.sections.infos === true} onChange={(e) => majSec("infos", e.target.checked)} /> Infos pratiques</label>
          <label className="fpv-toggle"><input type="checkbox" checked={v.rsvp_ouvert} onChange={(e) => maj("rsvp_ouvert", e.target.checked)} /> RSVP ouvert</label>
        </div>
        {(v.sections.interactif === true || v.sections.arbre === true) && (
          <label className="fpv-l" style={{ marginBottom: "1rem" }}>Type d'élément interactif
            <select value={v.sections.interactifType || (v.sections.arbre ? "arbre" : "arbre")} onChange={(e) => majSec("interactifType", e.target.value)}>
              <option value="arbre">Arbre de vie — une lumière par invité confirmé</option>
              <option value="constellation">Constellation — une étoile par invité confirmé</option>
            </select>
            <span className="fpv-hint">Un cœur du faire-part qui prend vie à chaque « oui ». D'autres éléments arriveront.</span>
          </label>
        )}
        {v.sections.infos && (
          <label className="fpv-l">Texte des infos pratiques
            <textarea rows={3} value={v.sections.infosTexte || ""} onChange={(e) => majSec("infosTexte", e.target.value)} placeholder="Dress code, hébergement, accès…" />
          </label>
        )}
      </div>

      {err && <p className="fpv-err">{err}</p>}
      {ok && <p className="fpv-ok">🌿 Enregistré.</p>}
      <div className="fpv-actions">
        <button className="fpv-btn" disabled={busy} onClick={() => enregistrer(null)}>Enregistrer le brouillon</button>
        {!v.publie
          ? <button className="fpv-btn accent" disabled={busy} onClick={() => enregistrer(true)}>Publier</button>
          : <button className="fpv-btn ghost" disabled={busy} onClick={() => enregistrer(false)}>Dépublier</button>}
        {v.publie && <span className="fpv-pill pub">En ligne</span>}
      </div>

      {!estNouveau && v.publie && (
        <div className="fpv-card" style={{ marginTop: "1.2rem" }}>
          <h2>Le lien à partager</h2>
          <div className="fpv-share">
            <span>{lienPublic(slug)}</span>
            <button className="fpv-btn ghost" onClick={() => navigator.clipboard?.writeText(lienPublic(slug))}>Copier</button>
            <a className="fpv-btn ghost" href={lienPublic(slug)} target="_blank" rel="noopener noreferrer">Voir</a>
          </div>
        </div>
      )}

      {!estNouveau && v.publie && (
        <div className="fpv-card" style={{ marginTop: "1.2rem" }}>
          <h2>Notifier vos invités</h2>
          <p className="fpv-hint" style={{ marginTop: "-.4rem" }}>{nAb} appareil·s abonné·s — annoncez le lieu, un changement, un petit mot.</p>
          <form onSubmit={envoyerNotif} className="fpv-row" style={{ gridTemplateColumns: "1fr", marginTop: ".8rem" }}>
            <label className="fpv-l">Titre
              <input value={nt} onChange={(e) => setNt(e.target.value)} maxLength={60} placeholder="Le lieu est révélé ! 🌿" />
            </label>
            <label className="fpv-l">Message
              <textarea rows={2} value={nm} onChange={(e) => setNm(e.target.value)} maxLength={180} placeholder="Rendez-vous au Domaine des Oliviers…" />
            </label>
            <div className="fpv-actions" style={{ marginTop: 0 }}>
              <button className="fpv-btn accent" disabled={notifBusy || !nt.trim() || !nm.trim()}>{notifBusy ? "Envoi…" : "Envoyer à tous les abonnés"}</button>
              {notifRet && <span className={notifRet.ok ? "fpv-ok" : "fpv-err"}>{notifRet.t}</span>}
            </div>
          </form>
        </div>
      )}

      {!estNouveau && (
        <div className="fpv-card" style={{ marginTop: "1.2rem" }}>
          <h2>Réponses ({rsvps.length})</h2>
          {rsvps.length === 0 ? (
            <p className="fpv-hint">Aucune réponse pour l'instant.</p>
          ) : (
            <div className="fpv-list">
              {rsvps.map((r) => (
                <div key={r.id} className="fpv-item">
                  <div className="grow">
                    <div className="nm">{r.nom}</div>
                    <div className="meta">{r.presence} · {r.adultes} adulte(s), {r.enfants} enfant(s){r.message ? ` · « ${r.message} »` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Tableau de bord (liste) ---------- */
export default function Editeur() {
  const [session, setSession] = useState(undefined); // undefined = inconnu
  const [invites, setInvites] = useState([]);
  const [edit, setEdit] = useState(null); // null=liste, {}=nouveau, {...}=édition

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const charger = useCallback(async () => {
    const { data } = await sb.from("fpv_invitations").select("*").order("created_at", { ascending: false });
    setInvites(data || []);
  }, []);
  useEffect(() => { if (session) charger(); }, [session, charger]);

  if (session === undefined) return <div className="fpv-loading">Un instant…</div>;
  if (!session) return <Auth />;

  if (edit !== null) {
    return <Editer invite={edit.id ? edit : null} onRetour={() => { setEdit(null); charger(); }} />;
  }

  return (
    <div className="fpv-admin">
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <p className="fpv-brand">Faire-part Vivant</p>
          <h1 className="fpv-h1" style={{ margin: ".2rem 0 0" }}>Mes invitations</h1>
        </div>
        <button className="fpv-btn ghost" style={{ marginLeft: "auto" }} onClick={() => sb.auth.signOut()}>Se déconnecter</button>
      </div>
      <p className="fpv-sub" style={{ marginTop: ".6rem" }}>{session.user.email}</p>

      <div className="fpv-actions" style={{ marginBottom: "1.4rem" }}>
        <button className="fpv-btn accent" onClick={() => setEdit({})}>＋ Créer une invitation</button>
      </div>

      {invites.length === 0 ? (
        <div className="fpv-card"><p className="fpv-hint">Aucune invitation pour l'instant. Créez la première 🌿</p></div>
      ) : (
        <div className="fpv-list">
          {invites.map((i) => (
            <div key={i.id} className="fpv-item">
              <div className="grow">
                <div className="nm">{i.couple || "Sans titre"}</div>
                <div className="meta">{i.date_event ? new Date(i.date_event + "T12:00:00").toLocaleDateString("fr-FR") : "date à définir"} · /{i.slug}</div>
              </div>
              <span className={"fpv-pill " + (i.publie ? "pub" : "draft")}>{i.publie ? "en ligne" : "brouillon"}</span>
              <button className="fpv-btn ghost" onClick={() => setEdit(i)}>Éditer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

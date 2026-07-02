import { useState } from "react";
import { supabase, messageErreurAuth } from "../lib/supabase.js";
import MedaillonArbre from "./MedaillonArbre.jsx";
import fondVideo from "../assets/fond-inscription.mp4";

/* ============================================================
   PORTAIL : inscription / connexion / proposition couple
   Aucun contenu du site n'est visible tant que onEnter() n'a
   pas été appelé (App bascule alors sur le site ou l'admin).
   ============================================================ */
export default function Gate({ onEnter }) {
  const [mode, setMode] = useState("inscription"); // inscription | connexion | couple
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [candidats, setCandidats] = useState([]); // {id, nom} des invités libres
  const [moiId, setMoiId] = useState(null); // id de la ligne fraîchement créée

  /* ---------- Inscription ---------- */
  async function inscrire(e) {
    e.preventDefault();
    setErr("");
    if (pass.length < 6) return setErr("Le mot de passe doit faire au moins 6 caractères.");
    if (pass !== pass2) return setErr("Les deux mots de passe ne correspondent pas.");

    setBusy(true);
    const key = email.trim().toLowerCase();

    // 1) Création du compte Auth (le nom est stocké dans les métadonnées :
    // il sert de secours si la ligne invité doit être recréée plus tard).
    const { data: signUp, error: errSignUp } = await supabase.auth.signUp({
      email: key,
      password: pass,
      options: { data: { nom: nom.trim() } },
    });
    if (errSignUp) {
      setBusy(false);
      return setErr(messageErreurAuth(errSignUp));
    }

    // Si la confirmation d'e-mail est activée, il n'y a pas de session :
    // on prévient l'invité (mais le mode privé recommande de la désactiver).
    if (!signUp.session) {
      setBusy(false);
      return setErr(
        "Compte créé ! Confirmez votre e-mail via le lien reçu, puis revenez sur « Déjà inscrit·e »."
      );
    }

    // 2) Création de la ligne invité (RLS : auth.uid() = user_id)
    const { data: ligne, error: errInsert } = await supabase
      .from("invites")
      .insert({ user_id: signUp.user.id, nom: nom.trim(), email: key })
      .select("id")
      .single();

    if (errInsert) {
      setBusy(false);
      // Cas rare : e-mail déjà présent en base mais pas côté Auth.
      return setErr(messageErreurAuth(errInsert));
    }

    // 3) Y a-t-il d'autres invités encore libres ? → écran couple.
    const { data: autres } = await supabase
      .from("invites_public")
      .select("id, nom, couple_id")
      .is("couple_id", null)
      .neq("id", ligne.id);

    setBusy(false);
    if (autres && autres.length > 0) {
      setMoiId(ligne.id);
      setCandidats(autres);
      setMode("couple");
    } else {
      onEnter();
    }
  }

  /* ---------- Liaison couple ---------- */
  async function lierCouple(partnerId) {
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("lier_couple", { partner_id: partnerId });
    setBusy(false);
    if (error) return setErr(error.message || "Impossible de lier ce couple.");
    onEnter();
  }

  /* ---------- Connexion ---------- */
  async function connecter(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const key = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: key, password: pass });
    setBusy(false);
    if (error) {
      // Distinguer e-mail inconnu / mot de passe incorrect quand c'est possible.
      return setErr(messageErreurAuth(error));
    }
    onEnter();
  }

  return (
    <div className="gate">
      {/* Vidéo d'ambiance en fond, légèrement fondue (calque vert par-dessus) */}
      <video className="gate-fond" src={fondVideo} autoPlay muted loop playsInline preload="auto" aria-hidden="true" />
      <div className="gate-overlay" aria-hidden="true" />
      <div className="gate-inner">
      <MedaillonArbre variant="gate" />
      <h1 className="gate-titre">
        Virginie <em>&amp;</em> François
      </h1>
      <p className="gate-date">26 · 27 mai 2028 — Sud-Toulousain</p>

      {mode !== "couple" && (
        <div className="gate-tabs" role="tablist" aria-label="Accès au site">
          <button
            role="tab"
            aria-selected={mode === "inscription"}
            className={mode === "inscription" ? "on" : ""}
            onClick={() => {
              setMode("inscription");
              setErr("");
            }}
          >
            Première visite
          </button>
          <button
            role="tab"
            aria-selected={mode === "connexion"}
            className={mode === "connexion" ? "on" : ""}
            onClick={() => {
              setMode("connexion");
              setErr("");
            }}
          >
            Déjà inscrit·e
          </button>
        </div>
      )}

      {mode === "inscription" && (
        <form className="gate-form" onSubmit={inscrire}>
          <p className="gate-note">
            Ce site est réservé à nos invités. Créez votre accès pour découvrir le faire-part.
          </p>
          <label htmlFor="g-nom">Prénom &amp; nom</label>
          <input id="g-nom" value={nom} onChange={(e) => setNom(e.target.value)} required placeholder="Camille Dupont" autoComplete="name" />
          <label htmlFor="g-mail">E-mail</label>
          <input id="g-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="camille@exemple.fr" autoComplete="email" />
          <label htmlFor="g-p1">Mot de passe</label>
          <input id="g-p1" type="password" value={pass} onChange={(e) => setPass(e.target.value)} required placeholder="6 caractères minimum" autoComplete="new-password" />
          <label htmlFor="g-p2">Confirmez le mot de passe</label>
          <input id="g-p2" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} required autoComplete="new-password" />
          {err && <p className="gate-err">{err}</p>}
          <button className="btn-or" disabled={busy}>{busy ? "Un instant…" : "Créer mon accès"}</button>
        </form>
      )}

      {mode === "connexion" && (
        <form className="gate-form" onSubmit={connecter}>
          <label htmlFor="c-mail">E-mail</label>
          <input id="c-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <label htmlFor="c-pass">Mot de passe</label>
          <input id="c-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} required autoComplete="current-password" />
          {err && <p className="gate-err">{err}</p>}
          <button className="btn-or" disabled={busy}>{busy ? "Un instant…" : "Entrer"}</button>
        </form>
      )}

      {mode === "couple" && (
        <div className="gate-form">
          <p className="gate-note">
            💍 Votre moitié est peut-être déjà parmi nous.
            <br />
            Venez-vous en couple avec l'un de nos invités déjà inscrits ?
          </p>
          {err && <p className="gate-err">{err}</p>}
          <div className="couple-liste">
            {candidats.map((c) => (
              <button key={c.id} className="couple-item" disabled={busy} onClick={() => lierCouple(c.id)}>
                <span>{c.nom}</span>
                <em>Rejoindre en couple</em>
              </button>
            ))}
          </div>
          <button className="btn-ghost" disabled={busy} onClick={() => onEnter()}>
            Je continue seul·e pour l'instant
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

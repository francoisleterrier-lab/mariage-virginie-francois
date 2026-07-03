import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase.js";
import Gate from "./components/Gate.jsx";
import Site from "./components/Site.jsx";
import Admin from "./components/Admin.jsx";
import Intro from "./components/Intro.jsx";
import InstallBanner from "./components/InstallBanner.jsx";

/* ============================================================
   RACINE — machine à états d'accès
   phase : 'boot' (vérif session) | 'gate' | 'app'
   Le portail (Gate) garde la main sur tout le parcours post-inscription
   (y compris l'écran couple) : App ne bascule sur le site QUE sur
   appel explicite de onEnter(). La session persistée est relue au boot ;
   la déconnexion renvoie au portail.
   ============================================================ */
export default function App() {
  const [phase, setPhase] = useState("boot");
  const [profile, setProfile] = useState(null);
  const [apercuInvite, setApercuInvite] = useState(false); // admin : aperçu du site invité
  const [introVue, setIntroVue] = useState(() => {
    try {
      return sessionStorage.getItem("vf-intro") === "1";
    } catch {
      return false;
    }
  });

  const chargerProfil = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      return null;
    }
    const cols = "id, nom, email, couple_id, table_id, role, rsvp, rsvp_date";
    let { data } = await supabase.from("invites").select(cols).eq("user_id", user.id).maybeSingle();

    // Secours : compte authentifié sans ligne invité (ex. e-mail confirmé
    // après coup) → on la crée depuis le nom stocké dans les métadonnées.
    if (!data) {
      const nom = user.user_metadata?.nom || (user.email || "").split("@")[0];
      await supabase.from("invites").insert({ user_id: user.id, nom, email: user.email });
      ({ data } = await supabase.from("invites").select(cols).eq("user_id", user.id).maybeSingle());
    }

    setProfile(data || null);
    return data;
  }, []);

  useEffect(() => {
    // 1) Session persistée ?
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        await chargerProfil();
        setPhase("app");
      } else {
        setPhase("gate");
      }
    });

    // 2) On ne réagit qu'à la déconnexion (l'entrée passe par onEnter()).
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setPhase("gate");
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [chargerProfil]);

  const entrer = useCallback(async () => {
    await chargerProfil();
    setPhase("app");
  }, [chargerProfil]);

  const deconnexion = useCallback(async () => {
    await supabase.auth.signOut();
    // le listener SIGNED_OUT bascule sur 'gate'
  }, []);

  // Contenu selon la phase (rendu SOUS l'intro, qui charge en avant-plan).
  let contenu;
  if (phase === "boot") {
    contenu = (
      <div className="gate">
        <p className="gate-note">Chargement…</p>
      </div>
    );
  } else if (phase === "gate") {
    contenu = (
      <>
        <Gate onEnter={entrer} />
        <InstallBanner />
      </>
    );
  } else if (!profile) {
    // Session valide mais aucune ligne invité (cas limite) : on propose de sortir.
    contenu = (
      <div className="gate">
        <p className="gate-note">
          Votre compte n'est associé à aucun profil invité. Reconnectez-vous ou contactez les mariés.
        </p>
        <button className="btn-ghost" style={{ maxWidth: 320 }} onClick={deconnexion}>
          Se déconnecter
        </button>
      </div>
    );
  } else if (profile.role === "admin" && !apercuInvite) {
    contenu = <Admin onLogout={deconnexion} onApercuInvite={() => setApercuInvite(true)} />;
  } else {
    contenu = (
      <>
        <Site
          profile={profile}
          onReload={chargerProfil}
          onLogout={deconnexion}
          retourAdmin={profile.role === "admin" ? () => setApercuInvite(false) : null}
        />
        <InstallBanner />
      </>
    );
  }

  return (
    <>
      {contenu}
      {/* Intro affichée dès le 1er rendu (une fois par session), la vidéo
          se charge en avant-plan pendant que l'app démarre derrière. */}
      {!introVue && (
        <Intro
          onFinish={() => {
            try {
              sessionStorage.setItem("vf-intro", "1");
            } catch {
              /* stockage indisponible */
            }
            setIntroVue(true);
          }}
        />
      )}
    </>
  );
}

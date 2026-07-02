import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase.js";
import Gate from "./components/Gate.jsx";
import Site from "./components/Site.jsx";
import Admin from "./components/Admin.jsx";

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

  const chargerProfil = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      return null;
    }
    const { data } = await supabase
      .from("invites")
      .select("id, nom, email, couple_id, role, rsvp, rsvp_date")
      .eq("user_id", user.id)
      .maybeSingle();
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

  if (phase === "boot") {
    return (
      <div className="gate">
        <p className="gate-note">Chargement…</p>
      </div>
    );
  }

  if (phase === "gate") {
    return <Gate onEnter={entrer} />;
  }

  // phase === 'app'
  if (!profile) {
    // Session valide mais aucune ligne invité (cas limite) : on propose de sortir.
    return (
      <div className="gate">
        <p className="gate-note">
          Votre compte n'est associé à aucun profil invité. Reconnectez-vous ou contactez les mariés.
        </p>
        <button className="btn-ghost" style={{ maxWidth: 320 }} onClick={deconnexion}>
          Se déconnecter
        </button>
      </div>
    );
  }

  if (profile.role === "admin") {
    return <Admin onLogout={deconnexion} />;
  }

  return <Site profile={profile} onReload={chargerProfil} onLogout={deconnexion} />;
}

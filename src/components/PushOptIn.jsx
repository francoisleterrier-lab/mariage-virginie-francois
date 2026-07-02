import { useState, useEffect } from "react";
import { pushSupporte, estIOS, estStandalone, abonnementActif, activerPush } from "../lib/push.js";

const CACHE = "vf2028-push-masque";

/* ============================================================
   Encart doux d'abonnement aux notifications (jamais de demande
   brutale à l'arrivée). Proposé après connexion.
   Sur iPhone, le push exige la PWA installée (iOS ≥ 16.4) : on invite
   alors d'abord à installer.
   ============================================================ */
export default function PushOptIn({ inviteId }) {
  const [etat, setEtat] = useState("chargement"); // chargement | proposer | ios-installer | actif | masque | erreur
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (localStorage.getItem(CACHE) === "1") return setEtat("masque");
    (async () => {
      // iPhone hors PWA : le push est impossible tant que non installé.
      if (estIOS() && !estStandalone()) return setEtat("ios-installer");
      if (!pushSupporte()) return setEtat("masque");
      if (Notification.permission === "denied") return setEtat("masque");
      if (await abonnementActif()) return setEtat("actif");
      setEtat("proposer");
    })();
  }, []);

  if (etat === "chargement" || etat === "masque" || etat === "actif") return null;

  const masquer = () => {
    localStorage.setItem(CACHE, "1");
    setEtat("masque");
  };

  const activer = async () => {
    setMsg("");
    try {
      await activerPush(inviteId);
      setEtat("actif");
    } catch (e) {
      setMsg(e.message || "Impossible d'activer les notifications.");
      setEtat("erreur");
    }
  };

  return (
    <div className="push-optin">
      <p className="push-titre">🔔 Soyez averti·e·s en premier</p>
      {etat === "ios-installer" ? (
        <>
          <p>
            Pour recevoir la révélation du lieu et nos annonces sur iPhone, ajoutez d'abord le faire-part à
            votre écran d'accueil (bouton <b>Partager</b> → <b>« Sur l'écran d'accueil »</b>), puis rouvrez-le
            depuis l'icône.
          </p>
          <button className="btn-lien" onClick={masquer}>
            J'ai compris
          </button>
        </>
      ) : (
        <>
          <p>Recevez une notification pour la révélation du lieu, le programme du samedi et les infos du jour J.</p>
          {msg && <p className="gate-err" style={{ color: "#b06a4f" }}>{msg}</p>}
          <div className="push-actions">
            <button className="btn-vert push-oui" onClick={activer}>
              Activer les notifications
            </button>
            <button className="btn-lien" onClick={masquer}>
              Non merci
            </button>
          </div>
        </>
      )}
    </div>
  );
}

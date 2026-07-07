import { useState, useEffect } from "react";
import { pushSupporte, estIOS, estStandalone, abonnementActif, activerPush } from "../lib/push.js";

/* ============================================================
   Encart d'abonnement aux notifications — SANS option de refus.
   Objectif : tout le monde doit être joignable. L'encart reste affiché
   tant que l'invité n'est pas abonné (aucun « Non merci », aucune mise
   en sourdine). Il disparaît seulement une fois l'abonnement actif.
   Sur iPhone, le push exige la PWA installée (iOS ≥ 16.4) : on invite
   alors d'abord à installer.
   ============================================================ */
export default function PushOptIn({ inviteId }) {
  const [etat, setEtat] = useState("chargement"); // chargement | proposer | ios-installer | actif | non-supporte
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (estIOS() && !estStandalone()) return setEtat("ios-installer");
      if (!pushSupporte()) return setEtat("non-supporte");
      if (await abonnementActif()) return setEtat("actif");
      setEtat("proposer");
    })();
  }, []);

  if (etat === "chargement" || etat === "actif" || etat === "non-supporte") return null;

  const activer = async () => {
    setMsg("");
    setBusy(true);
    try {
      await activerPush(inviteId);
      setEtat("actif");
    } catch (e) {
      setMsg(e?.message || "Impossible d'activer — vérifiez les autorisations de votre navigateur.");
    }
    setBusy(false);
  };

  return (
    <div className="push-optin">
      <p className="push-titre">🔔 Restez informé·e — c'est important</p>
      {etat === "ios-installer" ? (
        <p>
          Pour recevoir la révélation du lieu et toutes nos annonces, ajoutez d'abord le faire-part à votre écran
          d'accueil : bouton <b>Partager</b> → <b>« Sur l'écran d'accueil »</b>, puis rouvrez-le depuis l'icône et
          activez les notifications.
        </p>
      ) : (
        <>
          <p>
            Nous vous préviendrons pour la révélation du lieu, le programme du samedi et les infos du jour J. Activez
            les notifications pour ne rien manquer.
          </p>
          {msg && <p className="gate-err" style={{ color: "#b06a4f" }}>{msg}</p>}
          <div className="push-actions">
            <button className="btn-vert push-oui" onClick={activer} disabled={busy}>
              {busy ? "…" : "Activer les notifications"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { estIOS, estStandalone } from "../lib/push.js";

const CACHE = "vf2028-install-masque";

/* ============================================================
   Bannière d'installation maison (pas le prompt brut du navigateur).
   - Android/Chrome : capture beforeinstallprompt → bouton « Installer ».
   - iOS : pas de prompt automatique → instructions Partager → Écran d'accueil.
   Encourage l'installation (indispensable au push sur iPhone ≥ 16.4).
   ============================================================ */
export default function InstallBanner() {
  const [promptEvt, setPromptEvt] = useState(null);
  const [visible, setVisible] = useState(false);
  const ios = estIOS();

  useEffect(() => {
    if (estStandalone()) return; // déjà installée
    if (localStorage.getItem(CACHE) === "1") return; // déjà masquée

    const onPrompt = (e) => {
      e.preventDefault();
      setPromptEvt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS n'émet jamais beforeinstallprompt : on affiche les instructions.
    if (ios) setVisible(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [ios]);

  if (!visible) return null;

  const masquer = () => {
    localStorage.setItem(CACHE, "1");
    setVisible(false);
  };

  const installer = async () => {
    if (!promptEvt) return;
    promptEvt.prompt();
    await promptEvt.userChoice;
    masquer();
  };

  return (
    <div className="install-banner" role="dialog" aria-label="Installer le faire-part">
      <span className="install-emoji" aria-hidden="true">🌿</span>
      <div className="install-txt">
        <strong>Ajoutez notre faire-part à votre écran d'accueil</strong>
        {ios ? (
          <span>
            Appuyez sur <b>Partager</b> <span aria-hidden="true">􀈂</span> puis
            <b> « Sur l'écran d'accueil »</b>. Indispensable pour recevoir nos annonces sur iPhone.
          </span>
        ) : (
          <span>Un accès direct, comme une appli — et les notifications de nos annonces.</span>
        )}
      </div>
      <div className="install-actions">
        {!ios && promptEvt && (
          <button className="install-oui" onClick={installer}>
            Installer
          </button>
        )}
        <button className="install-non" onClick={masquer} aria-label="Masquer">
          Plus tard
        </button>
      </div>
    </div>
  );
}

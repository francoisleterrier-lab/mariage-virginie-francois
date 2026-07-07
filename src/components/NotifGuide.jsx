import { useState, useEffect, useRef } from "react";
import { pushSupporte, estIOS, estStandalone, abonnementActif, activerPush } from "../lib/push.js";

/* ============================================================
   Parcours guidé « Rester informé·e » en 2 étapes :
   1) Installer l'app (indispensable au push sur iPhone) ;
   2) Activer les notifications.
   Détecte iPhone/Android et l'état d'installation/abonnement.
   Ouvrable à tout moment via la cloche du menu.
   ============================================================ */
export default function NotifGuide({ inviteId, open, onClose }) {
  const [abonne, setAbonne] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const promptEvt = useRef(null);
  const [installable, setInstallable] = useState(false);

  const ios = estIOS();
  const installee = estStandalone();
  const supporte = pushSupporte();

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      promptEvt.current = e;
      setInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    if (!open) return;
    (async () => setAbonne(await abonnementActif().catch(() => false)))();
  }, [open]);

  if (!open) return null;

  const installer = async () => {
    if (!promptEvt.current) return;
    promptEvt.current.prompt();
    await promptEvt.current.userChoice;
    promptEvt.current = null;
    setInstallable(false);
    if (estStandalone()) setMsg("");
  };

  const activer = async () => {
    setMsg("");
    setBusy(true);
    try {
      await activerPush(inviteId);
      setAbonne(true);
    } catch (e) {
      setMsg(e?.message || "Activation impossible.");
    }
    setBusy(false);
  };

  // étape 1 franchie si installée (ou navigateur desktop qui gère le push sans installer)
  const etape1Ok = installee || (!ios && supporte);
  const termine = abonne;

  return (
    <div className="modal-fond" onClick={onClose}>
      <div className="modal notif-guide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>🔔 Ne rien manquer</h3>
          <button className="modal-x" onClick={onClose} aria-label="Fermer">×</button>
        </div>

        {termine ? (
          <div className="ng-fini">
            <p className="ng-ok">✅ Vous êtes abonné·e aux notifications.</p>
            <p>Vous serez averti·e de la révélation du lieu, du programme du samedi et des infos du jour J.</p>
            <button className="btn-vert" onClick={onClose}>Parfait</button>
          </div>
        ) : (
          <>
            <p className="ng-intro">
              Deux petites étapes pour recevoir nos annonces (révélation du lieu, jour J…) directement sur votre
              téléphone.
            </p>

            {/* Étape 1 — installer */}
            <div className={"ng-etape" + (etape1Ok ? " faite" : "")}>
              <div className="ng-num">{etape1Ok ? "✓" : "1"}</div>
              <div className="ng-corps">
                <strong>Installer le faire-part</strong>
                {etape1Ok ? (
                  <span>C'est bon, l'app est installée.</span>
                ) : ios ? (
                  <span>
                    Appuyez sur <b>Partager</b> <span aria-hidden="true">􀈂</span> en bas de Safari, puis
                    <b> « Sur l'écran d'accueil »</b>. Rouvrez ensuite le faire-part <b>depuis son icône</b>, et
                    revenez ici.
                  </span>
                ) : installable ? (
                  <>
                    <span>Installez l'app pour un accès direct et les notifications.</span>
                    <button className="btn-vert ng-btn" onClick={installer}>Installer l'app</button>
                  </>
                ) : (
                  <span>Sur ordinateur, vous pouvez activer les notifications directement à l'étape 2.</span>
                )}
              </div>
            </div>

            {/* Étape 2 — activer */}
            <div className={"ng-etape" + (!etape1Ok ? " bloquee" : "")}>
              <div className="ng-num">2</div>
              <div className="ng-corps">
                <strong>Activer les notifications</strong>
                {etape1Ok ? (
                  <>
                    <span>Un seul appui, et c'est réglé.</span>
                    {msg && <span className="gate-err" style={{ color: "#b06a4f" }}>{msg}</span>}
                    <button className="btn-vert ng-btn" onClick={activer} disabled={busy}>
                      {busy ? "…" : "Activer les notifications"}
                    </button>
                  </>
                ) : (
                  <span className="ng-attente">Disponible après l'installation.</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

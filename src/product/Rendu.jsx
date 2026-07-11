import { useEffect, useMemo, useState } from "react";
import { sb } from "./supabaseFpv.js";
import ArbreVivant from "./ArbreVivant.jsx";
import Constellation from "./Constellation.jsx";
import AlbumInvites from "./AlbumInvites.jsx";
import Cagnotte from "./Cagnotte.jsx";
import ListeCadeaux from "./ListeCadeaux.jsx";
import TimelineReveal from "./TimelineReveal.jsx";
import LivreDor from "./LivreDor.jsx";
import Playlist from "./Playlist.jsx";
import Covoiturage from "./Covoiturage.jsx";
import Defis from "./Defis.jsx";
import { pushSupporte, estAbonne, abonner } from "./pushFpv.js";

/* Rendu public d'une invitation « Faire-part Vivant » (multi-thèmes),
   piloté 100 % par la donnée (table fpv_invitations, lue par slug). */

function compteARebours(dateStr) {
  if (!dateStr) return null;
  const cible = new Date(dateStr + "T12:00:00");
  const diff = cible - new Date();
  if (isNaN(diff)) return null;
  const j = Math.max(0, Math.floor(diff / 86400000));
  const h = Math.max(0, Math.floor((diff % 86400000) / 3600000));
  const m = Math.max(0, Math.floor((diff % 3600000) / 60000));
  return { j, h, m };
}

const fmtDate = (d) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";

export default function Rendu({ slug }) {
  const [etat, setEtat] = useState("load"); // load | ok | 404
  const [inv, setInv] = useState(null);
  const [cd, setCd] = useState(null);

  // RSVP
  const [f, setF] = useState({ nom: "", email: "", presence: "Avec joie, je serai là", adultes: "1", enfants: "0", message: "" });
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let vivant = true;
    sb.from("fpv_invitations")
      .select("id, couple, date_event, lieu_teaser, theme, intro, sections, rsvp_ouvert, publie")
      .eq("slug", slug)
      .eq("publie", true)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivant) return;
        if (!data) return setEtat("404");
        setInv(data);
        setEtat("ok");
        document.title = `${data.couple} — Faire-part`;
      });
    return () => (vivant = false);
  }, [slug]);

  useEffect(() => {
    if (!inv?.date_event) return;
    const maj = () => setCd(compteARebours(inv.date_event));
    maj();
    const id = setInterval(maj, 30000);
    return () => clearInterval(id);
  }, [inv]);

  // Opt-in notifications invité
  const [pushEtat, setPushEtat] = useState("idle"); // idle | abonne | busy | ok | err
  useEffect(() => {
    if (!inv || !pushSupporte()) return;
    estAbonne().then((a) => a && setPushEtat("abonne")).catch(() => {});
  }, [inv]);
  async function activerPush() {
    setPushEtat("busy");
    try {
      await abonner(inv.id);
      setPushEtat("ok");
    } catch {
      setPushEtat("err");
    }
  }

  const sec = useMemo(() => inv?.sections || {}, [inv]);
  const [prenom1, prenom2] = useMemo(() => {
    const parts = (inv?.couple || "").split(/\s*&\s*|\s+et\s+/i);
    return [parts[0] || inv?.couple || "", parts[1] || ""];
  }, [inv]);

  async function envoyerRsvp(e) {
    e.preventDefault();
    if (!f.nom.trim()) return setErr("Indiquez votre nom.");
    setErr("");
    setEnvoi(true);
    const { error } = await sb.from("fpv_rsvps").insert({
      invitation_id: inv.id,
      nom: f.nom.trim(),
      email: f.email.trim().toLowerCase(),
      presence: f.presence,
      adultes: parseInt(f.adultes) || 0,
      enfants: parseInt(f.enfants) || 0,
      message: f.message.trim(),
    });
    setEnvoi(false);
    if (error) return setErr("Oups, réessayez dans un instant.");
    setEnvoye(true);
  }

  if (etat === "load") return <div className="fpv-loading">Un instant…</div>;
  if (etat === "404")
    return (
      <div className="fpv-404">
        <div>
          <p style={{ fontFamily: "var(--serif)", fontSize: "1.4rem" }}>Cette invitation n'existe pas encore.</p>
          <p style={{ color: "var(--admin-muted)" }}>Vérifiez le lien, ou revenez un peu plus tard.</p>
        </div>
      </div>
    );

  return (
    <div className="fpv-render" data-t={inv.theme || "canopee"}>
      <header className="fpv-hero">
        <p className="fpv-eyebrow">Nous nous marions</p>
        <h1 className="fpv-couple">
          {prenom1}
          {prenom2 && <span className="amp">&amp;</span>}
          {prenom2}
        </h1>
        {inv.date_event && <p className="fpv-date">{fmtDate(inv.date_event)}</p>}
        {inv.lieu_teaser && <p className="fpv-teaser">{inv.lieu_teaser}</p>}
        {(sec.rsvp !== false || inv.intro) && (
          <a className="fpv-scroll" href={sec.rsvp !== false ? "#rsvp" : "#histoire"}>
            Découvrir ↓
          </a>
        )}
      </header>

      {sec.compte !== false && inv.date_event && cd && (
        <section className="fpv-sec">
          <h2>Avant le grand jour</h2>
          <div className="fpv-cd">
            <div><div className="n">{cd.j}</div><div className="k">jours</div></div>
            <div><div className="n">{cd.h}</div><div className="k">heures</div></div>
            <div><div className="n">{cd.m}</div><div className="k">min</div></div>
          </div>
        </section>
      )}

      {inv.intro && (
        <section className="fpv-sec" id="histoire">
          <h2>Notre histoire</h2>
          {inv.intro.split(/\n{2,}/).map((par, i) => (
            <p key={i}>{par}</p>
          ))}
        </section>
      )}

      {sec.moments === true && <TimelineReveal slug={slug} />}

      {/* Élément interactif « à la demande » : prend vie à chaque invité confirmé.
          L'arbre de vie n'est qu'un des types possibles (constellation, …). */}
      {(sec.interactif === true || sec.arbre === true) &&
        ((sec.interactifType || (sec.arbre ? "arbre" : "arbre")) === "constellation" ? (
          <Constellation slug={slug} />
        ) : (
          <ArbreVivant slug={slug} />
        ))}

      {sec.infos !== false && (sec.infosTexte || "").trim() && (
        <section className="fpv-sec">
          <h2>Infos pratiques</h2>
          {sec.infosTexte.split(/\n{2,}/).map((par, i) => (
            <p key={i}>{par}</p>
          ))}
        </section>
      )}

      {inv.rsvp_ouvert && sec.rsvp !== false && (
        <section className="fpv-sec" id="rsvp">
          <h2>Dites-nous oui</h2>
          {envoye ? (
            <p>🌿 Merci, votre réponse est bien enregistrée !</p>
          ) : (
            <form className="fpv-form" onSubmit={envoyerRsvp}>
              <div>
                <label htmlFor="r-nom">Votre nom</label>
                <input id="r-nom" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} required />
              </div>
              <div>
                <label htmlFor="r-mail">E-mail (facultatif)</label>
                <input id="r-mail" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              </div>
              <div>
                <label htmlFor="r-pres">Présence</label>
                <select id="r-pres" value={f.presence} onChange={(e) => setF({ ...f, presence: e.target.value })}>
                  <option>Avec joie, je serai là</option>
                  <option>Je viens accompagné·e</option>
                  <option>Hélas, je ne pourrai pas venir</option>
                </select>
              </div>
              <div className="duo">
                <div>
                  <label htmlFor="r-ad">Adultes</label>
                  <select id="r-ad" value={f.adultes} onChange={(e) => setF({ ...f, adultes: e.target.value })}>
                    {["0", "1", "2", "3", "4", "5"].map((n) => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="r-en">Enfants</label>
                  <select id="r-en" value={f.enfants} onChange={(e) => setF({ ...f, enfants: e.target.value })}>
                    {["0", "1", "2", "3", "4", "5"].map((n) => <option key={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="r-msg">Un petit mot ?</label>
                <textarea id="r-msg" rows={2} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
              </div>
              {err && <p className="fpv-err">{err}</p>}
              <button className="fpv-cta" disabled={envoi}>{envoi ? "Envoi…" : "Envoyer ma réponse"}</button>
            </form>
          )}
        </section>
      )}

      {sec.cagnotte === true && (
        <Cagnotte
          invitationId={inv.id}
          cfg={{
            titre: sec.cagnotteTitre,
            texte: sec.cagnotteTexte,
            objectif: sec.cagnotteObjectif,
            montant: sec.cagnotteMontant,
            lien: sec.cagnotteLien,
          }}
        />
      )}

      {sec.cadeaux === true && <ListeCadeaux invitationId={inv.id} />}

      {sec.album === true && <AlbumInvites invitationId={inv.id} />}

      {sec.livredor === true && <LivreDor invitationId={inv.id} />}

      {sec.playlist === true && <Playlist invitationId={inv.id} />}

      {sec.covoiturage === true && <Covoiturage invitationId={inv.id} />}

      {sec.defis === true && <Defis invitationId={inv.id} defis={(sec.defisListe || "").split(/\n/)} />}

      {pushSupporte() && (
        <section className="fpv-sec">
          <h2>Restez au courant</h2>
          <p>Activez les notifications pour être prévenu·e des nouvelles : le lieu, le programme, les petits mots des mariés.</p>
          {pushEtat === "abonne" || pushEtat === "ok" ? (
            <p className="fpv-push-ok">🔔 Notifications activées — merci !</p>
          ) : (
            <>
              <button className="fpv-cta" disabled={pushEtat === "busy"} onClick={activerPush}>
                {pushEtat === "busy" ? "Activation…" : "🔔 Être prévenu·e"}
              </button>
              {pushEtat === "err" && <p className="fpv-err" style={{ marginTop: ".6rem" }}>Activation impossible (autorisez les notifications).</p>}
            </>
          )}
        </section>
      )}

      <footer>
        Créé avec <a href="./product.html" target="_blank" rel="noopener noreferrer">Faire-part Vivant</a> — l'invitation qui vit.
      </footer>
    </div>
  );
}

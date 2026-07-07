import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import Countdown from "./Countdown.jsx";
import MedaillonArbre from "./MedaillonArbre.jsx";
import TreeOfLife from "./TreeOfLife.jsx";
import MaTable from "./MaTable.jsx";
import PushOptIn from "./PushOptIn.jsx";

import fondVideo from "../assets/fond-inscription.mp4";
import photoCouple from "../assets/couple.jpg";
import photoEden from "../assets/eden.jpg";
import photoTemoins from "../assets/temoins.jpg";

/* Hébergements à moins de ~15 min du lieu de la fête (Sud-Toulousain).
   Liens fournis par les mariés — ordre indicatif, tout est proche. */
const LOGEMENTS = [
  {
    nom: "Le Moulin de Rudelle",
    type: "Hôtel de charme",
    lieu: "Muret",
    desc: "Domaine hôtelier du 16ᵉ siècle, chambres et cottages dans un parc de cinq hectares.",
    url: "https://www.moulinderudelle.com/",
  },
  {
    nom: "Le Domaine des Merveilles",
    type: "Chambres d'hôtes & gîte",
    lieu: "Lherm",
    desc: "En parc boisé : chambres, un gîte, et un espace bien-être avec spa, sauna et piscine de saison.",
    url: "https://www.domainedesmerveilles.fr/le-domaine-des-merveilles/plus-d-infos-sur-le-domaine-des-merveilles.html",
  },
  {
    nom: "Le Parc aux Papillons",
    type: "Chambres d'hôtes",
    lieu: "Lherm",
    desc: "13 couchages au cœur d'un jardin fleuri, atmosphère nature et sereine.",
    url: "https://leparcauxpapillons.fr/",
  },
  {
    nom: "Le Soubiran",
    type: "Chambres d'hôtes",
    lieu: "Bérat",
    desc: "4 chambres jusqu'à 11 personnes, piscine, jardin et terrasse — ambiance familiale.",
    url: "https://www.chambres-hotes.fr/chambres-hotes_le-soubiran_berat_h15400.htm",
  },
  {
    nom: "Le Gîte du Prat",
    type: "Gîte",
    lieu: "Bérat",
    desc: "Maison de vacances avec véranda et loisirs (billard, baby-foot, pétanque) — idéale pour un groupe.",
    url: "https://www.gitedupratberat.com/",
  },
  {
    nom: "Le Gîte du Fournil",
    type: "Gîte",
    lieu: "Sud-Toulousain",
    desc: "Gîte de campagne à quelques minutes du lieu de la fête.",
    url: "https://www.gite-du-fournil.com/tarifs/",
  },
  {
    nom: "Borde Basse",
    type: "Gîte · Gîtes de France",
    lieu: "Haute-Garonne",
    desc: "Gîte labellisé Gîtes de France, dans la campagne du Sud-Toulousain.",
    url: "https://www.gites-de-france.com/fr/occitanie/haute-garonne/borde-basse-31g100307",
  },
  {
    nom: "L'Atelier du Huchier",
    type: "Gîte · Gîtes de France",
    lieu: "Haute-Garonne",
    desc: "Gîte de caractère labellisé Gîtes de France.",
    url: "https://www.gites-de-france.com/fr/occitanie/haute-garonne/latelier-du-huchier-31g101275",
  },
  {
    nom: "Le Gîte des Lauriers",
    type: "Gîte · Gîtes de France",
    lieu: "Haute-Garonne",
    desc: "Gîte labellisé Gîtes de France, au calme.",
    url: "https://www.gites-de-france.com/fr/occitanie/haute-garonne/gite-des-lauriers-31g101336",
  },
  {
    nom: "Auberge Les Palmiers",
    type: "Hôtel-restaurant",
    lieu: "Rieumes",
    desc: "Hôtel-restaurant sur la place du foirail, cuisine aux saveurs locales.",
    url: "https://www.aubergelespalmiers.fr/",
  },
];

/* ============================================================
   LE SITE FAIRE-PART (contenu identique à la v1 statique)
   ============================================================ */
export default function Site({ profile, onReload, onLogout, retourAdmin }) {
  const [secret, setSecret] = useState(false);
  const [partenaire, setPartenaire] = useState(null);

  // Liaison couple tardive (bonus)
  const [candidats, setCandidats] = useState(null); // null = pas encore ouvert
  const [busyCouple, setBusyCouple] = useState(false);
  const [errCouple, setErrCouple] = useState("");

  // RSVP
  const [rsvp, setRsvp] = useState(
    profile.rsvp || {
      presence: "Les deux jours 🌿",
      adultes: profile.couple_id ? "2" : "1",
      enfants: "0",
      enfantsNoms: [],
      regime: "",
      mot: "",
    }
  );

  // Synchronise la liste des prénoms d'enfants avec le nombre choisi.
  function setEnfants(n) {
    const nb = parseInt(n) || 0;
    const noms = [...(rsvp.enfantsNoms || [])];
    noms.length = nb; // tronque ou étend
    for (let i = 0; i < nb; i++) if (noms[i] == null) noms[i] = "";
    setRsvp({ ...rsvp, enfants: n, enfantsNoms: noms });
  }
  function setEnfantNom(i, val) {
    const noms = [...(rsvp.enfantsNoms || [])];
    noms[i] = val;
    setRsvp({ ...rsvp, enfantsNoms: noms });
  }
  const [saved, setSaved] = useState(!!profile.rsvp);
  const [busy, setBusy] = useState(false);

  const prenom = (profile.nom || "").split(" ")[0];

  /* ---------- Nom du partenaire (via vue publique) ---------- */
  useEffect(() => {
    if (!profile.couple_id) {
      setPartenaire(null);
      return;
    }
    supabase
      .from("invites_public")
      .select("nom")
      .eq("id", profile.couple_id)
      .maybeSingle()
      .then(({ data }) => setPartenaire(data?.nom || null));
  }, [profile.couple_id]);

  /* ---------- Apparitions au scroll ---------- */
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("vu");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  /* ---------- RSVP ---------- */
  async function envoyerRsvp(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase
      .from("invites")
      .update({ rsvp, rsvp_date: new Date().toISOString() })
      .eq("id", profile.id);
    setBusy(false);
    if (!error) {
      setSaved(true);
      onReload?.();
    }
  }

  /* ---------- Liaison couple tardive (bonus) ---------- */
  async function ouvrirCandidats() {
    setErrCouple("");
    const { data } = await supabase
      .from("invites_public")
      .select("id, nom, couple_id")
      .is("couple_id", null)
      .neq("id", profile.id);
    setCandidats(data || []);
  }

  async function lierTard(partnerId) {
    setBusyCouple(true);
    setErrCouple("");
    const { error } = await supabase.rpc("lier_couple", { partner_id: partnerId });
    setBusyCouple(false);
    if (error) return setErrCouple(error.message || "Impossible de lier ce couple.");
    setCandidats(null);
    onReload?.();
  }

  return (
    <div>
      {retourAdmin && (
        <button className="retour-admin" onClick={retourAdmin}>
          ← Retour admin <span>· aperçu invité</span>
        </button>
      )}
      <nav>
        <a className="logo" href="#accueil">
          V <span>&amp;</span> F
        </a>
        <ul>
          <li>
            <a href="#nous">Notre histoire</a>
          </li>
          <li>
            <a href="#arbre">L'arbre</a>
          </li>
          <li>
            <a href="#programme">Programme</a>
          </li>
          <li>
            <a href="#lieu">Le lieu</a>
          </li>
          <li>
            <a href="#infos">Infos</a>
          </li>
          <li>
            <a href="#loger">Se loger</a>
          </li>
          <li>
            <a href="#matable">Ma table</a>
          </li>
          <li>
            <a href="#rsvp">RSVP</a>
          </li>
          <li>
            <button className="nav-out" onClick={onLogout}>
              Sortir
            </button>
          </li>
        </ul>
      </nav>

      {/* HÉRO */}
      <header className="hero" id="accueil">
        <video className="hero-fond" src={fondVideo} autoPlay muted loop playsInline preload="auto" aria-hidden="true" />
        <div className="hero-overlay" aria-hidden="true" />
        <MedaillonArbre variant="hero" withMono />
        <p className="annonce">{prenom ? `${prenom}, nous` : "Nous"} nous marions</p>
        <h1>
          Virginie <span className="et">&amp;</span> François
        </h1>
        <p className="date">26 · 27 mai 2028</p>
        <p className="lieu-teaser">Quelque part au cœur du Sud-Toulousain…</p>
        <a className="scroll-cue" href="#compte">
          Découvrir
        </a>
      </header>

      {/* COMPTE À REBOURS */}
      <div className="countdown" id="compte">
        <p className="eyebrow">Compte à rebours</p>
        <h2 className="cd-titre">Avant de nous dire <em>oui</em></h2>
        <Countdown />
      </div>

      {/* ENCART PUSH (doux, masquable, s'auto-cache si déjà abonné) */}
      <div className="push-band">
        <PushOptIn inviteId={profile.id} />
      </div>

      {/* ARBRE DE VIE VIVANT (une feuille par foyer confirmé) */}
      <TreeOfLife />

      {/* NOUS */}
      <section className="nous" id="nous">
        <div className="wrap reveal">
          <div>
            <div className="arche">
              <img src={photoCouple} alt="Virginie et François, souriants, devant un mur de verdure" />
            </div>
            <div className="polaroids">
              <figure className="pola">
                <img src={photoEden} alt="Eden, souriante dans sa robe blanche et bleue" />
                <figcaption>Eden, notre plus bel ange</figcaption>
              </figure>
              <figure className="pola">
                <img src={photoTemoins} alt="Alan et Mélane, souriants au soleil, en noir et blanc" />
                <figcaption>Alan &amp; Mélane, nos témoins</figcaption>
              </figure>
            </div>
          </div>
          <div>
            <p className="eyebrow">Notre histoire</p>
            <h2>
              Il y a des histoires qui <em>prennent leur temps</em>
            </h2>
            <p>
              La nôtre a commencé il y a plus de vingt ans. À chaque regard qui se croisait, le charme opérait — déjà.
              Mais la vie, parfois, choisit d'autres chemins, et nous nous sommes perdus de vue.
            </p>
            <p>En 2022, elle nous a remis l'un en face de l'autre. Et cette fois, nous ne nous sommes plus jamais quittés.</p>
            <p>
              De cet amour retrouvé est né le plus bel ange du monde : notre fille, <strong>Eden</strong>. Deux ans et demi
              après sa naissance, une seule évidence s'imposait — graver cet amour, pour toujours.
            </p>
            <p>
              C'est au mariage de sa belle-sœur et de son beau-frère — devenus aujourd'hui nos témoins — que François a posé
              un genou à terre. Virginie a dit oui.
            </p>
            <p className="il-manque">Il ne manque plus que vous.</p>
            {partenaire && (
              <p className="couple-badge">
                💍 Vous êtes inscrit·e·s en couple avec <strong>{partenaire}</strong>
              </p>
            )}
            <p className="signature">François, Virginie, Lou, Taïgo, Ugo &amp; Eden</p>
          </div>
        </div>
      </section>

      {/* PROGRAMME */}
      <section className="programme" id="programme">
        <div className="wrap center reveal">
          <p className="eyebrow">Le programme</p>
          <h2>
            Le pont de <em>l'Ascension</em> 2028
          </h2>
          <p>Deux journées pensées pour profiter — et garder des forces.</p>
          <div className="jours">
            <article className="jour">
              <p className="quand">Jour 1 — Vendredi 26 mai</p>
              <h3>Le grand jour</h3>
              <p className="jour-note">Le déroulé de la journée — les horaires précis vous seront communiqués un peu avant le jour J.</p>
              <ol>
                <li>
                  <span className="h">🌿</span>
                  <span className="t">
                    <strong>Mairie</strong>
                    <span>Lieu dévoilé plus tard…</span>
                  </span>
                </li>
                <li>
                  <span className="h">🌿</span>
                  <span className="t">
                    <strong>Cérémonie laïque</strong>
                    <span>Sous les arbres, au cœur du parc</span>
                  </span>
                </li>
                <li>
                  <span className="h">🌿</span>
                  <span className="t">
                    <strong>Vin d'honneur</strong>
                    <span>Avec une surprise musicale &amp; scénique ✨</span>
                  </span>
                </li>
                <li>
                  <span className="h">🌿</span>
                  <span className="t">
                    <strong>Repas</strong>
                    <span>À table, en famille et entre amis</span>
                  </span>
                </li>
                <li>
                  <span className="h">🌿</span>
                  <span className="t">
                    <strong>Dancefloor</strong>
                    <span>On vous attend au centre de la piste</span>
                  </span>
                </li>
                <li>
                  <span className="h">🌿</span>
                  <span className="t">
                    <strong>Fin de soirée</strong>
                    <span>Dernier morceau — demain, ça repart !</span>
                  </span>
                </li>
              </ol>
            </article>
            <article className="jour jour-mystere">
              <p className="quand">Jour 2 — Samedi 27 mai</p>
              <h3>La journée lâchage</h3>
              <div className="j2-secret">
                <div className="q">?</div>
                <p>
                  La programmation de cette deuxième journée reste <em>top secrète</em>.
                </p>
                <p className="j2-sub">Une seule certitude : on ne rentre pas se coucher. Programme dévoilé plus tard…</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* LIEU MYSTÈRE */}
      <section className="mystere" id="lieu">
        <div className="wrap center reveal">
          <p className="eyebrow">Le lieu</p>
          <h2>
            Chut… c'est encore <em>un secret</em>
          </h2>
          <p>
            Nous avons trouvé un écrin de verdure confidentiel, à quelques minutes de Toulouse.
            <br />
            Son nom et son adresse vous seront dévoilés quelques semaines avant le grand jour.
          </p>
          <div
            className={"carte-secrete" + (secret ? " ouverte" : "")}
            role="button"
            tabIndex={0}
            aria-expanded={secret}
            aria-label="Un indice sur le lieu — cliquer pour un teaser"
            onClick={() => setSecret((s) => !s)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSecret((s) => !s);
              }
            }}
          >
            <div className="q">?</div>
            <div className="flou" aria-hidden="true">
              Le ··· des ······
            </div>
            <p className="indice">Un domaine caché dans la campagne du Sud-Toulousain — cliquez, si vous osez.</p>
            <div className="reponse">Patience… 🌿 Un indice se glissera ici au fil des saisons. Revenez nous voir !</div>
          </div>
        </div>
      </section>

      {/* INFOS */}
      <section className="infos" id="infos">
        <div className="wrap center reveal">
          <p className="eyebrow">Infos pratiques</p>
          <h2>
            Tout ce qu'il faut <em>savoir</em>
          </h2>
          <div className="cartes">
            <div className="carte">
              <h3>🌿 Thème : Jungle chic</h3>
              <p>
                Pas de dress code imposé : venez comme vous avez envie d'être ! Le thème « jungle chic » est une simple
                invitation à la couleur et au feuillage, si le cœur vous en dit.
              </p>
            </div>
            <div className="carte">
              <h3>🏡 Hébergement</h3>
              <p>
                Une sélection de gîtes, chambres d'hôtes et hôtels à moins de 15 minutes du lieu vous attend juste en
                dessous. <a href="#loger">Voir où se loger →</a>
              </p>
            </div>
            <div className="carte">
              <h3>🗓️ Deux jours de fête</h3>
              <p>
                Le vendredi et le samedi du pont de l'Ascension : un long week-end idéal pour venir de loin — et tenir la
                journée lâchage du samedi.
              </p>
            </div>
            <div className="carte">
              <h3>💛 Votre présence</h3>
              <p>
                C'est le plus beau des cadeaux. Pour celles et ceux qui souhaitent nous gâter davantage, une urne accueillera
                vos attentions le jour J.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* OÙ SE LOGER */}
      <section className="loger" id="loger">
        <div className="wrap center reveal">
          <p className="eyebrow">Où se loger</p>
          <h2>
            Restez <em>tout près</em>
          </h2>
          <p>
            Deux jours de fête, ça se savoure sans reprendre la route trop tôt. Voici quelques adresses à moins de
            15 minutes du lieu — pensez à réserver assez tôt, le pont de l'Ascension est prisé.
          </p>
          <div className="loge-grid">
            {LOGEMENTS.map((l) => (
              <a key={l.url} className="loge-carte" href={l.url} target="_blank" rel="noopener noreferrer">
                <span className="loge-type">{l.type}</span>
                <h3>{l.nom}</h3>
                <p className="loge-lieu">📍 {l.lieu}</p>
                <p className="loge-desc">{l.desc}</p>
                <span className="loge-lien">Réserver / en savoir plus →</span>
              </a>
            ))}
          </div>
          <p className="loge-note">
            Ces adresses sont indépendantes des mariés : réservation, tarifs et disponibilités se gèrent directement
            auprès de chaque hébergement.
          </p>
        </div>
      </section>

      {/* MA TABLE : réservation libre / plan publié / mystère */}
      <MaTable profile={profile} onReload={onReload} />

      {/* RSVP */}
      <section className="rsvp" id="rsvp">
        <div className="wrap center reveal">
          <p className="eyebrow">RSVP</p>
          <h2>
            Dites-nous <em>oui</em>
          </h2>
          <p>
            {saved
              ? "Votre réponse est bien enregistrée — vous pouvez la modifier à tout moment."
              : "Confirmez votre présence en quelques secondes — nous avons hâte."}
          </p>
          <form onSubmit={envoyerRsvp}>
            <label htmlFor="r-pres">Je serai présent·e</label>
            <select id="r-pres" value={rsvp.presence} onChange={(e) => setRsvp({ ...rsvp, presence: e.target.value })}>
              <option>Les deux jours 🌿</option>
              <option>Vendredi 26 mai uniquement</option>
              <option>Samedi 27 mai uniquement</option>
              <option>Hélas, je ne pourrai pas venir</option>
            </select>
            <div className="duo">
              <div>
                <label htmlFor="r-ad">Adultes</label>
                <select id="r-ad" value={rsvp.adultes} onChange={(e) => setRsvp({ ...rsvp, adultes: e.target.value })}>
                  {["1", "2", "3", "4", "5"].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="r-en">Enfants / ados</label>
                <select id="r-en" value={rsvp.enfants} onChange={(e) => setEnfants(e.target.value)}>
                  {["0", "1", "2", "3", "4", "5"].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>

            {parseInt(rsvp.enfants) > 0 && (
              <div className="enfants-noms">
                <label>Prénom (et âge) de chaque enfant / ado</label>
                {Array.from({ length: parseInt(rsvp.enfants) }).map((_, i) => (
                  <input
                    key={i}
                    value={(rsvp.enfantsNoms && rsvp.enfantsNoms[i]) || ""}
                    onChange={(e) => setEnfantNom(i, e.target.value)}
                    placeholder={`Enfant ${i + 1} — ex. Léa, 8 ans`}
                    aria-label={`Prénom et âge de l'enfant ${i + 1}`}
                  />
                ))}
                <p className="enfants-hint">
                  Ils seront placés à une table dédiée aux enfants — pas besoin de leur choisir une place.
                </p>
              </div>
            )}

            {partenaire ? (
              <p className="couple-hint">
                💍 Inscrit·e en couple avec {partenaire} — pensez à compter 2 adultes si vous répondez pour vous deux.
              </p>
            ) : (
              <div className="couple-tard">
                {candidats === null ? (
                  <button type="button" className="btn-lien" onClick={ouvrirCandidats}>
                    💍 Vous venez en couple ? Lier mon compte à un autre invité
                  </button>
                ) : candidats.length === 0 ? (
                  <p className="couple-hint">Aucun autre invité disponible pour l'instant.</p>
                ) : (
                  <div className="couple-liste couple-liste-clair">
                    {errCouple && <p className="gate-err">{errCouple}</p>}
                    {candidats.map((c) => (
                      <button type="button" key={c.id} className="couple-item couple-item-clair" disabled={busyCouple} onClick={() => lierTard(c.id)}>
                        <span>{c.nom}</span>
                        <em>Rejoindre en couple</em>
                      </button>
                    ))}
                    <button type="button" className="btn-lien" onClick={() => setCandidats(null)}>
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            )}

            <label htmlFor="r-reg">Allergies ou régimes particuliers</label>
            <input id="r-reg" value={rsvp.regime} onChange={(e) => setRsvp({ ...rsvp, regime: e.target.value })} placeholder="Végétarien, sans gluten…" />
            <label htmlFor="r-mot">Un petit mot pour nous ?</label>
            <textarea id="r-mot" rows={3} value={rsvp.mot} onChange={(e) => setRsvp({ ...rsvp, mot: e.target.value })} placeholder="On prend aussi les idées de chansons pour le dancefloor 🎶" />
            <button className="btn-vert" disabled={busy}>
              {busy ? "Envoi…" : saved ? "Mettre à jour ma réponse" : "Envoyer ma réponse"}
            </button>
            {saved && <p className="ok">🌿 Réponse enregistrée, merci !</p>}
            <p className="deadline">
              Réponse souhaitée avant le 1<sup>er</sup> mars 2028
            </p>
          </form>
        </div>
      </section>

      <footer>
        <div className="mono">V &amp; F</div>
        <p>26 &amp; 27 mai 2028 — Sud-Toulousain</p>
        <p className="credit">
          Réalisation du site faire-part par{" "}
          <a href="https://francoisleterrier.fr/" target="_blank" rel="noopener noreferrer">
            francoisleterrier.fr
          </a>
        </p>
      </footer>
    </div>
  );
}

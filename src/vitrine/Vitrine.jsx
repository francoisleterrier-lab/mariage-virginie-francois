import { useState, useEffect } from "react";
import arbreImg from "../assets/arbre-vie.png";

/* ============================================================
   Faire-part Vivant — Vitrine commerciale (landing page)
   Vend le produit « Faire-part Vivant » (éditeur : product.html).
   ============================================================ */

// Lien vers l'espace de création (relatif → marche en dev et sur GitHub Pages).
const EDITEUR = "product.html";

/* ---------- Icônes (SVG inline, trait fin) ---------- */
const I = {
  leaf: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>),
  bell: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>),
  check: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>),
  x: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>),
  rsvp: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="m9 15 1.6 1.6L14 13"/></svg>),
  camera: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.2"/></svg>),
  gift: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M12 8S10.5 4 8 4a2 2 0 0 0 0 4h4Zm0 0s1.5-4 4-4a2 2 0 0 1 0 4h-4Z"/></svg>),
  spark: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/><circle cx="12" cy="12" r="2.5"/></svg>),
  phone: (p) => (<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/></svg>),
  lock: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>),
  plus: (p) => (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>),
  arrow: (p) => (<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>),
  burger: (p) => (<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}><path d="M4 7h16M4 12h16M4 17h16"/></svg>),
};

/* ---------- Thèmes (repris du rendu produit) ---------- */
const THEMES = [
  { id: "canopee", nom: "Canopée", desc: "Forêt profonde & or chaud", bg: "#12201a", bg2: "#1c2c22", accent: "#d0a85a", dot: "linear-gradient(135deg,#12201a,#4d6b3f)" },
  { id: "sceau", nom: "Le Sceau", desc: "Terre de Sienne & bordeaux", bg: "#241016", bg2: "#3a1c22", accent: "#d79055", dot: "linear-gradient(135deg,#3a1c22,#9c5a44)" },
  { id: "brume", nom: "La Brume", desc: "Bleu ardoise & lin", bg: "#161f27", bg2: "#26343f", accent: "#bcae7a", dot: "linear-gradient(135deg,#26343f,#6f8aa0)" },
];

// Positions des lumières dorées sur l'arbre (décoratif).
const LUMS = [
  { x: 50, y: 30 }, { x: 40, y: 38 }, { x: 60, y: 36 }, { x: 46, y: 24 },
  { x: 56, y: 26 }, { x: 34, y: 30 }, { x: 66, y: 32 }, { x: 50, y: 44 },
];

/* ---------- Nav ---------- */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links = [
    ["#fonctionnalites", "Fonctionnalités"],
    ["#themes", "Thèmes"],
    ["#tarifs", "Tarifs"],
    ["#faq", "FAQ"],
  ];
  return (
    <header className={"vt-nav" + (scrolled ? " scrolled" : "")}>
      <div className="vt-wrap vt-nav-in">
        <a href="#top" className="vt-logo"><span className="leaf">{I.leaf()}</span>Faire-part Vivant</a>
        <nav className="vt-nav-links">
          {links.map(([h, t]) => <a key={h} href={h}>{t}</a>)}
        </nav>
        <div className="vt-nav-cta">
          <a className="vt-btn gold" href={EDITEUR}>Créer mon faire-part {I.arrow()}</a>
          <button className="vt-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{I.burger()}</button>
        </div>
      </div>
      {open && (
        <div className="vt-mobile vt-wrap">
          {links.map(([h, t]) => <a key={h} href={h} onClick={() => setOpen(false)}>{t}</a>)}
          <a className="vt-btn gold" href={EDITEUR}>Créer mon faire-part {I.arrow()}</a>
        </div>
      )}
    </header>
  );
}

/* ---------- Aperçu téléphone (thème interactif) ---------- */
function PhoneMock() {
  const [t, setT] = useState(THEMES[0]);
  const vars = { "--sc-bg": t.bg, "--sc-bg2": t.bg2, "--sc-accent": t.accent };
  return (
    <div className="vt-phone-wrap">
      <div className="vt-phone" style={{ background: `linear-gradient(160deg, ${t.bg2}, #0c0a07)` }}>
        <div className="vt-screen" style={vars}>
          <span className="sc-live">En direct</span>
          <p className="sc-eyebrow">Ils se marient</p>
          <h3 className="sc-couple">Camille <span className="a">&amp;</span> Alex</h3>
          <p className="sc-date">12 · 09 · 2026</p>
          <div className="vt-tree">
            <img src={arbreImg} alt="" />
            {LUMS.map((l, i) => (
              <span key={i} className="lum" style={{ left: `${l.x}%`, top: `${l.y}%`, animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
          <div className="sc-cd">
            {[["112", "jours"], ["06", "h"], ["24", "min"]].map(([n, k]) => (
              <div key={k}><div className="n">{n}</div><div className="k">{k}</div></div>
            ))}
          </div>
          <button className="sc-btn" type="button">J'y serai ✓</button>
        </div>
        <div className="vt-notif">
          <span className="ic">{I.bell()}</span>
          <div>
            <div className="tt">Camille &amp; Alex</div>
            <div className="ds">« On a hâte de vous voir ! » 💛</div>
          </div>
        </div>
      </div>
      <div className="vt-theme-switch">
        <span>Thème :</span>
        {THEMES.map((th) => (
          <button
            key={th.id}
            className={"vt-theme-dot" + (t.id === th.id ? " on" : "")}
            style={{ background: th.dot }}
            aria-label={th.nom}
            aria-pressed={t.id === th.id}
            onClick={() => setT(th)}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section className="vt-hero" id="top">
      <span className="vt-hero-blob a" /><span className="vt-hero-blob b" />
      <div className="vt-wrap vt-hero-grid">
        <div className="vt-hero-copy">
          <span className="vt-eyebrow">Le faire-part de mariage nouvelle génération</span>
          <h1 className="vt-display">L'invitation qui <span className="vt-amp">vit</span>.</h1>
          <p className="vt-lead">
            Offrez à vos invités bien plus qu'un carton : un faire-part numérique élégant,
            qui s'installe comme une appli, notifie vos proches, recueille les réponses
            et rassemble leurs photos — le tout à votre nom, en quelques minutes.
          </p>
          <div className="vt-hero-actions">
            <a className="vt-btn gold lg" href={EDITEUR}>Créer mon faire-part {I.arrow()}</a>
            <a className="vt-btn ghost lg" href="#demo">Voir une démo</a>
          </div>
          <p className="vt-hero-note">{I.lock()} Sans engagement · vos données protégées · essai gratuit de l'éditeur</p>
        </div>
        <div className="vt-hero-media" id="demo"><PhoneMock /></div>
      </div>
    </section>
  );
}

/* ---------- Bandeau confiance ---------- */
function Trust() {
  const stats = [
    ["+120", "faire-part créés"], ["3", "thèmes signés"], ["98 %", "de RSVP reçus"], ["4,9/5", "satisfaction"],
  ];
  return (
    <div className="vt-trust">
      <div className="vt-wrap vt-trust-in">
        {stats.map(([n, l]) => (
          <div className="vt-stat" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Problème / solution ---------- */
function Compare() {
  return (
    <section className="vt-section">
      <div className="vt-wrap">
        <div className="vt-head">
          <span className="vt-eyebrow">Pourquoi passer au numérique</span>
          <h2 className="vt-h2">Le carton d'invitation n'a jamais rappelé personne.</h2>
          <p>Le papier est figé, coûteux et sans retour. Un Faire-part Vivant, lui, accompagne vos invités jusqu'au grand jour.</p>
        </div>
        <div className="vt-compare">
          <div className="card old">
            <h3>Le faire-part papier</h3>
            <ul>
              <li>{I.x()} Impression &amp; envois postaux coûteux</li>
              <li>{I.x()} Aucune confirmation automatique</li>
              <li>{I.x()} Relances à la main, adresses perdues</li>
              <li>{I.x()} Figé le jour de l'impression</li>
              <li>{I.x()} Les photos des invités se perdent</li>
            </ul>
          </div>
          <div className="card new">
            <h3>Le Faire-part Vivant</h3>
            <ul>
              <li>{I.check()} Un lien à partager, zéro impression</li>
              <li>{I.check()} RSVP recueillis et comptés en direct</li>
              <li>{I.check()} Notifications push vers vos invités</li>
              <li>{I.check()} Se met à jour à tout moment</li>
              <li>{I.check()} Album photo commun, en temps réel</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Fonctionnalités ---------- */
const FEATURES = [
  { ic: "bell", t: "Notifications push", d: "Prévenez tous vos invités d'un changement d'horaire, d'un mot doux ou du décompte final — directement sur leur écran." },
  { ic: "rsvp", t: "RSVP en direct", d: "Chaque invité confirme sa présence en un geste. Vous suivez les réponses et le nombre de couverts en temps réel." },
  { ic: "camera", t: "Album des invités", d: "Un mur photo commun : vos proches prennent des clichés et vidéos en direct, la galerie se remplit toute seule." },
  { ic: "gift", t: "Cagnotte & liste", d: "Une cagnotte commune ou une liste de cadeaux à réserver, intégrée élégamment à votre invitation." },
  { ic: "spark", t: "Éléments vivants", d: "Un arbre de vie qui s'illumine à chaque « oui », une constellation d'invités… des touches interactives qui émeuvent." },
  { ic: "phone", t: "Installable comme une appli", d: "Vos invités ajoutent le faire-part à leur écran d'accueil : il s'ouvre en plein écran, même hors connexion." },
];
function Features() {
  return (
    <section className="vt-section tint" id="fonctionnalites">
      <div className="vt-wrap">
        <div className="vt-head">
          <span className="vt-eyebrow">Tout ce qu'il sait faire</span>
          <h2 className="vt-h2">Une invitation, mille attentions.</h2>
          <p>Chaque fonctionnalité est pensée pour rapprocher vos invités de votre grand jour.</p>
        </div>
        <div className="vt-feats">
          {FEATURES.map((f) => (
            <article className="vt-feat" key={f.t}>
              <div className="ic">{I[f.ic]()}</div>
              <h3>{f.t}</h3>
              <p>{f.d}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Comment ça marche ---------- */
function Steps() {
  const steps = [
    { t: "Créez votre espace", d: "Inscrivez-vous en 30 secondes et ouvrez votre éditeur personnel, sans installation." },
    { t: "Personnalisez", d: "Vos prénoms, la date, un thème, vos sections… Activez l'album, la cagnotte ou l'arbre de vie en un clic." },
    { t: "Partagez le lien", d: "Diffusez votre faire-part par WhatsApp, SMS ou e-mail. Les réponses arrivent, la magie opère." },
  ];
  return (
    <section className="vt-section">
      <div className="vt-wrap">
        <div className="vt-head">
          <span className="vt-eyebrow">Simple, vraiment</span>
          <h2 className="vt-h2">Prêt à partager en trois étapes.</h2>
        </div>
        <div className="vt-steps">
          {steps.map((s) => (
            <div className="vt-step" key={s.t}>
              <div className="num" />
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Thèmes ---------- */
function Themes() {
  return (
    <section className="vt-section tint" id="themes">
      <div className="vt-wrap">
        <div className="vt-head">
          <span className="vt-eyebrow">Trois écrins signés</span>
          <h2 className="vt-h2">Un thème pour chaque histoire.</h2>
          <p>Des palettes élégantes, pensées par nos soins. Choisissez la vôtre, elle habille tout votre faire-part.</p>
        </div>
        <div className="vt-themes">
          {THEMES.map((th) => (
            <article className="vt-theme-card" key={th.id}>
              <div className="sw" style={{ background: `radial-gradient(120% 90% at 50% -10%, ${th.bg2}, ${th.bg})` }}>
                <span className="mark" style={{ color: th.accent }}>C &amp; A</span>
              </div>
              <div className="cap">
                <div className="nm">{th.nom}</div>
                <div className="ds">{th.desc}</div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Zoom fonctionnalités (alternance) ---------- */
function Highlights() {
  return (
    <section className="vt-section">
      <div className="vt-wrap">
        <div className="vt-split">
          <div>
            <span className="vt-eyebrow">L'album vivant</span>
            <h3 style={{ marginTop: ".7rem" }}>Tous les souvenirs, au même endroit.</h3>
            <p>Fini les photos éparpillées sur dix téléphones. Vos invités capturent l'instant depuis le faire-part, et le mur commun se remplit en temps réel — vous gardez tout.</p>
            <ul>
              <li>{I.check()} Appareil photo &amp; vidéo intégrés</li>
              <li>{I.check()} Galerie live, visible par tous les invités</li>
              <li>{I.check()} Aucune application à installer pour eux</li>
            </ul>
          </div>
          <div className="vt-split-media">
            <div className="vt-album-mock">
              {["#3a5a44", "#7d5a3c", "#4a6b7d", "#6b4a5a", "#5a6b3c", "#3c5a6b", "#7d6b3c", "#4a5a6b", "#6b5a3c"].map((c, i) => (
                <i key={i} style={{ background: `linear-gradient(150deg, ${c}, rgba(0,0,0,.3))` }} />
              ))}
            </div>
          </div>
        </div>

        <div className="vt-split rev">
          <div>
            <span className="vt-eyebrow">La cagnotte</span>
            <h3 style={{ marginTop: ".7rem" }}>Votre projet de vie, financé avec le sourire.</h3>
            <p>Voyage de noces, futur nid, liste de cadeaux à réserver… Proposez une cagnotte commune, suivez la progression, et remerciez chaque participant automatiquement.</p>
            <ul>
              <li>{I.check()} Jauge de progression en direct</li>
              <li>{I.check()} Mots doux laissés par les contributeurs</li>
              <li>{I.check()} Ou une liste de cadeaux « à réserver »</li>
            </ul>
          </div>
          <div className="vt-split-media">
            <div className="vt-cag-mock">
              <div className="amt">3 240 €</div>
              <div className="bar"><span /></div>
              <div className="sub">72 % de notre voyage de noces · 18 participants 💛</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Tarifs ---------- */
const PLANS = [
  {
    name: "Essentiel", tag: "L'invitation vivante, installable", price: 149, once: "Paiement unique · à vie",
    feats: ["1 faire-part personnalisé", "Les 3 thèmes signés", "Compte à rebours", "RSVP en ligne illimités", "Partage WhatsApp / SMS / e-mail"],
  },
  {
    name: "Vivant", tag: "Le préféré des futurs mariés", price: 249, once: "Paiement unique · à vie", featured: true,
    feats: ["Tout l'Essentiel, plus :", "Notifications push aux invités", "Album photo & vidéo des invités", "Éléments interactifs (arbre, constellation)", "Faire-part installable (appli)"],
  },
  {
    name: "Signature", tag: "L'expérience complète", price: 449, once: "Paiement unique · à vie",
    feats: ["Tout le Vivant, plus :", "Cagnotte & liste de cadeaux", "Pages personnalisées par invité", "Plan de table & « ma table »", "Accompagnement & support prioritaire"],
  },
];
function Pricing() {
  return (
    <section className="vt-section tint" id="tarifs">
      <div className="vt-wrap">
        <div className="vt-head">
          <span className="vt-eyebrow">Des tarifs clairs</span>
          <h2 className="vt-h2">Un prix, une fois. Pas d'abonnement.</h2>
          <p>Payez une seule fois : votre faire-part reste en ligne jusqu'à votre mariage et au-delà.</p>
        </div>
        <div className="vt-plans">
          {PLANS.map((p) => (
            <div className={"vt-plan" + (p.featured ? " feat" : "")} key={p.name}>
              {p.featured && <span className="badge">Le plus choisi</span>}
              <div className="vt-plan-name">{p.name}</div>
              <div className="vt-plan-tag">{p.tag}</div>
              <div className="vt-price"><span className="cur">{p.price} €</span></div>
              <div className="vt-plan-once">{p.once}</div>
              <ul>
                {p.feats.map((f) => <li key={f}>{I.check()}<span>{f}</span></li>)}
              </ul>
              <a className={"vt-btn " + (p.featured ? "gold" : "ghost")} href={EDITEUR}>Choisir {p.name}</a>
            </div>
          ))}
        </div>
        <div className="vt-bespoke">
          <div className="vt-bespoke-copy">
            <span className="vt-eyebrow on-dark">Sur-mesure · clé en main</span>
            <h3>Envie qu'on s'occupe de tout ?</h3>
            <p>Nous concevons et configurons votre Faire-part Vivant de A à Z — thème sur-mesure, mise en scène de vos éléments interactifs et accompagnement dédié jusqu'au grand jour.</p>
          </div>
          <div className="vt-bespoke-cta">
            <div className="vt-bespoke-price">Sur devis</div>
            <a className="vt-btn gold lg" href="mailto:contact@faire-part-vivant.fr?subject=Demande%20sur-mesure%20—%20Faire-part%20Vivant">Demander un devis {I.arrow()}</a>
          </div>
        </div>
        <p className="vt-plans-note">Paiement unique, sans abonnement, invités illimités. L'éditeur est gratuit à l'essai : vous ne payez qu'au moment de publier.</p>
      </div>
    </section>
  );
}

/* ---------- Témoignages ---------- */
const QUOTES = [
  { q: "Nos invités nous ont dit que c'était le plus beau faire-part qu'ils aient jamais reçu. L'arbre qui s'illumine à chaque réponse, ils ont adoré.", n: "Léa & Thomas", m: "Mariés en juin 2025", av: "L" },
  { q: "Fini les relances par téléphone : les RSVP arrivaient tout seuls. Et le mur photo après la fête valait de l'or.", n: "Sarah & Malik", m: "Mariés en septembre 2025", av: "S" },
  { q: "Monté en une soirée, partagé sur WhatsApp le lendemain. Simple, élégant, et tellement plus vivant qu'un carton.", n: "Clara & Antoine", m: "Mariés en mai 2026", av: "C" },
];
function Quotes() {
  return (
    <section className="vt-section">
      <div className="vt-wrap">
        <div className="vt-head">
          <span className="vt-eyebrow">Ils ont dit oui</span>
          <h2 className="vt-h2">Des mariés conquis.</h2>
        </div>
        <div className="vt-quotes">
          {QUOTES.map((c) => (
            <figure className="vt-quote" key={c.n}>
              <div className="stars">★★★★★</div>
              <blockquote><p>« {c.q} »</p></blockquote>
              <figcaption className="who">
                <span className="av">{c.av}</span>
                <span><span className="nm">{c.n}</span><br /><span className="mt">{c.m}</span></span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
const FAQS = [
  ["Ai-je besoin de compétences techniques ?", "Aucune. Vous vous connectez, vous remplissez vos informations, vous choisissez un thème et vous publiez. Tout se fait depuis votre navigateur, sur ordinateur ou mobile."],
  ["Mes invités doivent-ils installer une application ?", "Non. Ils ouvrent simplement le lien que vous partagez. S'ils le souhaitent, ils peuvent « ajouter à l'écran d'accueil » pour un accès en un geste, mais rien n'est obligatoire."],
  ["Mes données et celles de mes invités sont-elles protégées ?", "Oui. Votre faire-part n'est jamais indexé par les moteurs de recherche et l'accès aux données est protégé. Vous restez seul propriétaire de vos contenus."],
  ["Puis-je modifier mon faire-part après l'avoir partagé ?", "Bien sûr. Vous pouvez tout mettre à jour à tout moment — horaires, textes, sections — et vos invités voient la nouvelle version instantanément."],
  ["Combien de temps mon faire-part reste-t-il en ligne ?", "Il reste accessible jusqu'à votre mariage et bien au-delà, pour conserver l'album souvenir. Le paiement est unique, sans abonnement."],
  ["Comment recevoir l'aide en cas de besoin ?", "L'offre Signature inclut un accompagnement et un support prioritaire. Pour les autres formules, une aide vous répond par e-mail."],
];
function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="vt-section tint" id="faq">
      <div className="vt-wrap">
        <div className="vt-head">
          <span className="vt-eyebrow">Vous vous demandez…</span>
          <h2 className="vt-h2">Questions fréquentes.</h2>
        </div>
        <div className="vt-faq">
          {FAQS.map(([q, a], i) => (
            <div className={"vt-faq-item" + (open === i ? " open" : "")} key={q}>
              <button className="vt-faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                {q}<span className="chev">{I.plus()}</span>
              </button>
              <div className="vt-faq-a"><p>{a}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- CTA final ---------- */
function FinalCta() {
  return (
    <section className="vt-cta">
      <span className="blob a" /><span className="blob b" />
      <span className="vt-eyebrow on-dark">Votre grand jour mérite mieux qu'un carton</span>
      <h2 style={{ marginTop: "1rem" }}>Créez le faire-part dont on se souviendra.</h2>
      <p>Commencez gratuitement dans l'éditeur. Vous ne payez qu'au moment de publier.</p>
      <div className="vt-cta-actions">
        <a className="vt-btn gold lg" href={EDITEUR}>Créer mon faire-part {I.arrow()}</a>
        <a className="vt-btn on-dark lg" href="#tarifs">Voir les tarifs</a>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer className="vt-footer">
      <div className="vt-wrap vt-footer-in">
        <div>
          <span className="vt-logo"><span className="leaf">{I.leaf()}</span>Faire-part Vivant</span>
          <p className="tag">L'invitation de mariage numérique qui vit, notifie et rassemble vos proches.</p>
        </div>
        <nav>
          <div>
            <h4>Produit</h4>
            <a href="#fonctionnalites">Fonctionnalités</a>
            <a href="#themes">Thèmes</a>
            <a href="#tarifs">Tarifs</a>
            <a href={EDITEUR}>Créer mon faire-part</a>
          </div>
          <div>
            <h4>Aide</h4>
            <a href="#faq">FAQ</a>
            <a href="mailto:contact@faire-part-vivant.fr">Nous contacter</a>
          </div>
        </nav>
      </div>
      <div className="vt-wrap vt-footer-bottom">
        <span>© {"2026"} Faire-part Vivant — Fait avec 💛</span>
        <span>Mentions légales · Confidentialité</span>
      </div>
    </footer>
  );
}

export default function Vitrine() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Trust />
        <Compare />
        <Features />
        <Steps />
        <Themes />
        <Highlights />
        <Pricing />
        <Quotes />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

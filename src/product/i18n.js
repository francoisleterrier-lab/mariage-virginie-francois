/* Multilingue (produit) : dictionnaire du parcours invité principal.
   Le contenu propre au couple (prénoms, histoire, infos…) reste tel qu'écrit ;
   seule la « chrome » de l'app est traduite. */

export const DICO = {
  fr: {
    load: "Un instant…",
    err404a: "Cette invitation n'existe pas encore.",
    err404b: "Vérifiez le lien, ou revenez un peu plus tard.",
    eyebrow: "Nous nous marions",
    decouvrir: "Découvrir ↓",
    avant: "Avant le grand jour",
    jours: "jours",
    heures: "heures",
    min: "min",
    histoire: "Notre histoire",
    infos: "Infos pratiques",
    rsvpTitre: "Dites-nous oui",
    rMerci: "🌿 Merci, votre réponse est bien enregistrée !",
    rNom: "Votre nom",
    rMail: "E-mail (facultatif)",
    rPres: "Présence",
    pres1: "Avec joie, je serai là",
    pres2: "Je viens accompagné·e",
    pres3: "Hélas, je ne pourrai pas venir",
    rAdultes: "Adultes",
    rEnfants: "Enfants",
    rMsg: "Un petit mot ?",
    rEnvoi: "Envoi…",
    rEnvoyer: "Envoyer ma réponse",
    rErrNom: "Indiquez votre nom.",
    rErr: "Oups, réessayez dans un instant.",
    pushTitre: "Restez au courant",
    pushTexte: "Activez les notifications pour être prévenu·e des nouvelles : le lieu, le programme, les petits mots des mariés.",
    pushActif: "🔔 Notifications activées — merci !",
    pushBusy: "Activation…",
    pushBtn: "🔔 Être prévenu·e",
    pushErr: "Activation impossible (autorisez les notifications).",
    footer1: "Créé avec",
    footer2: "— l'invitation qui vit.",
  },
  en: {
    load: "One moment…",
    err404a: "This invitation doesn't exist yet.",
    err404b: "Check the link, or come back a little later.",
    eyebrow: "We're getting married",
    decouvrir: "Discover ↓",
    avant: "Before the big day",
    jours: "days",
    heures: "hours",
    min: "min",
    histoire: "Our story",
    infos: "Practical info",
    rsvpTitre: "Let us know",
    rMerci: "🌿 Thank you, your reply has been saved!",
    rNom: "Your name",
    rMail: "Email (optional)",
    rPres: "Attendance",
    pres1: "Joyfully, I'll be there",
    pres2: "I'm coming with a guest",
    pres3: "Sadly, I can't make it",
    rAdultes: "Adults",
    rEnfants: "Children",
    rMsg: "A little note?",
    rEnvoi: "Sending…",
    rEnvoyer: "Send my reply",
    rErrNom: "Please enter your name.",
    rErr: "Oops, please try again in a moment.",
    pushTitre: "Stay in the loop",
    pushTexte: "Turn on notifications to hear the news: the venue, the schedule, a word from the couple.",
    pushActif: "🔔 Notifications on — thank you!",
    pushBusy: "Enabling…",
    pushBtn: "🔔 Keep me posted",
    pushErr: "Couldn't enable (please allow notifications).",
    footer1: "Created with",
    footer2: "— the invitation that lives.",
  },
};

export function langInitiale() {
  try {
    const saved = localStorage.getItem("fpv-lang");
    if (saved === "fr" || saved === "en") return saved;
  } catch {
    /* ignore */
  }
  return typeof navigator !== "undefined" && (navigator.language || "").toLowerCase().startsWith("en") ? "en" : "fr";
}

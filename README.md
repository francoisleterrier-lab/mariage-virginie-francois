# Mariage Virginie & François — site sécurisé (v2)

Faire-part privé des **26 & 27 mai 2028** (Sud-Toulousain).
Vite + React + Supabase (Auth e-mail/mot de passe, Postgres + RLS).
Portail d'accès obligatoire, logique couple, RSVP en base, tableau de bord admin.

> ⚠️ Site `noindex, nofollow` — le nom du lieu de réception n'apparaît nulle part.

---

## 1. Prérequis

- Node.js 18+ et npm
- Un projet [Supabase](https://supabase.com) (gratuit)

## 2. Installation locale

```bash
npm install
cp .env.example .env.local   # puis renseignez vos clés (voir §4)
npm run dev
```

## 3. Configuration Supabase

1. Créez un projet sur supabase.com.
2. **SQL** : ouvrez `SQL Editor`, collez et exécutez **dans l'ordre** :
   - [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — table `invites`,
     vue publique `invites_public`, policies RLS, fonctions `lier_couple` / `delier_couple` / `is_admin`.
   - [`supabase/migrations/0002_pwa_push_plan.sql`](supabase/migrations/0002_pwa_push_plan.sql) —
     tables `push_subscriptions`, `tables_plan`, `parametres`, `notifications_log`,
     colonne `invites.table_id`, fonctions `affecter_table` / `mes_voisins` et garde-fou colonnes.
3. **Auth** : `Authentication > Providers > Email` → activé.
   - **Recommandé pour un faire-part privé** : `Authentication > Sign In / Providers`
     → désactivez **« Confirm email »**. Les invités entrent alors immédiatement
     après inscription (pas d'e-mail de confirmation à cliquer).
   - Si vous laissez la confirmation active, l'invité devra valider son e-mail
     puis se connecter via « Déjà inscrit·e » — l'appli gère ce cas et l'en informe.
4. **Clés** : `Project Settings > API` → copiez `Project URL` et la clé `anon public`.

## 4. Variables d'environnement

Dans `.env.local` (jamais commité) :

```
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anon-publique
VITE_VAPID_PUBLIC_KEY=votre-cle-publique-vapid   # voir §7 (push)
```

N'utilisez **jamais** la clé `service_role` ni la clé **privée** VAPID côté front.

## 5. Désigner l'administrateur

Le tableau de bord est réservé au rôle `admin` (contrôlé côté serveur par RLS via
`is_admin()` — c'est plus sûr qu'une liste d'e-mails côté client).

1. Inscrivez-vous normalement sur le site avec votre e-mail.
2. Dans `SQL Editor`, exécutez :

```sql
update public.invites set role = 'admin'
where email = 'francois.leterrier@gmail.com';
```

3. Reconnectez-vous : vous arrivez sur le tableau de bord (stats + tableau + export CSV).

## 6. Build de production

```bash
npm run build      # génère dist/
npm run preview    # prévisualise le build localement
```

## 7. Déploiement

### Option A — serveur statique (recommandé, `dist/` uploadable)

`vite.config.js` utilise `base: './'` : les chemins sont **relatifs**, donc
`dist/` fonctionne à la racine d'un domaine **ou** dans un sous-dossier.

1. Renseignez `.env.local` avec les clés de prod **avant** `npm run build`
   (les variables `VITE_*` sont injectées au moment du build).
2. `npm run build`.
3. Uploadez tout le contenu de `dist/` sur votre hébergement habituel.

### Option B — Vercel (plus simple pour les variables)

1. Importez le dépôt sur Vercel (framework détecté : Vite).
2. `Settings > Environment Variables` : ajoutez `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_ANON_KEY`.
3. Déployez. Build command `npm run build`, output `dist`.
   Ajoutez aussi `VITE_VAPID_PUBLIC_KEY` (§7).

## 7.bis PWA (application installable)

Le build génère automatiquement le `manifest.webmanifest` et le service worker
(`vite-plugin-pwa`). Rien à configurer :

- **Installation** : une bannière maison invite à ajouter le site à l'écran
  d'accueil (bouton natif sur Android ; instructions **Partager → Sur l'écran
  d'accueil** sur iPhone, qui n'a pas de prompt automatique).
- **Hors-ligne** : le shell (HTML/CSS/JS/polices) est précaché ; les médias
  (photos, vidéo, icônes) sont en *stale-while-revalidate*. Les sections
  statiques (histoire, programme) s'ouvrent sans réseau ; les données Supabase
  affichent un état vide propre hors-ligne.
- ⚠️ La PWA n'est active que **servie en HTTPS** (ou `localhost`).

## 7.ter Notifications push (VAPID + Edge Function)

1. **Générer les clés VAPID** (une seule fois) :

   ```bash
   npx web-push generate-vapid-keys
   ```

   Mettez la clé **publique** dans `VITE_VAPID_PUBLIC_KEY` (front) et gardez la
   **privée** pour l'Edge Function.

2. **Déployer l'Edge Function** :

   ```bash
   supabase functions deploy envoyer-notification
   supabase secrets set \
     VAPID_PUBLIC_KEY="<clé publique>" \
     VAPID_PRIVATE_KEY="<clé privée>" \
     VAPID_SUBJECT="mailto:francois.leterrier@gmail.com"
   ```

   (`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont
   injectés automatiquement dans la fonction.)

3. **Usage** : côté invité, un encart doux propose l'abonnement après connexion
   (jamais de demande brutale). Côté admin, l'onglet **Notifications** envoie un
   titre + message à tous les abonnés (révélation du lieu, programme du samedi,
   rappel RSVP…) ; chaque envoi est journalisé.
   - Sur iPhone, le push exige la **PWA installée** (iOS ≥ 16.4) — l'UI le
     rappelle et incite à installer d'abord.
   - La clé **privée** VAPID reste dans l'Edge Function (secret), jamais dans le front.

## 7.quater Plan de table

- **Admin** (onglet *Plan de table*) : créer des tables (nom, forme, capacité),
  les glisser sur le canevas, affecter chaque invité, basculer la visibilité
  invité (`plan_visible`). Une **alerte** signale tout couple séparé.
- **Invité** (section *Ma table*) : carte mystère tant que le plan n'est pas
  publié ; ensuite nom de sa table, voisins de tablée et mini-plan avec sa table
  en **or**.

## 8. Structure

```
index.html                     Entrée Vite (noindex, polices Google)
public/icons/                  Icônes PWA (arbre de vie 192/512/maskable)
src/
  main.jsx                     Montage React + enregistrement du service worker
  sw.js                        Service worker (précache + SWR + push)
  App.jsx                      Machine à états d'accès (boot/gate/app)
  styles.css                   Design system complet (couleurs, typo, responsive)
  lib/supabase.js              Client Supabase + messages d'erreur FR
  lib/push.js                  Helpers Web Push (VAPID, abonnement)
  components/
    Gate.jsx                   Portail : inscription / connexion / couple
    Site.jsx                   Faire-part (héro vidéo+SVG, RSVP, couple tardif)
    Admin.jsx                  Tableau de bord (onglets) + export CSV
    PushAdmin.jsx              Envoi de notifications + historique
    PlanEditor.jsx             Éditeur de plan de table (drag, affectation)
    MaTable.jsx                Vue « Ma table » invité (mystère / publiée)
    InstallBanner.jsx          Bannière d'installation PWA (parcours iOS)
    PushOptIn.jsx              Encart doux d'abonnement aux notifications
    Rosette.jsx                Arbre de vie SVG (secours vidéo)
    Countdown.jsx              Compte à rebours
  assets/                      Vidéo + photos (hashées par Vite au build)
supabase/migrations/           0001 (base) + 0002 (push/plan/paramètres)
supabase/functions/envoyer-notification/   Edge Function d'envoi push
```

## 9. Modèle de sécurité (résumé)

- Aucun contenu visible sans session (portail obligatoire).
- RLS activée : un invité ne lit/écrit que **sa** ligne.
- Les autres invités ne sont visibles que via la vue `invites_public`
  (`id, nom, couple_id` — **jamais** e-mail, rôle ni RSVP).
- Liaison couple = fonction Postgres `security definer` avec garde-fous
  (met à jour 2 lignes atomiquement, refuse si déjà lié).
- Admin : lecture globale via `is_admin()` (rôle en base, contrôlé serveur).
- Session persistante gérée par Supabase (refresh token).

## Pages personnalisées par foyer

Chaque foyer (couple lié par `couple_id`, sinon invité seul) peut recevoir une
page d'accueil dédiée : « Bonjour {nom} », un mot des mariés (markdown léger
**gras**/*italique*, rendu **sûr** sans HTML injecté), une photo souvenir
(bucket **privé** `household-photos`, URL signée 1 h) et un rappel RSVP.

- Table `pages_foyer` (clé = foyer canonique), RLS : l'invité ne lit **que** sa
  page et seulement si `published`. Écriture réservée à l'admin (`is_admin()`).
- Fonction `mon_foyer_id()` (security definer) : foyer de l'utilisateur courant,
  utilisée par la RLS de la table et la policy Storage (lecture limitée au
  dossier `{foyer_id}/`).
- Admin → onglet **Pages perso** : suivi d'avancement (⬜/✏️/✅), éditeur,
  compression photo client (max 1600 px, JPEG 0.82), aperçu « comme l'invité ».
- Sans page publiée : l'invité voit l'accueil habituel (aucun état vide).

## Arbre de vie vivant & « le site qui vit »

- Arbre de vie (illustration) qui s'illumine d'une lumière par personne inscrite
  (RPC `arbre_feuilles`, prénom au survol) — voir `TreeOfLife.jsx`.
- Paliers temporels (`site_phases`) : citation, décor botanique et teinte qui
  évoluent jusqu'au 26/05/2028 — hook `usePhase`, admin onglet « Le site ».

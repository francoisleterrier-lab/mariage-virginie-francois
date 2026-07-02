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
2. **SQL** : ouvrez `SQL Editor`, collez le contenu de
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) et exécutez.
   Cela crée la table `invites`, la vue publique `invites_public`, les policies RLS
   et les fonctions `lier_couple` / `delier_couple` / `is_admin`.
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
```

N'utilisez **jamais** la clé `service_role` côté front.

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

## 8. Structure

```
index.html                     Entrée Vite (noindex, polices Google)
src/
  main.jsx                     Montage React
  App.jsx                      Machine à états d'accès (boot/gate/app)
  styles.css                   Design system complet (couleurs, typo, responsive)
  lib/supabase.js              Client Supabase + messages d'erreur FR
  components/
    Gate.jsx                   Portail : inscription / connexion / couple
    Site.jsx                   Faire-part (héro vidéo+SVG, RSVP, couple tardif)
    Admin.jsx                  Tableau de bord + export CSV
    Rosette.jsx                Arbre de vie SVG (secours vidéo)
    Countdown.jsx              Compte à rebours
  assets/                      Vidéo + photos (hashées par Vite au build)
supabase/migrations/0001_init.sql   Schéma, RLS, vue, fonctions
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

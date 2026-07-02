-- ============================================================
--  Mariage Virginie & François — schéma initial
--  Table invités + RLS + vue publique + fonctions couple/admin
-- ============================================================

-- ---------- Table principale ----------
create table if not exists public.invites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade unique not null,
  nom        text not null,
  email      text not null unique,
  couple_id  uuid references public.invites(id),
  role       text not null default 'invite',      -- 'invite' | 'admin'
  rsvp       jsonb,
  rsvp_date  timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;

-- ============================================================
--  Fonction utilitaire : l'utilisateur courant est-il admin ?
--  security definer => évite la récursion RLS (une policy sur
--  invites qui interrogerait invites déclencherait une boucle).
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.invites
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
--  Politiques RLS sur invites
-- ============================================================

-- SELECT : un invité lit sa propre ligne ; un admin lit tout.
drop policy if exists "invite_select_self_or_admin" on public.invites;
create policy "invite_select_self_or_admin"
  on public.invites for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- INSERT : un invité crée uniquement SA ligne (auth.uid() = user_id).
drop policy if exists "invite_insert_self" on public.invites;
create policy "invite_insert_self"
  on public.invites for insert
  to authenticated
  with check (auth.uid() = user_id);

-- UPDATE : un invité modifie uniquement SA ligne (RSVP).
-- La liaison couple (qui touche 2 lignes) passe par lier_couple().
drop policy if exists "invite_update_self" on public.invites;
create policy "invite_update_self"
  on public.invites for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Pas de policy DELETE : personne ne supprime via l'API front.

-- ============================================================
--  Vue publique : colonnes NON sensibles uniquement.
--  Sert à lister les invités pour la logique couple SANS jamais
--  exposer l'e-mail, le rôle ou le RSVP des autres.
--  security_invoker = off (défaut) => la vue lit toutes les lignes
--  avec les droits du propriétaire, mais ne révèle que id/nom/couple_id.
-- ============================================================
drop view if exists public.invites_public;
create view public.invites_public as
  select id, nom, couple_id
  from public.invites;

grant select on public.invites_public to authenticated;

-- ============================================================
--  Liaison couple : met à jour DEUX lignes atomiquement.
--  security definer + garde-fous (aucun des deux déjà lié, pas soi-même).
-- ============================================================
create or replace function public.lier_couple(partner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  moi_id uuid;
begin
  select id into moi_id
  from public.invites
  where user_id = auth.uid();

  if moi_id is null then
    raise exception 'Invité introuvable pour l''utilisateur courant.';
  end if;

  if partner_id is null or moi_id = partner_id then
    raise exception 'Partenaire invalide.';
  end if;

  if not exists (select 1 from public.invites where id = partner_id) then
    raise exception 'Ce partenaire n''existe pas.';
  end if;

  -- garde-fous : aucun des deux ne doit déjà être en couple
  if exists (select 1 from public.invites where id = moi_id and couple_id is not null) then
    raise exception 'Vous êtes déjà lié·e à quelqu''un.';
  end if;

  if exists (select 1 from public.invites where id = partner_id and couple_id is not null) then
    raise exception 'Cet invité est déjà en couple.';
  end if;

  update public.invites set couple_id = partner_id where id = moi_id;
  update public.invites set couple_id = moi_id       where id = partner_id;
end;
$$;

grant execute on function public.lier_couple(uuid) to authenticated;

-- ============================================================
--  (Optionnel) délier un couple — utile si erreur de liaison.
-- ============================================================
create or replace function public.delier_couple()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  moi_id uuid;
  autre_id uuid;
begin
  select id, couple_id into moi_id, autre_id
  from public.invites
  where user_id = auth.uid();

  if moi_id is null or autre_id is null then
    return; -- rien à délier
  end if;

  update public.invites set couple_id = null where id = moi_id;
  update public.invites set couple_id = null where id = autre_id;
end;
$$;

grant execute on function public.delier_couple() to authenticated;

-- ============================================================
--  DÉSIGNER UN ADMIN
--  Après vous être inscrit·e via le site, exécutez (SQL editor) :
--    update public.invites set role = 'admin'
--    where email = 'francois.leterrier@gmail.com';
-- ============================================================

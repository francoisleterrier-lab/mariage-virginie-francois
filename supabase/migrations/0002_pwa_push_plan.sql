-- ============================================================
--  Mariage Virginie & François — v2.1
--  Push notifications + plan de table + paramètres + log
-- ============================================================

-- ---------- Abonnements Web Push ----------
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  invite_id    uuid references public.invites(id) on delete cascade not null,
  subscription jsonb not null,            -- endpoint + clés du navigateur
  created_at   timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

-- ---------- Tables du plan de salle ----------
create table if not exists public.tables_plan (
  id        uuid primary key default gen_random_uuid(),
  nom       text not null,                -- ex. « Table Olivier »
  forme     text not null default 'ronde',-- 'ronde' | 'rectangle'
  capacite  int  not null default 8,
  pos_x     real not null default 50,     -- position sur le canevas (0-100 %)
  pos_y     real not null default 50
);
alter table public.tables_plan enable row level security;

-- Affectation d'un invité à une table.
alter table public.invites add column if not exists table_id uuid references public.tables_plan(id) on delete set null;

-- ---------- Paramètres du site (flags) ----------
create table if not exists public.parametres (
  cle    text primary key,               -- ex. 'plan_visible', 'lieu_revele'
  valeur jsonb not null
);
alter table public.parametres enable row level security;

insert into public.parametres (cle, valeur) values
  ('plan_visible', 'false'::jsonb),
  ('lieu_revele',  'false'::jsonb)
on conflict (cle) do nothing;

-- ---------- Journal des notifications envoyées ----------
create table if not exists public.notifications_log (
  id         uuid primary key default gen_random_uuid(),
  titre      text not null,
  message    text not null,
  envoyes    int  not null default 0,
  created_at timestamptz not null default now()
);
alter table public.notifications_log enable row level security;

-- ============================================================
--  Garde-fou colonnes protégées de invites
--  Un invité ne peut PAS modifier role / couple_id / table_id
--  directement (seules les fonctions security definer le peuvent,
--  via le drapeau de session app.bypass_guard).
-- ============================================================
create or replace function public.invites_guard()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.bypass_guard', true), '') = 'on' then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.couple_id is distinct from old.couple_id
     or new.table_id is distinct from old.table_id then
    raise exception 'Modification de colonnes protégées non autorisée.';
  end if;
  return new;
end;
$$;

drop trigger if exists invites_guard_trg on public.invites;
create trigger invites_guard_trg
  before update on public.invites
  for each row execute function public.invites_guard();

-- lier_couple / delier_couple doivent contourner le garde-fou.
create or replace function public.lier_couple(partner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  moi_id uuid;
begin
  select id into moi_id from public.invites where user_id = auth.uid();
  if moi_id is null then raise exception 'Invité introuvable pour l''utilisateur courant.'; end if;
  if partner_id is null or moi_id = partner_id then raise exception 'Partenaire invalide.'; end if;
  if not exists (select 1 from public.invites where id = partner_id) then raise exception 'Ce partenaire n''existe pas.'; end if;
  if exists (select 1 from public.invites where id = moi_id and couple_id is not null) then raise exception 'Vous êtes déjà lié·e à quelqu''un.'; end if;
  if exists (select 1 from public.invites where id = partner_id and couple_id is not null) then raise exception 'Cet invité est déjà en couple.'; end if;

  perform set_config('app.bypass_guard', 'on', true);
  update public.invites set couple_id = partner_id where id = moi_id;
  update public.invites set couple_id = moi_id       where id = partner_id;
end;
$$;
grant execute on public.lier_couple(uuid) to authenticated;

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
  select id, couple_id into moi_id, autre_id from public.invites where user_id = auth.uid();
  if moi_id is null or autre_id is null then return; end if;
  perform set_config('app.bypass_guard', 'on', true);
  update public.invites set couple_id = null where id = moi_id;
  update public.invites set couple_id = null where id = autre_id;
end;
$$;
grant execute on public.delier_couple() to authenticated;

-- ============================================================
--  Affectation d'un invité à une table (admin uniquement)
-- ============================================================
create or replace function public.affecter_table(p_invite uuid, p_table uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  perform set_config('app.bypass_guard', 'on', true);
  update public.invites set table_id = p_table where id = p_invite;
end;
$$;
grant execute on public.affecter_table(uuid, uuid) to authenticated;

-- ============================================================
--  « Ma table » côté invité : voisins de table.
--  Ne renvoie rien tant que plan_visible n'est pas activé.
--  N'expose que les PRÉNOMS+NOMS (jamais e-mail).
-- ============================================================
create or replace function public.mes_voisins()
returns table (nom text)
language sql
stable
security definer
set search_path = public
as $$
  select i.nom
  from public.invites i
  where (select valeur from public.parametres where cle = 'plan_visible') = 'true'::jsonb
    and i.table_id is not null
    and i.table_id = (select table_id from public.invites where user_id = auth.uid())
    and i.user_id <> auth.uid()
  order by i.nom;
$$;
grant execute on public.mes_voisins() to authenticated;

-- ============================================================
--  Nombre d'abonnés push (admin uniquement).
--  Évite d'exposer push_subscriptions en lecture globale au front :
--  seule cette fonction (security definer) renvoie le total.
-- ============================================================
create or replace function public.nb_abonnes()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_admin()
              then (select count(*)::int from public.push_subscriptions)
              else 0 end;
$$;
grant execute on public.nb_abonnes() to authenticated;

-- ============================================================
--  POLITIQUES RLS
-- ============================================================

-- push_subscriptions : chaque invité gère UNIQUEMENT ses abonnements.
-- (l'Edge Function lit tout via service_role, qui contourne la RLS)
drop policy if exists "push_self_all" on public.push_subscriptions;
create policy "push_self_all"
  on public.push_subscriptions for all
  to authenticated
  using (invite_id in (select id from public.invites where user_id = auth.uid()))
  with check (invite_id in (select id from public.invites where user_id = auth.uid()));

-- tables_plan : lecture tout invité authentifié ; écriture admin.
drop policy if exists "tables_select_auth" on public.tables_plan;
create policy "tables_select_auth"
  on public.tables_plan for select to authenticated using (true);

drop policy if exists "tables_write_admin" on public.tables_plan;
create policy "tables_write_admin"
  on public.tables_plan for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- parametres : lecture tout invité ; écriture admin.
drop policy if exists "param_select_auth" on public.parametres;
create policy "param_select_auth"
  on public.parametres for select to authenticated using (true);

drop policy if exists "param_write_admin" on public.parametres;
create policy "param_write_admin"
  on public.parametres for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- notifications_log : lecture + écriture admin (l'Edge Function écrit via service_role).
drop policy if exists "log_admin" on public.notifications_log;
create policy "log_admin"
  on public.notifications_log for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

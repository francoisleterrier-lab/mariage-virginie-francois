-- ============================================================
--  Mariage Virginie & François — v2.2
--  Placement libre : les invités réservent leur table eux-mêmes.
--  - comptage en ADULTES (enfants/ados = table à part, non comptée)
--  - tables « bloquées » (mariés, enfants) non réservables
--  - interrupteur admin « reservation_ouverte »
-- ============================================================

-- Table réservable ou non (mariés / enfants = true).
alter table public.tables_plan add column if not exists bloquee boolean not null default false;

-- Interrupteur d'ouverture des réservations (par défaut fermé).
insert into public.parametres (cle, valeur) values ('reservation_ouverte', 'false'::jsonb)
on conflict (cle) do nothing;

-- ------------------------------------------------------------
--  Tables + places prises (en adultes) — visible par tout invité.
--  N'expose aucune donnée individuelle, juste les compteurs.
-- ------------------------------------------------------------
create or replace function public.tables_dispo()
returns table (id uuid, nom text, forme text, capacite int, bloquee boolean, pos_x real, pos_y real, pris int)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.nom, t.forme, t.capacite, t.bloquee, t.pos_x, t.pos_y,
    coalesce((
      select sum(coalesce((i.rsvp->>'adultes')::int, 1))
      from public.invites i where i.table_id = t.id
    ), 0)::int as pris
  from public.tables_plan t
  order by t.nom;
$$;
grant execute on function public.tables_dispo() to authenticated;

-- ------------------------------------------------------------
--  Réserver / rejoindre une table (par l'invité lui-même).
--  Contrôles : réservations ouvertes, table non bloquée, places
--  suffisantes (en adultes). Compte les adultes du RSVP.
-- ------------------------------------------------------------
create or replace function public.reserver_table(p_table uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  moi uuid;
  mes_adultes int;
  pris int;
  cap int;
  est_bloquee boolean;
  ouverte boolean;
begin
  select (valeur = 'true'::jsonb) into ouverte from public.parametres where cle = 'reservation_ouverte';
  if not coalesce(ouverte, false) then
    raise exception 'Les réservations ne sont pas encore ouvertes.';
  end if;

  select id, coalesce((rsvp->>'adultes')::int, 1) into moi, mes_adultes
  from public.invites where user_id = auth.uid();
  if moi is null then raise exception 'Invité introuvable.'; end if;

  select capacite, bloquee into cap, est_bloquee from public.tables_plan where id = p_table;
  if cap is null then raise exception 'Table introuvable.'; end if;
  if est_bloquee then raise exception 'Cette table n''est pas réservable.'; end if;

  -- places déjà prises par les AUTRES invités (en adultes)
  select coalesce(sum(coalesce((i.rsvp->>'adultes')::int, 1)), 0) into pris
  from public.invites i where i.table_id = p_table and i.id <> moi;

  if pris + mes_adultes > cap then
    raise exception 'Il ne reste plus assez de places à cette table.';
  end if;

  perform set_config('app.bypass_guard', 'on', true);
  update public.invites set table_id = p_table where id = moi;
end;
$$;
grant execute on function public.reserver_table(uuid) to authenticated;

-- Se retirer de sa table.
create or replace function public.liberer_table()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  moi uuid;
begin
  select id into moi from public.invites where user_id = auth.uid();
  if moi is null then return; end if;
  perform set_config('app.bypass_guard', 'on', true);
  update public.invites set table_id = null where id = moi;
end;
$$;
grant execute on function public.liberer_table() to authenticated;

-- ------------------------------------------------------------
--  Voisins : visibles si le plan est publié OU si les
--  réservations sont ouvertes (l'invité a choisi lui-même).
-- ------------------------------------------------------------
create or replace function public.mes_voisins()
returns table (nom text)
language sql
stable
security definer
set search_path = public
as $$
  select i.nom
  from public.invites i
  where (
      (select valeur from public.parametres where cle = 'plan_visible') = 'true'::jsonb
      or (select valeur from public.parametres where cle = 'reservation_ouverte') = 'true'::jsonb
    )
    and i.table_id is not null
    and i.table_id = (select table_id from public.invites where user_id = auth.uid())
    and i.user_id <> auth.uid()
  order by i.nom;
$$;
grant execute on function public.mes_voisins() to authenticated;

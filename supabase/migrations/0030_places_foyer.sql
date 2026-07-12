-- ============================================================
--  Plan de table : compter les places par FOYER (même règle que le
--  tableau de bord), pour ne pas gonfler un couple ni oublier les
--  accompagnants.
--   - Couple (2 comptes liés) = au moins 2 places, comptées UNE fois.
--   - Personne seule = son nombre d'adultes (≥ 1).
--   - Chaque accompagnant adulte nommé (adultesNoms) = +1 place.
--   - Les enfants ne prennent pas de place (table enfants à part).
-- ============================================================

-- Places occupées par un compte donné (déjà assis ou candidat).
create or replace function public.place_prise(p_invite uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  with me as (select * from public.invites where id = p_invite),
  pa as (select p.* from public.invites p, me where me.couple_id = p.id and p.couple_id = me.id)
  select
    -- accompagnants adultes nommés (chacun = 1 place)
    coalesce((
      select count(*)
      from me,
        lateral jsonb_array_elements_text(
          case when jsonb_typeof(me.rsvp->'adultesNoms') = 'array' then me.rsvp->'adultesNoms' else '[]'::jsonb end
        ) as e(val)
      where length(trim(e.val)) > 0
    ), 0)::int
    +
    case
      -- personne seule : son nombre d'adultes (au moins 1)
      when not exists (select 1 from pa)
        then greatest(1, coalesce(((select rsvp from me)->>'adultes')::int, 1))
      -- couple : la base (au moins 2) est comptée UNE fois — par le membre
      -- « primaire » (plus petit id), ou par le membre assis si l'autre ne l'est pas.
      when (select id from me) < (select id from pa)
        or (select table_id from pa) is null
        then greatest(2,
               coalesce(((select rsvp from me)->>'adultes')::int, 1),
               coalesce(((select rsvp from pa)->>'adultes')::int, 1))
      else 0
    end
$$;

grant execute on function public.place_prise(uuid) to authenticated;

-- Tables avec places prises recalculées par foyer.
create or replace function public.tables_dispo()
returns table(id uuid, nom text, forme text, capacite integer, bloquee boolean, pos_x real, pos_y real, pris integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select t.id, t.nom, t.forme, t.capacite, t.bloquee, t.pos_x, t.pos_y,
    coalesce((
      select sum(public.place_prise(i.id))
      from public.invites i where i.table_id = t.id
    ), 0)::int as pris
  from public.tables_plan t
  order by t.nom;
$$;

-- Réservation : même règle de comptage.
create or replace function public.reserver_table(p_table uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  moi uuid;
  mes_places int;
  pris int;
  cap int;
  est_bloquee boolean;
  ouverte boolean;
begin
  select (valeur = 'true'::jsonb) into ouverte from public.parametres where cle = 'reservation_ouverte';
  if not coalesce(ouverte, false) then
    raise exception 'Les réservations ne sont pas encore ouvertes.';
  end if;

  select id into moi from public.invites where user_id = auth.uid();
  if moi is null then raise exception 'Invité introuvable.'; end if;

  select capacite, bloquee into cap, est_bloquee from public.tables_plan where id = p_table;
  if cap is null then raise exception 'Table introuvable.'; end if;
  if est_bloquee then raise exception 'Cette table n''est pas réservable.'; end if;

  -- places déjà prises par les AUTRES foyers à cette table
  select coalesce(sum(public.place_prise(i.id)), 0) into pris
  from public.invites i where i.table_id = p_table and i.id <> moi;

  mes_places := public.place_prise(moi);

  if pris + mes_places > cap then
    raise exception 'Il ne reste plus assez de places à cette table.';
  end if;

  perform set_config('app.bypass_guard', 'on', true);
  update public.invites set table_id = p_table where id = moi;
end;
$$;

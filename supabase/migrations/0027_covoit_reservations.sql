-- ============================================================
--  Réservation de places de covoiturage (site V&F).
--  Un invité peut réserver 1..N places dans un trajet « offre ».
--  L'insertion passe par une fonction atomique (verrou du trajet)
--  pour éviter la survente ; pas de policy insert directe.
-- ============================================================

create table if not exists public.covoiturage_reservations (
  id          uuid primary key default gen_random_uuid(),
  trajet_id   uuid not null references public.covoiturage(id) on delete cascade,
  invite_id   uuid not null references public.invites(id) on delete cascade,
  prenom      text default '',
  places      int not null default 1 check (places between 1 and 8),
  created_at  timestamptz not null default now(),
  unique (trajet_id, invite_id)
);
create index if not exists covoit_resa_trajet_idx on public.covoiturage_reservations(trajet_id);
alter table public.covoiturage_reservations enable row level security;

-- Lecture : tous les invités connectés (voir places restantes / passagers).
drop policy if exists covoit_resa_select on public.covoiturage_reservations;
create policy covoit_resa_select on public.covoiturage_reservations for select to authenticated using (true);

-- Suppression : admin ou propriétaire de la réservation.
drop policy if exists covoit_resa_delete on public.covoiturage_reservations;
create policy covoit_resa_delete on public.covoiturage_reservations for delete to authenticated
  using (public.is_admin() or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

-- Réservation atomique : verrouille le trajet, vérifie les places restantes,
-- puis upsert la réservation de l'appelant.
create or replace function public.vf_reserver_covoit(p_trajet uuid, p_places int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_invite uuid;
  v_nom    text;
  v_offert int;
  v_pris   int;
begin
  if v_uid is null then raise exception 'non authentifie'; end if;
  select id, nom into v_invite, v_nom from public.invites where user_id = v_uid limit 1;
  if v_invite is null then raise exception 'invite introuvable'; end if;
  if p_places is null or p_places < 1 then p_places := 1; end if;

  -- Verrou du trajet pour sérialiser les réservations concurrentes.
  select places into v_offert from public.covoiturage where id = p_trajet and type = 'offre' for update;
  if v_offert is null then raise exception 'trajet introuvable'; end if;

  -- Places déjà prises par les AUTRES invités (la réservation de l'appelant est remplacée).
  select coalesce(sum(places), 0) into v_pris
    from public.covoiturage_reservations
    where trajet_id = p_trajet and invite_id <> v_invite;

  if p_places > (v_offert - v_pris) then raise exception 'complet'; end if;

  insert into public.covoiturage_reservations (trajet_id, invite_id, prenom, places)
    values (p_trajet, v_invite, split_part(coalesce(v_nom, ''), ' ', 1), p_places)
  on conflict (trajet_id, invite_id)
    do update set places = excluded.places, created_at = now();

  return jsonb_build_object('restant', v_offert - v_pris - p_places);
end;
$$;

grant execute on function public.vf_reserver_covoit(uuid, int) to authenticated;

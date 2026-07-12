-- ============================================================
--  Réservation covoiturage : enregistrer le NOM COMPLET (nom + prénom)
--  de l'invité qui réserve, au lieu du seul prénom.
-- ============================================================

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

  select places into v_offert from public.covoiturage where id = p_trajet and type = 'offre' for update;
  if v_offert is null then raise exception 'trajet introuvable'; end if;

  select coalesce(sum(places), 0) into v_pris
    from public.covoiturage_reservations
    where trajet_id = p_trajet and invite_id <> v_invite;

  if p_places > (v_offert - v_pris) then raise exception 'complet'; end if;

  -- On stocke le nom complet (nom + prénom) tel qu'enregistré sur l'invitation.
  insert into public.covoiturage_reservations (trajet_id, invite_id, prenom, places)
    values (p_trajet, v_invite, trim(coalesce(v_nom, '')), p_places)
  on conflict (trajet_id, invite_id)
    do update set places = excluded.places, prenom = excluded.prenom, created_at = now();

  return jsonb_build_object('restant', v_offert - v_pris - p_places);
end;
$$;

grant execute on function public.vf_reserver_covoit(uuid, int) to authenticated;

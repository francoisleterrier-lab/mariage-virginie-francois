-- ============================================================
--  Mariage Virginie & François — v2.8
--  Permettre à l'admin d'ajouter manuellement un conjoint NON inscrit
--  (sans compte) et de le lier en couple à un invité existant.
-- ============================================================

-- Un conjoint manuel n'a pas de compte auth → user_id devient nullable.
alter table public.invites alter column user_id drop not null;

-- Crée un conjoint manuel (nom seul), le lie au couple de l'invité donné,
-- et renvoie son id. Admin uniquement.
create or replace function public.admin_creer_conjoint(p_invite uuid, p_nom text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  if p_nom is null or length(trim(p_nom)) = 0 then raise exception 'Nom requis.'; end if;
  if not exists (select 1 from public.invites where id = p_invite) then
    raise exception 'Invité introuvable.';
  end if;
  if exists (select 1 from public.invites where id = p_invite and couple_id is not null) then
    raise exception 'Cet invité est déjà en couple.';
  end if;

  perform set_config('app.bypass_guard', 'on', true);
  insert into public.invites (user_id, nom, email, couple_id)
    values (null, trim(p_nom), 'manuel+' || gen_random_uuid() || '@vf2028.local', p_invite)
    returning id into v_id;
  update public.invites set couple_id = v_id where id = p_invite;
  return v_id;
end;
$$;
grant execute on function public.admin_creer_conjoint(uuid, text) to authenticated;

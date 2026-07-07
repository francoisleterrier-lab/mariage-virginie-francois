-- ============================================================
--  Mariage Virginie & François — v2.7
--  Suivi d'engagement admin : qui est abonné aux notifications ?
--  (RSVP / quiz / bande-son se lisent déjà côté admin via leurs tables.)
-- ============================================================

-- Ids des invités ayant au moins un abonnement push (admin uniquement).
create or replace function public.abonnes_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct invite_id from public.push_subscriptions
  where public.is_admin();
$$;
grant execute on function public.abonnes_ids() to authenticated;

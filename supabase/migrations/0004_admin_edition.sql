-- ============================================================
--  Mariage Virginie & François — v2.3
--  Édition complète des invités par l'admin
--  (les prénoms des enfants/ados sont stockés dans invites.rsvp jsonb,
--   aucune colonne supplémentaire nécessaire)
-- ============================================================

-- L'admin peut modifier n'importe quelle ligne (le trigger invites_guard
-- autorise déjà is_admin() à changer role / couple_id / table_id).
drop policy if exists "invite_update_admin" on public.invites;
create policy "invite_update_admin"
  on public.invites for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- L'admin peut supprimer un invité.
drop policy if exists "invite_delete_admin" on public.invites;
create policy "invite_delete_admin"
  on public.invites for delete
  to authenticated
  using (public.is_admin());

-- couple_id : on delete set null, pour pouvoir supprimer un invité lié
-- sans être bloqué par la contrainte de clé étrangère.
alter table public.invites drop constraint if exists invites_couple_id_fkey;
alter table public.invites
  add constraint invites_couple_id_fkey
  foreign key (couple_id) references public.invites(id) on delete set null;

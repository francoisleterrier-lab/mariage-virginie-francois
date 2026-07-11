-- ============================================================
--  Défis photo : le couple définit une liste de défis (config), les invités
--  les relèvent en publiant une photo. Ici on ne stocke que les PHOTOS des
--  défis relevés (les défis eux-mêmes sont en config : sections/parametres).
--  Les photos réutilisent les buckets existants (fpv-photos / vf-photos)
--  sous « defis/ ». defi_idx = position du défi dans la liste.
-- ============================================================

-- ---------- Produit ----------
create table if not exists public.fpv_defis_photos (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.fpv_invitations(id) on delete cascade,
  defi_idx       int not null,
  chemin         text not null,
  prenom         text default '',
  created_at     timestamptz not null default now()
);
create index if not exists fpv_defis_photos_idx on public.fpv_defis_photos(invitation_id, defi_idx);
alter table public.fpv_defis_photos enable row level security;

drop policy if exists fpv_defis_insert on public.fpv_defis_photos;
create policy fpv_defis_insert on public.fpv_defis_photos for insert
  with check (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true));

drop policy if exists fpv_defis_select on public.fpv_defis_photos;
create policy fpv_defis_select on public.fpv_defis_photos for select
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true));

drop policy if exists fpv_defis_delete on public.fpv_defis_photos;
create policy fpv_defis_delete on public.fpv_defis_photos for delete
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid()));

-- ---------- Site V&F ----------
create table if not exists public.defis_photos (
  id          uuid primary key default gen_random_uuid(),
  invite_id   uuid not null references public.invites(id) on delete cascade,
  defi_idx    int not null,
  chemin      text not null,
  prenom      text default '',
  created_at  timestamptz not null default now()
);
create index if not exists defis_photos_idx on public.defis_photos(defi_idx);
alter table public.defis_photos enable row level security;

drop policy if exists defis_ph_insert on public.defis_photos;
create policy defis_ph_insert on public.defis_photos for insert to authenticated
  with check (public.is_admin() or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

drop policy if exists defis_ph_select on public.defis_photos;
create policy defis_ph_select on public.defis_photos for select to authenticated using (true);

drop policy if exists defis_ph_delete on public.defis_photos;
create policy defis_ph_delete on public.defis_photos for delete to authenticated
  using (public.is_admin() or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

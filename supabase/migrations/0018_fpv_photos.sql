-- ============================================================
--  Faire-part Vivant — album photo des invités (multi-clients)
--  Chaque invité ajoute ses photos → galerie live de l'invitation.
-- ============================================================

-- Bucket de stockage public (lecture publique ; upload autorisé, voir policies).
insert into storage.buckets (id, name, public)
  values ('fpv-photos', 'fpv-photos', true)
  on conflict (id) do nothing;

drop policy if exists "fpv_photos_obj_insert" on storage.objects;
create policy "fpv_photos_obj_insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'fpv-photos');

drop policy if exists "fpv_photos_obj_read" on storage.objects;
create policy "fpv_photos_obj_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'fpv-photos');

-- Métadonnées des photos (rattachées à l'invitation).
create table if not exists public.fpv_photos (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.fpv_invitations(id) on delete cascade,
  chemin         text not null,
  prenom         text default '',
  created_at     timestamptz not null default now()
);
create index if not exists fpv_photos_inv_idx on public.fpv_photos(invitation_id);
alter table public.fpv_photos enable row level security;

drop policy if exists fpv_photos_insert on public.fpv_photos;
create policy fpv_photos_insert on public.fpv_photos for insert
  with check (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true));

drop policy if exists fpv_photos_select on public.fpv_photos;
create policy fpv_photos_select on public.fpv_photos for select
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true));

drop policy if exists fpv_photos_delete on public.fpv_photos;
create policy fpv_photos_delete on public.fpv_photos for delete
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid()));

-- ============================================================
--  Mariage Virginie & François — Album photo des invités (site perso)
--  Les invités connectés ajoutent leurs photos → mur commun.
-- ============================================================
insert into storage.buckets (id, name, public)
  values ('vf-photos', 'vf-photos', true)
  on conflict (id) do nothing;

drop policy if exists "vf_photos_obj_insert" on storage.objects;
create policy "vf_photos_obj_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'vf-photos');

drop policy if exists "vf_photos_obj_read" on storage.objects;
create policy "vf_photos_obj_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'vf-photos');

create table if not exists public.photos_invites (
  id          uuid primary key default gen_random_uuid(),
  invite_id   uuid not null references public.invites(id) on delete cascade,
  chemin      text not null,
  prenom      text default '',
  created_at  timestamptz not null default now()
);
create index if not exists photos_invites_idx on public.photos_invites(created_at desc);
alter table public.photos_invites enable row level security;

-- Ajout : par l'invité pour lui-même (ou l'admin).
drop policy if exists photos_inv_insert on public.photos_invites;
create policy photos_inv_insert on public.photos_invites for insert to authenticated
  with check (
    public.is_admin()
    or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid())
  );

-- Lecture : tous les invités connectés voient le mur.
drop policy if exists photos_inv_select on public.photos_invites;
create policy photos_inv_select on public.photos_invites for select to authenticated using (true);

-- Suppression : sa propre photo, ou l'admin.
drop policy if exists photos_inv_delete on public.photos_invites;
create policy photos_inv_delete on public.photos_invites for delete to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid())
  );

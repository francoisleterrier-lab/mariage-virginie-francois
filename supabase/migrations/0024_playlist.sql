-- ============================================================
--  Playlist collaborative : les invités proposent des chansons ; le couple
--  (et son DJ) récupère la liste. Produit : fpv_playlist. Site V&F : playlist.
-- ============================================================

-- ---------- Produit ----------
create table if not exists public.fpv_playlist (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.fpv_invitations(id) on delete cascade,
  titre          text not null,
  artiste        text default '',
  prenom         text default '',
  created_at     timestamptz not null default now()
);
create index if not exists fpv_playlist_inv_idx on public.fpv_playlist(invitation_id);
alter table public.fpv_playlist enable row level security;

drop policy if exists fpv_playlist_insert on public.fpv_playlist;
create policy fpv_playlist_insert on public.fpv_playlist for insert
  with check (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true));

drop policy if exists fpv_playlist_select on public.fpv_playlist;
create policy fpv_playlist_select on public.fpv_playlist for select
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true));

drop policy if exists fpv_playlist_delete on public.fpv_playlist;
create policy fpv_playlist_delete on public.fpv_playlist for delete
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid()));

-- ---------- Site V&F ----------
create table if not exists public.playlist (
  id          uuid primary key default gen_random_uuid(),
  invite_id   uuid not null references public.invites(id) on delete cascade,
  titre       text not null,
  artiste     text default '',
  prenom      text default '',
  created_at  timestamptz not null default now()
);
create index if not exists playlist_idx on public.playlist(created_at desc);
alter table public.playlist enable row level security;

drop policy if exists playlist_insert on public.playlist;
create policy playlist_insert on public.playlist for insert to authenticated
  with check (public.is_admin() or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

drop policy if exists playlist_select on public.playlist;
create policy playlist_select on public.playlist for select to authenticated using (true);

drop policy if exists playlist_delete on public.playlist;
create policy playlist_delete on public.playlist for delete to authenticated
  using (public.is_admin() or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

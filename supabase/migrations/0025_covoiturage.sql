-- ============================================================
--  Covoiturage : les invités proposent ou cherchent une place.
--  Produit : fpv_covoit. Site V&F : covoiturage.
-- ============================================================

-- ---------- Produit ----------
create table if not exists public.fpv_covoit (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.fpv_invitations(id) on delete cascade,
  type           text not null default 'offre',   -- 'offre' | 'recherche'
  ville          text default '',
  quand          text default '',
  places         int default 1,
  prenom         text default '',
  contact        text default '',
  created_at     timestamptz not null default now()
);
create index if not exists fpv_covoit_inv_idx on public.fpv_covoit(invitation_id);
alter table public.fpv_covoit enable row level security;

drop policy if exists fpv_covoit_insert on public.fpv_covoit;
create policy fpv_covoit_insert on public.fpv_covoit for insert
  with check (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true));

drop policy if exists fpv_covoit_select on public.fpv_covoit;
create policy fpv_covoit_select on public.fpv_covoit for select
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true));

drop policy if exists fpv_covoit_delete on public.fpv_covoit;
create policy fpv_covoit_delete on public.fpv_covoit for delete
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid()));

-- ---------- Site V&F ----------
create table if not exists public.covoiturage (
  id          uuid primary key default gen_random_uuid(),
  invite_id   uuid not null references public.invites(id) on delete cascade,
  type        text not null default 'offre',
  ville       text default '',
  quand       text default '',
  places      int default 1,
  prenom      text default '',
  contact     text default '',
  created_at  timestamptz not null default now()
);
create index if not exists covoiturage_idx on public.covoiturage(created_at desc);
alter table public.covoiturage enable row level security;

drop policy if exists covoit_insert on public.covoiturage;
create policy covoit_insert on public.covoiturage for insert to authenticated
  with check (public.is_admin() or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

drop policy if exists covoit_select on public.covoiturage;
create policy covoit_select on public.covoiturage for select to authenticated using (true);

drop policy if exists covoit_delete on public.covoiturage;
create policy covoit_delete on public.covoiturage for delete to authenticated
  using (public.is_admin() or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

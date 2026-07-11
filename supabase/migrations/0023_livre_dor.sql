-- ============================================================
--  Livre d'or vidéo : chaque invité laisse un message filmé (ou écrit)
--  pour les mariés. Les vidéos réutilisent les buckets photo existants
--  (fpv-photos / vf-photos), sous un préfixe « livredor/ ».
--
--  Produit : table fpv_livredor (par invitation).
--  Site V&F : table livre_dor.
-- ============================================================

-- ---------- Produit ----------
create table if not exists public.fpv_livredor (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.fpv_invitations(id) on delete cascade,
  prenom         text default '',
  message        text default '',
  chemin         text,               -- chemin de la vidéo (bucket fpv-photos) ; null = message écrit
  created_at     timestamptz not null default now()
);
create index if not exists fpv_livredor_inv_idx on public.fpv_livredor(invitation_id);
alter table public.fpv_livredor enable row level security;

drop policy if exists fpv_livredor_insert on public.fpv_livredor;
create policy fpv_livredor_insert on public.fpv_livredor for insert
  with check (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true));

drop policy if exists fpv_livredor_select on public.fpv_livredor;
create policy fpv_livredor_select on public.fpv_livredor for select
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true));

drop policy if exists fpv_livredor_delete on public.fpv_livredor;
create policy fpv_livredor_delete on public.fpv_livredor for delete
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid()));

-- ---------- Site V&F ----------
create table if not exists public.livre_dor (
  id          uuid primary key default gen_random_uuid(),
  invite_id   uuid not null references public.invites(id) on delete cascade,
  prenom      text default '',
  message     text default '',
  chemin      text,
  created_at  timestamptz not null default now()
);
create index if not exists livre_dor_idx on public.livre_dor(created_at desc);
alter table public.livre_dor enable row level security;

drop policy if exists livre_dor_insert on public.livre_dor;
create policy livre_dor_insert on public.livre_dor for insert to authenticated
  with check (
    public.is_admin()
    or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid())
  );

drop policy if exists livre_dor_select on public.livre_dor;
create policy livre_dor_select on public.livre_dor for select to authenticated using (true);

drop policy if exists livre_dor_delete on public.livre_dor;
create policy livre_dor_delete on public.livre_dor for delete to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid())
  );

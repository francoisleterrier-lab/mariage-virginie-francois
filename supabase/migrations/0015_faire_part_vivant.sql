-- ============================================================
--  Faire-part Vivant — fondation multi-clients (produit SaaS)
--  Tables NEUVES, préfixées fpv_ : aucune interaction avec les tables
--  du mariage V&F existant. Chaque invitation = un « locataire ».
-- ============================================================

create table if not exists public.fpv_invitations (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  slug         text not null unique,
  couple       text not null default '',
  date_event   date,
  lieu_teaser  text default '',
  theme        text not null default 'canopee',   -- canopee | sceau | brume
  intro        text default '',
  sections     jsonb not null default '{}'::jsonb, -- toggles + contenus
  rsvp_ouvert  boolean not null default true,
  publie       boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.fpv_rsvps (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.fpv_invitations(id) on delete cascade,
  nom            text not null default '',
  email          text default '',
  presence       text default '',
  adultes        int default 1,
  enfants        int default 0,
  message        text default '',
  created_at     timestamptz not null default now()
);
create index if not exists fpv_rsvps_inv_idx on public.fpv_rsvps(invitation_id);

alter table public.fpv_invitations enable row level security;
alter table public.fpv_rsvps enable row level security;

-- Invitations : lisibles si publiées (pour le rendu public) ou si on en est
-- le propriétaire ; modifiables uniquement par le propriétaire.
drop policy if exists fpv_inv_select on public.fpv_invitations;
create policy fpv_inv_select on public.fpv_invitations
  for select using (publie = true or owner_id = auth.uid());

drop policy if exists fpv_inv_insert on public.fpv_invitations;
create policy fpv_inv_insert on public.fpv_invitations
  for insert with check (owner_id = auth.uid());

drop policy if exists fpv_inv_update on public.fpv_invitations;
create policy fpv_inv_update on public.fpv_invitations
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists fpv_inv_delete on public.fpv_invitations;
create policy fpv_inv_delete on public.fpv_invitations
  for delete using (owner_id = auth.uid());

-- RSVP : n'importe quel invité peut répondre à une invitation PUBLIÉE ;
-- seul le propriétaire de l'invitation lit les réponses.
drop policy if exists fpv_rsvp_insert on public.fpv_rsvps;
create policy fpv_rsvp_insert on public.fpv_rsvps
  for insert with check (
    exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true)
  );

drop policy if exists fpv_rsvp_select on public.fpv_rsvps;
create policy fpv_rsvp_select on public.fpv_rsvps
  for select using (
    exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid())
  );

drop policy if exists fpv_rsvp_delete on public.fpv_rsvps;
create policy fpv_rsvp_delete on public.fpv_rsvps
  for delete using (
    exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid())
  );

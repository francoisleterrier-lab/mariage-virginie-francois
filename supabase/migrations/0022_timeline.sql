-- ============================================================
--  « La timeline qui se dévoile » : des moments datés dont le CONTENU
--  n'apparaît qu'à sa date de révélation (le titre, lui, sert de teaser).
--  Le masquage du contenu non révélé est fait côté serveur (fonctions
--  security definer) pour qu'un invité curieux ne puisse pas lire en avance.
--
--  Produit « Faire-part Vivant » : table fpv_moments (par invitation).
--  Site V&F : table moments (mono-locataire, gérée par l'admin).
-- ============================================================

-- ---------- Produit ----------
create table if not exists public.fpv_moments (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.fpv_invitations(id) on delete cascade,
  titre          text not null,
  contenu        text default '',
  reveal_at      timestamptz not null,
  ordre          int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists fpv_moments_inv_idx on public.fpv_moments(invitation_id, ordre);
alter table public.fpv_moments enable row level security;

-- Le propriétaire gère (et lit en clair) ses moments. Les invités passent par la RPC.
drop policy if exists fpv_moments_owner on public.fpv_moments;
create policy fpv_moments_owner on public.fpv_moments for all
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid()))
  with check (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid()));

create or replace function public.fpv_timeline(p_slug text)
returns table (id uuid, titre text, contenu text, reveal_at timestamptz, revele boolean, ordre int)
language sql stable security definer set search_path = public
as $$
  select m.id, m.titre,
         case when m.reveal_at <= now() then m.contenu else '' end as contenu,
         m.reveal_at,
         (m.reveal_at <= now()) as revele,
         m.ordre
  from public.fpv_moments m
  join public.fpv_invitations i on i.id = m.invitation_id
  where i.slug = p_slug and i.publie = true
  order by m.ordre, m.reveal_at;
$$;
grant execute on function public.fpv_timeline(text) to anon, authenticated;

-- ---------- Site V&F ----------
create table if not exists public.moments (
  id          uuid primary key default gen_random_uuid(),
  titre       text not null,
  contenu     text default '',
  reveal_at   timestamptz not null,
  ordre       int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists moments_ordre_idx on public.moments(ordre);
alter table public.moments enable row level security;

-- Écriture + lecture en clair : admin uniquement. Les invités passent par la RPC.
drop policy if exists moments_admin on public.moments;
create policy moments_admin on public.moments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.vf_timeline()
returns table (id uuid, titre text, contenu text, reveal_at timestamptz, revele boolean, ordre int)
language sql stable security definer set search_path = public
as $$
  select m.id, m.titre,
         case when m.reveal_at <= now() then m.contenu else '' end as contenu,
         m.reveal_at,
         (m.reveal_at <= now()) as revele,
         m.ordre
  from public.moments m
  order by m.ordre, m.reveal_at;
$$;
grant execute on function public.vf_timeline() to authenticated;

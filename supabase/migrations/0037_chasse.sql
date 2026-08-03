-- ============================================================
--  « La Chasse au domaine » — geocaching narratif du jour J.
--  Le téléphone devient un radar chaud/froid vers des balises
--  invisibles semées dans le parc ; sur place, une vidéo-souvenir
--  des mariés se révèle. Découverte partagée en temps réel.
-- ============================================================

create table if not exists public.chasse_balises (
  id            uuid primary key default gen_random_uuid(),
  titre         text not null,
  indice        text,
  lat           double precision not null,
  lng           double precision not null,
  rayon_m       integer not null default 20,
  media_chemin  text,                              -- vidéo/photo dans vf-photos (chasse/)
  ordre         integer not null default 0,
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);
alter table public.chasse_balises enable row level security;

drop policy if exists chasse_bal_select on public.chasse_balises;
create policy chasse_bal_select on public.chasse_balises for select to authenticated using (true);
drop policy if exists chasse_bal_write on public.chasse_balises;
create policy chasse_bal_write on public.chasse_balises for all to authenticated
  using (exists (select 1 from public.invites i where i.user_id = auth.uid() and i.role = 'admin'))
  with check (exists (select 1 from public.invites i where i.user_id = auth.uid() and i.role = 'admin'));

create table if not exists public.chasse_decouvertes (
  id          uuid primary key default gen_random_uuid(),
  balise_id   uuid not null references public.chasse_balises(id) on delete cascade,
  invite_id   uuid not null references public.invites(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (balise_id, invite_id)
);
create index if not exists chasse_dec_idx on public.chasse_decouvertes(balise_id);
alter table public.chasse_decouvertes enable row level security;

drop policy if exists chasse_dec_select on public.chasse_decouvertes;
create policy chasse_dec_select on public.chasse_decouvertes for select to authenticated using (true);
drop policy if exists chasse_dec_insert on public.chasse_decouvertes;
create policy chasse_dec_insert on public.chasse_decouvertes for insert to authenticated
  with check (exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));
drop policy if exists chasse_dec_delete on public.chasse_decouvertes;
create policy chasse_dec_delete on public.chasse_decouvertes for delete to authenticated
  using (exists (select 1 from public.invites i where i.user_id = auth.uid() and i.role = 'admin')
      or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

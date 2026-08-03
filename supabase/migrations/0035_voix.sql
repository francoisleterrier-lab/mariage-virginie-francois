-- ============================================================
--  « Le Vitrail Sonore » — la voix des invités devient une œuvre.
--  Chaque invité enregistre ~10 s ; l'app en dérive un « pétale »
--  (couleur/forme) à partir de l'empreinte fréquentielle. Tous les
--  pétales composent un vitrail collectif ; toucher un pétale rejoue
--  la vraie voix. Audio stocké dans le bucket vf-photos (préfixe voix/).
-- ============================================================

create table if not exists public.voix (
  id          uuid primary key default gen_random_uuid(),
  invite_id   uuid not null references public.invites(id) on delete cascade,
  prenom      text,
  chemin      text not null,                       -- vf-photos/voix/...
  params      jsonb not null default '{}'::jsonb,  -- { hue, petals, sat, seed }
  created_at  timestamptz not null default now()
);
create index if not exists voix_idx on public.voix(created_at desc);
alter table public.voix enable row level security;

-- Lecture : tous les invités connectés.
drop policy if exists voix_select on public.voix;
create policy voix_select on public.voix for select to authenticated using (true);

-- Ajout : pour soi-même.
drop policy if exists voix_insert on public.voix;
create policy voix_insert on public.voix for insert to authenticated
  with check (exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

-- Retrait : admin ou propriétaire.
drop policy if exists voix_delete on public.voix;
create policy voix_delete on public.voix for delete to authenticated
  using (exists (select 1 from public.invites i where i.user_id = auth.uid() and i.role = 'admin')
      or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

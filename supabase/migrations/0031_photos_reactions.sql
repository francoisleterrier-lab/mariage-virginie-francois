-- ============================================================
--  Réactions emoji sur les photos de l'album des invités (site V&F).
--  Un invité peut poser plusieurs emojis différents sur une photo,
--  mais un seul de chaque (toggle).
-- ============================================================

create table if not exists public.photos_reactions (
  id          uuid primary key default gen_random_uuid(),
  photo_id    uuid not null references public.photos_invites(id) on delete cascade,
  invite_id   uuid not null references public.invites(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (photo_id, invite_id, emoji)
);
create index if not exists photos_reactions_photo_idx on public.photos_reactions(photo_id);
alter table public.photos_reactions enable row level security;

-- Lecture : tous les invités connectés.
drop policy if exists photos_reac_select on public.photos_reactions;
create policy photos_reac_select on public.photos_reactions for select to authenticated using (true);

-- Ajout : seulement pour soi-même.
drop policy if exists photos_reac_insert on public.photos_reactions;
create policy photos_reac_insert on public.photos_reactions for insert to authenticated
  with check (exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

-- Retrait : admin ou propriétaire de la réaction.
drop policy if exists photos_reac_delete on public.photos_reactions;
create policy photos_reac_delete on public.photos_reactions for delete to authenticated
  using (public.is_admin() or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

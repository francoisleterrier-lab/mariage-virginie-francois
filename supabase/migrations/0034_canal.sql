-- ============================================================
--  « Le Canal » — le faire-part qui ne meurt jamais.
--  Après le mariage, le couple publie des annonces (naissance,
--  déménagement, anniversaire…) qui réveillent l'app des invités
--  (push). Chaque annonce a ses réactions emoji + un mur de mots.
-- ============================================================

create table if not exists public.annonces (
  id            uuid primary key default gen_random_uuid(),
  type          text not null default 'autre',        -- naissance | demenagement | voyage | anniversaire | autre
  titre         text not null,
  message       text not null,
  media_chemin  text,                                  -- optionnel : photo dans le bucket vf-photos
  publiee       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists annonces_pub_idx on public.annonces(publiee, created_at desc);
alter table public.annonces enable row level security;

-- Lecture : les invités connectés voient les annonces publiées ; l'admin voit tout.
drop policy if exists annonces_select on public.annonces;
create policy annonces_select on public.annonces for select to authenticated
  using (publiee = true or public.is_admin());

-- Écriture : admin uniquement.
drop policy if exists annonces_insert on public.annonces;
create policy annonces_insert on public.annonces for insert to authenticated
  with check (public.is_admin());
drop policy if exists annonces_update on public.annonces;
create policy annonces_update on public.annonces for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists annonces_delete on public.annonces;
create policy annonces_delete on public.annonces for delete to authenticated
  using (public.is_admin());

-- ---------- Réactions emoji (motif identique aux photos) ----------
create table if not exists public.annonce_reactions (
  id          uuid primary key default gen_random_uuid(),
  annonce_id  uuid not null references public.annonces(id) on delete cascade,
  invite_id   uuid not null references public.invites(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (annonce_id, invite_id, emoji)
);
create index if not exists annonce_reac_idx on public.annonce_reactions(annonce_id);
alter table public.annonce_reactions enable row level security;

drop policy if exists annonce_reac_select on public.annonce_reactions;
create policy annonce_reac_select on public.annonce_reactions for select to authenticated using (true);
drop policy if exists annonce_reac_insert on public.annonce_reactions;
create policy annonce_reac_insert on public.annonce_reactions for insert to authenticated
  with check (exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));
drop policy if exists annonce_reac_delete on public.annonce_reactions;
create policy annonce_reac_delete on public.annonce_reactions for delete to authenticated
  using (public.is_admin() or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

-- ---------- Mur de mots (félicitations) ----------
create table if not exists public.annonce_messages (
  id          uuid primary key default gen_random_uuid(),
  annonce_id  uuid not null references public.annonces(id) on delete cascade,
  invite_id   uuid not null references public.invites(id) on delete cascade,
  prenom      text,
  texte       text not null,
  created_at  timestamptz not null default now()
);
create index if not exists annonce_msg_idx on public.annonce_messages(annonce_id, created_at);
alter table public.annonce_messages enable row level security;

drop policy if exists annonce_msg_select on public.annonce_messages;
create policy annonce_msg_select on public.annonce_messages for select to authenticated using (true);
drop policy if exists annonce_msg_insert on public.annonce_messages;
create policy annonce_msg_insert on public.annonce_messages for insert to authenticated
  with check (exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));
drop policy if exists annonce_msg_delete on public.annonce_messages;
create policy annonce_msg_delete on public.annonce_messages for delete to authenticated
  using (public.is_admin() or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

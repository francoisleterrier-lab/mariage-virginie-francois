-- ============================================================
--  Mariage Virginie & François — v2.4
--  Pages personnalisées par foyer (« Bonjour Tante Monique »)
--  Adapté au schéma réel : pas de table households — le « foyer » est
--  l'identifiant canonique d'un invité (couple → plus petit des deux id ;
--  sinon l'invité seul). La table pages_foyer est clé sur cet id.
-- ============================================================

-- Foyer canonique de l'utilisateur courant (security definer : lit invites).
create or replace function public.mon_foyer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when i.couple_id is not null then least(i.id, i.couple_id) else i.id end
  from public.invites i
  where i.user_id = auth.uid();
$$;
grant execute on function public.mon_foyer_id() to authenticated;

create table if not exists public.pages_foyer (
  foyer_id          uuid primary key references public.invites(id) on delete cascade,
  greeting_name     text not null,
  message           text,
  photo_path        text,
  photo_caption     text,
  signature_variant text not null default 'vf',   -- 'vf' | 'vfe'
  published         boolean not null default false,
  updated_at        timestamptz not null default now()
);
create index if not exists idx_pages_foyer_published on public.pages_foyer (published);

alter table public.pages_foyer enable row level security;

-- Lecture invité : uniquement SA page, et seulement si publiée.
drop policy if exists "pages_read_own" on public.pages_foyer;
create policy "pages_read_own"
  on public.pages_foyer for select to authenticated
  using (published = true and foyer_id = public.mon_foyer_id());

-- Écriture : admins uniquement (lecture admin incluse pour l'éditeur).
drop policy if exists "pages_write_admin" on public.pages_foyer;
create policy "pages_write_admin"
  on public.pages_foyer for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
--  Stockage : bucket privé des photos souvenir.
--  Chemin : {foyer_id}/{fichier}. Lecture invité limitée à son foyer,
--  écriture réservée à l'admin. URL signée générée à la demande.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('household-photos', 'household-photos', false)
on conflict (id) do nothing;

drop policy if exists "hp_read_own_or_admin" on storage.objects;
create policy "hp_read_own_or_admin"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'household-photos'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.mon_foyer_id()::text
    )
  );

drop policy if exists "hp_write_admin" on storage.objects;
create policy "hp_write_admin"
  on storage.objects for all to authenticated
  using (bucket_id = 'household-photos' and public.is_admin())
  with check (bucket_id = 'household-photos' and public.is_admin());

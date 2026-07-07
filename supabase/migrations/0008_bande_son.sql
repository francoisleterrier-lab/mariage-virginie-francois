-- ============================================================
--  Mariage Virginie & François — v2.5
--  « La bande-son fantôme » : playlist collaborative à souvenirs.
--  Adapté au schéma réel : guest = invites ; réglages dans parametres ;
--  admin via is_admin(). Le statut de modération n'est JAMAIS exposé à
--  l'invité (pas de policy select sur la table pour lui → lecture via vue).
-- ============================================================

create table if not exists public.chansons (
  id             uuid primary key default gen_random_uuid(),
  invite_id      uuid not null references public.invites(id) on delete cascade,
  titre          text not null check (char_length(titre) between 1 and 120),
  artiste        text not null check (char_length(artiste) between 1 and 120),
  souvenir       text not null check (char_length(souvenir) between 10 and 500),
  lien           text,
  partage_jour_j boolean not null default true,
  partage_apres  boolean not null default true,
  statut         text not null default 'recue' check (statut in ('recue','approuvee','refusee')),
  note_admin     text,
  joue_a         timestamptz,
  push_a         timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_chansons_statut on public.chansons (statut);
create index if not exists idx_chansons_invite on public.chansons (invite_id);

insert into public.parametres (cle, valeur) values
  ('bandeson_a_venir', 'true'::jsonb),   -- true = teaser « bientôt », pas encore de formulaire
  ('bandeson_ouverte', 'true'::jsonb),
  ('bandeson_max', '2'::jsonb)
on conflict (cle) do nothing;

alter table public.chansons enable row level security;

-- INSERT invité : pour lui-même, si ouvert, dans la limite du quota.
drop policy if exists "chansons_insert_own" on public.chansons;
create policy "chansons_insert_own"
  on public.chansons for insert to authenticated
  with check (
    invite_id = (select id from public.invites where user_id = auth.uid())
    and (select valeur = 'true'::jsonb from public.parametres where cle = 'bandeson_ouverte')
    and (
      select count(*) from public.chansons s
      where s.invite_id = (select id from public.invites where user_id = auth.uid())
    ) < ((select valeur from public.parametres where cle = 'bandeson_max')::text)::int
  );

-- UPDATE / DELETE invité : sa proposition, tant que non jouée.
drop policy if exists "chansons_update_own" on public.chansons;
create policy "chansons_update_own"
  on public.chansons for update to authenticated
  using (invite_id = (select id from public.invites where user_id = auth.uid()) and joue_a is null)
  with check (invite_id = (select id from public.invites where user_id = auth.uid()));

drop policy if exists "chansons_delete_own" on public.chansons;
create policy "chansons_delete_own"
  on public.chansons for delete to authenticated
  using (invite_id = (select id from public.invites where user_id = auth.uid()) and joue_a is null);

-- ADMIN : tout (inclut le select, jamais accordé à l'invité sur la table).
drop policy if exists "chansons_admin_all" on public.chansons;
create policy "chansons_admin_all"
  on public.chansons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
--  Vue « mes chansons » : colonnes SÛRES uniquement (jamais statut /
--  note_admin). L'invité ne lit QUE via cette vue → « Reçue »/« Jouée ».
-- ============================================================
drop view if exists public.mes_chansons;
create view public.mes_chansons as
  select id, titre, artiste, souvenir, lien, partage_jour_j, partage_apres,
         (joue_a is not null) as joue, created_at
  from public.chansons
  where invite_id = (select id from public.invites where user_id = auth.uid());
grant select on public.mes_chansons to authenticated;

-- ============================================================
--  Mur de la bande-son (après le mariage uniquement).
--  Retourne les titres approuvés ; le souvenir n'est exposé que si joué
--  ET partage_apres. Rien avant le 28/05/2028 (isolation garantie même
--  par requête directe).
-- ============================================================
create or replace function public.mur_bande_son()
returns table (
  titre text, artiste text, prenom text, lien text, joue boolean, joue_a timestamptz, souvenir text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.titre, c.artiste,
    split_part(i.nom, ' ', 1) as prenom,
    c.lien,
    (c.joue_a is not null) as joue,
    c.joue_a,
    case when c.joue_a is not null and c.partage_apres then c.souvenir else null end as souvenir
  from public.chansons c
  join public.invites i on i.id = c.invite_id
  where c.statut = 'approuvee'
    and current_date >= date '2028-05-28'
  order by c.joue_a asc nulls last, c.titre;
$$;
grant execute on function public.mur_bande_son() to authenticated;

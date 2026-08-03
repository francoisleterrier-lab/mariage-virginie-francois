-- ============================================================
--  « Le Coffre des invités » — jeu coopératif de rencontres.
--  Chaque invité a un « sceau » (code dérivé de son id). Pour récolter
--  le sceau d'un autre, il faut le rencontrer en vrai et lire son code.
--  Quand assez de rencontres ont eu lieu, le coffre s'ouvre POUR TOUS
--  et révèle la récompense des mariés.
-- ============================================================

create table if not exists public.coffre_echanges (
  id             uuid primary key default gen_random_uuid(),
  collecteur_id  uuid not null references public.invites(id) on delete cascade,
  cible_id       uuid not null references public.invites(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (collecteur_id, cible_id)
);
create index if not exists coffre_ech_idx on public.coffre_echanges(collecteur_id);
alter table public.coffre_echanges enable row level security;

-- Lecture : tous les invités connectés (compteur collectif).
drop policy if exists coffre_select on public.coffre_echanges;
create policy coffre_select on public.coffre_echanges for select to authenticated using (true);

-- Ajout : seulement en tant que collecteur (soi-même), pas sur soi-même.
drop policy if exists coffre_insert on public.coffre_echanges;
create policy coffre_insert on public.coffre_echanges for insert to authenticated
  with check (
    collecteur_id <> cible_id
    and exists (select 1 from public.invites i where i.id = collecteur_id and i.user_id = auth.uid())
  );

-- Retrait : admin ou propriétaire de la rencontre.
drop policy if exists coffre_delete on public.coffre_echanges;
create policy coffre_delete on public.coffre_echanges for delete to authenticated
  using (exists (select 1 from public.invites i where i.user_id = auth.uid() and i.role = 'admin')
      or exists (select 1 from public.invites i where i.id = collecteur_id and i.user_id = auth.uid()));

-- Réglage par défaut du coffre (objectif de rencontres + récompense).
insert into public.parametres (cle, valeur)
values ('coffre', '{"objectif": 25, "texte": "", "media": null}'::jsonb)
on conflict (cle) do nothing;

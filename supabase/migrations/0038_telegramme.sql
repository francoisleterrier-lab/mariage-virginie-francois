-- ============================================================
--  « Le Télégramme » — le livre d'or qui s'imprime en vrai.
--  L'invité écrit un mot depuis l'app → il rejoint une file
--  d'impression ; un petit agent (Raspberry Pi / laptop) branché à
--  une imprimante thermique l'imprime en direct, puis marque 'printed'.
--  La section ne s'affiche que si les mariés l'ont activée (imprimante prête).
-- ============================================================

create table if not exists public.telegrammes (
  id            uuid primary key default gen_random_uuid(),
  invite_id     uuid not null references public.invites(id) on delete cascade,
  prenom        text,
  texte         text not null,
  photo_chemin  text,
  statut        text not null default 'pending',   -- pending | printed
  created_at    timestamptz not null default now()
);
create index if not exists telegrammes_statut_idx on public.telegrammes(statut, created_at);
alter table public.telegrammes enable row level security;

-- Lecture : invités connectés (compteur / mur éventuel).
drop policy if exists telegrammes_select on public.telegrammes;
create policy telegrammes_select on public.telegrammes for select to authenticated using (true);

-- Ajout : pour soi-même.
drop policy if exists telegrammes_insert on public.telegrammes;
create policy telegrammes_insert on public.telegrammes for insert to authenticated
  with check (exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

-- Mise à jour (statut 'printed') / suppression : admin. L'agent d'impression
-- utilise la clé service_role et contourne la RLS.
drop policy if exists telegrammes_update on public.telegrammes;
create policy telegrammes_update on public.telegrammes for update to authenticated
  using (exists (select 1 from public.invites i where i.user_id = auth.uid() and i.role = 'admin'));
drop policy if exists telegrammes_delete on public.telegrammes;
create policy telegrammes_delete on public.telegrammes for delete to authenticated
  using (exists (select 1 from public.invites i where i.user_id = auth.uid() and i.role = 'admin')
      or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid()));

insert into public.parametres (cle, valeur)
values ('telegramme', '{"actif": false}'::jsonb)
on conflict (cle) do nothing;

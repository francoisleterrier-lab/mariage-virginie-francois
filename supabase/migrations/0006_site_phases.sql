-- ============================================================
--  Mariage Virginie & François — v2.3
--  « Le site qui vit » : paliers temporels (saisons + citations)
--  pilotés par la base pour ajuster dates/textes sans redéploiement.
--  Date pivot : 26 mai 2028.
-- ============================================================

create table if not exists public.site_phases (
  id               text primary key,        -- 'graine', 'pousse', ...
  starts_at        date not null,            -- date d'entrée dans la phase
  accent_token     text not null,            -- 'deep-green' | 'sage' | 'ivory' | 'gold'
  decoration_level int  not null,            -- 0..6 : densité du décor botanique
  quote            text not null,
  quote_author     text,
  ordre            int  not null default 0
);

alter table public.site_phases enable row level security;

drop policy if exists "phases_read_auth" on public.site_phases;
create policy "phases_read_auth"
  on public.site_phases for select to authenticated using (true);

drop policy if exists "phases_write_admin" on public.site_phases;
create policy "phases_write_admin"
  on public.site_phases for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Seed : dates calculées depuis le 26/05/2028 (citations FR sur mesure,
-- libres de droits). Chaque phase commence à sa date `starts_at` ; la phase
-- courante est celle dont starts_at est la plus récente <= aujourd'hui.
insert into public.site_phases (id, starts_at, accent_token, decoration_level, quote, quote_author, ordre) values
  ('graine',    date '2000-01-01',              'deep-green', 1, 'Les plus belles histoires commencent par une promesse.', null, 0),
  ('pousse',    date '2028-05-26' - 700,        'sage',       2, 'Patience : ce qui pousse lentement s''enracine profondément.', null, 1),
  ('branches',  date '2028-05-26' - 500,        'sage',       3, 'Nos chemins se sont trouvés, et ne se quittent plus.', null, 2),
  ('bourgeons', date '2028-05-26' - 365,        'ivory',      4, '2028, l''année du oui : tout est prêt à éclore.', null, 3),
  ('floraison', date '2028-05-26' - 100,        'gold',       5, 'L''attente fleurit : le grand jour approche.', null, 4),
  ('veille',    date '2028-05-26' - 7,          'gold',       6, 'Plus que quelques battements de cœur…', null, 5),
  ('jour_j',    date '2028-05-26',              'gold',       6, 'Aujourd''hui, nous nous disons oui.', null, 6),
  ('souvenir',  date '2028-05-28',              'gold',       4, 'Merci d''avoir fait de ce jour un souvenir éternel.', null, 7)
on conflict (id) do nothing;

-- Drapeau push de palier (désactivé par défaut) + journal d'idempotence.
insert into public.parametres (cle, valeur) values ('phase_push_enabled', 'false'::jsonb)
on conflict (cle) do nothing;

create table if not exists public.phase_push_log (
  phase_id   text primary key,
  sent_at    timestamptz not null default now()
);
alter table public.phase_push_log enable row level security;
drop policy if exists "phase_push_log_admin" on public.phase_push_log;
create policy "phase_push_log_admin"
  on public.phase_push_log for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

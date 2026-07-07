-- ============================================================
--  Mariage Virginie & François — v2.6
--  Le Quiz des Mariés + Duel des Témoins.
--  Adapté au schéma réel : app_settings→parametres, guests→invites,
--  admins→is_admin(). Colonnes `round` dès l'origine (fusion avenant).
--  Anti-triche : les invités n'ont AUCUN select sur quiz_questions /
--  quiz_answers ; tout passe par des Edge Functions (service role).
-- ============================================================

create table if not exists public.quiz_questions (
  id           uuid primary key default gen_random_uuid(),
  round        text not null default 'main' check (round in ('main','witness')),
  position     int  not null,
  body         text not null,
  image_path   text,
  choices      jsonb not null,
  correct_key  text not null,
  time_limit_s int  not null default 15 check (time_limit_s between 5 and 90),
  points       int  not null default 10
);
create unique index if not exists uq_questions_round_position on public.quiz_questions (round, position);

create table if not exists public.quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  invite_id     uuid not null references public.invites(id) on delete cascade,
  round         text not null default 'main' check (round in ('main','witness')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  total_score   int not null default 0,
  total_time_ms bigint not null default 0
);
create unique index if not exists uq_attempt_invite_round on public.quiz_attempts (invite_id, round);

create table if not exists public.quiz_answers (
  attempt_id   uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id  uuid not null references public.quiz_questions(id) on delete cascade,
  served_at    timestamptz not null,
  submitted_at timestamptz,
  answer_key   text,
  is_correct   boolean,
  time_ms      bigint,
  primary key (attempt_id, question_id)
);

insert into public.parametres (cle, valeur) values
  ('quiz_state', '"hidden"'::jsonb),                                   -- hidden | open | closed
  ('quiz_reveal_at', 'null'::jsonb),
  ('quiz_close_at', 'null'::jsonb),
  ('quiz_teaser', '"Une surprise attend les 3 premiers…"'::jsonb),
  ('quiz_witnesses', '[]'::jsonb),                                     -- [id_alan, id_melane]
  ('witness_reveal_answers', 'true'::jsonb),
  ('quiz_push_log', '[]'::jsonb)                                       -- transitions déjà notifiées (idempotence)
on conflict (cle) do nothing;

alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts  enable row level security;
alter table public.quiz_answers   enable row level security;

-- Questions & réponses : ADMIN uniquement (le correct_key y vit).
drop policy if exists "quiz_questions_admin" on public.quiz_questions;
create policy "quiz_questions_admin" on public.quiz_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "quiz_answers_admin" on public.quiz_answers;
create policy "quiz_answers_admin" on public.quiz_answers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Tentatives : l'invité lit LA SIENNE (score/progression) ; admin tout.
drop policy if exists "quiz_attempts_read_own" on public.quiz_attempts;
create policy "quiz_attempts_read_own" on public.quiz_attempts
  for select to authenticated
  using (invite_id = (select id from public.invites where user_id = auth.uid()) or public.is_admin());
drop policy if exists "quiz_attempts_admin" on public.quiz_attempts;
create policy "quiz_attempts_admin" on public.quiz_attempts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
--  Restitutions APRÈS clôture uniquement (gardées par quiz_state).
-- ============================================================
create or replace function public.quiz_podium()
returns table (rang bigint, prenom text, score int, temps_ms bigint)
language sql stable security definer set search_path = public as $$
  select rank() over (order by a.total_score desc, a.total_time_ms asc),
         split_part(i.nom, ' ', 1), a.total_score, a.total_time_ms
  from public.quiz_attempts a
  join public.invites i on i.id = a.invite_id
  where a.round = 'main' and a.finished_at is not null
    and (select valeur = '"closed"'::jsonb from public.parametres where cle = 'quiz_state')
  order by 1;
$$;
grant execute on function public.quiz_podium() to authenticated;

create or replace function public.quiz_correction()
returns table (pos int, body text, choices jsonb, correct_key text, stats jsonb)
language sql stable security definer set search_path = public as $$
  select q.position, q.body, q.choices, q.correct_key,
    coalesce((
      select jsonb_object_agg(t.answer_key, t.n)
      from (select an.answer_key, count(*) n from public.quiz_answers an
            where an.question_id = q.id and an.answer_key is not null group by an.answer_key) t
    ), '{}'::jsonb)
  from public.quiz_questions q
  where q.round = 'main'
    and (select valeur = '"closed"'::jsonb from public.parametres where cle = 'quiz_state')
  order by q.position;
$$;
grant execute on function public.quiz_correction() to authenticated;

-- Duel des témoins (après clôture) : scores/temps des 2 témoins.
create or replace function public.quiz_duel()
returns table (prenom text, invite_id uuid, joue boolean, score int, temps_ms bigint)
language sql stable security definer set search_path = public as $$
  select split_part(i.nom, ' ', 1), i.id,
         (a.finished_at is not null) as joue,
         coalesce(a.total_score, 0), coalesce(a.total_time_ms, 0)
  from public.invites i
  left join public.quiz_attempts a on a.invite_id = i.id and a.round = 'witness'
  where i.id in (select jsonb_array_elements_text((select valeur from public.parametres where cle = 'quiz_witnesses'))::uuid)
    and (select valeur = '"closed"'::jsonb from public.parametres where cle = 'quiz_state')
  order by (a.finished_at is not null) desc, coalesce(a.total_score, 0) desc, coalesce(a.total_time_ms, 0) asc;
$$;
grant execute on function public.quiz_duel() to authenticated;

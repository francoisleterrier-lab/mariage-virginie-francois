-- ============================================================
--  Mariage Virginie & François — v2.9
--  Rattacher une personne inscrite (seule, avec compte) à une famille
--  en tant qu'« ado ». Lien simple vers l'invité « parent » du foyer.
-- ============================================================

alter table public.invites
  add column if not exists rattache_a uuid references public.invites(id) on delete set null;

create index if not exists invites_rattache_a_idx on public.invites(rattache_a);

comment on column public.invites.rattache_a is
  'Si renseigné : cet invité (inscrit seul) est rattaché comme ado au foyer de l''invité pointé.';

-- Protéger la colonne : seul l'admin peut (dé)rattacher un ado à une famille.
create or replace function public.invites_guard()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.bypass_guard', true), '') = 'on' then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.couple_id is distinct from old.couple_id
     or new.table_id is distinct from old.table_id
     or new.rattache_a is distinct from old.rattache_a then
    raise exception 'Modification de colonnes protégées non autorisée.';
  end if;
  return new;
end;
$$;

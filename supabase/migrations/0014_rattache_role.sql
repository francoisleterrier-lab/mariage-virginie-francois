-- ============================================================
--  Mariage Virginie & François — v3.0
--  Catégorie du rattachement d'une personne inscrite seule à une famille :
--  « enfant » ou « ado ».
-- ============================================================

alter table public.invites
  add column if not exists rattache_role text;

-- Les rattachements existants étaient des ados.
update public.invites set rattache_role = 'ado'
  where rattache_a is not null and rattache_role is null;

-- Protéger la colonne : seul l'admin peut la modifier.
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
     or new.rattache_a is distinct from old.rattache_a
     or new.rattache_role is distinct from old.rattache_role then
    raise exception 'Modification de colonnes protégées non autorisée.';
  end if;
  return new;
end;
$$;

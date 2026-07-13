-- ============================================================
--  Arbre de vie : une lumière par personne CONFIRMÉE (et non par
--  compte inscrit). Avant, tous les comptes comptaient — même ceux
--  qui n'avaient jamais répondu → nombre gonflé (71).
--  Désormais : seulement les invités présents (RSVP ≠ « Hélas »),
--  + leurs accompagnants adultes nommés + leurs enfants nommés.
-- ============================================================

create or replace function public.arbre_feuilles()
returns table(leaf_rank bigint, display_name text, kind text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with pres as (
    select * from public.invites
    where rsvp is not null and coalesce(rsvp->>'presence', '') not like 'Hélas%'
  ),
  gens as (
    -- 1 feuille par compte confirmé (adulte / conjoint)
    select i.id, i.created_at, 0 as ordre, i.nom as personne, 'adulte' as kind
    from pres i
    union all
    -- 1 feuille par accompagnant adulte nommé dans le RSVP
    select i.id, i.created_at, 1 as ordre, trim(both from elem) as personne, 'adulte' as kind
    from pres i,
         lateral jsonb_array_elements_text(
           case when jsonb_typeof(i.rsvp->'adultesNoms') = 'array' then i.rsvp->'adultesNoms' else '[]'::jsonb end
         ) as elem
    where coalesce(trim(both from elem), '') <> ''
    union all
    -- 1 feuille par enfant nommé dans le RSVP
    select i.id, i.created_at, 2 as ordre, trim(both from elem) as personne, 'enfant' as kind
    from pres i,
         lateral jsonb_array_elements_text(
           case when jsonb_typeof(i.rsvp->'enfantsNoms') = 'array' then i.rsvp->'enfantsNoms' else '[]'::jsonb end
         ) as elem
    where coalesce(trim(both from elem), '') <> ''
  ),
  classe as (
    select
      row_number() over (order by created_at asc nulls last, id, ordre) as leaf_rank,
      personne,
      kind
    from gens
  )
  select
    leaf_rank,
    case
      when (select valeur = 'true'::jsonb from public.parametres where cle = 'arbre_prenoms')
        then personne
      else ''
    end as display_name,
    kind
  from classe
  order by leaf_rank;
$function$;

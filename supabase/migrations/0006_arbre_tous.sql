-- ============================================================
--  Mariage Virginie & François — v2.3
--  Arbre de vie : une feuille par PERSONNE.
--  À la demande des mariés, l'arbre représente désormais tout le
--  monde inscrit — chaque profil créé (adulte), le conjoint (profil
--  lié) et chaque enfant/ado nommé dans le RSVP — et non plus
--  seulement les foyers ayant confirmé.
--  Reste privacy-safe : ne renvoie que rang + nom (+ type), jamais
--  e-mail/rôle/détail du RSVP.
-- ============================================================
-- La signature de retour change (ajout de `kind`) → on supprime d'abord.
drop function if exists public.arbre_feuilles();

create or replace function public.arbre_feuilles()
returns table (leaf_rank bigint, display_name text, kind text)
language sql
stable
security definer
set search_path = public
as $$
  with gens as (
    -- 1 feuille par profil inscrit (adulte / conjoint)
    select i.id, i.created_at, 0 as ordre, i.nom as personne, 'adulte' as kind
    from public.invites i
    union all
    -- 1 feuille par enfant / ado nommé dans le RSVP
    select i.id, i.created_at, 1 as ordre,
           trim(both from elem) as personne, 'enfant' as kind
    from public.invites i,
         lateral jsonb_array_elements_text(
           case when jsonb_typeof(i.rsvp->'enfantsNoms') = 'array'
                then i.rsvp->'enfantsNoms' else '[]'::jsonb end
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
$$;

grant execute on function public.arbre_feuilles() to authenticated;

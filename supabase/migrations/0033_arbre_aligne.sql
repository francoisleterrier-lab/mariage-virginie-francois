-- ============================================================
--  Arbre de vie : ALIGNER le nombre de lumières sur le tableau de bord.
--  Même comptage par FOYER que l'admin :
--   - couple = au moins 2 adultes (max(2, adultes déclaré)), compté 1 fois ;
--   - personne seule = son nombre d'adultes (≥ 1) ;
--   - + chaque accompagnant adulte nommé ;
--   - enfants = nombre max déclaré du foyer (pas la somme).
--  Les lumières portent les prénoms connus ; le surplus (adultes déclarés
--  sans prénom, enfants sans prénom) donne des lumières sans nom.
-- ============================================================

create or replace function public.arbre_feuilles()
returns table(leaf_rank bigint, display_name text, kind text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with pres as (
    select i.id, i.nom, i.created_at, i.rsvp,
      case when i.couple_id is not null
             and exists (select 1 from public.invites p where p.id = i.couple_id and p.couple_id = i.id)
           then least(i.id::text, i.couple_id::text) else i.id::text end as foyer
    from public.invites i
    where i.rsvp is not null and coalesce(i.rsvp->>'presence', '') not like 'Hélas%'
      and i.rattache_a is null   -- exclut les ados/enfants inscrits séparément (comme le tableau de bord)
  ),
  -- Noms d'adultes disponibles par foyer : comptes présents (sub=0) + accompagnants nommés (sub=1).
  adultes_nommes as (
    select foyer, created_at, id, 0 as sub, nom as personne from pres
    union all
    select p.foyer, p.created_at, p.id, 1 as sub, trim(both from elem)
    from pres p,
      lateral jsonb_array_elements_text(
        case when jsonb_typeof(p.rsvp->'adultesNoms') = 'array' then p.rsvp->'adultesNoms' else '[]'::jsonb end
      ) as elem
    where coalesce(trim(both from elem), '') <> ''
  ),
  adultes_rangs as (
    select foyer, personne,
      row_number() over (partition by foyer order by sub, created_at, id, personne) as rn
    from adultes_nommes
  ),
  comp as (
    select foyer, count(*) as n_comp from adultes_nommes where sub = 1 group by foyer
  ),
  enfants_rangs as (
    select foyer, personne, row_number() over (partition by foyer order by personne) as rn
    from (
      select distinct p.foyer, trim(both from elem) as personne
      from pres p,
        lateral jsonb_array_elements_text(
          case when jsonb_typeof(p.rsvp->'enfantsNoms') = 'array' then p.rsvp->'enfantsNoms' else '[]'::jsonb end
        ) as elem
      where coalesce(trim(both from elem), '') <> ''
    ) e
  ),
  foyer_base as (
    select foyer, min(created_at) as fc, count(*) as membres,
      case when count(*) > 1 then greatest(2, max(coalesce((rsvp->>'adultes')::int, 0)))
           else greatest(1, max(coalesce((rsvp->>'adultes')::int, 0))) end as base_ad,
      max(coalesce((rsvp->>'enfants')::int, 0)) as enfants_cible
    from pres group by foyer
  ),
  foyer_stat as (
    select fb.foyer, fb.fc, fb.enfants_cible, fb.base_ad + coalesce(c.n_comp, 0) as adultes_cible
    from foyer_base fb left join comp c on c.foyer = fb.foyer
  ),
  adultes as (
    select fs.foyer, fs.fc, 0 as ord, gs.n,
      (select ar.personne from adultes_rangs ar where ar.foyer = fs.foyer and ar.rn = gs.n) as personne,
      'adulte' as kind
    from foyer_stat fs, lateral generate_series(1, greatest(fs.adultes_cible, 1)) as gs(n)
  ),
  enfants as (
    select fs.foyer, fs.fc, 1 as ord, gs.n,
      (select er.personne from enfants_rangs er where er.foyer = fs.foyer and er.rn = gs.n) as personne,
      'enfant' as kind
    from foyer_stat fs, lateral generate_series(1, fs.enfants_cible) as gs(n)
    where fs.enfants_cible > 0
  ),
  tous as (
    select foyer, fc, ord, n, personne, kind from adultes
    union all
    select foyer, fc, ord, n, personne, kind from enfants
  ),
  classe as (
    select row_number() over (order by fc asc nulls last, foyer, ord, n) as leaf_rank, personne, kind
    from tous
  )
  select
    leaf_rank,
    case
      when (select valeur = 'true'::jsonb from public.parametres where cle = 'arbre_prenoms')
        then coalesce(personne, '')
      else ''
    end as display_name,
    kind
  from classe
  order by leaf_rank;
$function$;

-- ============================================================
--  Mariage Virginie & François — v2.2
--  « Arbre de vie vivant » : une feuille par foyer confirmé.
--  Adapté au schéma réel : les réponses sont dans invites.rsvp (jsonb),
--  « confirmé » = présence renseignée ne commençant pas par « Hélas ».
-- ============================================================

-- ---------- Paramètres (réutilise la table `parametres` existante) ----------
insert into public.parametres (cle, valeur) values
  ('arbre_objectif', '80'::jsonb),      -- cible de pleine floraison
  ('arbre_prenoms',  'true'::jsonb)     -- afficher les prénoms au survol ?
on conflict (cle) do nothing;

-- ============================================================
--  Feuilles de l'arbre — fonction security definer.
--  N'expose QUE : le rang (ordre chronologique de confirmation) et le
--  nom du foyer. Jamais e-mail / rôle / détail du RSVP.
--  Un « foyer » = un invité seul, ou un couple (couple_id) regroupé en
--  une seule feuille dont le nom réunit les deux prénoms.
--  Le rang est stable (ordre par 1re confirmation du foyer) : recharger
--  la page redonne exactement la même disposition.
--  Si `arbre_prenoms` est faux, display_name est vide (feuilles anonymes).
-- ============================================================
create or replace function public.arbre_feuilles()
returns table (leaf_rank bigint, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  with confirmes as (
    select
      i.id,
      i.nom,
      i.rsvp_date,
      -- clé de foyer : canonique pour un couple (le plus petit des deux id)
      case when i.couple_id is not null then least(i.id, i.couple_id) else i.id end as foyer
    from public.invites i
    where i.rsvp is not null
      and coalesce(i.rsvp->>'presence', '') not ilike 'Hélas%'
  ),
  foyers as (
    select
      foyer,
      min(rsvp_date) as confirmed_at,
      string_agg(nom, ' & ' order by nom) as noms
    from confirmes
    group by foyer
  ),
  classe as (
    select
      row_number() over (order by confirmed_at asc nulls last, foyer) as leaf_rank,
      noms
    from foyers
  )
  select
    leaf_rank,
    case
      when (select valeur = 'true'::jsonb from public.parametres where cle = 'arbre_prenoms')
        then noms
      else ''
    end as display_name
  from classe
  order by leaf_rank;
$$;

grant execute on function public.arbre_feuilles() to authenticated;

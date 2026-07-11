-- ============================================================
--  Faire-part Vivant — arbre de vie vivant (multi-clients)
--  Fonction security-definer : renvoie, pour une invitation PUBLIÉE,
--  le rang + le prénom des invités CONFIRMÉS — jamais e-mail ni message.
--  Lisible publiquement (les orbes s'allument côté invité) sans casser la RLS.
-- ============================================================
create or replace function public.fpv_arbre(p_slug text)
returns table(leaf_rank int, prenom text)
language sql
stable
security definer
set search_path = public
as $$
  select (row_number() over (order by r.created_at))::int as leaf_rank,
         nullif(split_part(coalesce(r.nom, ''), ' ', 1), '') as prenom
  from public.fpv_rsvps r
  join public.fpv_invitations i on i.id = r.invitation_id
  where i.slug = p_slug
    and i.publie = true
    and coalesce(r.presence, '') not ilike 'hélas%';
$$;
grant execute on function public.fpv_arbre(text) to anon, authenticated;

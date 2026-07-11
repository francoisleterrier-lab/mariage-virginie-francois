-- ============================================================
--  Faire-part Vivant — Liste de mariage (cadeaux à réserver).
--  Produit uniquement (pas sur le site V&F).
--  Chaque cadeau peut être réservé par un invité ; on évite les doublons
--  via une fonction sécurisée qui ne réserve que si le cadeau est libre.
-- ============================================================

create table if not exists public.fpv_gifts (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.fpv_invitations(id) on delete cascade,
  titre          text not null,
  description    text default '',
  prix           numeric,
  lien           text default '',
  reserve_par    text,               -- null = disponible
  reserve_at     timestamptz,
  position       int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists fpv_gifts_inv_idx on public.fpv_gifts(invitation_id, position);
alter table public.fpv_gifts enable row level security;

-- Lecture : invitation publiée (invités), ou le propriétaire (édition).
drop policy if exists fpv_gifts_select on public.fpv_gifts;
create policy fpv_gifts_select on public.fpv_gifts for select
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and (i.publie = true or i.owner_id = auth.uid())));

-- Gestion des articles (ajout / modif / retrait) : le propriétaire uniquement.
drop policy if exists fpv_gifts_insert on public.fpv_gifts;
create policy fpv_gifts_insert on public.fpv_gifts for insert
  with check (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid()));

drop policy if exists fpv_gifts_update on public.fpv_gifts;
create policy fpv_gifts_update on public.fpv_gifts for update
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid()));

drop policy if exists fpv_gifts_delete on public.fpv_gifts;
create policy fpv_gifts_delete on public.fpv_gifts for delete
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid()));

-- Réservation par un invité (anon) : ne réserve que si le cadeau est libre
-- et l'invitation publiée. Renvoie true si réservé, false si déjà pris.
create or replace function public.fpv_reserver_cadeau(p_gift uuid, p_nom text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  update public.fpv_gifts g
     set reserve_par = coalesce(nullif(trim(p_nom), ''), 'Un invité'),
         reserve_at  = now()
   where g.id = p_gift
     and g.reserve_par is null
     and exists (select 1 from public.fpv_invitations i where i.id = g.invitation_id and i.publie = true)
  returning true into ok;
  return coalesce(ok, false);
end;
$$;
grant execute on function public.fpv_reserver_cadeau(uuid, text) to anon, authenticated;

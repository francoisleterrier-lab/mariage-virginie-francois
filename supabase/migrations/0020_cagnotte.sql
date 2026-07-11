-- ============================================================
--  Cagnotte / liste de mariage (fonds commun) — messages des invités.
--  Le montant est géré par le couple (mise à jour manuelle), la participation
--  passe par un lien externe (Leetchi, Lydia, PayPal, RIB…). Ici on ne stocke
--  que les petits mots d'encouragement laissés par les invités.
--
--  Config :
--   - Produit « Faire-part Vivant » : dans fpv_invitations.sections (JSON).
--   - Site V&F : dans la table parametres (cagnotte_active, cagnotte_titre,
--     cagnotte_texte, cagnotte_objectif, cagnotte_montant, cagnotte_lien).
-- ============================================================

-- ---------- Produit : messages de cagnotte (multi-clients) ----------
create table if not exists public.fpv_cagnotte_messages (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.fpv_invitations(id) on delete cascade,
  prenom         text default '',
  message        text not null,
  created_at     timestamptz not null default now()
);
create index if not exists fpv_cagnotte_inv_idx on public.fpv_cagnotte_messages(invitation_id);
alter table public.fpv_cagnotte_messages enable row level security;

drop policy if exists fpv_cagnotte_insert on public.fpv_cagnotte_messages;
create policy fpv_cagnotte_insert on public.fpv_cagnotte_messages for insert
  with check (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true));

drop policy if exists fpv_cagnotte_select on public.fpv_cagnotte_messages;
create policy fpv_cagnotte_select on public.fpv_cagnotte_messages for select
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true));

drop policy if exists fpv_cagnotte_delete on public.fpv_cagnotte_messages;
create policy fpv_cagnotte_delete on public.fpv_cagnotte_messages for delete
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid()));

-- ---------- Site V&F : messages de cagnotte ----------
create table if not exists public.cagnotte_messages (
  id          uuid primary key default gen_random_uuid(),
  invite_id   uuid not null references public.invites(id) on delete cascade,
  prenom      text default '',
  message     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists cagnotte_messages_idx on public.cagnotte_messages(created_at desc);
alter table public.cagnotte_messages enable row level security;

drop policy if exists cagnotte_msg_insert on public.cagnotte_messages;
create policy cagnotte_msg_insert on public.cagnotte_messages for insert to authenticated
  with check (
    public.is_admin()
    or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid())
  );

drop policy if exists cagnotte_msg_select on public.cagnotte_messages;
create policy cagnotte_msg_select on public.cagnotte_messages for select to authenticated using (true);

drop policy if exists cagnotte_msg_delete on public.cagnotte_messages;
create policy cagnotte_msg_delete on public.cagnotte_messages for delete to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.invites i where i.id = invite_id and i.user_id = auth.uid())
  );

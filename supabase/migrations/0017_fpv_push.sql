-- ============================================================
--  Faire-part Vivant — notifications push (multi-clients)
--  Abonnements push rattachés à une invitation ; VAPID partagé (secrets).
-- ============================================================
create table if not exists public.fpv_push_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  invitation_id  uuid not null references public.fpv_invitations(id) on delete cascade,
  subscription   jsonb not null,
  created_at     timestamptz not null default now()
);
create index if not exists fpv_push_inv_idx on public.fpv_push_subscriptions(invitation_id);
create unique index if not exists fpv_push_uniq on public.fpv_push_subscriptions(invitation_id, (subscription->>'endpoint'));

alter table public.fpv_push_subscriptions enable row level security;

-- Un invité peut s'abonner à une invitation PUBLIÉE.
drop policy if exists fpv_push_insert on public.fpv_push_subscriptions;
create policy fpv_push_insert on public.fpv_push_subscriptions for insert
  with check (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.publie = true));

-- Seul le propriétaire de l'invitation lit / purge ses abonnés.
drop policy if exists fpv_push_select on public.fpv_push_subscriptions;
create policy fpv_push_select on public.fpv_push_subscriptions for select
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid()));

drop policy if exists fpv_push_delete on public.fpv_push_subscriptions;
create policy fpv_push_delete on public.fpv_push_subscriptions for delete
  using (exists (select 1 from public.fpv_invitations i where i.id = invitation_id and i.owner_id = auth.uid()));

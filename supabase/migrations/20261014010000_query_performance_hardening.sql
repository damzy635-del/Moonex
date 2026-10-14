-- Improve foreign-key maintenance and common owner-scoped queries.
-- These indexes are additive and safe to apply to existing data.
create index if not exists messages_conversation_user_idx
  on public.messages (conversation_id, user_id);
create index if not exists messages_user_id_idx
  on public.messages (user_id);
create index if not exists subscriptions_plan_id_idx
  on public.subscriptions (plan_id);
create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);
create index if not exists usage_events_user_id_idx
  on public.usage_events (user_id);

-- Remove the legacy ALL policy that duplicates the four explicit conversation
-- policies. PostgreSQL combines permissive policies with OR, so duplication
-- adds work without expanding the intended access.
drop policy if exists "conversations own access" on public.conversations;

-- Wrap auth.uid() in a scalar subquery so PostgreSQL can evaluate it once per
-- statement rather than repeatedly for every candidate row.
drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "usage select own" on public.usage_events;
create policy "usage select own" on public.usage_events
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "subscriptions read own" on public.subscriptions;
create policy "subscriptions read own" on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

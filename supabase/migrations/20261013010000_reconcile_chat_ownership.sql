-- Reconcile the existing Supabase chat schema without dropping legacy columns or rows.
-- This migration intentionally aborts if existing data violates the ownership invariants.
do $$
begin
  if exists (
    select 1 from public.messages m
    left join public.conversations c on c.id = m.conversation_id
    where c.id is null or c.user_id <> m.user_id
  ) then
    raise exception 'Moonex reconciliation blocked: orphaned or cross-owner messages exist; investigate before migrating';
  end if;

  if exists (
    select 1 from public.conversations
    where title is null or char_length(title) not between 1 and 200
  ) then
    raise exception 'Moonex reconciliation blocked: invalid conversation titles exist';
  end if;

  if exists (
    select 1 from public.messages
    where role not in ('user', 'assistant', 'system')
       or content is null
       or char_length(content) not between 1 and 100000
  ) then
    raise exception 'Moonex reconciliation blocked: invalid message role/content exists';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'Users can create their messages'
      and cmd = 'INSERT'
  ) then
    raise exception 'Moonex reconciliation blocked: expected strict message INSERT policy is missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'Users can read their messages'
      and cmd = 'SELECT'
  ) then
    raise exception 'Moonex reconciliation blocked: expected message SELECT policy is missing';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'Users can delete their messages'
      and cmd = 'DELETE'
  ) then
    raise exception 'Moonex reconciliation blocked: expected message DELETE policy is missing';
  end if;
end $$;

-- The primary key already guarantees id uniqueness, so this pair is safe to add
-- when absent and enables the ownership-enforcing composite foreign key.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.conversations'::regclass
      and conname = 'conversations_id_user_unique'
  ) then
    alter table public.conversations
      add constraint conversations_id_user_unique unique (id, user_id);
  end if;
end $$;

-- Remove only the permissive catch-all policy. PostgreSQL ORs permissive policies,
-- so its user_id-only WITH CHECK could bypass the stricter INSERT policy above.
drop policy if exists "messages own access" on public.messages;

-- Replace the old conversation_id-only FK with the composite owner-matching FK.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_conversation_user_fk'
      and contype = 'f'
  ) then
    alter table public.messages
      drop constraint if exists messages_conversation_id_fkey;
    alter table public.messages
      add constraint messages_conversation_user_fk
      foreign key (conversation_id, user_id)
      references public.conversations(id, user_id)
      on delete cascade;
  end if;
end $$;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Preserve existing legacy columns (including provider/token metadata) and grants.
-- Do not grant message UPDATE: chat rows are append-only from authenticated clients.
grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, delete on public.messages to authenticated;

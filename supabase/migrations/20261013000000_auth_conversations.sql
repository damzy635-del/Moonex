-- Moonex user-owned chat history. Supabase Auth owns user identities.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat' check (char_length(title) between 1 and 200),
  model_profile text not null default 'moonex-pro-1.5',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_id_user_unique unique (id, user_id)
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 100000),
  created_at timestamptz not null default now(),
  constraint messages_conversation_user_fk
    foreign key (conversation_id, user_id)
    references public.conversations(id, user_id) on delete cascade
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at asc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Users can read their conversations"
  on public.conversations for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their conversations"
  on public.conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their conversations"
  on public.conversations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their conversations"
  on public.conversations for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their messages"
  on public.messages for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their messages"
  on public.messages for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );
create policy "Users can delete their messages"
  on public.messages for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.conversations to authenticated;
grant select, insert, delete on public.messages to authenticated;

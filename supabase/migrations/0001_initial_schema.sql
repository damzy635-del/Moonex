-- Review and apply only to the intended Supabase project.
create extension if not exists pgcrypto;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text,locale text not null default 'en',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.conversations(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null default 'New chat',model_profile text not null default 'moonex-pro-1.5',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index if not exists conversations_user_updated_idx on public.conversations(user_id,updated_at desc);
create table if not exists public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.conversations(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,role text not null check(role in ('user','assistant','system')),content text not null,model_profile text,provider text,input_tokens integer,output_tokens integer,created_at timestamptz not null default now());
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);
create table if not exists public.usage_events(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete set null,profile_id text not null,provider text,input_tokens integer,output_tokens integer,status text not null,created_at timestamptz not null default now());
create table if not exists public.plans(id text primary key,name text not null,active boolean not null default true,features jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
create table if not exists public.subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,plan_id text not null references public.plans(id),provider text,provider_subscription_id text,status text not null default 'incomplete',current_period_end timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(provider,provider_subscription_id));
create table if not exists public.payment_events(id uuid primary key default gen_random_uuid(),provider text not null,provider_event_id text not null,event_type text not null,payload jsonb not null default '{}'::jsonb,processed_at timestamptz,created_at timestamptz not null default now(),unique(provider,provider_event_id));
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.usage_events enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security;
create policy "profiles select own" on public.profiles for select to authenticated using(id=auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "conversations own access" on public.conversations for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "messages own access" on public.messages for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "usage select own" on public.usage_events for select to authenticated using(user_id=auth.uid());
create policy "plans read active" on public.plans for select to authenticated using(active=true);
create policy "subscriptions read own" on public.subscriptions for select to authenticated using(user_id=auth.uid());
-- payment_events intentionally has no client-facing policy; manage it server-side.

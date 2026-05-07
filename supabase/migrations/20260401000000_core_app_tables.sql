begin;

-- Core application tables that later migrations alter or backfill.
-- Supabase-provided auth/storage schemas remain external.

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    name text,
    idea text,
    business_name text,
    industry text,
    strategy text,
    strategy_label text,
    experience text,
    current_stage integer not null default 1,
    setup_completed boolean not null default false,
    budget_total numeric not null default 0,
    budget_spent numeric not null default 0,
    budget_remaining numeric not null default 0,
    budget_runway text not null default 'TBD',
    budget_range text,
    exact_budget_amount numeric,
    budget_is_estimated boolean not null default false,
    expenses jsonb not null default '[]'::jsonb,
    glossary_learned text[] not null default '{}'::text[],
    decisions jsonb not null default '[]'::jsonb,
    role text not null default 'user',
    last_active_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.stage_progress (
    user_id uuid not null references auth.users(id) on delete cascade,
    stage_id integer not null check (stage_id between 1 and 6),
    completed_milestones text[] not null default '{}'::text[],
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, stage_id)
);

create table if not exists public.messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    stage_id integer not null check (stage_id between 1 and 6),
    role text not null check (role in ('user', 'forge', 'assistant', 'system')),
    content text not null default '',
    created_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    content text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.briefings (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    content text not null default '',
    stage_id integer not null default 1 check (stage_id between 1 and 6),
    created_at timestamptz not null default now()
);

create index if not exists idx_profiles_email
    on public.profiles (lower(email))
    where email is not null;

create index if not exists idx_stage_progress_user_stage
    on public.stage_progress (user_id, stage_id);

create index if not exists idx_messages_user_stage_created_at
    on public.messages (user_id, stage_id, created_at asc);

create index if not exists idx_journal_entries_user_created_at
    on public.journal_entries (user_id, created_at desc);

create index if not exists idx_briefings_user_created_at
    on public.briefings (user_id, created_at desc);

alter table public.stage_progress enable row level security;
alter table public.messages enable row level security;
alter table public.journal_entries enable row level security;
alter table public.briefings enable row level security;

drop policy if exists stage_progress_own_all on public.stage_progress;
create policy stage_progress_own_all
    on public.stage_progress
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists messages_own_all on public.messages;
create policy messages_own_all
    on public.messages
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists journal_entries_own_all on public.journal_entries;
create policy journal_entries_own_all
    on public.journal_entries
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists briefings_own_all on public.briefings;
create policy briefings_own_all
    on public.briefings
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

commit;

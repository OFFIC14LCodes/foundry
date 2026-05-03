begin;

create table if not exists public.foundry_actions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    description text not null default '',
    source_type text not null default 'insight',
    source_id text,
    source_module text not null check (source_module in (
        'forge',
        'academy',
        'market_intelligence',
        'weekly_intelligence',
        'finance',
        'strategy',
        'document_vault',
        'journal',
        'system'
    )),
    action_type text not null check (action_type in (
        'task',
        'canvas_update',
        'document_create',
        'document_review',
        'finance_review',
        'market_followup',
        'academy_apply',
        'journal_reflection',
        'forge_followup',
        'stage_gate'
    )),
    status text not null default 'suggested' check (status in (
        'suggested',
        'accepted',
        'in_progress',
        'completed',
        'dismissed'
    )),
    priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
    due_date date,
    completed_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_foundry_actions_user_status_updated
    on public.foundry_actions (user_id, status, updated_at desc);

create index if not exists idx_foundry_actions_user_priority_due
    on public.foundry_actions (user_id, priority, due_date);

create index if not exists idx_foundry_actions_user_source
    on public.foundry_actions (user_id, source_module, source_type);

drop index if exists public.idx_foundry_actions_source_unique;
create index if not exists idx_foundry_actions_user_source_id
    on public.foundry_actions (user_id, source_module, source_type, source_id, action_type, status)
    where source_id is not null;

alter table public.foundry_actions enable row level security;

drop policy if exists foundry_actions_own_select on public.foundry_actions;
create policy foundry_actions_own_select
    on public.foundry_actions
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists foundry_actions_own_insert on public.foundry_actions;
create policy foundry_actions_own_insert
    on public.foundry_actions
    for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

drop policy if exists foundry_actions_own_update on public.foundry_actions;
create policy foundry_actions_own_update
    on public.foundry_actions
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists foundry_actions_own_delete on public.foundry_actions;
create policy foundry_actions_own_delete
    on public.foundry_actions
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);

commit;

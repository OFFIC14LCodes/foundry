begin;

create table if not exists public.daily_chat_summaries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    stage_id integer not null check (stage_id between 1 and 6),
    summary_date date not null,
    title text not null,
    summary text not null,
    message_count integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint daily_chat_summaries_user_stage_date_key unique (user_id, stage_id, summary_date)
);

create index if not exists idx_daily_chat_summaries_user_stage_date
    on public.daily_chat_summaries (user_id, stage_id, summary_date desc);

alter table public.daily_chat_summaries enable row level security;

drop policy if exists daily_chat_summaries_own_read on public.daily_chat_summaries;
create policy daily_chat_summaries_own_read
    on public.daily_chat_summaries
    for select
    using (user_id = auth.uid());

drop policy if exists daily_chat_summaries_own_insert on public.daily_chat_summaries;
create policy daily_chat_summaries_own_insert
    on public.daily_chat_summaries
    for insert
    with check (user_id = auth.uid());

drop policy if exists daily_chat_summaries_own_update on public.daily_chat_summaries;
create policy daily_chat_summaries_own_update
    on public.daily_chat_summaries
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists daily_chat_summaries_own_delete on public.daily_chat_summaries;
create policy daily_chat_summaries_own_delete
    on public.daily_chat_summaries
    for delete
    using (user_id = auth.uid());

commit;

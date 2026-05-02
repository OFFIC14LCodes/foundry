begin;

alter table public.market_reports
    add column if not exists search_queries jsonb not null default '[]'::jsonb;

alter table public.competitor_snapshots
    add column if not exists report_id uuid references public.market_reports(id) on delete set null,
    add column if not exists snapshot_date date not null default current_date;

create index if not exists idx_competitor_snapshots_report_id
    on public.competitor_snapshots (report_id);

create index if not exists idx_competitor_snapshots_competitor_date
    on public.competitor_snapshots (competitor_id, snapshot_date desc);

create table if not exists public.trend_snapshots (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    trend_name text not null,
    report_id uuid references public.market_reports(id) on delete set null,
    snapshot_date date not null default current_date,
    impact_level text not null default 'medium',
    notes text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists idx_trend_snapshots_user_trend_date
    on public.trend_snapshots (user_id, lower(trend_name), snapshot_date desc);

create index if not exists idx_trend_snapshots_report_id
    on public.trend_snapshots (report_id);

alter table public.trend_snapshots enable row level security;

drop policy if exists trend_snapshots_own_read on public.trend_snapshots;
create policy trend_snapshots_own_read
    on public.trend_snapshots
    for select
    using (user_id = auth.uid());

drop policy if exists trend_snapshots_own_insert on public.trend_snapshots;
create policy trend_snapshots_own_insert
    on public.trend_snapshots
    for insert
    with check (user_id = auth.uid());

drop policy if exists trend_snapshots_own_update on public.trend_snapshots;
create policy trend_snapshots_own_update
    on public.trend_snapshots
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists trend_snapshots_own_delete on public.trend_snapshots;
create policy trend_snapshots_own_delete
    on public.trend_snapshots
    for delete
    using (user_id = auth.uid());

alter table public.founder_session_state
    add column if not exists market_refresh_schedule jsonb;

commit;

begin;

create table if not exists public.market_benchmark_snapshots (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    report_id uuid not null references public.market_reports(id) on delete cascade,
    metric text not null,
    value text not null,
    unit text,
    created_at timestamptz not null default now()
);

create index if not exists idx_market_benchmark_snapshots_user_report
    on public.market_benchmark_snapshots (user_id, report_id, created_at desc);

create index if not exists idx_market_benchmark_snapshots_user_metric
    on public.market_benchmark_snapshots (user_id, lower(metric), created_at desc);

create unique index if not exists uq_market_benchmark_snapshots_report_metric
    on public.market_benchmark_snapshots (report_id, lower(metric));

alter table public.market_benchmark_snapshots enable row level security;

drop policy if exists market_benchmark_snapshots_own_read on public.market_benchmark_snapshots;
create policy market_benchmark_snapshots_own_read
    on public.market_benchmark_snapshots
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists market_benchmark_snapshots_own_insert on public.market_benchmark_snapshots;
create policy market_benchmark_snapshots_own_insert
    on public.market_benchmark_snapshots
    for insert
    to authenticated
    with check (
        (select auth.uid()) = user_id
        and exists (
            select 1
            from public.market_reports reports
            where reports.id = report_id
              and reports.user_id = (select auth.uid())
        )
    );

drop policy if exists market_benchmark_snapshots_own_update on public.market_benchmark_snapshots;
create policy market_benchmark_snapshots_own_update
    on public.market_benchmark_snapshots
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check (
        (select auth.uid()) = user_id
        and exists (
            select 1
            from public.market_reports reports
            where reports.id = report_id
              and reports.user_id = (select auth.uid())
        )
    );

drop policy if exists market_benchmark_snapshots_own_delete on public.market_benchmark_snapshots;
create policy market_benchmark_snapshots_own_delete
    on public.market_benchmark_snapshots
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);

alter table public.market_intelligence_changes
    add column if not exists change_reason text;

commit;

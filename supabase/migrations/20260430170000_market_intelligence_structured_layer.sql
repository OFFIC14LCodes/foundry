begin;

-- These tables will power future Market Intelligence upgrades and should not
-- break the existing daily report flow backed by public.market_reports.

create table if not exists public.competitors (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    description text not null default '',
    website text,
    created_at timestamptz not null default now()
);

create index if not exists idx_competitors_user_id_created_at
    on public.competitors (user_id, created_at desc);

create table if not exists public.competitor_snapshots (
    id uuid primary key default gen_random_uuid(),
    competitor_id uuid not null references public.competitors(id) on delete cascade,
    summary text not null default '',
    strengths jsonb not null default '[]'::jsonb,
    weaknesses jsonb not null default '[]'::jsonb,
    pricing_notes text,
    positioning text,
    created_at timestamptz not null default now()
);

create index if not exists idx_competitor_snapshots_competitor_id_created_at
    on public.competitor_snapshots (competitor_id, created_at desc);

create table if not exists public.market_trends (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    description text not null default '',
    impact_level text not null default 'medium',
    timeframe text not null default 'current',
    created_at timestamptz not null default now()
);

create index if not exists idx_market_trends_user_id_created_at
    on public.market_trends (user_id, created_at desc);

create table if not exists public.industry_benchmarks (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    metric text not null,
    value text not null,
    unit text,
    description text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists idx_industry_benchmarks_user_id_created_at
    on public.industry_benchmarks (user_id, created_at desc);

create table if not exists public.market_report_sources (
    id uuid primary key default gen_random_uuid(),
    report_id uuid not null references public.market_reports(id) on delete cascade,
    title text not null,
    url text not null,
    snippet text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists idx_market_report_sources_report_id_created_at
    on public.market_report_sources (report_id, created_at asc);

alter table public.competitors enable row level security;
alter table public.competitor_snapshots enable row level security;
alter table public.market_trends enable row level security;
alter table public.industry_benchmarks enable row level security;
alter table public.market_report_sources enable row level security;

drop policy if exists competitors_own_read on public.competitors;
create policy competitors_own_read
    on public.competitors
    for select
    using (user_id = auth.uid());

drop policy if exists competitors_own_insert on public.competitors;
create policy competitors_own_insert
    on public.competitors
    for insert
    with check (user_id = auth.uid());

drop policy if exists competitors_own_update on public.competitors;
create policy competitors_own_update
    on public.competitors
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists competitors_own_delete on public.competitors;
create policy competitors_own_delete
    on public.competitors
    for delete
    using (user_id = auth.uid());

drop policy if exists competitor_snapshots_owner_read on public.competitor_snapshots;
create policy competitor_snapshots_owner_read
    on public.competitor_snapshots
    for select
    using (
        exists (
            select 1
            from public.competitors c
            where c.id = competitor_snapshots.competitor_id
              and c.user_id = auth.uid()
        )
    );

drop policy if exists competitor_snapshots_owner_insert on public.competitor_snapshots;
create policy competitor_snapshots_owner_insert
    on public.competitor_snapshots
    for insert
    with check (
        exists (
            select 1
            from public.competitors c
            where c.id = competitor_snapshots.competitor_id
              and c.user_id = auth.uid()
        )
    );

drop policy if exists competitor_snapshots_owner_update on public.competitor_snapshots;
create policy competitor_snapshots_owner_update
    on public.competitor_snapshots
    for update
    using (
        exists (
            select 1
            from public.competitors c
            where c.id = competitor_snapshots.competitor_id
              and c.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1
            from public.competitors c
            where c.id = competitor_snapshots.competitor_id
              and c.user_id = auth.uid()
        )
    );

drop policy if exists competitor_snapshots_owner_delete on public.competitor_snapshots;
create policy competitor_snapshots_owner_delete
    on public.competitor_snapshots
    for delete
    using (
        exists (
            select 1
            from public.competitors c
            where c.id = competitor_snapshots.competitor_id
              and c.user_id = auth.uid()
        )
    );

drop policy if exists market_trends_own_read on public.market_trends;
create policy market_trends_own_read
    on public.market_trends
    for select
    using (user_id = auth.uid());

drop policy if exists market_trends_own_insert on public.market_trends;
create policy market_trends_own_insert
    on public.market_trends
    for insert
    with check (user_id = auth.uid());

drop policy if exists market_trends_own_update on public.market_trends;
create policy market_trends_own_update
    on public.market_trends
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists market_trends_own_delete on public.market_trends;
create policy market_trends_own_delete
    on public.market_trends
    for delete
    using (user_id = auth.uid());

drop policy if exists industry_benchmarks_own_read on public.industry_benchmarks;
create policy industry_benchmarks_own_read
    on public.industry_benchmarks
    for select
    using (user_id = auth.uid());

drop policy if exists industry_benchmarks_own_insert on public.industry_benchmarks;
create policy industry_benchmarks_own_insert
    on public.industry_benchmarks
    for insert
    with check (user_id = auth.uid());

drop policy if exists industry_benchmarks_own_update on public.industry_benchmarks;
create policy industry_benchmarks_own_update
    on public.industry_benchmarks
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists industry_benchmarks_own_delete on public.industry_benchmarks;
create policy industry_benchmarks_own_delete
    on public.industry_benchmarks
    for delete
    using (user_id = auth.uid());

drop policy if exists market_report_sources_owner_read on public.market_report_sources;
create policy market_report_sources_owner_read
    on public.market_report_sources
    for select
    using (
        exists (
            select 1
            from public.market_reports mr
            where mr.id = market_report_sources.report_id
              and mr.user_id = auth.uid()
        )
    );

drop policy if exists market_report_sources_owner_insert on public.market_report_sources;
create policy market_report_sources_owner_insert
    on public.market_report_sources
    for insert
    with check (
        exists (
            select 1
            from public.market_reports mr
            where mr.id = market_report_sources.report_id
              and mr.user_id = auth.uid()
        )
    );

drop policy if exists market_report_sources_owner_update on public.market_report_sources;
create policy market_report_sources_owner_update
    on public.market_report_sources
    for update
    using (
        exists (
            select 1
            from public.market_reports mr
            where mr.id = market_report_sources.report_id
              and mr.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1
            from public.market_reports mr
            where mr.id = market_report_sources.report_id
              and mr.user_id = auth.uid()
        )
    );

drop policy if exists market_report_sources_owner_delete on public.market_report_sources;
create policy market_report_sources_owner_delete
    on public.market_report_sources
    for delete
    using (
        exists (
            select 1
            from public.market_reports mr
            where mr.id = market_report_sources.report_id
              and mr.user_id = auth.uid()
        )
    );

commit;

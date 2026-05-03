begin;

create table if not exists public.market_intelligence_changes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    report_id uuid not null references public.market_reports(id) on delete cascade,
    action_id uuid references public.foundry_actions(id) on delete set null,
    entity_type text not null check (entity_type in ('competitor', 'trend', 'benchmark')),
    entity_name text not null,
    change_type text not null check (change_type in ('added', 'removed', 'changed')),
    change_summary text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists idx_market_intelligence_changes_user_report_created
    on public.market_intelligence_changes (user_id, report_id, created_at desc);

create index if not exists idx_market_intelligence_changes_user_entity
    on public.market_intelligence_changes (user_id, entity_type, lower(entity_name), created_at desc);

create unique index if not exists uq_market_intelligence_changes_report_entity_change
    on public.market_intelligence_changes (report_id, entity_type, lower(entity_name), change_type);

alter table public.market_intelligence_changes enable row level security;

drop policy if exists market_intelligence_changes_own_read on public.market_intelligence_changes;
create policy market_intelligence_changes_own_read
    on public.market_intelligence_changes
    for select
    to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists market_intelligence_changes_own_insert on public.market_intelligence_changes;
create policy market_intelligence_changes_own_insert
    on public.market_intelligence_changes
    for insert
    to authenticated
    with check (
        (select auth.uid()) = user_id
        and (
            action_id is null
            or exists (
                select 1
                from public.foundry_actions fa
                where fa.id = action_id
                  and fa.user_id = (select auth.uid())
            )
        )
    );

drop policy if exists market_intelligence_changes_own_update on public.market_intelligence_changes;
create policy market_intelligence_changes_own_update
    on public.market_intelligence_changes
    for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check (
        (select auth.uid()) = user_id
        and (
            action_id is null
            or exists (
                select 1
                from public.foundry_actions fa
                where fa.id = action_id
                  and fa.user_id = (select auth.uid())
            )
        )
    );

drop policy if exists market_intelligence_changes_own_delete on public.market_intelligence_changes;
create policy market_intelligence_changes_own_delete
    on public.market_intelligence_changes
    for delete
    to authenticated
    using ((select auth.uid()) = user_id);

commit;

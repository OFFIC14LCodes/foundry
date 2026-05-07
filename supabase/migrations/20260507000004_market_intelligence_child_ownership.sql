begin;

drop policy if exists market_intelligence_changes_own_insert on public.market_intelligence_changes;
create policy market_intelligence_changes_own_insert
    on public.market_intelligence_changes
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
        and exists (
            select 1
            from public.market_reports reports
            where reports.id = report_id
              and reports.user_id = (select auth.uid())
        )
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

drop policy if exists trend_snapshots_own_insert on public.trend_snapshots;
create policy trend_snapshots_own_insert
    on public.trend_snapshots
    for insert
    with check (
        user_id = auth.uid()
        and (
            report_id is null
            or exists (
                select 1
                from public.market_reports reports
                where reports.id = report_id
                  and reports.user_id = auth.uid()
            )
        )
    );

drop policy if exists trend_snapshots_own_update on public.trend_snapshots;
create policy trend_snapshots_own_update
    on public.trend_snapshots
    for update
    using (user_id = auth.uid())
    with check (
        user_id = auth.uid()
        and (
            report_id is null
            or exists (
                select 1
                from public.market_reports reports
                where reports.id = report_id
                  and reports.user_id = auth.uid()
            )
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
        and (
            report_id is null
            or exists (
                select 1
                from public.market_reports reports
                where reports.id = report_id
                  and reports.user_id = auth.uid()
            )
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
        and (
            report_id is null
            or exists (
                select 1
                from public.market_reports reports
                where reports.id = report_id
                  and reports.user_id = auth.uid()
            )
        )
    );

commit;

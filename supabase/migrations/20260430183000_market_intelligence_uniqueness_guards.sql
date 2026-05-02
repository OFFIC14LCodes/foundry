begin;

create unique index if not exists uq_competitors_user_lower_name
    on public.competitors (user_id, lower(name));

create unique index if not exists uq_market_trends_user_lower_name_impact_timeframe
    on public.market_trends (user_id, lower(name), impact_level, timeframe);

create unique index if not exists uq_industry_benchmarks_user_lower_metric_value_unit
    on public.industry_benchmarks (user_id, lower(metric), value, coalesce(unit, ''));

create unique index if not exists uq_market_report_sources_report_lower_title_url
    on public.market_report_sources (report_id, lower(title), url);

-- TODO: Do not add a fragile uniqueness constraint on competitor_snapshots yet.
-- If snapshot-level dedupe becomes necessary at the database layer, add a
-- normalized content hash column first and enforce uniqueness on that hash.

commit;

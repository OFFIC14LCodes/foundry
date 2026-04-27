alter table if exists public.briefings
    add column if not exists week_start date,
    add column if not exists highlights jsonb,
    add column if not exists source_counts jsonb,
    add column if not exists generated_at timestamptz default now();

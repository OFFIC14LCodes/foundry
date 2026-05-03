begin;

-- ── Mood column on journal entries ────────────────────────────
alter table public.journal_entries
    add column if not exists mood text;

-- ── Weekly summaries table ────────────────────────────────────
create table if not exists public.journal_weekly_summaries (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references auth.users(id) on delete cascade,
    week_start   date not null,
    week_end     date not null,
    summary_text text not null,
    themes       jsonb,
    entry_count  integer not null default 0,
    generated_at timestamptz not null default now(),
    unique (user_id, week_start)
);

create index if not exists idx_journal_weekly_summaries_user_week
    on public.journal_weekly_summaries (user_id, week_start desc);

alter table public.journal_weekly_summaries enable row level security;

create policy "journal_weekly_summaries_owner"
on public.journal_weekly_summaries for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

commit;

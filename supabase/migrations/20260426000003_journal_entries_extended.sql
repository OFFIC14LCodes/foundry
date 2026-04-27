begin;

alter table public.journal_entries
    add column if not exists stage_id integer,
    add column if not exists word_count integer,
    add column if not exists forge_summary text,
    add column if not exists themes text[],
    add column if not exists summary_generated_at timestamptz;

commit;

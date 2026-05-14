begin;

alter table public.daily_chat_summaries
    add column if not exists archive_source_type text,
    add column if not exists archive_source_ref_id text,
    add column if not exists archive_source_title text,
    add column if not exists archive_source_metadata jsonb not null default '{}'::jsonb;

create index if not exists idx_daily_chat_summaries_archive_source
    on public.daily_chat_summaries (user_id, archive_source_type, archive_source_ref_id);

commit;

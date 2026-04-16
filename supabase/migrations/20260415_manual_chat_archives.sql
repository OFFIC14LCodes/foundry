begin;

alter table public.daily_chat_summaries
    drop constraint if exists daily_chat_summaries_user_stage_date_key;

drop index if exists idx_daily_chat_summaries_user_stage_date;

create index if not exists idx_daily_chat_summaries_user_stage_created
    on public.daily_chat_summaries (user_id, stage_id, created_at desc);

commit;

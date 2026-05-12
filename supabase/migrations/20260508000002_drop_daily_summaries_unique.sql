-- The unique constraint on (user_id, stage_id, summary_date) prevents users
-- from saving multiple manual archives on the same day as an auto-generated
-- stage summary. Drop it — the primary key (id uuid) already guarantees
-- row uniqueness. persistStageSummaryToday now does a select+update
-- instead of relying on ON CONFLICT.
alter table public.daily_chat_summaries
    drop constraint if exists daily_chat_summaries_user_stage_date_key;

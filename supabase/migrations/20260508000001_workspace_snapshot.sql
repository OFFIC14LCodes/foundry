alter table public.daily_chat_summaries
    add column if not exists workspace_snapshot jsonb default null;

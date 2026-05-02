alter table public.briefings
    add column if not exists streak_count integer default 1;

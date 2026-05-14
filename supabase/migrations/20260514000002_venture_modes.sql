begin;

alter table public.profiles
    add column if not exists venture_mode text not null default 'business',
    add column if not exists venture_goal text,
    add column if not exists weekly_hours_available integer,
    add column if not exists target_monthly_income numeric,
    add column if not exists transition_timeline text;

alter table public.profiles
    drop constraint if exists profiles_venture_mode_check;

alter table public.profiles
    add constraint profiles_venture_mode_check
    check (venture_mode in ('business', 'side_hustle', 'side_hustle_to_full_time', 'exploring'));

commit;

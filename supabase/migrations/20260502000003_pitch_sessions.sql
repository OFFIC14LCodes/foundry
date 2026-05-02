begin;

create table if not exists public.pitch_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    scenario text not null,
    mode text not null default 'text',
    duration_seconds integer,
    transcript jsonb not null default '[]',
    feedback text,
    clarity_score integer,
    confidence_score integer,
    persuasiveness_score integer,
    brevity_score integer,
    overall_score integer,
    key_strengths text[],
    key_improvements text[],
    most_important_fix text,
    encouragement text,
    created_at timestamptz default now()
);

create index if not exists idx_pitch_sessions_user_id
    on public.pitch_sessions(user_id, created_at desc);

alter table public.pitch_sessions enable row level security;

drop policy if exists pitch_sessions_own_read on public.pitch_sessions;
create policy pitch_sessions_own_read
    on public.pitch_sessions
    for select
    using (user_id = auth.uid());

drop policy if exists pitch_sessions_own_insert on public.pitch_sessions;
create policy pitch_sessions_own_insert
    on public.pitch_sessions
    for insert
    with check (user_id = auth.uid());

drop policy if exists pitch_sessions_own_update on public.pitch_sessions;
create policy pitch_sessions_own_update
    on public.pitch_sessions
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists pitch_sessions_own_delete on public.pitch_sessions;
create policy pitch_sessions_own_delete
    on public.pitch_sessions
    for delete
    using (user_id = auth.uid());

commit;

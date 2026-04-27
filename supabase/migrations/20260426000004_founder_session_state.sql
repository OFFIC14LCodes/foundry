begin;

create table if not exists public.founder_session_state (
    user_id uuid primary key references auth.users(id) on delete cascade,
    last_seen_at timestamptz,
    last_screen text,
    weekly_journal_summary text,
    weekly_journal_summary_generated_at timestamptz,
    updated_at timestamptz not null default now()
);

create or replace function public.set_founder_session_state_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists founder_session_state_set_updated_at on public.founder_session_state;
create trigger founder_session_state_set_updated_at
    before update on public.founder_session_state
    for each row
    execute function public.set_founder_session_state_updated_at();

alter table public.founder_session_state enable row level security;

drop policy if exists founder_session_state_select on public.founder_session_state;
create policy founder_session_state_select
    on public.founder_session_state
    for select
    using (user_id = auth.uid());

drop policy if exists founder_session_state_insert on public.founder_session_state;
create policy founder_session_state_insert
    on public.founder_session_state
    for insert
    with check (user_id = auth.uid());

drop policy if exists founder_session_state_update on public.founder_session_state;
create policy founder_session_state_update
    on public.founder_session_state
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists founder_session_state_delete on public.founder_session_state;
create policy founder_session_state_delete
    on public.founder_session_state
    for delete
    using (user_id = auth.uid());

commit;

begin;

create table if not exists public.founder_nudges (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    nudge_type text not null,
    nudge_text text not null,
    signal_source text not null,
    seen_at timestamptz,
    dismissed_at timestamptz,
    acted_on_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_founder_nudges_user_id
    on public.founder_nudges (user_id, created_at desc);

alter table public.founder_nudges enable row level security;

drop policy if exists founder_nudges_select on public.founder_nudges;
create policy founder_nudges_select
    on public.founder_nudges
    for select
    using (user_id = auth.uid());

drop policy if exists founder_nudges_insert on public.founder_nudges;
create policy founder_nudges_insert
    on public.founder_nudges
    for insert
    with check (user_id = auth.uid());

drop policy if exists founder_nudges_update on public.founder_nudges;
create policy founder_nudges_update
    on public.founder_nudges
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists founder_nudges_delete on public.founder_nudges;
create policy founder_nudges_delete
    on public.founder_nudges
    for delete
    using (user_id = auth.uid());

commit;

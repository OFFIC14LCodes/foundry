begin;

create table if not exists public.founder_decisions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    stage_id integer not null,
    tag text,
    text text not null,
    decided_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists idx_founder_decisions_user_id
    on public.founder_decisions (user_id);

create index if not exists idx_founder_decisions_decided_at
    on public.founder_decisions (user_id, decided_at desc);

alter table public.founder_decisions enable row level security;

drop policy if exists founder_decisions_select on public.founder_decisions;
create policy founder_decisions_select
    on public.founder_decisions
    for select
    using (user_id = auth.uid());

drop policy if exists founder_decisions_insert on public.founder_decisions;
create policy founder_decisions_insert
    on public.founder_decisions
    for insert
    with check (user_id = auth.uid());

drop policy if exists founder_decisions_update on public.founder_decisions;
create policy founder_decisions_update
    on public.founder_decisions
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists founder_decisions_delete on public.founder_decisions;
create policy founder_decisions_delete
    on public.founder_decisions
    for delete
    using (user_id = auth.uid());

commit;

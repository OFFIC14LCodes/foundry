begin;

create table if not exists public.produced_documents (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    doc_type text not null,
    audience text not null,
    tone text not null,
    request text not null default '',
    content text not null,
    history jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_produced_documents_user_updated
    on public.produced_documents (user_id, updated_at desc);

alter table public.produced_documents enable row level security;

drop policy if exists produced_documents_own_read on public.produced_documents;
create policy produced_documents_own_read
    on public.produced_documents
    for select
    using (user_id = auth.uid());

drop policy if exists produced_documents_own_insert on public.produced_documents;
create policy produced_documents_own_insert
    on public.produced_documents
    for insert
    with check (user_id = auth.uid());

drop policy if exists produced_documents_own_update on public.produced_documents;
create policy produced_documents_own_update
    on public.produced_documents
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists produced_documents_own_delete on public.produced_documents;
create policy produced_documents_own_delete
    on public.produced_documents
    for delete
    using (user_id = auth.uid());

commit;

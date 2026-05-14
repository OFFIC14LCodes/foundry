begin;

create table if not exists public.founder_books (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    book_type text not null check (book_type in ('business', 'academy', 'quick_chat', 'market_intelligence', 'pitch_practice', 'chat_room')),
    title text not null,
    content text not null default '',
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(user_id, book_type)
);

create table if not exists public.founder_book_sources (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    book_id uuid not null references public.founder_books(id) on delete cascade,
    archive_summary_id uuid references public.daily_chat_summaries(id) on delete set null,
    source_type text not null,
    source_ref_id text,
    source_title text,
    source_stage_id integer,
    source_metadata jsonb not null default '{}'::jsonb,
    applied_at timestamptz not null default now(),
    unique(book_id, archive_summary_id)
);

create index if not exists idx_founder_books_user_updated
    on public.founder_books (user_id, updated_at desc);

create index if not exists idx_founder_book_sources_book_applied
    on public.founder_book_sources (book_id, applied_at desc);

alter table public.founder_books enable row level security;
alter table public.founder_book_sources enable row level security;

drop policy if exists founder_books_own_read on public.founder_books;
create policy founder_books_own_read
    on public.founder_books
    for select
    using (user_id = auth.uid());

drop policy if exists founder_books_own_insert on public.founder_books;
create policy founder_books_own_insert
    on public.founder_books
    for insert
    with check (user_id = auth.uid());

drop policy if exists founder_books_own_update on public.founder_books;
create policy founder_books_own_update
    on public.founder_books
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists founder_books_own_delete on public.founder_books;
create policy founder_books_own_delete
    on public.founder_books
    for delete
    using (user_id = auth.uid());

drop policy if exists founder_book_sources_own_read on public.founder_book_sources;
create policy founder_book_sources_own_read
    on public.founder_book_sources
    for select
    using (user_id = auth.uid());

drop policy if exists founder_book_sources_own_insert on public.founder_book_sources;
create policy founder_book_sources_own_insert
    on public.founder_book_sources
    for insert
    with check (
        user_id = auth.uid()
        and exists (
            select 1
            from public.founder_books fb
            where fb.id = founder_book_sources.book_id
              and fb.user_id = auth.uid()
        )
    );

drop policy if exists founder_book_sources_own_update on public.founder_book_sources;
create policy founder_book_sources_own_update
    on public.founder_book_sources
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists founder_book_sources_own_delete on public.founder_book_sources;
create policy founder_book_sources_own_delete
    on public.founder_book_sources
    for delete
    using (user_id = auth.uid());

commit;

begin;

create table if not exists public.conversation_threads (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    stage_id integer not null check (stage_id between 1 and 6),
    summary_id uuid references public.daily_chat_summaries(id) on delete set null,
    created_at timestamptz not null default now(),
    last_message_at timestamptz
);

create table if not exists public.conversation_messages (
    id uuid primary key default gen_random_uuid(),
    thread_id uuid not null references public.conversation_threads(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('user', 'forge', 'assistant', 'system')),
    content text not null default '',
    created_at timestamptz not null default now(),
    token_count integer not null default 0 check (token_count >= 0)
);

create table if not exists public.message_attachments (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references public.conversation_messages(id) on delete cascade,
    file_name text not null,
    file_type text not null default 'application/octet-stream',
    storage_path text not null default '',
    created_at timestamptz not null default now()
);

create index if not exists idx_conversation_threads_user_stage_last_message
    on public.conversation_threads (user_id, stage_id, last_message_at desc nulls last, created_at desc);

create index if not exists idx_conversation_threads_user_created_at
    on public.conversation_threads (user_id, created_at desc);

create index if not exists idx_conversation_messages_thread_created_at
    on public.conversation_messages (thread_id, created_at desc);

create index if not exists idx_conversation_messages_user_created_at
    on public.conversation_messages (user_id, created_at desc);

create index if not exists idx_message_attachments_message_id
    on public.message_attachments (message_id);

alter table public.conversation_threads enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.message_attachments enable row level security;

drop policy if exists conversation_threads_own_read on public.conversation_threads;
create policy conversation_threads_own_read
    on public.conversation_threads
    for select
    using (user_id = auth.uid());

drop policy if exists conversation_threads_own_insert on public.conversation_threads;
create policy conversation_threads_own_insert
    on public.conversation_threads
    for insert
    with check (user_id = auth.uid());

drop policy if exists conversation_threads_own_update on public.conversation_threads;
create policy conversation_threads_own_update
    on public.conversation_threads
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists conversation_threads_own_delete on public.conversation_threads;
create policy conversation_threads_own_delete
    on public.conversation_threads
    for delete
    using (user_id = auth.uid());

drop policy if exists conversation_messages_own_read on public.conversation_messages;
create policy conversation_messages_own_read
    on public.conversation_messages
    for select
    using (user_id = auth.uid());

drop policy if exists conversation_messages_own_insert on public.conversation_messages;
create policy conversation_messages_own_insert
    on public.conversation_messages
    for insert
    with check (
        user_id = auth.uid()
        and exists (
            select 1
            from public.conversation_threads ct
            where ct.id = conversation_messages.thread_id
              and ct.user_id = auth.uid()
        )
    );

drop policy if exists conversation_messages_own_update on public.conversation_messages;
create policy conversation_messages_own_update
    on public.conversation_messages
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists conversation_messages_own_delete on public.conversation_messages;
create policy conversation_messages_own_delete
    on public.conversation_messages
    for delete
    using (user_id = auth.uid());

drop policy if exists message_attachments_own_read on public.message_attachments;
create policy message_attachments_own_read
    on public.message_attachments
    for select
    using (
        exists (
            select 1
            from public.conversation_messages cm
            where cm.id = message_attachments.message_id
              and cm.user_id = auth.uid()
        )
    );

drop policy if exists message_attachments_own_insert on public.message_attachments;
create policy message_attachments_own_insert
    on public.message_attachments
    for insert
    with check (
        exists (
            select 1
            from public.conversation_messages cm
            where cm.id = message_attachments.message_id
              and cm.user_id = auth.uid()
        )
    );

drop policy if exists message_attachments_own_update on public.message_attachments;
create policy message_attachments_own_update
    on public.message_attachments
    for update
    using (
        exists (
            select 1
            from public.conversation_messages cm
            where cm.id = message_attachments.message_id
              and cm.user_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1
            from public.conversation_messages cm
            where cm.id = message_attachments.message_id
              and cm.user_id = auth.uid()
        )
    );

drop policy if exists message_attachments_own_delete on public.message_attachments;
create policy message_attachments_own_delete
    on public.message_attachments
    for delete
    using (
        exists (
            select 1
            from public.conversation_messages cm
            where cm.id = message_attachments.message_id
              and cm.user_id = auth.uid()
        )
    );

commit;

begin;

do $$
begin
    if not exists (select 1 from pg_type where typname = 'document_status') then
        create type public.document_status as enum (
            'draft',
            'generated',
            'reviewed',
            'sent_for_signature',
            'partially_signed',
            'signed',
            'declined',
            'archived'
        );
    end if;

    if not exists (select 1 from pg_type where typname = 'document_file_kind') then
        create type public.document_file_kind as enum (
            'source_upload',
            'generated_pdf',
            'generated_docx',
            'generated_html',
            'signed_pdf',
            'attachment'
        );
    end if;

    if not exists (select 1 from pg_type where typname = 'document_signature_status') then
        create type public.document_signature_status as enum (
            'draft',
            'sent',
            'viewed',
            'completed',
            'declined',
            'expired',
            'canceled',
            'error'
        );
    end if;
end
$$;

create or replace function public.set_document_vault_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create table if not exists public.document_folders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    business_id uuid,
    parent_folder_id uuid references public.document_folders(id) on delete set null,
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz,
    metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.documents (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    business_id uuid,
    folder_id uuid references public.document_folders(id) on delete set null,
    source_produced_document_id uuid references public.produced_documents(id) on delete set null,
    title text not null,
    doc_type text not null,
    category text,
    status public.document_status not null default 'draft',
    stage_id integer,
    audience text,
    tone text,
    current_version_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz,
    metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.document_versions (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.documents(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    version_number integer not null check (version_number > 0),
    title text not null,
    content text not null,
    change_summary text,
    source text not null,
    created_at timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb,
    unique(document_id, version_number)
);

alter table public.documents
    drop constraint if exists documents_current_version_id_fkey;

alter table public.documents
    add constraint documents_current_version_id_fkey
    foreign key (current_version_id)
    references public.document_versions(id)
    on delete set null;

create table if not exists public.document_files (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.documents(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    version_id uuid references public.document_versions(id) on delete set null,
    storage_bucket text not null,
    storage_path text not null,
    filename text not null,
    mime_type text not null,
    file_size bigint not null check (file_size >= 0),
    file_kind public.document_file_kind not null,
    created_at timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb,
    unique(storage_bucket, storage_path)
);

create table if not exists public.document_signature_requests (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.documents(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    version_id uuid references public.document_versions(id) on delete set null,
    provider text,
    provider_request_id text,
    status public.document_signature_status not null default 'draft',
    signer_name text,
    signer_email text,
    sent_at timestamptz,
    completed_at timestamptz,
    declined_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.document_signature_events (
    id uuid primary key default gen_random_uuid(),
    signature_request_id uuid not null references public.document_signature_requests(id) on delete cascade,
    document_id uuid not null references public.documents(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    provider text,
    event_type text not null,
    event_status public.document_signature_status,
    payload jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index if not exists idx_document_folders_user_created
    on public.document_folders (user_id, created_at desc);
create index if not exists idx_document_folders_parent
    on public.document_folders (parent_folder_id);

create index if not exists idx_documents_user_updated
    on public.documents (user_id, updated_at desc);
create index if not exists idx_documents_user_created
    on public.documents (user_id, created_at desc);
create index if not exists idx_documents_status
    on public.documents (status);
create index if not exists idx_documents_doc_type
    on public.documents (doc_type);
create index if not exists idx_documents_source_produced
    on public.documents (source_produced_document_id);
create unique index if not exists idx_documents_source_produced_unique
    on public.documents (source_produced_document_id)
    where source_produced_document_id is not null;
create index if not exists idx_documents_folder
    on public.documents (folder_id);
create index if not exists idx_documents_stage
    on public.documents (stage_id);

create index if not exists idx_document_versions_document_created
    on public.document_versions (document_id, created_at desc);
create index if not exists idx_document_versions_user_created
    on public.document_versions (user_id, created_at desc);

create index if not exists idx_document_files_document_created
    on public.document_files (document_id, created_at desc);
create index if not exists idx_document_files_user_created
    on public.document_files (user_id, created_at desc);
create index if not exists idx_document_files_kind
    on public.document_files (file_kind);
create index if not exists idx_document_files_version
    on public.document_files (version_id);

create index if not exists idx_document_signature_requests_document_created
    on public.document_signature_requests (document_id, created_at desc);
create index if not exists idx_document_signature_requests_user_created
    on public.document_signature_requests (user_id, created_at desc);
create index if not exists idx_document_signature_requests_status
    on public.document_signature_requests (status);
create index if not exists idx_document_signature_requests_provider_request
    on public.document_signature_requests (provider_request_id);

create index if not exists idx_document_signature_events_request_occurred
    on public.document_signature_events (signature_request_id, occurred_at desc);
create index if not exists idx_document_signature_events_document_occurred
    on public.document_signature_events (document_id, occurred_at desc);

drop trigger if exists document_folders_set_updated_at on public.document_folders;
create trigger document_folders_set_updated_at
    before update on public.document_folders
    for each row
    execute function public.set_document_vault_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
    before update on public.documents
    for each row
    execute function public.set_document_vault_updated_at();

drop trigger if exists document_signature_requests_set_updated_at on public.document_signature_requests;
create trigger document_signature_requests_set_updated_at
    before update on public.document_signature_requests
    for each row
    execute function public.set_document_vault_updated_at();

alter table public.document_folders enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_files enable row level security;
alter table public.document_signature_requests enable row level security;
alter table public.document_signature_events enable row level security;

drop policy if exists document_folders_own_select on public.document_folders;
create policy document_folders_own_select
    on public.document_folders
    for select
    using (user_id = auth.uid());

drop policy if exists document_folders_own_insert on public.document_folders;
create policy document_folders_own_insert
    on public.document_folders
    for insert
    with check (user_id = auth.uid());

drop policy if exists document_folders_own_update on public.document_folders;
create policy document_folders_own_update
    on public.document_folders
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists document_folders_own_delete on public.document_folders;
create policy document_folders_own_delete
    on public.document_folders
    for delete
    using (user_id = auth.uid());

drop policy if exists documents_own_select on public.documents;
create policy documents_own_select
    on public.documents
    for select
    using (user_id = auth.uid());

drop policy if exists documents_own_insert on public.documents;
create policy documents_own_insert
    on public.documents
    for insert
    with check (user_id = auth.uid());

drop policy if exists documents_own_update on public.documents;
create policy documents_own_update
    on public.documents
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists documents_own_delete on public.documents;
create policy documents_own_delete
    on public.documents
    for delete
    using (user_id = auth.uid());

drop policy if exists document_versions_own_select on public.document_versions;
create policy document_versions_own_select
    on public.document_versions
    for select
    using (user_id = auth.uid());

drop policy if exists document_versions_own_insert on public.document_versions;
create policy document_versions_own_insert
    on public.document_versions
    for insert
    with check (user_id = auth.uid());

drop policy if exists document_versions_own_update on public.document_versions;
create policy document_versions_own_update
    on public.document_versions
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists document_versions_own_delete on public.document_versions;
create policy document_versions_own_delete
    on public.document_versions
    for delete
    using (user_id = auth.uid());

drop policy if exists document_files_own_select on public.document_files;
create policy document_files_own_select
    on public.document_files
    for select
    using (user_id = auth.uid());

drop policy if exists document_files_own_insert on public.document_files;
create policy document_files_own_insert
    on public.document_files
    for insert
    with check (user_id = auth.uid());

drop policy if exists document_files_own_update on public.document_files;
create policy document_files_own_update
    on public.document_files
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists document_files_own_delete on public.document_files;
create policy document_files_own_delete
    on public.document_files
    for delete
    using (user_id = auth.uid());

drop policy if exists document_signature_requests_own_select on public.document_signature_requests;
create policy document_signature_requests_own_select
    on public.document_signature_requests
    for select
    using (user_id = auth.uid());

drop policy if exists document_signature_requests_own_insert on public.document_signature_requests;
create policy document_signature_requests_own_insert
    on public.document_signature_requests
    for insert
    with check (user_id = auth.uid());

drop policy if exists document_signature_requests_own_update on public.document_signature_requests;
create policy document_signature_requests_own_update
    on public.document_signature_requests
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists document_signature_requests_own_delete on public.document_signature_requests;
create policy document_signature_requests_own_delete
    on public.document_signature_requests
    for delete
    using (user_id = auth.uid());

drop policy if exists document_signature_events_own_select on public.document_signature_events;
create policy document_signature_events_own_select
    on public.document_signature_events
    for select
    using (user_id = auth.uid());

drop policy if exists document_signature_events_own_insert on public.document_signature_events;
create policy document_signature_events_own_insert
    on public.document_signature_events
    for insert
    with check (user_id = auth.uid());

drop policy if exists document_signature_events_own_update on public.document_signature_events;
create policy document_signature_events_own_update
    on public.document_signature_events
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists document_signature_events_own_delete on public.document_signature_events;
create policy document_signature_events_own_delete
    on public.document_signature_events
    for delete
    using (user_id = auth.uid());

commit;

begin;

alter table public.document_signature_requests
    add column if not exists file_id uuid references public.document_files(id) on delete set null;

create index if not exists idx_document_signature_requests_file
    on public.document_signature_requests (file_id);

commit;

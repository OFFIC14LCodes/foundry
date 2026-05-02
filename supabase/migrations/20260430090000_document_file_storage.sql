begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'document-files',
    'document-files',
    false,
    52428800,
    array[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/html',
        'text/plain',
        'application/msword',
        'application/rtf',
        'image/png',
        'image/jpeg',
        'image/webp'
    ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists document_files_storage_select on storage.objects;
create policy document_files_storage_select
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'document-files'
        and (storage.foldername(name))[1] = 'users'
        and (storage.foldername(name))[2] = auth.uid()::text
    );

drop policy if exists document_files_storage_insert on storage.objects;
create policy document_files_storage_insert
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'document-files'
        and (storage.foldername(name))[1] = 'users'
        and (storage.foldername(name))[2] = auth.uid()::text
    );

drop policy if exists document_files_storage_update on storage.objects;
create policy document_files_storage_update
    on storage.objects
    for update
    to authenticated
    using (
        bucket_id = 'document-files'
        and (storage.foldername(name))[1] = 'users'
        and (storage.foldername(name))[2] = auth.uid()::text
    )
    with check (
        bucket_id = 'document-files'
        and (storage.foldername(name))[1] = 'users'
        and (storage.foldername(name))[2] = auth.uid()::text
    );

drop policy if exists document_files_storage_delete on storage.objects;
create policy document_files_storage_delete
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'document-files'
        and (storage.foldername(name))[1] = 'users'
        and (storage.foldername(name))[2] = auth.uid()::text
    );

commit;

# Migration Chain Notes

This directory is intended to replay against a fresh Supabase project.

External/base schema assumptions:

- `auth.users` is provided by Supabase Auth.
- `storage.buckets`, `storage.objects`, and `storage.foldername(...)` are provided by Supabase Storage.
- `gen_random_uuid()` is available in Supabase Postgres.

Core app tables that earlier app code treated as pre-existing are now created in
`20260401000000_core_app_tables.sql` before later migrations alter or backfill
them:

- `public.profiles`
- `public.stage_progress`
- `public.messages` legacy chat compatibility table
- `public.journal_entries`
- `public.briefings`

`public.conversation_messages` is the current chat persistence table and is
created later by `20260502000008_conversation_threads.sql`. The legacy
`public.messages` table remains because admin/token usage code and fallback chat
loading still read it for older accounts.

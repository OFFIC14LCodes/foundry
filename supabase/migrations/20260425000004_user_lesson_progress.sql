create table if not exists public.user_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  content_id uuid references public.academy_content not null,
  status text check (status in ('not_started','in_progress','completed')),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz default now()
);

create index if not exists idx_user_lesson_progress_user_content
  on public.user_lesson_progress (user_id, content_id);

alter table public.user_lesson_progress enable row level security;

drop policy if exists user_lesson_progress_own_select on public.user_lesson_progress;
create policy user_lesson_progress_own_select
  on public.user_lesson_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_lesson_progress_own_insert on public.user_lesson_progress;
create policy user_lesson_progress_own_insert
  on public.user_lesson_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_lesson_progress_own_update on public.user_lesson_progress;
create policy user_lesson_progress_own_update
  on public.user_lesson_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_lesson_progress_own_delete on public.user_lesson_progress;
create policy user_lesson_progress_own_delete
  on public.user_lesson_progress
  for delete
  to authenticated
  using (auth.uid() = user_id);

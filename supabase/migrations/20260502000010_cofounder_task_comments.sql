begin;

create table if not exists public.cofounder_task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.cofounder_tasks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cofounder_task_comments_task_id
  on public.cofounder_task_comments (task_id, created_at asc);

alter table public.cofounder_task_comments enable row level security;

-- Team members can read comments on tasks in their team
create policy "cofounder_task_comments_read"
on public.cofounder_task_comments for select
using (
  exists (
    select 1 from public.cofounder_tasks t
    join public.cofounder_members cm on cm.team_id = t.team_id
    where t.id = cofounder_task_comments.task_id
      and cm.user_id = auth.uid()
  )
);

-- Team members can add comments
create policy "cofounder_task_comments_insert"
on public.cofounder_task_comments for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.cofounder_tasks t
    join public.cofounder_members cm on cm.team_id = t.team_id
    where t.id = cofounder_task_comments.task_id
      and cm.user_id = auth.uid()
  )
);

-- Authors can delete their own comments; team owners can delete any
create policy "cofounder_task_comments_delete"
on public.cofounder_task_comments for delete
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.cofounder_tasks t
    join public.cofounder_teams ct on ct.id = t.team_id
    where t.id = cofounder_task_comments.task_id
      and ct.owner_id = auth.uid()
  )
);

commit;

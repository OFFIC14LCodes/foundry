begin;

create table if not exists public.cofounder_file_links (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.cofounder_teams(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  label        text not null,
  url          text not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_cofounder_file_links_workspace_id
  on public.cofounder_file_links (workspace_id, created_at desc);

alter table public.cofounder_file_links enable row level security;

-- Team members can read all file links for their workspace
create policy "cofounder_file_links_read"
on public.cofounder_file_links for select
using (
  exists (
    select 1 from public.cofounder_members cm
    where cm.team_id = cofounder_file_links.workspace_id
      and cm.user_id = auth.uid()
  )
);

-- Team members can add file links
create policy "cofounder_file_links_insert"
on public.cofounder_file_links for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.cofounder_members cm
    where cm.team_id = cofounder_file_links.workspace_id
      and cm.user_id = auth.uid()
  )
);

-- Owner or creator can delete
create policy "cofounder_file_links_delete"
on public.cofounder_file_links for delete
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.cofounder_teams ct
    where ct.id = cofounder_file_links.workspace_id
      and ct.owner_id = auth.uid()
  )
);

commit;

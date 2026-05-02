begin;

-- ── Member DELETE policies ────────────────────────────────────
-- Owner can remove any non-owner member
create policy "cofounder_members_owner_delete"
on public.cofounder_members for delete
using (
  exists (
    select 1 from public.cofounder_teams
    where id = cofounder_members.team_id
      and owner_id = auth.uid()
  )
);

-- Member can remove themselves (leave team)
create policy "cofounder_members_self_delete"
on public.cofounder_members for delete
using (user_id = auth.uid());

-- ── Member UPDATE policy (role changes) ──────────────────────
-- Member can update their own row; owner can update any row
create policy "cofounder_members_role_update"
on public.cofounder_members for update
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.cofounder_teams
    where id = cofounder_members.team_id
      and owner_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  or exists (
    select 1 from public.cofounder_teams
    where id = cofounder_members.team_id
      and owner_id = auth.uid()
  )
);

-- ── Invite DELETE policy ──────────────────────────────────────
create policy "cofounder_invites_owner_delete"
on public.cofounder_invites for delete
using (
  exists (
    select 1 from public.cofounder_teams
    where id = cofounder_invites.team_id
      and owner_id = auth.uid()
  )
);

-- ── last_seen_at on members ────────────────────────────────────
alter table public.cofounder_members
  add column if not exists last_seen_at timestamptz default now();

-- ── Shared task list ──────────────────────────────────────────
create table if not exists public.cofounder_tasks (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.cofounder_teams(id) on delete cascade,
  created_by  uuid references auth.users(id) on delete set null,
  assigned_to uuid references public.cofounder_members(id) on delete set null,
  title       text not null,
  description text,
  status      text not null default 'todo',
  priority    text not null default 'normal',
  due_date    date,
  completed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_cofounder_tasks_team_id
  on public.cofounder_tasks (team_id, created_at desc);

alter table public.cofounder_tasks enable row level security;

create policy "cofounder_tasks_team_read"
on public.cofounder_tasks for select
using (
  exists (
    select 1 from public.cofounder_members cm
    where cm.team_id = cofounder_tasks.team_id
      and cm.user_id = auth.uid()
  )
  or exists (
    select 1 from public.cofounder_teams ct
    where ct.id = cofounder_tasks.team_id
      and ct.owner_id = auth.uid()
  )
);

create policy "cofounder_tasks_team_insert"
on public.cofounder_tasks for insert
with check (
  exists (
    select 1 from public.cofounder_members cm
    where cm.team_id = cofounder_tasks.team_id
      and cm.user_id = auth.uid()
  )
);

create policy "cofounder_tasks_team_update"
on public.cofounder_tasks for update
using (
  exists (
    select 1 from public.cofounder_members cm
    where cm.team_id = cofounder_tasks.team_id
      and cm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.cofounder_members cm
    where cm.team_id = cofounder_tasks.team_id
      and cm.user_id = auth.uid()
  )
);

create policy "cofounder_tasks_delete"
on public.cofounder_tasks for delete
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.cofounder_teams ct
    where ct.id = cofounder_tasks.team_id
      and ct.owner_id = auth.uid()
  )
);

commit;

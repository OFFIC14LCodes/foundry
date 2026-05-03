begin;

create table if not exists public.cofounder_decisions (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.cofounder_teams(id) on delete cascade,
  created_by       uuid references auth.users(id) on delete set null,
  source_message_id uuid references public.cofounder_messages(id) on delete set null,
  title            text not null,
  description      text,
  options          jsonb,
  chosen_option    text,
  rationale        text,
  decided_at       timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_cofounder_decisions_workspace_id
  on public.cofounder_decisions (workspace_id, created_at desc);

alter table public.cofounder_decisions enable row level security;

-- Team members can read all decisions for their workspace
create policy "cofounder_decisions_read"
on public.cofounder_decisions for select
using (
  exists (
    select 1 from public.cofounder_members cm
    where cm.team_id = cofounder_decisions.workspace_id
      and cm.user_id = auth.uid()
  )
);

-- Team members can insert decisions
create policy "cofounder_decisions_insert"
on public.cofounder_decisions for insert
with check (
  auth.uid() = created_by
  and exists (
    select 1 from public.cofounder_members cm
    where cm.team_id = cofounder_decisions.workspace_id
      and cm.user_id = auth.uid()
  )
);

-- Team members can update any decision (collaborative editing)
create policy "cofounder_decisions_update"
on public.cofounder_decisions for update
using (
  exists (
    select 1 from public.cofounder_members cm
    where cm.team_id = cofounder_decisions.workspace_id
      and cm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.cofounder_members cm
    where cm.team_id = cofounder_decisions.workspace_id
      and cm.user_id = auth.uid()
  )
);

-- Creator or owner can delete
create policy "cofounder_decisions_delete"
on public.cofounder_decisions for delete
using (
  created_by = auth.uid()
  or exists (
    select 1 from public.cofounder_teams ct
    where ct.id = cofounder_decisions.workspace_id
      and ct.owner_id = auth.uid()
  )
);

commit;

begin;

-- ── Security-definer helper ────────────────────────────────────────────────
-- Queries cofounder_members WITHOUT applying RLS, breaking the recursive
-- policy cycle that exists whenever any policy checks team membership.
create or replace function public.is_cofounder_member(p_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from cofounder_members
    where team_id = p_team_id and user_id = auth.uid()
  );
$$;

-- ── cofounder_members SELECT ───────────────────────────────────────────────
-- Root of the recursion: replaced self-referential subquery with the helper.
drop policy if exists cofounder_members_team_read on public.cofounder_members;
create policy cofounder_members_team_read
    on public.cofounder_members for select
    using (
        user_id = auth.uid()
        or public.is_cofounder_member(team_id)
        or exists (
            select 1 from public.cofounder_teams ct
            where ct.id = cofounder_members.team_id
              and ct.owner_id = auth.uid()
        )
    );

-- ── cofounder_teams SELECT ────────────────────────────────────────────────
drop policy if exists cofounder_teams_member_read on public.cofounder_teams;
create policy cofounder_teams_member_read
    on public.cofounder_teams for select
    using (
        owner_id = auth.uid()
        or public.is_cofounder_member(id)
    );

-- ── cofounder_messages ────────────────────────────────────────────────────
drop policy if exists cofounder_messages_team_read on public.cofounder_messages;
create policy cofounder_messages_team_read
    on public.cofounder_messages for select
    using (
        public.is_cofounder_member(team_id)
        or exists (
            select 1 from public.cofounder_teams ct
            where ct.id = cofounder_messages.team_id
              and ct.owner_id = auth.uid()
        )
    );

drop policy if exists cofounder_messages_team_insert on public.cofounder_messages;
create policy cofounder_messages_team_insert
    on public.cofounder_messages for insert
    with check (
        (user_id = auth.uid() or role = 'forge')
        and public.is_cofounder_member(team_id)
    );

-- ── cofounder_invites SELECT ──────────────────────────────────────────────
drop policy if exists cofounder_invites_team_read on public.cofounder_invites;
create policy cofounder_invites_team_read
    on public.cofounder_invites for select
    using (
        created_by = auth.uid()
        or public.is_cofounder_member(team_id)
        or exists (
            select 1 from public.cofounder_teams ct
            where ct.id = cofounder_invites.team_id
              and ct.owner_id = auth.uid()
        )
    );

-- ── cofounder_tasks ───────────────────────────────────────────────────────
drop policy if exists "cofounder_tasks_team_read" on public.cofounder_tasks;
create policy cofounder_tasks_team_read
    on public.cofounder_tasks for select
    using (
        public.is_cofounder_member(team_id)
        or exists (
            select 1 from public.cofounder_teams ct
            where ct.id = cofounder_tasks.team_id
              and ct.owner_id = auth.uid()
        )
    );

drop policy if exists "cofounder_tasks_team_insert" on public.cofounder_tasks;
create policy cofounder_tasks_team_insert
    on public.cofounder_tasks for insert
    with check (public.is_cofounder_member(team_id));

drop policy if exists "cofounder_tasks_team_update" on public.cofounder_tasks;
create policy cofounder_tasks_team_update
    on public.cofounder_tasks for update
    using (public.is_cofounder_member(team_id))
    with check (public.is_cofounder_member(team_id));

-- ── cofounder_task_comments ───────────────────────────────────────────────
drop policy if exists "cofounder_task_comments_read" on public.cofounder_task_comments;
create policy cofounder_task_comments_read
    on public.cofounder_task_comments for select
    using (
        exists (
            select 1 from public.cofounder_tasks t
            where t.id = cofounder_task_comments.task_id
              and public.is_cofounder_member(t.team_id)
        )
    );

drop policy if exists "cofounder_task_comments_insert" on public.cofounder_task_comments;
create policy cofounder_task_comments_insert
    on public.cofounder_task_comments for insert
    with check (
        auth.uid() = user_id
        and exists (
            select 1 from public.cofounder_tasks t
            where t.id = cofounder_task_comments.task_id
              and public.is_cofounder_member(t.team_id)
        )
    );

-- ── cofounder_decisions ───────────────────────────────────────────────────
drop policy if exists "cofounder_decisions_read" on public.cofounder_decisions;
create policy cofounder_decisions_read
    on public.cofounder_decisions for select
    using (public.is_cofounder_member(workspace_id));

drop policy if exists "cofounder_decisions_insert" on public.cofounder_decisions;
create policy cofounder_decisions_insert
    on public.cofounder_decisions for insert
    with check (
        auth.uid() = created_by
        and public.is_cofounder_member(workspace_id)
    );

drop policy if exists "cofounder_decisions_update" on public.cofounder_decisions;
create policy cofounder_decisions_update
    on public.cofounder_decisions for update
    using (public.is_cofounder_member(workspace_id))
    with check (public.is_cofounder_member(workspace_id));

-- ── cofounder_file_links ──────────────────────────────────────────────────
drop policy if exists "cofounder_file_links_read" on public.cofounder_file_links;
create policy cofounder_file_links_read
    on public.cofounder_file_links for select
    using (public.is_cofounder_member(workspace_id));

drop policy if exists "cofounder_file_links_insert" on public.cofounder_file_links;
create policy cofounder_file_links_insert
    on public.cofounder_file_links for insert
    with check (
        auth.uid() = user_id
        and public.is_cofounder_member(workspace_id)
    );

commit;

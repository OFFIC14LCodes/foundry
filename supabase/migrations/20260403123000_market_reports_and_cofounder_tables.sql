begin;

create table if not exists public.market_reports (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    date date not null,
    industry text,
    content text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint market_reports_user_date_key unique (user_id, date)
);

create index if not exists idx_market_reports_user_date
    on public.market_reports (user_id, date desc);

create table if not exists public.cofounder_teams (
    id uuid primary key default gen_random_uuid(),
    business_name text not null,
    owner_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create index if not exists idx_cofounder_teams_owner_id
    on public.cofounder_teams (owner_id);

create table if not exists public.cofounder_members (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.cofounder_teams(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null default 'Cofounder',
    display_name text not null,
    invited_by uuid references auth.users(id) on delete set null,
    joined_at timestamptz not null default now(),
    constraint cofounder_members_team_user_key unique (team_id, user_id)
);

create index if not exists idx_cofounder_members_user_id
    on public.cofounder_members (user_id);

create index if not exists idx_cofounder_members_team_id
    on public.cofounder_members (team_id, joined_at asc);

create table if not exists public.cofounder_invites (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.cofounder_teams(id) on delete cascade,
    token text not null unique default gen_random_uuid()::text,
    created_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    used_at timestamptz
);

create index if not exists idx_cofounder_invites_team_id
    on public.cofounder_invites (team_id, created_at desc);

create table if not exists public.cofounder_messages (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.cofounder_teams(id) on delete cascade,
    user_id uuid references auth.users(id) on delete set null,
    role text not null check (role in ('member', 'forge')),
    sender_name text not null,
    sender_role text not null default '',
    content text not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_cofounder_messages_team_id
    on public.cofounder_messages (team_id, created_at asc);

alter table public.market_reports enable row level security;
alter table public.cofounder_teams enable row level security;
alter table public.cofounder_members enable row level security;
alter table public.cofounder_invites enable row level security;
alter table public.cofounder_messages enable row level security;

drop policy if exists market_reports_own_read on public.market_reports;
create policy market_reports_own_read
    on public.market_reports
    for select
    using (user_id = auth.uid());

drop policy if exists market_reports_own_insert on public.market_reports;
create policy market_reports_own_insert
    on public.market_reports
    for insert
    with check (user_id = auth.uid());

drop policy if exists market_reports_own_update on public.market_reports;
create policy market_reports_own_update
    on public.market_reports
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists market_reports_own_delete on public.market_reports;
create policy market_reports_own_delete
    on public.market_reports
    for delete
    using (user_id = auth.uid());

drop policy if exists cofounder_teams_member_read on public.cofounder_teams;
create policy cofounder_teams_member_read
    on public.cofounder_teams
    for select
    using (
        owner_id = auth.uid()
        or exists (
            select 1
            from public.cofounder_members cm
            where cm.team_id = cofounder_teams.id
              and cm.user_id = auth.uid()
        )
    );

drop policy if exists cofounder_teams_owner_insert on public.cofounder_teams;
create policy cofounder_teams_owner_insert
    on public.cofounder_teams
    for insert
    with check (owner_id = auth.uid());

drop policy if exists cofounder_teams_owner_update on public.cofounder_teams;
create policy cofounder_teams_owner_update
    on public.cofounder_teams
    for update
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());

drop policy if exists cofounder_members_team_read on public.cofounder_members;
create policy cofounder_members_team_read
    on public.cofounder_members
    for select
    using (
        user_id = auth.uid()
        or exists (
            select 1
            from public.cofounder_members self
            where self.team_id = cofounder_members.team_id
              and self.user_id = auth.uid()
        )
        or exists (
            select 1
            from public.cofounder_teams ct
            where ct.id = cofounder_members.team_id
              and ct.owner_id = auth.uid()
        )
    );

drop policy if exists cofounder_members_self_or_owner_insert on public.cofounder_members;
create policy cofounder_members_self_or_owner_insert
    on public.cofounder_members
    for insert
    with check (
        user_id = auth.uid()
        or invited_by = auth.uid()
        or exists (
            select 1
            from public.cofounder_teams ct
            where ct.id = cofounder_members.team_id
              and ct.owner_id = auth.uid()
        )
    );

drop policy if exists cofounder_invites_team_read on public.cofounder_invites;
create policy cofounder_invites_team_read
    on public.cofounder_invites
    for select
    using (
        created_by = auth.uid()
        or exists (
            select 1
            from public.cofounder_members cm
            where cm.team_id = cofounder_invites.team_id
              and cm.user_id = auth.uid()
        )
        or exists (
            select 1
            from public.cofounder_teams ct
            where ct.id = cofounder_invites.team_id
              and ct.owner_id = auth.uid()
        )
    );

drop policy if exists cofounder_invites_owner_insert on public.cofounder_invites;
create policy cofounder_invites_owner_insert
    on public.cofounder_invites
    for insert
    with check (
        created_by = auth.uid()
        and exists (
            select 1
            from public.cofounder_teams ct
            where ct.id = cofounder_invites.team_id
              and ct.owner_id = auth.uid()
        )
    );

drop policy if exists cofounder_invites_owner_update on public.cofounder_invites;
create policy cofounder_invites_owner_update
    on public.cofounder_invites
    for update
    using (
        created_by = auth.uid()
        or exists (
            select 1
            from public.cofounder_teams ct
            where ct.id = cofounder_invites.team_id
              and ct.owner_id = auth.uid()
        )
    )
    with check (
        created_by = auth.uid()
        or exists (
            select 1
            from public.cofounder_teams ct
            where ct.id = cofounder_invites.team_id
              and ct.owner_id = auth.uid()
        )
    );

drop policy if exists cofounder_messages_team_read on public.cofounder_messages;
create policy cofounder_messages_team_read
    on public.cofounder_messages
    for select
    using (
        exists (
            select 1
            from public.cofounder_members cm
            where cm.team_id = cofounder_messages.team_id
              and cm.user_id = auth.uid()
        )
        or exists (
            select 1
            from public.cofounder_teams ct
            where ct.id = cofounder_messages.team_id
              and ct.owner_id = auth.uid()
        )
    );

drop policy if exists cofounder_messages_team_insert on public.cofounder_messages;
create policy cofounder_messages_team_insert
    on public.cofounder_messages
    for insert
    with check (
        (
            user_id = auth.uid()
            and exists (
                select 1
                from public.cofounder_members cm
                where cm.team_id = cofounder_messages.team_id
                  and cm.user_id = auth.uid()
            )
        )
        or (
            role = 'forge'
            and exists (
                select 1
                from public.cofounder_members cm
                where cm.team_id = cofounder_messages.team_id
                  and cm.user_id = auth.uid()
            )
        )
    );

commit;

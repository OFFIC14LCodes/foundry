begin;

create table if not exists public.admin_actions (
    id uuid primary key default gen_random_uuid(),
    admin_id uuid references auth.users(id) on delete set null,
    target_user_id uuid references auth.users(id) on delete set null,
    action_type text not null,
    entity_type text,
    entity_id text,
    reason text,
    before_state jsonb,
    after_state jsonb,
    metadata jsonb not null default '{}'::jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz not null default now()
);

create index if not exists idx_admin_actions_target_created
    on public.admin_actions (target_user_id, created_at desc);

create index if not exists idx_admin_actions_admin_created
    on public.admin_actions (admin_id, created_at desc);

create index if not exists idx_admin_actions_entity
    on public.admin_actions (entity_type, entity_id);

create index if not exists idx_admin_actions_action_created
    on public.admin_actions (action_type, created_at desc);

alter table public.admin_actions enable row level security;

drop policy if exists admin_actions_admin_select on public.admin_actions;
create policy admin_actions_admin_select
    on public.admin_actions
    for select
    to authenticated
    using (public.is_admin_or_owner());

drop policy if exists admin_actions_admin_insert on public.admin_actions;
create policy admin_actions_admin_insert
    on public.admin_actions
    for insert
    to authenticated
    with check (
        public.is_admin_or_owner()
        and (admin_id is null or admin_id = auth.uid())
    );

create table if not exists public.admin_support_notes (
    id uuid primary key default gen_random_uuid(),
    target_user_id uuid not null references auth.users(id) on delete cascade,
    admin_id uuid references auth.users(id) on delete set null,
    note text not null,
    note_type text not null default 'general',
    visibility text not null default 'internal',
    linked_entity_type text,
    linked_entity_id text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_admin_support_notes_target_created
    on public.admin_support_notes (target_user_id, created_at desc);

create index if not exists idx_admin_support_notes_type_created
    on public.admin_support_notes (note_type, created_at desc);

create or replace function public.set_admin_support_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists admin_support_notes_set_updated_at on public.admin_support_notes;
create trigger admin_support_notes_set_updated_at
    before update on public.admin_support_notes
    for each row
    execute function public.set_admin_support_notes_updated_at();

alter table public.admin_support_notes enable row level security;

drop policy if exists admin_support_notes_admin_select on public.admin_support_notes;
create policy admin_support_notes_admin_select
    on public.admin_support_notes
    for select
    to authenticated
    using (public.is_admin_or_owner());

drop policy if exists admin_support_notes_admin_insert on public.admin_support_notes;
create policy admin_support_notes_admin_insert
    on public.admin_support_notes
    for insert
    to authenticated
    with check (
        public.is_admin_or_owner()
        and (admin_id is null or admin_id = auth.uid())
    );

drop policy if exists admin_support_notes_admin_update on public.admin_support_notes;
create policy admin_support_notes_admin_update
    on public.admin_support_notes
    for update
    to authenticated
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

create table if not exists public.message_feedback (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    reaction text not null check (reaction in ('up', 'down')),
    surface text,
    message_id text,
    message_text text,
    conversation_title text,
    archive_summary_id uuid references public.daily_chat_summaries(id) on delete set null,
    stage_id integer,
    context jsonb not null default '{}'::jsonb,
    status text not null default 'new' check (status in ('new', 'reviewed', 'fixed', 'ignored')),
    admin_note text,
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_message_feedback_status_created
    on public.message_feedback (status, created_at desc);

create index if not exists idx_message_feedback_reaction_created
    on public.message_feedback (reaction, created_at desc);

create index if not exists idx_message_feedback_user_created
    on public.message_feedback (user_id, created_at desc);

create index if not exists idx_message_feedback_surface_created
    on public.message_feedback (surface, created_at desc);

alter table public.message_feedback enable row level security;

drop policy if exists message_feedback_own_insert on public.message_feedback;
create policy message_feedback_own_insert
    on public.message_feedback
    for insert
    to authenticated
    with check (user_id = auth.uid());

drop policy if exists message_feedback_admin_select on public.message_feedback;
create policy message_feedback_admin_select
    on public.message_feedback
    for select
    to authenticated
    using (public.is_admin_or_owner());

drop policy if exists message_feedback_admin_update on public.message_feedback;
create policy message_feedback_admin_update
    on public.message_feedback
    for update
    to authenticated
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

create table if not exists public.admin_notifications (
    id uuid primary key default gen_random_uuid(),
    type text not null,
    severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
    title text not null,
    message text,
    target_user_id uuid references auth.users(id) on delete set null,
    entity_type text,
    entity_id text,
    status text not null default 'new' check (status in ('new', 'acknowledged', 'resolved')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    acknowledged_by uuid references auth.users(id) on delete set null,
    acknowledged_at timestamptz,
    resolved_by uuid references auth.users(id) on delete set null,
    resolved_at timestamptz
);

create index if not exists idx_admin_notifications_status_severity_created
    on public.admin_notifications (status, severity, created_at desc);

create index if not exists idx_admin_notifications_target_created
    on public.admin_notifications (target_user_id, created_at desc);

create index if not exists idx_admin_notifications_type_created
    on public.admin_notifications (type, created_at desc);

alter table public.admin_notifications enable row level security;

drop policy if exists admin_notifications_admin_select on public.admin_notifications;
create policy admin_notifications_admin_select
    on public.admin_notifications
    for select
    to authenticated
    using (public.is_admin_or_owner());

drop policy if exists admin_notifications_admin_insert on public.admin_notifications;
create policy admin_notifications_admin_insert
    on public.admin_notifications
    for insert
    to authenticated
    with check (public.is_admin_or_owner());

drop policy if exists admin_notifications_admin_update on public.admin_notifications;
create policy admin_notifications_admin_update
    on public.admin_notifications
    for update
    to authenticated
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

commit;

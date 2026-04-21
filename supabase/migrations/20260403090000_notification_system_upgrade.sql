begin;

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    type text not null check (type in ('reengagement', 'system', 'milestone')),
    title text not null,
    message text not null,
    channel text not null check (channel in ('email', 'in_app')),
    status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
    sent_at timestamptz,
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created_at
    on public.notifications (user_id, created_at desc);

create index if not exists idx_notifications_type_channel
    on public.notifications (type, channel, created_at desc);

create table if not exists public.user_notification_preferences (
    user_id uuid primary key references auth.users(id) on delete cascade,
    reengagement_enabled boolean not null default true,
    product_updates_enabled boolean not null default true,
    email_notifications_enabled boolean not null default true,
    in_app_notifications_enabled boolean not null default true,
    updated_at timestamptz not null default now()
);

create table if not exists public.admin_notification_settings (
    id text primary key,
    reengagement_enabled boolean not null default true,
    reengagement_delay_days integer not null default 3,
    max_reminders_per_user integer not null default 1,
    updated_at timestamptz not null default now()
);

insert into public.admin_notification_settings (
    id,
    reengagement_enabled,
    reengagement_delay_days,
    max_reminders_per_user,
    updated_at
)
values ('global', true, 3, 1, now())
on conflict (id) do nothing;

insert into public.user_notification_preferences (
    user_id,
    reengagement_enabled,
    product_updates_enabled,
    email_notifications_enabled,
    in_app_notifications_enabled,
    updated_at
)
select
    p.id,
    true,
    true,
    true,
    true,
    now()
from public.profiles p
left join public.user_notification_preferences unp on unp.user_id = p.id
where unp.user_id is null;

do $$
begin
    if exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'notification_preferences'
    ) then
        insert into public.user_notification_preferences (
            user_id,
            reengagement_enabled,
            product_updates_enabled,
            email_notifications_enabled,
            in_app_notifications_enabled,
            updated_at
        )
        select
            np.user_id,
            coalesce(np.email_reengagement_enabled, true),
            coalesce(np.product_updates_enabled, true),
            true,
            coalesce(np.in_app_reengagement_enabled, true),
            coalesce(np.updated_at, now())
        from public.notification_preferences np
        on conflict (user_id) do update
        set
            reengagement_enabled = excluded.reengagement_enabled,
            product_updates_enabled = excluded.product_updates_enabled,
            in_app_notifications_enabled = excluded.in_app_notifications_enabled,
            updated_at = excluded.updated_at;
    end if;
end $$;

do $$
begin
    if exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = 'notification_log'
    ) then
        insert into public.notifications (
            id,
            user_id,
            type,
            title,
            message,
            channel,
            status,
            sent_at,
            created_at
        )
        select
            nl.id,
            nl.user_id,
            case
                when nl.notification_type in ('reengagement', 'system', 'milestone') then nl.notification_type
                else 'system'
            end,
            coalesce(nl.subject, 'Foundry notification'),
            coalesce(nl.body, ''),
            case
                when nl.channel in ('email', 'in_app') then nl.channel
                else 'email'
            end,
            case
                when nl.status = 'queued' then 'pending'
                when nl.status in ('sent', 'failed') then nl.status
                else 'sent'
            end,
            nl.sent_at,
            coalesce(nl.created_at, now())
        from public.notification_log nl
        on conflict (id) do nothing;
    end if;
end $$;

create or replace function public.reengagement_due_users(
    delay_days integer default 3,
    max_reminders integer default 1,
    as_of timestamptz default now()
)
returns table (
    user_id uuid,
    email text,
    name text,
    current_stage integer,
    last_active_at timestamptz,
    days_inactive integer
)
language sql
security definer
stable
set search_path = public
as $$
    with candidates as (
        select
            p.id as user_id,
            p.email,
            p.name,
            coalesce(p.current_stage, 1) as current_stage,
            p.last_active_at,
            greatest(0, floor(extract(epoch from (as_of - p.last_active_at)) / 86400))::int as days_inactive,
            coalesce(unp.reengagement_enabled, true) as reengagement_enabled,
            coalesce(unp.email_notifications_enabled, true) as email_notifications_enabled,
            coalesce(aa.access_status, 'active') as access_status,
            (
                select count(*)
                from public.notifications n
                where n.user_id = p.id
                  and n.type = 'reengagement'
                  and n.channel = 'email'
                  and n.created_at >= (as_of - make_interval(days => greatest(delay_days, 1)))
                  and n.status in ('pending', 'sent')
            ) as reminders_in_window
        from public.profiles p
        left join public.user_notification_preferences unp on unp.user_id = p.id
        left join public.account_access aa on aa.user_id = p.id
        where p.email is not null
          and p.last_active_at is not null
    )
    select
        c.user_id,
        c.email,
        c.name,
        c.current_stage,
        c.last_active_at,
        c.days_inactive
    from candidates c
    where c.reengagement_enabled = true
      and c.email_notifications_enabled = true
      and c.access_status = 'active'
      and c.last_active_at <= (as_of - make_interval(days => greatest(delay_days, 1)))
      and c.reminders_in_window < greatest(max_reminders, 1)
    order by c.last_active_at asc;
$$;

alter table public.user_notification_preferences enable row level security;
drop policy if exists user_notification_preferences_own_select on public.user_notification_preferences;
create policy user_notification_preferences_own_select
    on public.user_notification_preferences
    for select
    using (user_id = auth.uid());

drop policy if exists user_notification_preferences_own_insert on public.user_notification_preferences;
create policy user_notification_preferences_own_insert
    on public.user_notification_preferences
    for insert
    with check (user_id = auth.uid());

drop policy if exists user_notification_preferences_own_update on public.user_notification_preferences;
create policy user_notification_preferences_own_update
    on public.user_notification_preferences
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists user_notification_preferences_admin_read on public.user_notification_preferences;
create policy user_notification_preferences_admin_read
    on public.user_notification_preferences
    for select
    using (public.is_admin_or_owner());

alter table public.admin_notification_settings enable row level security;
drop policy if exists admin_notification_settings_admin_select on public.admin_notification_settings;
create policy admin_notification_settings_admin_select
    on public.admin_notification_settings
    for select
    using (public.is_admin_or_owner());

drop policy if exists admin_notification_settings_admin_update on public.admin_notification_settings;
create policy admin_notification_settings_admin_update
    on public.admin_notification_settings
    for update
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

drop policy if exists admin_notification_settings_admin_insert on public.admin_notification_settings;
create policy admin_notification_settings_admin_insert
    on public.admin_notification_settings
    for insert
    with check (public.is_admin_or_owner());

alter table public.notifications enable row level security;
drop policy if exists notifications_own_select on public.notifications;
create policy notifications_own_select
    on public.notifications
    for select
    using (user_id = auth.uid());

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update
    on public.notifications
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists notifications_admin_read on public.notifications;
create policy notifications_admin_read
    on public.notifications
    for select
    using (public.is_admin_or_owner());

commit;

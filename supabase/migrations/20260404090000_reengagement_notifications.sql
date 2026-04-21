begin;

alter table public.profiles
    add column if not exists last_reengagement_sent_at timestamptz,
    add column if not exists last_reengagement_variant text;

create table if not exists public.notification_preferences (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade unique,
    email_reengagement_enabled boolean not null default true,
    product_updates_enabled boolean not null default true,
    in_app_reengagement_enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.notification_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    notification_type text not null,
    channel text not null,
    template_key text not null,
    status text not null default 'queued',
    subject text,
    body text,
    metadata jsonb not null default '{}'::jsonb,
    scheduled_for timestamptz not null default now(),
    sent_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint notification_log_status_check check (status in ('queued', 'sent', 'skipped', 'failed'))
);

create index if not exists idx_profiles_last_active_at on public.profiles (last_active_at);
create index if not exists idx_profiles_last_reengagement_sent_at on public.profiles (last_reengagement_sent_at);
create index if not exists idx_notification_log_lookup
    on public.notification_log (user_id, notification_type, channel, created_at desc);

insert into public.notification_preferences (
    user_id,
    email_reengagement_enabled,
    product_updates_enabled,
    in_app_reengagement_enabled
)
select
    p.id,
    true,
    true,
    true
from public.profiles p
left join public.notification_preferences np on np.user_id = p.id
where np.user_id is null;

create or replace function public.reengagement_due_users(as_of timestamptz default now())
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
            p.last_reengagement_sent_at,
            coalesce(np.email_reengagement_enabled, true) as email_reengagement_enabled,
            coalesce(aa.access_status, 'active') as access_status
        from public.profiles p
        left join public.notification_preferences np on np.user_id = p.id
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
    where c.email_reengagement_enabled = true
      and c.access_status = 'active'
      and c.last_active_at <= (as_of - interval '3 days')
      and (
          c.last_reengagement_sent_at is null
          or c.last_reengagement_sent_at <= (as_of - interval '5 days')
      )
      and not exists (
          select 1
          from public.notification_log nl
          where nl.user_id = c.user_id
            and nl.notification_type = 'reengagement'
            and nl.channel = 'email'
            and nl.status in ('queued', 'sent')
            and nl.created_at >= (as_of - interval '5 days')
      )
    order by c.last_active_at asc;
$$;

alter table public.notification_preferences enable row level security;
drop policy if exists notification_preferences_own_select on public.notification_preferences;
create policy notification_preferences_own_select
    on public.notification_preferences
    for select
    using (user_id = auth.uid());

drop policy if exists notification_preferences_own_insert on public.notification_preferences;
create policy notification_preferences_own_insert
    on public.notification_preferences
    for insert
    with check (user_id = auth.uid());

drop policy if exists notification_preferences_own_update on public.notification_preferences;
create policy notification_preferences_own_update
    on public.notification_preferences
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists notification_preferences_admin_read on public.notification_preferences;
create policy notification_preferences_admin_read
    on public.notification_preferences
    for select
    using (public.is_admin_or_owner());

alter table public.notification_log enable row level security;
drop policy if exists notification_log_own_read on public.notification_log;
create policy notification_log_own_read
    on public.notification_log
    for select
    using (user_id = auth.uid());

drop policy if exists notification_log_admin_read on public.notification_log;
create policy notification_log_admin_read
    on public.notification_log
    for select
    using (public.is_admin_or_owner());

commit;

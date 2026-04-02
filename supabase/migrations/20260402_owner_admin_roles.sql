-- Foundry owner/admin role system
-- Run this in Supabase SQL Editor or as a migration.

begin;

create table if not exists public.role_seeds (
    email text primary key,
    role text not null check (role in ('user', 'admin', 'owner')),
    created_at timestamptz not null default now()
);

create table if not exists public.account_access (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade unique not null,
    access_status text not null default 'active',
    plan_type text not null default 'free',
    subscription_status text not null default 'trial',
    is_family_comp boolean default false,
    comp_reason text,
    starts_at timestamptz default now(),
    ends_at timestamptz,
    canceled_at timestamptz,
    suspended_at timestamptz,
    suspension_reason text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.billing_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade unique not null,
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_price_id text,
    stripe_status text,
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean default false,
    trial_end timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.admin_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    admin_id uuid references auth.users(id),
    note text not null,
    retention_status text,
    winback_status text,
    cancellation_reason text,
    last_discount_offered_at timestamptz,
    last_contacted_at timestamptz,
    created_at timestamptz default now()
);

insert into public.role_seeds (email, role)
values ('foundryandforge.app@gmail.com', 'owner')
on conflict (email) do update set role = excluded.role;

alter table public.profiles
    add column if not exists role text not null default 'user',
    add column if not exists setup_completed boolean not null default false,
    add column if not exists email text,
    add column if not exists last_active_at timestamptz;

alter table public.profiles
    drop constraint if exists profiles_role_check;

alter table public.profiles
    add constraint profiles_role_check check (role in ('user', 'admin', 'owner'));

create or replace function public.resolve_profile_role(profile_email text)
returns text
language sql
security definer
stable
set search_path = public
as $$
    select coalesce(
        (
            select rs.role
            from public.role_seeds rs
            where lower(rs.email) = lower(profile_email)
            limit 1
        ),
        'user'
    )
$$;

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    seeded_role text;
    seeded_name text;
begin
    seeded_role := public.resolve_profile_role(new.email);
    seeded_name := nullif(trim(coalesce(new.raw_user_meta_data->>'name', '')), '');

    insert into public.profiles (
        id,
        email,
        name,
        role,
        setup_completed,
        created_at,
        updated_at
    )
    values (
        new.id,
        new.email,
        seeded_name,
        seeded_role,
        false,
        now(),
        now()
    )
    on conflict (id) do update
    set
        email = excluded.email,
        role = public.resolve_profile_role(excluded.email),
        updated_at = now();

    return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
    after insert on auth.users
    for each row execute function public.handle_auth_user_created();

create or replace function public.ensure_default_account_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.account_access (
        user_id,
        access_status,
        plan_type,
        subscription_status,
        is_family_comp
    )
    values (
        new.id,
        'active',
        'free',
        'trial',
        false
    )
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_profile_created_default_access on public.profiles;
create trigger on_profile_created_default_access
    after insert on public.profiles
    for each row execute function public.ensure_default_account_access();

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

insert into public.profiles (
    id,
    email,
    name,
    role,
    setup_completed,
    created_at,
    updated_at
)
select
    u.id,
    u.email,
    nullif(trim(coalesce(u.raw_user_meta_data->>'name', '')), ''),
    public.resolve_profile_role(u.email),
    false,
    now(),
    now()
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

update public.profiles
set role = public.resolve_profile_role(email),
    updated_at = now()
where role is distinct from public.resolve_profile_role(email);

insert into public.account_access (
    user_id,
    access_status,
    plan_type,
    subscription_status,
    is_family_comp
)
select
    p.id,
    'active',
    'free',
    'trial',
    false
from public.profiles p
left join public.account_access aa on aa.user_id = p.id
where aa.user_id is null;

update public.profiles
set setup_completed = true,
    updated_at = now()
where setup_completed = false
  and (
    coalesce(name, '') <> ''
    or coalesce(idea, '') <> ''
    or coalesce(business_name, '') <> ''
    or coalesce(current_stage, 1) > 1
  );

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
    select coalesce(
        (select p.role from public.profiles p where p.id = auth.uid()),
        'user'
    )
$$;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select public.current_user_role() in ('admin', 'owner')
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select public.current_user_role() = 'owner'
$$;

alter table public.profiles enable row level security;

drop policy if exists profiles_own_select on public.profiles;
create policy profiles_own_select
    on public.profiles
    for select
    using (id = auth.uid());

drop policy if exists profiles_own_insert on public.profiles;
create policy profiles_own_insert
    on public.profiles
    for insert
    with check (id = auth.uid());

drop policy if exists profiles_own_update on public.profiles;
create policy profiles_own_update
    on public.profiles
    for update
    using (id = auth.uid())
    with check (
        id = auth.uid()
        and role = public.current_user_role()
    );

drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read
    on public.profiles
    for select
    using (public.is_admin_or_owner());

drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update
    on public.profiles
    for update
    using (public.is_owner())
    with check (public.is_owner());

alter table public.account_access enable row level security;
drop policy if exists own_read on public.account_access;
create policy own_read on public.account_access
    for select
    using (user_id = auth.uid());

drop policy if exists own_insert on public.account_access;
create policy own_insert on public.account_access
    for insert
    with check (user_id = auth.uid());

drop policy if exists admin_all on public.account_access;
create policy admin_all on public.account_access
    for all
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

alter table public.billing_subscriptions enable row level security;
drop policy if exists own_read on public.billing_subscriptions;
create policy own_read on public.billing_subscriptions
    for select
    using (user_id = auth.uid());

drop policy if exists admin_all on public.billing_subscriptions;
create policy admin_all on public.billing_subscriptions
    for all
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

alter table public.admin_notes enable row level security;
drop policy if exists admin_all on public.admin_notes;
create policy admin_all on public.admin_notes
    for all
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

commit;

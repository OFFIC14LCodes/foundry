begin;

alter table public.account_access
    add column if not exists billing_interval text,
    add column if not exists stripe_price_id text;

alter table public.account_access
    drop constraint if exists account_access_billing_interval_check;

alter table public.account_access
    add constraint account_access_billing_interval_check
    check (billing_interval in ('monthly', 'yearly') or billing_interval is null);

alter table public.billing_subscriptions
    add column if not exists plan_key text,
    add column if not exists billing_interval text,
    add column if not exists canceled_at timestamptz,
    add column if not exists cofounder_quantity integer not null default 0,
    add column if not exists founding_price_locked boolean not null default false,
    add column if not exists stripe_checkout_session_id text,
    add column if not exists latest_invoice_id text,
    add column if not exists checkout_completed_at timestamptz;

alter table public.billing_subscriptions
    drop constraint if exists billing_subscriptions_plan_key_check;

alter table public.billing_subscriptions
    add constraint billing_subscriptions_plan_key_check
    check (plan_key in ('starter', 'pro') or plan_key is null);

alter table public.billing_subscriptions
    drop constraint if exists billing_subscriptions_billing_interval_check;

alter table public.billing_subscriptions
    add constraint billing_subscriptions_billing_interval_check
    check (billing_interval in ('monthly', 'yearly') or billing_interval is null);

create unique index if not exists billing_subscriptions_stripe_customer_id_key
    on public.billing_subscriptions (stripe_customer_id)
    where stripe_customer_id is not null;

create unique index if not exists billing_subscriptions_stripe_subscription_id_key
    on public.billing_subscriptions (stripe_subscription_id)
    where stripe_subscription_id is not null;

create table if not exists public.billing_events (
    id text primary key,
    user_id uuid references auth.users(id) on delete set null,
    stripe_customer_id text,
    stripe_subscription_id text,
    event_type text not null,
    livemode boolean not null default false,
    processing_status text not null default 'processed',
    error_message text,
    payload jsonb not null,
    created_at timestamptz not null default now(),
    processed_at timestamptz not null default now()
);

create index if not exists billing_events_user_id_idx on public.billing_events (user_id);
create index if not exists billing_events_event_type_idx on public.billing_events (event_type);
create index if not exists billing_events_processed_at_idx on public.billing_events (processed_at desc);

alter table public.billing_events enable row level security;

drop policy if exists billing_events_admin_all on public.billing_events;
create policy billing_events_admin_all on public.billing_events
    for all
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

commit;

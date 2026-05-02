create table if not exists public.product_usage_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    feature text not null,
    event_name text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists product_usage_events_user_id_idx
    on public.product_usage_events (user_id);

create index if not exists product_usage_events_feature_event_idx
    on public.product_usage_events (feature, event_name);

create index if not exists product_usage_events_created_at_idx
    on public.product_usage_events (created_at desc);

alter table public.product_usage_events enable row level security;

create policy "Users can insert their own product usage events"
    on public.product_usage_events
    for insert
    with check (auth.uid() = user_id);

create policy "Users can view their own product usage events"
    on public.product_usage_events
    for select
    using (auth.uid() = user_id);

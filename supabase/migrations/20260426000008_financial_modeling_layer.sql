begin;

create or replace function public.set_financial_modeling_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create table if not exists public.founder_financial_accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    account_type text not null default 'operating' check (account_type in ('cash', 'operating', 'profit', 'owner_comp', 'tax', 'revenue_hold', 'other')),
    institution_name text,
    last4 text,
    is_external_feed boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.founder_expenses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    account_id uuid references public.founder_financial_accounts(id) on delete set null,
    label text not null,
    category text default 'operating',
    amount numeric not null,
    currency text not null default 'USD',
    incurred_on date,
    frequency text not null default 'one_time' check (frequency in ('one_time', 'monthly', 'yearly')),
    renewal_date date,
    is_recurring boolean not null default false,
    notes text,
    source text not null default 'manual' check (source in ('manual', 'imported', 'legacy_migrated')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.founder_revenue (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    account_id uuid references public.founder_financial_accounts(id) on delete set null,
    label text not null,
    category text default 'sales',
    amount numeric not null,
    currency text not null default 'USD',
    received_on date,
    frequency text not null default 'one_time' check (frequency in ('one_time', 'monthly', 'yearly')),
    renewal_date date,
    notes text,
    source text not null default 'manual' check (source in ('manual', 'imported', 'legacy_migrated')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.founder_financial_settings (
    user_id uuid primary key references auth.users(id) on delete cascade,
    starting_cash numeric,
    default_currency text not null default 'USD',
    profit_first_enabled boolean not null default true,
    runway_override_months numeric,
    break_even_assumptions jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.founder_profit_buckets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    bucket_type text not null check (bucket_type in ('income', 'profit', 'owner_comp', 'tax', 'opex')),
    allocation_percent numeric not null default 0,
    current_balance numeric,
    display_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(user_id, bucket_type)
);

create index if not exists founder_financial_accounts_user_idx on public.founder_financial_accounts(user_id);
create index if not exists founder_expenses_user_idx on public.founder_expenses(user_id, incurred_on desc);
create index if not exists founder_revenue_user_idx on public.founder_revenue(user_id, received_on desc);
create index if not exists founder_profit_buckets_user_idx on public.founder_profit_buckets(user_id);

drop trigger if exists founder_financial_accounts_set_updated_at on public.founder_financial_accounts;
create trigger founder_financial_accounts_set_updated_at
    before update on public.founder_financial_accounts
    for each row
    execute function public.set_financial_modeling_updated_at();

drop trigger if exists founder_expenses_set_updated_at on public.founder_expenses;
create trigger founder_expenses_set_updated_at
    before update on public.founder_expenses
    for each row
    execute function public.set_financial_modeling_updated_at();

drop trigger if exists founder_revenue_set_updated_at on public.founder_revenue;
create trigger founder_revenue_set_updated_at
    before update on public.founder_revenue
    for each row
    execute function public.set_financial_modeling_updated_at();

drop trigger if exists founder_financial_settings_set_updated_at on public.founder_financial_settings;
create trigger founder_financial_settings_set_updated_at
    before update on public.founder_financial_settings
    for each row
    execute function public.set_financial_modeling_updated_at();

drop trigger if exists founder_profit_buckets_set_updated_at on public.founder_profit_buckets;
create trigger founder_profit_buckets_set_updated_at
    before update on public.founder_profit_buckets
    for each row
    execute function public.set_financial_modeling_updated_at();

alter table public.founder_financial_accounts enable row level security;
alter table public.founder_expenses enable row level security;
alter table public.founder_revenue enable row level security;
alter table public.founder_financial_settings enable row level security;
alter table public.founder_profit_buckets enable row level security;

drop policy if exists founder_financial_accounts_select on public.founder_financial_accounts;
create policy founder_financial_accounts_select on public.founder_financial_accounts for select using (user_id = auth.uid());
drop policy if exists founder_financial_accounts_insert on public.founder_financial_accounts;
create policy founder_financial_accounts_insert on public.founder_financial_accounts for insert with check (user_id = auth.uid());
drop policy if exists founder_financial_accounts_update on public.founder_financial_accounts;
create policy founder_financial_accounts_update on public.founder_financial_accounts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists founder_financial_accounts_delete on public.founder_financial_accounts;
create policy founder_financial_accounts_delete on public.founder_financial_accounts for delete using (user_id = auth.uid());

drop policy if exists founder_expenses_select on public.founder_expenses;
create policy founder_expenses_select on public.founder_expenses for select using (user_id = auth.uid());
drop policy if exists founder_expenses_insert on public.founder_expenses;
create policy founder_expenses_insert on public.founder_expenses for insert with check (user_id = auth.uid());
drop policy if exists founder_expenses_update on public.founder_expenses;
create policy founder_expenses_update on public.founder_expenses for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists founder_expenses_delete on public.founder_expenses;
create policy founder_expenses_delete on public.founder_expenses for delete using (user_id = auth.uid());

drop policy if exists founder_revenue_select on public.founder_revenue;
create policy founder_revenue_select on public.founder_revenue for select using (user_id = auth.uid());
drop policy if exists founder_revenue_insert on public.founder_revenue;
create policy founder_revenue_insert on public.founder_revenue for insert with check (user_id = auth.uid());
drop policy if exists founder_revenue_update on public.founder_revenue;
create policy founder_revenue_update on public.founder_revenue for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists founder_revenue_delete on public.founder_revenue;
create policy founder_revenue_delete on public.founder_revenue for delete using (user_id = auth.uid());

drop policy if exists founder_financial_settings_select on public.founder_financial_settings;
create policy founder_financial_settings_select on public.founder_financial_settings for select using (user_id = auth.uid());
drop policy if exists founder_financial_settings_insert on public.founder_financial_settings;
create policy founder_financial_settings_insert on public.founder_financial_settings for insert with check (user_id = auth.uid());
drop policy if exists founder_financial_settings_update on public.founder_financial_settings;
create policy founder_financial_settings_update on public.founder_financial_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists founder_financial_settings_delete on public.founder_financial_settings;
create policy founder_financial_settings_delete on public.founder_financial_settings for delete using (user_id = auth.uid());

drop policy if exists founder_profit_buckets_select on public.founder_profit_buckets;
create policy founder_profit_buckets_select on public.founder_profit_buckets for select using (user_id = auth.uid());
drop policy if exists founder_profit_buckets_insert on public.founder_profit_buckets;
create policy founder_profit_buckets_insert on public.founder_profit_buckets for insert with check (user_id = auth.uid());
drop policy if exists founder_profit_buckets_update on public.founder_profit_buckets;
create policy founder_profit_buckets_update on public.founder_profit_buckets for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists founder_profit_buckets_delete on public.founder_profit_buckets;
create policy founder_profit_buckets_delete on public.founder_profit_buckets for delete using (user_id = auth.uid());

commit;

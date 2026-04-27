begin;

create table if not exists public.plaid_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    plaid_item_id text not null,
    access_token_ciphertext text not null,
    access_token_iv text not null,
    institution_id text,
    institution_name text,
    status text,
    sync_cursor text,
    last_synced_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(plaid_item_id)
);

create table if not exists public.plaid_transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    plaid_item_id text not null,
    plaid_account_id text,
    plaid_transaction_id text not null unique,
    name text,
    merchant_name text,
    amount numeric,
    currency text,
    authorized_date date,
    posted_date date,
    category_raw jsonb not null default '[]'::jsonb,
    pending boolean not null default false,
    review_status text not null default 'pending' check (review_status in ('pending', 'accepted', 'ignored')),
    mapped_direction text check (mapped_direction in ('expense', 'revenue') or mapped_direction is null),
    linked_expense_id uuid references public.founder_expenses(id) on delete set null,
    linked_revenue_id uuid references public.founder_revenue(id) on delete set null,
    imported_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.founder_financial_accounts
    add column if not exists provider text,
    add column if not exists provider_item_id text,
    add column if not exists provider_account_id text,
    add column if not exists official_name text,
    add column if not exists subtype text,
    add column if not exists mask text,
    add column if not exists last_synced_at timestamptz;

create index if not exists plaid_items_user_idx on public.plaid_items(user_id);
create index if not exists plaid_transactions_user_review_idx on public.plaid_transactions(user_id, review_status, posted_date desc);
create index if not exists founder_financial_accounts_provider_idx on public.founder_financial_accounts(user_id, provider, provider_account_id);
create unique index if not exists founder_financial_accounts_provider_account_unique on public.founder_financial_accounts(user_id, provider, provider_account_id) where provider is not null and provider_account_id is not null;

drop trigger if exists plaid_items_set_updated_at on public.plaid_items;
create trigger plaid_items_set_updated_at
    before update on public.plaid_items
    for each row
    execute function public.set_financial_modeling_updated_at();

drop trigger if exists plaid_transactions_set_updated_at on public.plaid_transactions;
create trigger plaid_transactions_set_updated_at
    before update on public.plaid_transactions
    for each row
    execute function public.set_financial_modeling_updated_at();

alter table public.plaid_items enable row level security;
alter table public.plaid_transactions enable row level security;

drop policy if exists plaid_items_select on public.plaid_items;
create policy plaid_items_select on public.plaid_items for select using (user_id = auth.uid());
drop policy if exists plaid_items_insert on public.plaid_items;
create policy plaid_items_insert on public.plaid_items for insert with check (user_id = auth.uid());
drop policy if exists plaid_items_update on public.plaid_items;
create policy plaid_items_update on public.plaid_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists plaid_items_delete on public.plaid_items;
create policy plaid_items_delete on public.plaid_items for delete using (user_id = auth.uid());

drop policy if exists plaid_transactions_select on public.plaid_transactions;
create policy plaid_transactions_select on public.plaid_transactions for select using (user_id = auth.uid());
drop policy if exists plaid_transactions_insert on public.plaid_transactions;
create policy plaid_transactions_insert on public.plaid_transactions for insert with check (user_id = auth.uid());
drop policy if exists plaid_transactions_update on public.plaid_transactions;
create policy plaid_transactions_update on public.plaid_transactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists plaid_transactions_delete on public.plaid_transactions;
create policy plaid_transactions_delete on public.plaid_transactions for delete using (user_id = auth.uid());

commit;

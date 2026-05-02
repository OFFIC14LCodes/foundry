begin;

create table if not exists public.ledger_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    date date not null,
    description text not null,
    amount numeric(12,2) not null check (amount >= 0),
    type text not null check (type in ('debit', 'credit')),
    category text not null default 'uncategorized',
    account text not null default 'operating',
    source text not null default 'manual' check (source in ('manual', 'plaid', 'invoice')),
    reference_id uuid,
    reconciled_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists ledger_entries_user_date_idx
    on public.ledger_entries (user_id, date desc);

create index if not exists ledger_entries_user_category_idx
    on public.ledger_entries (user_id, category);

create index if not exists ledger_entries_user_source_reference_idx
    on public.ledger_entries (user_id, source, reference_id);

create unique index if not exists ledger_entries_source_reference_unique
    on public.ledger_entries (user_id, source, reference_id, type);

drop trigger if exists ledger_entries_set_updated_at on public.ledger_entries;
create trigger ledger_entries_set_updated_at
    before update on public.ledger_entries
    for each row
    execute function public.set_financial_modeling_updated_at();

alter table public.ledger_entries enable row level security;

drop policy if exists ledger_entries_select on public.ledger_entries;
create policy ledger_entries_select
    on public.ledger_entries for select
    using (user_id = auth.uid());

drop policy if exists ledger_entries_insert on public.ledger_entries;
create policy ledger_entries_insert
    on public.ledger_entries for insert
    with check (user_id = auth.uid());

drop policy if exists ledger_entries_update on public.ledger_entries;
create policy ledger_entries_update
    on public.ledger_entries for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists ledger_entries_delete on public.ledger_entries;
create policy ledger_entries_delete
    on public.ledger_entries for delete
    using (user_id = auth.uid());

insert into public.ledger_entries (
    user_id, date, description, amount, type, category, account, source, reference_id
)
select
    e.user_id,
    coalesce(e.incurred_on, e.created_at::date),
    e.label,
    abs(e.amount)::numeric(12,2),
    'debit',
    coalesce(nullif(e.category, ''), 'operating'),
    coalesce(a.name, 'operating'),
    case when e.source = 'imported' then 'plaid' else 'manual' end,
    e.id
from public.founder_expenses e
left join public.founder_financial_accounts a on a.id = e.account_id
where e.amount is not null
on conflict do nothing;

insert into public.ledger_entries (
    user_id, date, description, amount, type, category, account, source, reference_id
)
select
    r.user_id,
    coalesce(r.received_on, r.created_at::date),
    r.label,
    abs(r.amount)::numeric(12,2),
    'credit',
    coalesce(nullif(r.category, ''), 'sales'),
    coalesce(a.name, 'operating'),
    case when r.source = 'imported' then 'plaid' else 'manual' end,
    r.id
from public.founder_revenue r
left join public.founder_financial_accounts a on a.id = r.account_id
where r.amount is not null
on conflict do nothing;

insert into public.ledger_entries (
    user_id, date, description, amount, type, category, account, source, reference_id
)
select
    i.user_id,
    coalesce(
        nullif(i.line_items->0->>'issuedDate', '')::date,
        i.created_at::date
    ),
    'Invoice: ' || coalesce(nullif(i.client_name, ''), i.invoice_number),
    abs(i.total_amount)::numeric(12,2),
    'credit',
    'sales',
    'accounts_receivable',
    'invoice',
    i.id
from public.founder_invoices i
where i.status = 'paid'
  and i.total_amount is not null
on conflict do nothing;

commit;

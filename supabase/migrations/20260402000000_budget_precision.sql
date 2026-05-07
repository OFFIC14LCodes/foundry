begin;

alter table public.profiles
    add column if not exists budget_range text,
    add column if not exists exact_budget_amount numeric,
    add column if not exists budget_is_estimated boolean not null default false;

update public.profiles
set exact_budget_amount = coalesce(exact_budget_amount, budget_total, 0)
where exact_budget_amount is null;

update public.profiles
set budget_remaining = coalesce(budget_remaining, exact_budget_amount, budget_total, 0)
where budget_remaining is null;

commit;

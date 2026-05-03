begin;

alter table public.foundry_actions
    add column if not exists outcome_type text check (outcome_type in ('success', 'partial', 'failed', 'unknown')),
    add column if not exists outcome_notes text,
    add column if not exists outcome_score integer check (outcome_score between 1 and 5),
    add column if not exists outcome_recorded_at timestamptz;

create index if not exists idx_foundry_actions_user_outcome
    on public.foundry_actions (user_id, outcome_type, outcome_recorded_at desc)
    where outcome_type is not null;

commit;

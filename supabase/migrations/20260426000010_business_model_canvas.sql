create table if not exists public.business_model_canvas (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    stage_id integer not null default 2,
    customer_segments jsonb not null default '[]'::jsonb,
    value_propositions jsonb not null default '[]'::jsonb,
    channels jsonb not null default '[]'::jsonb,
    customer_relationships jsonb not null default '[]'::jsonb,
    revenue_streams jsonb not null default '[]'::jsonb,
    key_activities jsonb not null default '[]'::jsonb,
    key_resources jsonb not null default '[]'::jsonb,
    key_partners jsonb not null default '[]'::jsonb,
    cost_structure jsonb not null default '[]'::jsonb,
    version integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, stage_id)
);

create index if not exists business_model_canvas_user_stage_idx
    on public.business_model_canvas (user_id, stage_id, updated_at desc);

create or replace function public.set_business_model_canvas_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists business_model_canvas_set_updated_at on public.business_model_canvas;
create trigger business_model_canvas_set_updated_at
    before update on public.business_model_canvas
    for each row
    execute function public.set_business_model_canvas_updated_at();

alter table public.business_model_canvas enable row level security;

drop policy if exists "business_model_canvas_select_own" on public.business_model_canvas;
create policy "business_model_canvas_select_own"
    on public.business_model_canvas
    for select
    using (auth.uid() = user_id);

drop policy if exists "business_model_canvas_insert_own" on public.business_model_canvas;
create policy "business_model_canvas_insert_own"
    on public.business_model_canvas
    for insert
    with check (auth.uid() = user_id);

drop policy if exists "business_model_canvas_update_own" on public.business_model_canvas;
create policy "business_model_canvas_update_own"
    on public.business_model_canvas
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "business_model_canvas_delete_own" on public.business_model_canvas;
create policy "business_model_canvas_delete_own"
    on public.business_model_canvas
    for delete
    using (auth.uid() = user_id);

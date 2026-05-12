begin;

create table if not exists public.forge_memory_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    workspace_id uuid null references public.cofounder_teams(id) on delete cascade,
    scope text not null check (scope in ('personal', 'workspace', 'hybrid', 'custom')),
    visibility text not null default 'private' check (visibility in ('private', 'shared', 'role_limited')),
    source text not null default 'forge_chat' check (source in (
        'forge_chat',
        'academy',
        'stage_chat',
        'cofounder_chat',
        'document',
        'market_intelligence',
        'business_canvas',
        'manual'
    )),
    source_ref_id text,
    title text,
    content text not null,
    summary text,
    custom_context_label text,
    confidence numeric,
    requires_confirmation boolean not null default false,
    confirmed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint forge_memory_items_workspace_scope_check check (
        (scope in ('personal', 'custom') and visibility = 'private')
        or (scope = 'workspace' and workspace_id is not null and visibility = 'shared')
        or (scope = 'hybrid' and workspace_id is not null)
    )
);

create index if not exists idx_forge_memory_items_user_id
    on public.forge_memory_items (user_id);

create index if not exists idx_forge_memory_items_workspace_id
    on public.forge_memory_items (workspace_id);

create index if not exists idx_forge_memory_items_scope
    on public.forge_memory_items (scope);

create index if not exists idx_forge_memory_items_visibility
    on public.forge_memory_items (visibility);

create index if not exists idx_forge_memory_items_created_at_desc
    on public.forge_memory_items (created_at desc);

create index if not exists idx_forge_memory_items_user_created_at_desc
    on public.forge_memory_items (user_id, created_at desc);

create index if not exists idx_forge_memory_items_workspace_created_at_desc
    on public.forge_memory_items (workspace_id, created_at desc)
    where workspace_id is not null;

create or replace function public.set_forge_memory_items_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists forge_memory_items_set_updated_at on public.forge_memory_items;
create trigger forge_memory_items_set_updated_at
    before update on public.forge_memory_items
    for each row
    execute function public.set_forge_memory_items_updated_at();

alter table public.forge_memory_items enable row level security;

drop policy if exists forge_memory_items_private_own_read on public.forge_memory_items;
create policy forge_memory_items_private_own_read
    on public.forge_memory_items
    for select
    using (
        user_id = auth.uid()
        and visibility in ('private', 'role_limited')
    );

drop policy if exists forge_memory_items_workspace_shared_read on public.forge_memory_items;
create policy forge_memory_items_workspace_shared_read
    on public.forge_memory_items
    for select
    using (
        visibility = 'shared'
        and workspace_id is not null
        and public.is_cofounder_member(workspace_id)
    );

drop policy if exists forge_memory_items_own_insert on public.forge_memory_items;
create policy forge_memory_items_own_insert
    on public.forge_memory_items
    for insert
    with check (
        user_id = auth.uid()
        and (
            workspace_id is null
            or public.is_cofounder_member(workspace_id)
        )
        and (
            (scope in ('personal', 'custom') and visibility = 'private')
            or (scope = 'workspace' and workspace_id is not null and visibility = 'shared')
            or (scope = 'hybrid' and workspace_id is not null)
        )
    );

drop policy if exists forge_memory_items_own_update on public.forge_memory_items;
create policy forge_memory_items_own_update
    on public.forge_memory_items
    for update
    using (user_id = auth.uid())
    with check (
        user_id = auth.uid()
        and (
            workspace_id is null
            or public.is_cofounder_member(workspace_id)
        )
    );

drop policy if exists forge_memory_items_own_delete on public.forge_memory_items;
create policy forge_memory_items_own_delete
    on public.forge_memory_items
    for delete
    using (user_id = auth.uid());

commit;

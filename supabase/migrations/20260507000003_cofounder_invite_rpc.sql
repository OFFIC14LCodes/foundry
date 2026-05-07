begin;

create or replace function public.get_cofounder_invite_by_token(p_token text)
returns table (
  team_id uuid,
  business_name text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ct.id as team_id,
    ct.business_name,
    ci.created_at
  from public.cofounder_invites ci
  join public.cofounder_teams ct on ct.id = ci.team_id
  where ci.token = p_token
    and ci.used_at is null
    and auth.uid() is not null
  limit 1;
$$;

create or replace function public.accept_cofounder_invite(
  p_token text,
  p_display_name text,
  p_role text default 'Cofounder'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.cofounder_invites%rowtype;
  v_role text := coalesce(nullif(trim(p_role), ''), 'Cofounder');
  v_display_name text := coalesce(nullif(trim(p_display_name), ''), 'Founder');
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_invite
  from public.cofounder_invites
  where token = p_token
    and used_at is null
  limit 1;

  if v_invite.id is null then
    raise exception 'Invite not found';
  end if;

  insert into public.cofounder_members (
    team_id,
    user_id,
    role,
    display_name,
    invited_by,
    last_seen_at
  )
  values (
    v_invite.team_id,
    auth.uid(),
    v_role,
    v_display_name,
    v_invite.created_by,
    now()
  )
  on conflict (team_id, user_id) do update
    set last_seen_at = now();

  return v_invite.team_id;
end;
$$;

revoke all on function public.get_cofounder_invite_by_token(text) from public;
revoke all on function public.accept_cofounder_invite(text, text, text) from public;

grant execute on function public.get_cofounder_invite_by_token(text) to authenticated;
grant execute on function public.accept_cofounder_invite(text, text, text) to authenticated;

commit;

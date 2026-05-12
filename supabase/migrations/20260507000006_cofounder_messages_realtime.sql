-- Enable Supabase Realtime for cofounder_messages so that postgres_changes
-- subscriptions in the client receive live INSERT events.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cofounder_messages'
  ) then
    alter publication supabase_realtime add table public.cofounder_messages;
  end if;
end
$$;

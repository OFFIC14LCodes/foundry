-- Enable Supabase Realtime for cofounder_messages so that postgres_changes
-- subscriptions in the client receive live INSERT events.
alter publication supabase_realtime add table public.cofounder_messages;

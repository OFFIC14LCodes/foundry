drop policy if exists conversation_messages_admin_read on public.conversation_messages;
create policy conversation_messages_admin_read
    on public.conversation_messages
    for select
    using (public.is_admin_or_owner());

do $$
begin
    if to_regclass('public.messages') is not null then
        drop policy if exists messages_admin_read on public.messages;
        create policy messages_admin_read
            on public.messages
            for select
            using (public.is_admin_or_owner());
    end if;
end
$$;

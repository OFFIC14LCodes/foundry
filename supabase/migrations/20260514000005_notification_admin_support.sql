begin;

-- Extend the notifications type constraint to include admin_support.
-- The original inline CHECK has the auto-generated name notifications_type_check.
alter table public.notifications
    drop constraint if exists notifications_type_check;

alter table public.notifications
    add constraint notifications_type_check
    check (type in ('reengagement', 'system', 'milestone', 'admin_support'));

-- Add metadata column for admin-created notifications.
alter table public.notifications
    add column if not exists metadata jsonb not null default '{}';

commit;

begin;

with ranked as (
    select
        id,
        row_number() over (
            partition by user_id, content_id
            order by
                case status
                    when 'completed' then 3
                    when 'in_progress' then 2
                    when 'not_started' then 1
                    else 0
                end desc,
                updated_at desc nulls last,
                completed_at desc nulls last,
                started_at desc nulls last,
                id desc
        ) as row_rank
    from public.user_lesson_progress
),
duplicates as (
    select id
    from ranked
    where row_rank > 1
)
delete from public.user_lesson_progress
where id in (select id from duplicates);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'user_lesson_progress_user_content_key'
    ) then
        alter table public.user_lesson_progress
            add constraint user_lesson_progress_user_content_key unique (user_id, content_id);
    end if;
end $$;

commit;

begin;

alter table public.academy_user_content_progress
    add column if not exists knowledge_checked_at timestamptz,
    add column if not exists last_check_response text,
    add column if not exists last_check_feedback text;

alter table public.user_lesson_progress
    add column if not exists knowledge_checked_at timestamptz,
    add column if not exists last_check_response text,
    add column if not exists last_check_feedback text;

alter table public.academy_user_history
    add column if not exists event_key text;

create unique index if not exists academy_user_history_user_content_action_event_key
    on public.academy_user_history (user_id, content_id, action, event_key);

create or replace function public.complete_academy_lesson(
    p_content_id uuid,
    p_completed_at timestamptz default now(),
    p_knowledge_checked_at timestamptz default null,
    p_last_check_response text default null,
    p_last_check_feedback text default null,
    p_source text default 'academy',
    p_correct_count integer default null,
    p_attempted_count integer default null,
    p_event_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_completed_at timestamptz := coalesce(p_completed_at, now());
    v_knowledge_checked_at timestamptz := coalesce(p_knowledge_checked_at, v_completed_at);
    v_content_progress public.academy_user_content_progress%rowtype;
    v_lesson_progress public.user_lesson_progress%rowtype;
    v_history_row_count integer := 0;
    v_history_inserted boolean := false;
begin
    if v_user_id is null then
        raise exception 'Authentication required to complete Academy lesson';
    end if;

    perform 1
    from public.academy_content
    where id = p_content_id;

    if not found then
        raise exception 'Academy lesson not found: %', p_content_id;
    end if;

    insert into public.academy_user_content_progress (
        user_id,
        content_id,
        status,
        completed_at,
        knowledge_checked_at,
        last_check_response,
        last_check_feedback,
        last_opened_at,
        last_forge_opened_at,
        updated_at
    )
    values (
        v_user_id,
        p_content_id,
        'completed',
        v_completed_at,
        v_knowledge_checked_at,
        p_last_check_response,
        p_last_check_feedback,
        v_completed_at,
        v_completed_at,
        v_completed_at
    )
    on conflict (user_id, content_id) do update
    set
        status = 'completed',
        completed_at = coalesce(public.academy_user_content_progress.completed_at, excluded.completed_at),
        knowledge_checked_at = coalesce(excluded.knowledge_checked_at, public.academy_user_content_progress.knowledge_checked_at),
        last_check_response = coalesce(excluded.last_check_response, public.academy_user_content_progress.last_check_response),
        last_check_feedback = coalesce(excluded.last_check_feedback, public.academy_user_content_progress.last_check_feedback),
        last_opened_at = coalesce(excluded.last_opened_at, public.academy_user_content_progress.last_opened_at),
        last_forge_opened_at = coalesce(excluded.last_forge_opened_at, public.academy_user_content_progress.last_forge_opened_at),
        updated_at = greatest(public.academy_user_content_progress.updated_at, excluded.updated_at)
    returning * into v_content_progress;

    insert into public.user_lesson_progress (
        user_id,
        content_id,
        status,
        started_at,
        completed_at,
        knowledge_checked_at,
        last_check_response,
        last_check_feedback,
        updated_at
    )
    values (
        v_user_id,
        p_content_id,
        'completed',
        v_completed_at,
        v_completed_at,
        v_knowledge_checked_at,
        p_last_check_response,
        p_last_check_feedback,
        v_completed_at
    )
    on conflict (user_id, content_id) do update
    set
        status = 'completed',
        started_at = coalesce(public.user_lesson_progress.started_at, excluded.started_at),
        completed_at = coalesce(public.user_lesson_progress.completed_at, excluded.completed_at),
        knowledge_checked_at = coalesce(excluded.knowledge_checked_at, public.user_lesson_progress.knowledge_checked_at),
        last_check_response = coalesce(excluded.last_check_response, public.user_lesson_progress.last_check_response),
        last_check_feedback = coalesce(excluded.last_check_feedback, public.user_lesson_progress.last_check_feedback),
        updated_at = greatest(public.user_lesson_progress.updated_at, excluded.updated_at)
    returning * into v_lesson_progress;

    insert into public.academy_user_history (
        user_id,
        content_id,
        action,
        metadata,
        event_key,
        created_at
    )
    values (
        v_user_id,
        p_content_id,
        'completed',
        jsonb_build_object(
            'source', p_source,
            'correctCount', p_correct_count,
            'attemptedCount', p_attempted_count
        ),
        p_event_key,
        v_completed_at
    )
    on conflict do nothing;

    get diagnostics v_history_row_count = row_count;
    v_history_inserted := v_history_row_count > 0;

    return jsonb_build_object(
        'content_progress', to_jsonb(v_content_progress),
        'lesson_progress', to_jsonb(v_lesson_progress),
        'history_inserted', v_history_inserted
    );
end;
$$;

commit;

begin;

alter table public.academy_content
    add column if not exists knowledge_check_prompt text,
    add column if not exists knowledge_check_expected_points text[],
    add column if not exists completion_badge_label text;

alter table public.user_lesson_progress
    add column if not exists knowledge_checked_at timestamptz,
    add column if not exists last_check_response text,
    add column if not exists last_check_feedback text;

update public.academy_content
set
    knowledge_check_prompt = coalesce(knowledge_check_prompt, 'Explain the difference between a business story and the actual logic that makes the business work.'),
    knowledge_check_expected_points = coalesce(knowledge_check_expected_points, array[
        'A business model is the logic that connects value, revenue, cost, and delivery.',
        'A compelling story is not enough if the economics or behavior do not hold.',
        'The founder should be able to explain how the business works in practice.'
    ]),
    completion_badge_label = coalesce(completion_badge_label, 'Model Logic Landed')
where lower(title) like '%business model%';

update public.academy_content
set
    knowledge_check_prompt = coalesce(knowledge_check_prompt, 'What makes a customer conversation useful instead of just encouraging?'),
    knowledge_check_expected_points = coalesce(knowledge_check_expected_points, array[
        'Useful discovery reveals behavior, pain, stakes, or workflow.',
        'Encouraging feedback is not the same as evidence of demand.',
        'The founder should leave with clearer decisions, not just confidence.'
    ]),
    completion_badge_label = coalesce(completion_badge_label, 'Discovery Eyes Open')
where lower(title) like '%customer discovery%';

update public.academy_content
set
    knowledge_check_prompt = coalesce(knowledge_check_prompt, 'Why is pricing a strategy decision instead of just a number?'),
    knowledge_check_expected_points = coalesce(knowledge_check_expected_points, array[
        'Pricing shapes positioning, customer fit, margin, and behavior.',
        'A price communicates value and target market, not just revenue.',
        'Weak pricing choices usually create downstream execution problems.'
    ]),
    completion_badge_label = coalesce(completion_badge_label, 'Pricing Judgment Built')
where lower(title) like '%pricing%';

update public.academy_content
set
    knowledge_check_prompt = coalesce(knowledge_check_prompt, 'What is the founder behavior this lesson is trying to expose?'),
    knowledge_check_expected_points = coalesce(knowledge_check_expected_points, array[
        'The lesson is exposing a behavior pattern, not just handing over advice.',
        'The founder should be able to name the weak instinct or avoidance pattern.',
        'The lesson matters because behavior compounds into better or worse decisions.'
    ]),
    completion_badge_label = coalesce(completion_badge_label, 'Mindset Shift Noticed')
where content_type = 'mindset';

commit;

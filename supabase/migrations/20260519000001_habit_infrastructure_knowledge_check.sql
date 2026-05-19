begin;

update public.academy_content
set
    knowledge_check_prompt = 'Why should a founder treat habit-building as operational infrastructure rather than a personal motivation project?',
    knowledge_check_expected_points = array[
        'Habits should automate repeated decisions instead of relying on daily motivation or willpower.',
        'Behavioral infrastructure preserves decision-making capacity for high-leverage founder work.',
        'The business cost of weak habits shows up as worse strategic decisions, inconsistent execution, and avoidable reactive work.',
        'A strong answer should connect the concept to a concrete system, routine, environment, or planning cadence in the founder''s own life.'
    ],
    completion_badge_label = coalesce(completion_badge_label, 'Behavioral Infrastructure Built'),
    updated_at = now()
where slug = 'habits-are-infrastructure-not-self-help';

commit;

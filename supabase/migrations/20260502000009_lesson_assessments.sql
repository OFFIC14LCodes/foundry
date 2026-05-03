begin;

create table if not exists public.lesson_assessments (
    id uuid primary key default gen_random_uuid(),
    lesson_id uuid not null references public.academy_content(id) on delete cascade,
    question text not null,
    options jsonb not null default '[]'::jsonb,
    correct_answer_index integer not null default 0 check (correct_answer_index >= 0),
    explanation text not null default '',
    created_at timestamptz not null default now(),
    constraint lesson_assessments_unique_question unique (lesson_id, question),
    constraint lesson_assessments_options_array check (jsonb_typeof(options) = 'array')
);

create table if not exists public.assessment_attempts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    lesson_id uuid not null references public.academy_content(id) on delete cascade,
    assessment_id uuid not null references public.lesson_assessments(id) on delete cascade,
    selected_index integer not null check (selected_index >= 0),
    is_correct boolean not null default false,
    attempted_at timestamptz not null default now()
);

create table if not exists public.stage_certificates (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    stage_id integer not null check (stage_id between 1 and 6),
    founder_name text not null default '',
    stage_name text not null default '',
    completed_at timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint stage_certificates_user_stage_unique unique (user_id, stage_id)
);

create index if not exists idx_lesson_assessments_lesson on public.lesson_assessments (lesson_id);
create index if not exists idx_assessment_attempts_user_lesson_attempted on public.assessment_attempts (user_id, lesson_id, attempted_at desc);
create index if not exists idx_assessment_attempts_assessment on public.assessment_attempts (assessment_id);
create index if not exists idx_stage_certificates_user_stage on public.stage_certificates (user_id, stage_id);
create index if not exists idx_stage_certificates_user_completed on public.stage_certificates (user_id, completed_at desc);

alter table public.lesson_assessments enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.stage_certificates enable row level security;

drop policy if exists lesson_assessments_authenticated_read on public.lesson_assessments;
create policy lesson_assessments_authenticated_read
    on public.lesson_assessments
    for select
    to authenticated
    using (true);

drop policy if exists lesson_assessments_admin_all on public.lesson_assessments;
create policy lesson_assessments_admin_all
    on public.lesson_assessments
    for all
    to authenticated
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

drop policy if exists assessment_attempts_own_select on public.assessment_attempts;
create policy assessment_attempts_own_select
    on public.assessment_attempts
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists assessment_attempts_own_insert on public.assessment_attempts;
create policy assessment_attempts_own_insert
    on public.assessment_attempts
    for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists assessment_attempts_own_update on public.assessment_attempts;
create policy assessment_attempts_own_update
    on public.assessment_attempts
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists assessment_attempts_own_delete on public.assessment_attempts;
create policy assessment_attempts_own_delete
    on public.assessment_attempts
    for delete
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists assessment_attempts_admin_read on public.assessment_attempts;
create policy assessment_attempts_admin_read
    on public.assessment_attempts
    for select
    to authenticated
    using (public.is_admin_or_owner());

drop policy if exists stage_certificates_own_select on public.stage_certificates;
create policy stage_certificates_own_select
    on public.stage_certificates
    for select
    to authenticated
    using (auth.uid() = user_id);

drop policy if exists stage_certificates_own_insert on public.stage_certificates;
create policy stage_certificates_own_insert
    on public.stage_certificates
    for insert
    to authenticated
    with check (auth.uid() = user_id);

drop policy if exists stage_certificates_own_update on public.stage_certificates;
create policy stage_certificates_own_update
    on public.stage_certificates
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists stage_certificates_admin_read on public.stage_certificates;
create policy stage_certificates_admin_read
    on public.stage_certificates
    for select
    to authenticated
    using (public.is_admin_or_owner());

insert into public.lesson_assessments (lesson_id, question, options, correct_answer_index, explanation)
select
    content.id,
    'What is the strongest way to use "' || content.title || '" as a founder?',
    jsonb_build_array(
        'Turn it into a concrete decision or operating behavior this week',
        'Read it once and wait until the issue becomes urgent',
        'Treat it as general inspiration without changing execution',
        'Delegate the thinking before understanding the tradeoffs'
    ),
    0,
    'Academy lessons are complete only when the founder can translate the concept into a concrete business move.'
from public.academy_content content
where content.status = 'published'
on conflict (lesson_id, question) do nothing;

insert into public.lesson_assessments (lesson_id, question, options, correct_answer_index, explanation)
select
    content.id,
    'What should you watch for after studying "' || content.title || '"?',
    jsonb_build_array(
        coalesce(nullif(content.common_mistake, ''), 'A subtle assumption or shortcut that weakens founder judgment'),
        'Only vanity metrics and surface-level confidence',
        'Whether the lesson sounds impressive in a pitch deck',
        'How quickly you can move to the next lesson'
    ),
    0,
    'The useful signal is whether the lesson changes what the founder notices before a weak decision compounds.'
from public.academy_content content
where content.status = 'published'
on conflict (lesson_id, question) do nothing;

insert into public.lesson_assessments (lesson_id, question, options, correct_answer_index, explanation)
select
    content.id,
    'Which answer best proves you understood "' || content.title || '"?',
    jsonb_build_array(
        coalesce(nullif(content.learning_goal, ''), 'You can explain the main lesson and apply it to your current company context'),
        'You remember the title and category',
        'You opened Forge without forming a specific situation',
        'You agree with the idea but cannot name a next action'
    ),
    0,
    'Passing requires more than recognition. It requires usable understanding tied to the founder''s real situation.'
from public.academy_content content
where content.status = 'published'
on conflict (lesson_id, question) do nothing;

commit;

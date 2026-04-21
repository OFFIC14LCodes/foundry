begin;

-- Forge Academy is modeled as:
-- 1. reusable content records (topic, video, resource, mindset)
-- 2. optional lesson series that sequence existing content
-- 3. per-user progress/history tables kept separate for clean upserts
-- This keeps admin CRUD simple now and supports future expansion such as PDFs,
-- transcripts, richer lesson flows, and more granular engagement analytics.

create table if not exists public.academy_categories (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    title text not null,
    description text,
    accent_color text,
    sort_order integer not null default 0,
    is_mindset boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.academy_tags (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.academy_content (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    title text not null,
    short_description text not null,
    description text,
    content_type text not null check (content_type in ('topic', 'video', 'resource', 'mindset')),
    category_id uuid references public.academy_categories(id) on delete set null,
    source_type text not null default 'foundry_original' check (source_type in ('foundry_original', 'external_youtube', 'external_resource')),
    stage_ids integer[] not null default '{}',
    difficulty_label text,
    thumbnail_url text,
    estimated_minutes integer,
    why_this_matters text,
    what_to_watch_for text,
    learning_goal text,
    starter_prompt text,
    forge_context text,
    video_url text,
    youtube_video_id text,
    resource_url text,
    transcript text,
    featured boolean not null default false,
    priority integer not null default 0,
    status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
    published_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint academy_content_stage_ids_check
        check (
            not exists (
                select 1
                from unnest(stage_ids) as stage_id
                where stage_id < 1 or stage_id > 6
            )
        )
);

create table if not exists public.academy_content_tags (
    content_id uuid not null references public.academy_content(id) on delete cascade,
    tag_id uuid not null references public.academy_tags(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (content_id, tag_id)
);

create table if not exists public.academy_series (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    title text not null,
    short_description text not null,
    description text,
    category_id uuid references public.academy_categories(id) on delete set null,
    stage_ids integer[] not null default '{}',
    difficulty_label text,
    estimated_minutes integer,
    featured boolean not null default false,
    priority integer not null default 0,
    status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
    learning_goal text,
    cover_image_url text,
    published_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint academy_series_stage_ids_check
        check (
            not exists (
                select 1
                from unnest(stage_ids) as stage_id
                where stage_id < 1 or stage_id > 6
            )
        )
);

create table if not exists public.academy_series_items (
    id uuid primary key default gen_random_uuid(),
    series_id uuid not null references public.academy_series(id) on delete cascade,
    content_id uuid not null references public.academy_content(id) on delete cascade,
    position integer not null,
    title_override text,
    description_override text,
    required boolean not null default true,
    created_at timestamptz not null default now(),
    constraint academy_series_items_unique_position unique (series_id, position)
);

create table if not exists public.academy_user_content_progress (
    user_id uuid not null references auth.users(id) on delete cascade,
    content_id uuid not null references public.academy_content(id) on delete cascade,
    status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
    completed_at timestamptz,
    last_opened_at timestamptz,
    last_forge_opened_at timestamptz,
    updated_at timestamptz not null default now(),
    primary key (user_id, content_id)
);

create table if not exists public.academy_user_series_item_progress (
    user_id uuid not null references auth.users(id) on delete cascade,
    series_id uuid not null references public.academy_series(id) on delete cascade,
    series_item_id uuid not null references public.academy_series_items(id) on delete cascade,
    status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
    completed_at timestamptz,
    last_opened_at timestamptz,
    updated_at timestamptz not null default now(),
    primary key (user_id, series_item_id)
);

create table if not exists public.academy_user_history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    content_id uuid references public.academy_content(id) on delete cascade,
    series_id uuid references public.academy_series(id) on delete cascade,
    series_item_id uuid references public.academy_series_items(id) on delete cascade,
    action text not null check (action in ('viewed', 'opened_forge', 'completed', 'started_video', 'completed_series_item')),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_academy_categories_sort on public.academy_categories (sort_order, title);
create index if not exists idx_academy_content_status_priority on public.academy_content (status, featured desc, priority asc, title);
create index if not exists idx_academy_content_category on public.academy_content (category_id, content_type);
create index if not exists idx_academy_series_status_priority on public.academy_series (status, featured desc, priority asc, title);
create index if not exists idx_academy_series_items_series on public.academy_series_items (series_id, position);
create index if not exists idx_academy_history_user_created on public.academy_user_history (user_id, created_at desc);

insert into public.academy_categories (slug, title, description, accent_color, sort_order, is_mindset, is_active)
values
    ('business-fundamentals', 'Business Fundamentals', 'Core ideas every serious founder should understand before execution gets expensive.', '#E8622A', 10, false, true),
    ('marketing', 'Marketing', 'How attention, positioning, and demand actually compound when the offer is clear.', '#63B3ED', 20, false, true),
    ('sales', 'Sales', 'Practical lessons on closing, objection handling, and confidence in real conversations.', '#48BB78', 30, false, true),
    ('legal', 'Legal', 'What founders need to understand before contracts, entities, and compliance become painful.', '#9B7FE8', 40, false, true),
    ('finance', 'Finance', 'Money discipline, unit economics, and the numbers that keep a business alive.', '#F5A843', 50, false, true),
    ('winners-mindset', 'Winner''s Mindset', 'Internal founder psychology: resilience, self-command, and judgment under uncertainty.', '#C76B4B', 60, true, true),
    ('decision-making', 'Decision Making', 'How to think clearly when information is incomplete and stakes are real.', '#C8A96E', 70, false, true)
on conflict (slug) do update
set
    title = excluded.title,
    description = excluded.description,
    accent_color = excluded.accent_color,
    sort_order = excluded.sort_order,
    is_mindset = excluded.is_mindset,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.academy_tags (slug, name)
values
    ('business-model', 'Business Model'),
    ('positioning', 'Positioning'),
    ('pricing', 'Pricing'),
    ('sales-confidence', 'Sales Confidence'),
    ('financial-control', 'Financial Control'),
    ('founder-identity', 'Founder Identity'),
    ('uncertainty', 'Uncertainty'),
    ('judgment', 'Judgment')
on conflict (slug) do update
set name = excluded.name;

with seeded_categories as (
    select id, slug from public.academy_categories
),
upserted_content as (
    insert into public.academy_content (
        slug,
        title,
        short_description,
        description,
        content_type,
        category_id,
        source_type,
        stage_ids,
        difficulty_label,
        estimated_minutes,
        why_this_matters,
        what_to_watch_for,
        learning_goal,
        starter_prompt,
        forge_context,
        featured,
        priority,
        status,
        published_at
    )
    values
        (
            'business-model-fundamentals',
            'Business Model Fundamentals',
            'Learn the mechanics of how value, revenue, cost, and customer behavior connect.',
            'A founder can sound ambitious and still be building on a weak model. This topic helps users understand the structural logic underneath the business so they stop confusing excitement with viability.',
            'topic',
            (select id from seeded_categories where slug = 'business-fundamentals'),
            'foundry_original',
            array[1,2],
            'Core',
            18,
            'If a founder cannot explain how value is created, delivered, and captured, every later decision becomes fuzzy.',
            'Watch for whether the founder can clearly name the customer, the value exchange, and the money mechanics without drifting into vague optimism.',
            'Understand the anatomy of a sound business model and how it shapes strategy.',
            'Teach me the core parts of a business model in a way a first-time founder can actually use. Then help me pressure-test mine.',
            'Start with the founder''s actual business idea, but teach from first principles. Push toward clarity, not jargon.',
            true,
            10,
            'published',
            now()
        ),
        (
            'first-sales-without-feeling-sleazy',
            'First Sales Without Feeling Sleazy',
            'A direct lesson on selling with conviction instead of apology or awkwardness.',
            'New founders often hesitate around sales because they frame it as pressure instead of service. This topic reframes sales as the disciplined transfer of clarity and confidence.',
            'topic',
            (select id from seeded_categories where slug = 'sales'),
            'foundry_original',
            array[2,5],
            'Applied',
            16,
            'Most founders do not lose because they lacked a product. They lose because they never learned how to confidently ask for a decision.',
            'Pay attention to language that weakens authority: over-explaining, apologizing for price, or hiding from the ask.',
            'Develop a healthier, more effective mental model for founder-led sales.',
            'Coach me on how to sell without sounding fake, needy, or aggressive. I want practical language and a stronger mindset.',
            'This should feel like founder coaching, not a generic sales script. Make the founder more direct and more grounded.',
            true,
            20,
            'published',
            now()
        ),
        (
            'founder-decision-memo',
            'Founder Decision Memo',
            'A structured framework for turning messy founder instincts into a sharper decision record.',
            'This resource trains judgment. Instead of letting important choices stay emotional and unstructured, the founder learns to document the decision, options, tradeoffs, and why the chosen path won.',
            'resource',
            (select id from seeded_categories where slug = 'decision-making'),
            'foundry_original',
            array[1,2,3,4,5,6],
            'Core',
            12,
            'Founders get punished less for imperfect decisions than for unexamined ones repeated over time.',
            'Look for where the founder is making a commitment versus simply buying more time.',
            'Strengthen repeatable founder judgment through a disciplined decision format.',
            'Help me think through an important business decision using a clean memo structure with options, risks, and a recommendation.',
            'Guide the founder toward a concrete decision memo they could reuse for future choices.',
            false,
            30,
            'published',
            now()
        ),
        (
            'analysis-paralysis-is-not-caution',
            'Analysis Paralysis Is Not Caution',
            'A Winner''s Mindset lesson on the hidden emotional logic behind overthinking.',
            'This entry is for founders who keep calling delay “strategy.” It helps them separate legitimate uncertainty from avoidance disguised as intelligence.',
            'mindset',
            (select id from seeded_categories where slug = 'winners-mindset'),
            'foundry_original',
            array[1,2,3,4,5,6],
            'Mindset',
            14,
            'A founder who cannot move under uncertainty becomes professionally dependent on more data than real life ever provides.',
            'Watch for perfectionism, self-protection, and the desire to postpone commitment under the banner of “one more round of research.”',
            'Build the founder''s ability to act with discipline before certainty arrives.',
            'Talk to me about analysis paralysis like a serious founder coach. Help me separate real risk from delay disguised as thoughtfulness.',
            'Push the founder toward clearer decisions and smaller, cleaner commitments.',
            true,
            40,
            'published',
            now()
        ),
        (
            'fear-of-selling-is-fear-of-judgment',
            'Fear of Selling Is Fear of Judgment',
            'A Winner''s Mindset lesson on why selling feels personal and how to untangle identity from rejection.',
            'Many first-time founders say they need more confidence, but what they actually need is a cleaner relationship to rejection. This topic helps them stop treating a sales no as a referendum on self-worth.',
            'mindset',
            (select id from seeded_categories where slug = 'winners-mindset'),
            'foundry_original',
            array[2,5,6],
            'Mindset',
            13,
            'You cannot become strong at founder-led selling while every rejection still lands like identity damage.',
            'Notice whether the founder is protecting ego more than they are seeking truth from the market.',
            'Reduce emotional friction around sales and build a more durable selling identity.',
            'Help me work through the emotional side of selling. I want to stop taking rejection personally and learn to handle it like a founder.',
            'Be firm, psychologically sharp, and practical. This is about identity, not only tactics.',
            false,
            50,
            'published',
            now()
        ),
        (
            'financial-control-before-growth',
            'Financial Control Before Growth',
            'What a founder should measure before spending more, scaling faster, or celebrating momentum too early.',
            'This topic teaches restraint. It helps founders understand the difference between movement and financially sound movement before they scale a weak machine.',
            'topic',
            (select id from seeded_categories where slug = 'finance'),
            'foundry_original',
            array[2,4,5,6],
            'Applied',
            17,
            'Poor financial control destroys optionality. The founder loses room to think because the numbers were ignored while chasing speed.',
            'Look for whether spending is tied to a model, a learning loop, or just founder emotion.',
            'Make the founder more fluent in cash discipline, simple unit economics, and operational restraint.',
            'Teach me what I should measure before trying to grow. I want a clear financial control system, not generic finance advice.',
            'Use simple language, but do not oversimplify. The founder should leave with real decision tools.',
            true,
            60,
            'published',
            now()
        )
    on conflict (slug) do update
    set
        title = excluded.title,
        short_description = excluded.short_description,
        description = excluded.description,
        content_type = excluded.content_type,
        category_id = excluded.category_id,
        source_type = excluded.source_type,
        stage_ids = excluded.stage_ids,
        difficulty_label = excluded.difficulty_label,
        estimated_minutes = excluded.estimated_minutes,
        why_this_matters = excluded.why_this_matters,
        what_to_watch_for = excluded.what_to_watch_for,
        learning_goal = excluded.learning_goal,
        starter_prompt = excluded.starter_prompt,
        forge_context = excluded.forge_context,
        featured = excluded.featured,
        priority = excluded.priority,
        status = excluded.status,
        published_at = excluded.published_at,
        updated_at = now()
    returning id, slug
)
insert into public.academy_content_tags (content_id, tag_id)
select c.id, t.id
from upserted_content c
join public.academy_tags t on (
    (c.slug = 'business-model-fundamentals' and t.slug in ('business-model', 'judgment')) or
    (c.slug = 'first-sales-without-feeling-sleazy' and t.slug in ('sales-confidence', 'positioning')) or
    (c.slug = 'founder-decision-memo' and t.slug in ('judgment', 'uncertainty')) or
    (c.slug = 'analysis-paralysis-is-not-caution' and t.slug in ('uncertainty', 'judgment')) or
    (c.slug = 'fear-of-selling-is-fear-of-judgment' and t.slug in ('sales-confidence', 'founder-identity')) or
    (c.slug = 'financial-control-before-growth' and t.slug in ('financial-control', 'pricing'))
)
on conflict do nothing;

insert into public.academy_series (
    slug,
    title,
    short_description,
    description,
    category_id,
    stage_ids,
    difficulty_label,
    estimated_minutes,
    featured,
    priority,
    status,
    learning_goal,
    published_at
)
values (
    'founder-foundations',
    'Founder Foundations',
    'A first Academy path for founders who need stronger fundamentals before speed.',
    'This lesson series sequences business model clarity, founder decision quality, mindset discipline, and financial control into one coherent starting arc.',
    (select id from public.academy_categories where slug = 'business-fundamentals'),
    array[1,2,4],
    'Core',
    47,
    true,
    10,
    'published',
    'Build stronger founder judgment and core business fluency before execution compounds mistakes.',
    now()
)
on conflict (slug) do update
set
    title = excluded.title,
    short_description = excluded.short_description,
    description = excluded.description,
    category_id = excluded.category_id,
    stage_ids = excluded.stage_ids,
    difficulty_label = excluded.difficulty_label,
    estimated_minutes = excluded.estimated_minutes,
    featured = excluded.featured,
    priority = excluded.priority,
    status = excluded.status,
    learning_goal = excluded.learning_goal,
    published_at = excluded.published_at,
    updated_at = now();

delete from public.academy_series_items
where series_id = (select id from public.academy_series where slug = 'founder-foundations');

insert into public.academy_series_items (series_id, content_id, position, required)
select
    s.id,
    c.id,
    v.position,
    true
from public.academy_series s
join (
    values
        ('business-model-fundamentals', 1),
        ('analysis-paralysis-is-not-caution', 2),
        ('financial-control-before-growth', 3)
) as v(content_slug, position) on true
join public.academy_content c on c.slug = v.content_slug
where s.slug = 'founder-foundations';

alter table public.academy_categories enable row level security;
alter table public.academy_tags enable row level security;
alter table public.academy_content enable row level security;
alter table public.academy_content_tags enable row level security;
alter table public.academy_series enable row level security;
alter table public.academy_series_items enable row level security;
alter table public.academy_user_content_progress enable row level security;
alter table public.academy_user_series_item_progress enable row level security;
alter table public.academy_user_history enable row level security;

drop policy if exists academy_categories_public_read on public.academy_categories;
create policy academy_categories_public_read
    on public.academy_categories
    for select
    using (is_active = true or public.is_admin_or_owner());

drop policy if exists academy_categories_admin_all on public.academy_categories;
create policy academy_categories_admin_all
    on public.academy_categories
    for all
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

drop policy if exists academy_tags_public_read on public.academy_tags;
create policy academy_tags_public_read
    on public.academy_tags
    for select
    using (true);

drop policy if exists academy_tags_admin_all on public.academy_tags;
create policy academy_tags_admin_all
    on public.academy_tags
    for all
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

drop policy if exists academy_content_public_read on public.academy_content;
create policy academy_content_public_read
    on public.academy_content
    for select
    using (status = 'published' or public.is_admin_or_owner());

drop policy if exists academy_content_admin_all on public.academy_content;
create policy academy_content_admin_all
    on public.academy_content
    for all
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

drop policy if exists academy_content_tags_public_read on public.academy_content_tags;
create policy academy_content_tags_public_read
    on public.academy_content_tags
    for select
    using (
        exists (
            select 1
            from public.academy_content c
            where c.id = content_id
              and (c.status = 'published' or public.is_admin_or_owner())
        )
    );

drop policy if exists academy_content_tags_admin_all on public.academy_content_tags;
create policy academy_content_tags_admin_all
    on public.academy_content_tags
    for all
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

drop policy if exists academy_series_public_read on public.academy_series;
create policy academy_series_public_read
    on public.academy_series
    for select
    using (status = 'published' or public.is_admin_or_owner());

drop policy if exists academy_series_admin_all on public.academy_series;
create policy academy_series_admin_all
    on public.academy_series
    for all
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

drop policy if exists academy_series_items_public_read on public.academy_series_items;
create policy academy_series_items_public_read
    on public.academy_series_items
    for select
    using (
        exists (
            select 1
            from public.academy_series s
            where s.id = series_id
              and (s.status = 'published' or public.is_admin_or_owner())
        )
    );

drop policy if exists academy_series_items_admin_all on public.academy_series_items;
create policy academy_series_items_admin_all
    on public.academy_series_items
    for all
    using (public.is_admin_or_owner())
    with check (public.is_admin_or_owner());

drop policy if exists academy_user_content_progress_own_select on public.academy_user_content_progress;
create policy academy_user_content_progress_own_select
    on public.academy_user_content_progress
    for select
    using (user_id = auth.uid());

drop policy if exists academy_user_content_progress_own_insert on public.academy_user_content_progress;
create policy academy_user_content_progress_own_insert
    on public.academy_user_content_progress
    for insert
    with check (user_id = auth.uid());

drop policy if exists academy_user_content_progress_own_update on public.academy_user_content_progress;
create policy academy_user_content_progress_own_update
    on public.academy_user_content_progress
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists academy_user_content_progress_own_delete on public.academy_user_content_progress;
create policy academy_user_content_progress_own_delete
    on public.academy_user_content_progress
    for delete
    using (user_id = auth.uid());

drop policy if exists academy_user_content_progress_admin_read on public.academy_user_content_progress;
create policy academy_user_content_progress_admin_read
    on public.academy_user_content_progress
    for select
    using (public.is_admin_or_owner());

drop policy if exists academy_user_series_item_progress_own_select on public.academy_user_series_item_progress;
create policy academy_user_series_item_progress_own_select
    on public.academy_user_series_item_progress
    for select
    using (user_id = auth.uid());

drop policy if exists academy_user_series_item_progress_own_insert on public.academy_user_series_item_progress;
create policy academy_user_series_item_progress_own_insert
    on public.academy_user_series_item_progress
    for insert
    with check (user_id = auth.uid());

drop policy if exists academy_user_series_item_progress_own_update on public.academy_user_series_item_progress;
create policy academy_user_series_item_progress_own_update
    on public.academy_user_series_item_progress
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists academy_user_series_item_progress_own_delete on public.academy_user_series_item_progress;
create policy academy_user_series_item_progress_own_delete
    on public.academy_user_series_item_progress
    for delete
    using (user_id = auth.uid());

drop policy if exists academy_user_series_item_progress_admin_read on public.academy_user_series_item_progress;
create policy academy_user_series_item_progress_admin_read
    on public.academy_user_series_item_progress
    for select
    using (public.is_admin_or_owner());

drop policy if exists academy_user_history_own_select on public.academy_user_history;
create policy academy_user_history_own_select
    on public.academy_user_history
    for select
    using (user_id = auth.uid());

drop policy if exists academy_user_history_own_insert on public.academy_user_history;
create policy academy_user_history_own_insert
    on public.academy_user_history
    for insert
    with check (user_id = auth.uid());

drop policy if exists academy_user_history_admin_read on public.academy_user_history;
create policy academy_user_history_admin_read
    on public.academy_user_history
    for select
    using (public.is_admin_or_owner());

commit;

begin;

insert into public.academy_tags (slug, name)
values
    ('habits',               'Habits'),
    ('discipline',           'Discipline'),
    ('founder-performance',  'Founder Performance'),
    ('identity',             'Identity'),
    ('routines',             'Routines'),
    ('personal-growth',      'Personal Growth'),
    ('resilience',           'Resilience'),
    ('environment-design',   'Environment Design')
on conflict (slug) do update
set name = excluded.name;

with categories as (
    select id, slug from public.academy_categories
),
upserted_content as (
    insert into public.academy_content (
        slug, title, short_description, description,
        content_type, category_id, source_type, stage_ids,
        difficulty_label, estimated_minutes,
        why_this_matters, what_to_watch_for, learning_goal,
        who_this_is_for, when_this_matters, common_mistake,
        starter_prompt, forge_context,
        video_url, youtube_video_id,
        featured, priority, status, published_at
    )
    values
    (
        'habits-are-infrastructure-not-self-help',
        'Habits Are Infrastructure, Not Self-Help',
        'Most founders treat habits like a motivation project. They are actually an operational design problem.',
        'There is a version of the habits conversation that belongs in a wellness podcast. This is not that. Habits matter for founders because building a company is a sustained, high-stakes cognitive and emotional performance across months and years. Every decision made under depleted energy is a weaker decision. Every morning that begins without structure is a morning that slowly bleeds into reactive chaos. Habits are not about becoming a better person in the abstract. They are about reducing the cognitive cost of being good at things that matter. A founder who has automated the right behaviors has more mental bandwidth for the judgment calls that actually determine outcomes. A founder who has not is spending willpower on things that should have been decided long ago. This lesson opens the entire Habit Edge series by reframing what habits actually are at the operational level: not inspiration content, not self-improvement ideology, but infrastructure. The same way a business needs systems, a founder needs behavioral infrastructure that runs reliably without constant deliberate effort. The goal is not to become a monk. The goal is to stop burning energy on decisions your habits should be making for you.',
        'topic',
        (select id from categories where slug = 'winners-mindset'),
        'foundry_original',
        array[1,2,3,4,5,6],
        'Core',
        14,
        'A founder without behavioral infrastructure runs on willpower alone. Willpower depletes. Infrastructure does not. The cost of neglecting this is paid slowly, in the quality of decisions and the durability of effort.',
        'Watch for founders who treat habits as a personal motivation problem — something they will "get to" after traction. That framing usually means they are already burning more energy than necessary and calling it discipline.',
        'Understand habits as operational infrastructure that conserves decision-making capacity and sustains founder performance across the long arc of building.',
        'Any founder who has started and stopped habit-building attempts, or who treats personal discipline as separate from business performance.',
        'Now. Before the build gets harder, the stress compounds, and the cost of poor habits becomes too embedded to notice clearly.',
        'Treating habits as a motivation problem rather than a design problem, and therefore trying harder instead of building better systems.',
        'I want Forge''s actual take on habits — not the self-help version, not a list of morning routines. Start by telling me why a founder who ignores their behavioral infrastructure is making a business mistake, not just a personal one. Then show me how to think about this differently.',
        'Open strong. Challenge the way most founders dismiss habit-building as soft or secondary. Make the operational argument first — habits are infrastructure, not inspiration. Do not prescribe routines yet. Build the frame.',
        null, null, true, 20, 'published', now()
    ),
    (
        'identity-is-the-foundation-every-habit-stands-on',
        'Identity Is the Foundation Every Habit Stands On',
        'You do not build a habit by trying harder. You build one by slowly becoming someone for whom the behavior is normal.',
        'Most habit attempts fail for the same reason: the founder is trying to do something new without becoming someone new. They set a goal, build a streak, and then something disrupts it. Without the identity to anchor it, the streak was the whole strategy — and streaks break. The identity-based model of habit formation inverts the usual logic. Instead of starting with outcome goals and working backward to behavior, it starts with the question of who you are becoming and works forward. A founder who identifies as someone who protects their thinking time will make different decisions than one who is "trying to focus more." A founder who sees themselves as someone who takes care of their body physically will protect sleep differently than one who "wants to be healthier." The identity is not a lie you tell yourself. It is a direction of travel. Every habit you perform is a vote for the version of yourself you are becoming. This lesson teaches founders to examine the identity assumptions underneath their current behaviors, understand why identity-behavior mismatches cause habit collapse, and start choosing identity first instead of results first. It also connects directly to the founder role: who you believe yourself to be shapes how you show up in the business, how you make hard calls, and how long you can sustain the effort this work requires.',
        'topic',
        (select id from categories where slug = 'winners-mindset'),
        'foundry_original',
        array[1,2,3,4,5,6],
        'Core',
        16,
        'Habits built on goals are fragile. Goals end, get missed, or lose emotional charge. Habits built on identity are durable because they are tied to who the person believes they are becoming.',
        'Watch for founders who describe their habits entirely in outcome terms: "I want to wake up earlier," "I want to exercise more," "I want to read every day." Those are goals, not identities. The habit will collapse the first time the outcome feels out of reach.',
        'Understand how identity shapes behavior at a level deeper than goal-setting, and learn to use identity as the foundation for building habits that last.',
        'Founders who have tried and failed to build consistent habits, or who want to understand why discipline feels hard even when the goal is clear.',
        'Anytime a founder is trying to change behavior. This reframe is the prerequisite for any habit that is meant to last longer than motivation does.',
        'Setting behavior goals without examining the underlying identity, then trying harder when the habit breaks instead of diagnosing the identity mismatch underneath it.',
        'I keep starting habits and losing them. I want Forge''s real explanation for why that happens — not "be more consistent," but the actual structural reason. And then show me how identity changes that equation.',
        'Teach identity-based habit formation as a founder concept, not a self-help platitude. Be specific about how identity shows up in founder behavior. Use concrete examples of what an identity shift looks and feels like versus just trying harder.',
        null, null, true, 22, 'published', now()
    ),
    (
        'the-three-physical-foundations-you-cannot-skip',
        'The Three Physical Foundations You Cannot Skip',
        'Sleep, movement, and recovery are not wellness hobbies. They are the biological floor your performance rests on.',
        'Founders have a complicated relationship with their physical baseline. On one side is the culture of hustle — sleep deprivation worn as a badge, rest treated like weakness, health sacrificed for traction. On the other is the wellness industrial complex, which turns basic physical maintenance into expensive rituals and a second full-time job. Neither framing is useful. What is useful is the operational reality: your brain runs on biology. Sleep governs memory consolidation, emotional regulation, and prefrontal cortex function — the part of the brain responsible for complex decision-making. Movement governs cognitive performance, stress tolerance, and energy regulation. Recovery governs the ability to sustain effort without degrading. When a founder systematically shortchanges any of these three, they are not running lean. They are slowly degrading the hardware their judgment runs on, and usually not noticing because the degradation is gradual and the benchmark keeps shifting. This lesson makes the operational argument for the three physical foundations without turning it into a wellness sermon. It shows what the research says concisely, explains what the trade-off actually costs in founder terms, and helps a founder honestly audit which of the three is their current weak point. It does not prescribe an amount of sleep, a type of movement, or a recovery protocol. It makes the case for treating these as non-negotiable infrastructure and gives the founder the framing to decide what that means for their actual life.',
        'topic',
        (select id from categories where slug = 'winners-mindset'),
        'foundry_original',
        array[1,2,3,4,5,6],
        'Core',
        15,
        'A founder operating on degraded sleep, no physical movement, and zero recovery is making business decisions from a compromised instrument. The cost shows up in judgment quality, emotional reactivity, and the ability to sustain hard effort — not in the mirror.',
        'Watch for founders who describe their sleep, movement, and recovery as luxuries or future priorities. That framing usually means those foundations are already compromised and the founder has adjusted their expectations downward without realizing it.',
        'Understand the three physical foundations of founder performance and make an honest assessment of which one is most degraded in your current life.',
        'Any founder — but especially those who work long hours, run on caffeine, skip exercise, or treat sleep as a variable they optimize last.',
        'Now, before the build gets harder and the excuses for neglecting these get more convincing.',
        'Treating physical foundations as optional lifestyle choices rather than baseline requirements for sustained cognitive performance.',
        'Give me Forge''s real take on sleep, movement, and recovery — not the wellness influencer version. Make the business case. Show me what it actually costs to shortchange these, and be specific about how it shows up in the work.',
        'Make the operational argument, not the health argument. Founders do not need a lecture on wellness. They need to see what degraded physical foundations cost them in decision quality, stress tolerance, and execution durability. Then ask the honest audit question.',
        null, null, true, 24, 'published', now()
    ),
    (
        'find-your-keystone-habit',
        'Find Your Keystone Habit',
        'One habit, chosen correctly, makes a dozen others easier. Most founders never find it because they are looking in the wrong direction.',
        'Not all habits are equal. Some habits are isolated — they exist in a silo, do their job, and do not change much else. Others are load-bearing. When you do them consistently, they seem to make other positive behaviors more likely. They create momentum, shift identity, and structure the day in ways that make the right choices easier across the board. These are keystone habits, and they are worth looking for seriously. The most commonly cited example is exercise — when people start exercising consistently, they often eat better, sleep earlier, and drink less without targeting those behaviors directly. But the keystone habit is different for every person and every stage of life. For some founders, the keystone is a daily review of their priorities. For others, it is a morning window of no inputs. For others, it is consistent sleep time. For others, it is a weekly planning session. The signal that something is a keystone habit is not that it feels important in isolation — it is that when you do it, other things tend to fall into place, and when you miss it, other things tend to unravel. This lesson teaches the concept of keystone habits, helps founders develop a theory for what their keystone might be, and shows how to test that theory deliberately. It also explains why spreading habit effort across ten simultaneous goals tends to produce no durable habits, while finding one keystone and protecting it first tends to create compound traction.',
        'topic',
        (select id from categories where slug = 'winners-mindset'),
        'foundry_original',
        array[1,2,3,4,5,6],
        'Applied',
        15,
        'A founder who finds their keystone habit gets compound returns on a single investment. A founder who never finds it keeps trying to build habits one by one with no reinforcing structure beneath them.',
        'Watch for founders who have a long list of habits they want to build simultaneously. That approach almost always fails. It signals they have not yet identified what their keystone is — the one thing that would make the rest more likely.',
        'Understand the keystone habit concept and develop a working hypothesis about which habit would create the most compound effect in your current life and work.',
        'Founders who want to build better habits but keep failing when they try to build many at once, or who want a more strategic approach to personal systems.',
        'When a founder is ready to move past the theory of habits and into the practice of building one that actually sticks and compounds.',
        'Spreading habit energy across ten goals simultaneously and then wondering why none of them are working.',
        'Tell me what a keystone habit actually is and why it matters more than a long list of habits I want to build. Then help me figure out what mine might be — not theoretically, but by thinking through what actually tends to pull my life together or fall apart.',
        'Teach keystone habits as a strategic concept, not just a motivational one. Help the founder think through their own keystone seriously. Ask the question that actually surfaces it — when have things been going well, and what were you doing consistently then?',
        null, null, true, 26, 'published', now()
    ),
    (
        'design-your-environment-before-you-design-your-willpower',
        'Design Your Environment Before You Design Your Willpower',
        'Willpower is a resource that depletes. Environment is a structure that persists. Founders who rely on the first instead of the second are fighting the wrong battle.',
        'There is a version of self-discipline that is just white-knuckling through the same bad environment every day. It works sometimes. It does not scale. Willpower is real, but it is a finite cognitive resource that depletes across the day, especially under stress, decision load, and uncertainty — which describes most founders most of the time. Relying on willpower alone to maintain habits means the moments when life gets hard are exactly the moments the system breaks down. Environment design is the alternative. Instead of making yourself stronger against friction, you reduce the friction for good behaviors and increase it for bad ones. You make the default choice the right choice. You put the book where you will see it. You put the phone across the room. You prepare the workout clothes the night before. You close every irrelevant tab. These are not hacks. They are structural changes that shift the probability of the right behavior without requiring a decision. This lesson teaches founders how to audit their current environment for habit friction, understand the behavioral economics behind default choices, and redesign their physical and digital environment to support the habits they are trying to build. It also connects to how the best founders think about building products: you change behavior by changing the system, not by expecting more from the person.',
        'topic',
        (select id from categories where slug = 'winners-mindset'),
        'foundry_original',
        array[1,2,3,4,5,6],
        'Applied',
        15,
        'Founders who rely on willpower to maintain habits are building on a foundation that will fail exactly when they need it most. Environment design is leverage that works even when motivation is gone.',
        'Watch for founders who describe their habit problems in terms of not being disciplined enough or not wanting it badly enough. Those explanations are almost always wrong. The environment is usually the culprit, not the character.',
        'Learn to audit your environment for habit friction and redesign it so the right behaviors require less willpower and the wrong ones require more.',
        'Any founder who has failed to maintain a habit despite genuinely wanting to, or who finds themselves doing things they did not intend to out of default or convenience.',
        'Before trying to build any new habit, especially one that has been attempted and lost before.',
        'Diagnosing habit failure as a willpower problem when it is almost always an environment design problem.',
        'I keep failing at habits I genuinely want. Forge, tell me why willpower-based explanations are wrong and show me how to actually redesign my environment so the right behaviors happen without a daily fight.',
        'This should feel like a reframe that makes the founder slightly embarrassed for how long they blamed themselves. Then move immediately into the practical audit — what does their current environment make easy, and what does it make hard?',
        null, null, true, 28, 'published', now()
    ),
    (
        'build-a-morning-that-protects-what-matters-most',
        'Build a Morning That Protects What Matters Most',
        'The first two hours of the day are not a ritual opportunity. They are a decision about what gets your sharpest thinking before the day takes it.',
        'The morning routine conversation has been so thoroughly colonized by influencer culture that the actual operating principle has been buried under aesthetics. The point of a structured morning is not to become the kind of person who wakes up at 5 AM. The point is that the early hours of the day are, for most people, the highest-quality cognitive window — before the inbox, the messages, the meetings, the decisions other people are pushing onto you. Once the reactive load begins, your thinking is fractured and your attention is shared. Most founders lose their best thinking window to low-leverage inputs before they have done a single thing that actually moves the business. A structured morning is not about discipline for its own sake. It is about protecting your highest-leverage cognitive hours from being consumed by other people''s priorities before you have served your own. This lesson does not prescribe a morning routine. That would be wrong — everyone''s life looks different, and every founder is at a different stage with different constraints. What it does is teach the principle behind morning design: protect the window, use it for output over input, and make the transition into reactive mode intentional rather than immediate. The goal is a morning that does something for the business, even if that something is only twenty minutes of clear thinking.',
        'topic',
        (select id from categories where slug = 'winners-mindset'),
        'foundry_original',
        array[1,2,3,4,5,6],
        'Applied',
        14,
        'Most founders give their sharpest cognitive hours to low-leverage inputs and call it being busy. A morning that protects creative and strategic thinking time has compounding business value most founders never stop to quantify.',
        'Watch for founders who check their phone first thing in the morning, answer messages before doing any meaningful work, or describe their mornings as reactive without treating that as a problem worth solving.',
        'Understand the operating principle behind a useful morning structure and design one that protects your highest-leverage thinking time in a way that fits your actual life.',
        'Founders whose mornings regularly begin in reactive mode, or who have heard "get a morning routine" many times but have resisted or failed because the advice felt prescriptive or impractical.',
        'Any point where the founder notices that the day consistently feels ahead of them rather than behind them — that reactive priorities are consuming creative and strategic time.',
        'Copying someone else''s morning routine without understanding the principle behind it, then abandoning it when it does not fit their life or loses novelty.',
        'I want Forge''s actual take on morning routines — not the influencer version with cold plunges and gratitude journals. Show me the real principle behind why mornings matter and help me build something that actually protects my best thinking time.',
        'Challenge the performance aesthetics of morning routines hard. Get to the actual principle fast: the morning is your highest-quality cognitive window, and most founders let other people''s priorities consume it before they have done anything for themselves. Then ask what the founder currently does with their first two hours.',
        null, null, true, 30, 'published', now()
    ),
    (
        'the-compounding-return-of-a-consistent-life',
        'The Compounding Return of a Consistent Life',
        'One percent better every day for a year is 37 times better by the end. Most founders understand compound interest in business and completely miss it in themselves.',
        'The math of compounding is not abstract. One percent improvement compounded daily for one year produces something 37 times better than what you started with. One percent worse every day produces something that has shrunk to almost nothing. Founders who understand this intellectually for business — who build systems, invest in teams, develop assets that compound — often fail to apply the same logic to their own development and daily habits. The reason is that compound returns are invisible at the beginning. The first thirty days of a new habit look almost exactly like failure: nothing seems to have changed, the investment feels large, and the reward feels distant. This is the valley where most habits die. But the math does not care. Consistency through that valley is the exact moment the investment is being made. This final lesson in the series connects everything together: habits as infrastructure, identity as foundation, physical foundations as the floor, keystone habits as leverage, environment design as the system, and morning structure as the protected zone. All of it is in service of one thing — becoming the founder who shows up consistently, improves incrementally, and builds something durable over years rather than sprinting and crashing in cycles. Consistency is not exciting. It is one of the most powerful business advantages a founder can hold.',
        'topic',
        (select id from categories where slug = 'winners-mindset'),
        'foundry_original',
        array[1,2,3,4,5,6],
        'Core',
        16,
        'Founders who build consistent personal habits create a compounding advantage that shows up in the business over time in ways that are hard to trace but impossible to ignore. Founders who do not build this consistency often succeed in bursts and fail to sustain.',
        'Watch for founders who describe their progress in terms of big moves, pivots, and moments rather than consistent daily effort. That framing usually means the compounding is not happening, and the founder is relying on intensity rather than continuity.',
        'Understand the compounding math of consistent personal habits and connect it directly to long-term business durability and founder resilience.',
        'Founders who are approaching the end of the Habit Edge series and need to see how everything connects — and any founder who has been sprint-and-crash cycling through habit attempts without a longer-term view.',
        'When a founder is ready to stop treating habit-building as a short-term project and start treating it as a permanent operating system for how they run their life and business.',
        'Expecting dramatic short-term results from habit investment, then abandoning the habits during the invisible compounding phase when nothing looks different yet.',
        'Give me the closing argument, Forge. I want to understand why consistency is one of the most powerful advantages a founder can hold — not just in their habits but in how it shapes the business over time. Show me the real math.',
        'Close the series strong. Connect habit consistency to business durability in a way that makes the founder feel the full weight of what is at stake — not in a motivational way, but in a clear-eyed, long-arc business way. The compounding math is not metaphor. Apply it literally.',
        null, null, true, 32, 'published', now()
    )
    on conflict (slug) do update
    set
        title              = excluded.title,
        short_description  = excluded.short_description,
        description        = excluded.description,
        content_type       = excluded.content_type,
        category_id        = excluded.category_id,
        source_type        = excluded.source_type,
        stage_ids          = excluded.stage_ids,
        difficulty_label   = excluded.difficulty_label,
        estimated_minutes  = excluded.estimated_minutes,
        why_this_matters   = excluded.why_this_matters,
        what_to_watch_for  = excluded.what_to_watch_for,
        learning_goal      = excluded.learning_goal,
        who_this_is_for    = excluded.who_this_is_for,
        when_this_matters  = excluded.when_this_matters,
        common_mistake     = excluded.common_mistake,
        starter_prompt     = excluded.starter_prompt,
        forge_context      = excluded.forge_context,
        video_url          = excluded.video_url,
        youtube_video_id   = excluded.youtube_video_id,
        featured           = excluded.featured,
        priority           = excluded.priority,
        status             = excluded.status,
        published_at       = excluded.published_at,
        updated_at         = now()
    returning id, slug
)
insert into public.academy_content_tags (content_id, tag_id)
select c.id, t.id
from upserted_content c
join (
    values
        ('habits-are-infrastructure-not-self-help',                     'habits'),
        ('habits-are-infrastructure-not-self-help',                     'discipline'),
        ('habits-are-infrastructure-not-self-help',                     'founder-performance'),
        ('identity-is-the-foundation-every-habit-stands-on',            'identity'),
        ('identity-is-the-foundation-every-habit-stands-on',            'habits'),
        ('identity-is-the-foundation-every-habit-stands-on',            'personal-growth'),
        ('the-three-physical-foundations-you-cannot-skip',              'founder-performance'),
        ('the-three-physical-foundations-you-cannot-skip',              'resilience'),
        ('the-three-physical-foundations-you-cannot-skip',              'habits'),
        ('find-your-keystone-habit',                                     'habits'),
        ('find-your-keystone-habit',                                     'discipline'),
        ('find-your-keystone-habit',                                     'routines'),
        ('design-your-environment-before-you-design-your-willpower',    'environment-design'),
        ('design-your-environment-before-you-design-your-willpower',    'habits'),
        ('design-your-environment-before-you-design-your-willpower',    'discipline'),
        ('build-a-morning-that-protects-what-matters-most',             'routines'),
        ('build-a-morning-that-protects-what-matters-most',             'founder-performance'),
        ('build-a-morning-that-protects-what-matters-most',             'habits'),
        ('the-compounding-return-of-a-consistent-life',                 'discipline'),
        ('the-compounding-return-of-a-consistent-life',                 'resilience'),
        ('the-compounding-return-of-a-consistent-life',                 'personal-growth')
) as m(content_slug, tag_slug) on m.content_slug = c.slug
join public.academy_tags t on t.slug = m.tag_slug
on conflict do nothing;

insert into public.academy_series (
    slug, title, short_description, description,
    category_id, stage_ids, difficulty_label, estimated_minutes,
    featured, priority, status, learning_goal, published_at
)
values
    (
        'the-habit-edge',
        'The Habit Edge',
        'A seven-part series on building the behavioral infrastructure that lets founders perform at a high level for years, not just weeks.',
        'Most founders know habits matter. Very few treat them with the same rigor they apply to business systems. This series fixes that. It is not a wellness curriculum or a self-help program. It is a practical, Forge-taught operating system for founder behavior — built on the same logic The Foundry Method applies to business: design the system, stop relying on motivation, and build something that compounds over time. The series moves from the foundational argument for why habits are infrastructure, through the identity layer that makes habits durable, into the physical foundations no founder can shortchange, the keystone habit concept, environment design as leverage, morning structure as protection of your best thinking, and finally the compounding math that connects personal consistency to long-term business durability. Each lesson is meant to leave the founder with a sharper understanding of themselves as a performing asset — and a clearer sense of what to change first.',
        (select id from public.academy_categories where slug = 'winners-mindset'),
        array[1,2,3,4,5,6],
        'Core',
        105,
        true,
        10,
        'published',
        'Build a founder-level behavioral operating system: understand habits as infrastructure, anchor them in identity, protect the physical foundations, find your keystone, design your environment, structure your mornings, and commit to the compounding math of a consistent life.',
        now()
    )
on conflict (slug) do update
set
    title              = excluded.title,
    short_description  = excluded.short_description,
    description        = excluded.description,
    category_id        = excluded.category_id,
    stage_ids          = excluded.stage_ids,
    difficulty_label   = excluded.difficulty_label,
    estimated_minutes  = excluded.estimated_minutes,
    featured           = excluded.featured,
    priority           = excluded.priority,
    status             = excluded.status,
    learning_goal      = excluded.learning_goal,
    published_at       = excluded.published_at,
    updated_at         = now();

delete from public.academy_series_items
where series_id = (select id from public.academy_series where slug = 'the-habit-edge');

insert into public.academy_series_items (series_id, content_id, position, required)
select s.id, c.id, v.position, true
from public.academy_series s
join (
    values
        ('habits-are-infrastructure-not-self-help',                  1),
        ('identity-is-the-foundation-every-habit-stands-on',         2),
        ('the-three-physical-foundations-you-cannot-skip',           3),
        ('find-your-keystone-habit',                                  4),
        ('design-your-environment-before-you-design-your-willpower', 5),
        ('build-a-morning-that-protects-what-matters-most',          6),
        ('the-compounding-return-of-a-consistent-life',              7)
) as v(content_slug, position) on true
join public.academy_content c on c.slug = v.content_slug
where s.slug = 'the-habit-edge';

commit;

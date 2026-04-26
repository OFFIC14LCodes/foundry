begin;

insert into public.academy_tags (slug, name)
values
    ('messaging',            'Messaging'),
    ('channel-strategy',     'Channel Strategy'),
    ('conversion',           'Conversion'),
    ('content-marketing',    'Content Marketing'),
    ('demand-generation',    'Demand Generation'),
    ('marketing-analytics',  'Marketing Analytics'),
    ('brand-trust',          'Brand Trust')
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
        'marketing-is-clarity-made-visible',
        'Marketing Is Clarity Made Visible',
        'Most founders think marketing starts with promotion. It starts with whether the market can clearly understand and care.',
        'Most first-time founders treat marketing like a visibility problem. They think the issue is reach, content volume, or ad spend. Usually the issue is earlier: the market does not yet understand who the offer is for, what pain it solves, why it matters now, or why this version is worth attention. Marketing is not a layer you add after the business is built. It is the discipline of making the business legible to the right people. This lesson reframes marketing as clarity under pressure. It shows why founders who get this wrong waste energy blaming channels, algorithms, and attention spans when the real weakness lives in the message itself. It also explains why strong marketing feels simpler from the outside: the customer understands the offer fast, the promise feels believable, and the next step feels obvious. Before a founder studies channels, content, campaigns, or metrics, they need this frame or they will optimize noise.',
        'topic',
        (select id from categories where slug = 'marketing'),
        'foundry_original',
        array[1,2,3,4,5],
        'Core',
        18,
        'Weak marketing is usually a clarity problem disguised as a traffic problem. Founders who do not understand this spend months trying to amplify a message the market never really understood.',
        'Watch for founders describing marketing in terms of tactics first: social posts, ads, funnels, virality, SEO, brand awareness. That usually means they are skipping the harder work of sharpening what the market should understand before it sees any tactic.',
        'Understand marketing as the discipline of making the offer legible, believable, and compelling to the right customer before scale enters the picture.',
        'Founders who know they need marketing but are still treating it like a bag of channels rather than a system built on clarity.',
        'Before launch, before paid spend, before hiring a marketer, and whenever the founder feels pressure to “do more marketing” without being able to name what the market is currently misunderstanding.',
        'Jumping straight into channels and promotion before the business has earned the right to be amplified.',
        'Teach me how Forge thinks about marketing at the root level. I do not want a list of tactics first. I want to understand what strong marketing actually is and why weak marketing wastes so much founder energy.',
        'Teach this like Forge: direct, clarifying, and a little confrontational when needed. Push the founder away from shallow tactic-chasing and toward the deeper logic of market clarity.',
        null, null, false, 60, 'published', now()
    ),
    (
        'positioning-message-and-offer-have-to-lock',
        'Positioning, Messaging, and Offer Have to Lock Together',
        'If those three pieces drift apart, the market feels the confusion immediately.',
        'Founders often talk about positioning, messaging, and the offer like they are separate tasks owned by different moments in the business. In reality they are a single operating system. Positioning answers who this is for and how it should be understood. Messaging translates that position into language the market can absorb quickly. The offer is the concrete expression of that promise. If any one piece drifts, the whole thing gets weaker. A founder might have sharp positioning but vague messaging. They might have decent messaging but an offer that feels generic or low-stakes. They might have a solid offer but language that makes it sound interchangeable. This lesson shows why customers feel those disconnects faster than founders do. It teaches the founder how to pressure-test whether their offer, message, and market position reinforce each other or quietly cancel each other out. It also makes clear that better wording cannot rescue weak positioning, and better traffic cannot rescue an offer the market does not trust or value enough.',
        'topic',
        (select id from categories where slug = 'marketing'),
        'foundry_original',
        array[1,2,3,4],
        'Core',
        20,
        'Positioning, messaging, and offer strength are multiplicative. If one is weak, everything downstream becomes harder to sell, explain, and spread.',
        'Watch for founders who keep rewriting copy while leaving the underlying offer vague, or who keep adjusting the offer while the positioning itself is still too broad.',
        'Build the ability to evaluate whether the market position, the language, and the actual offer reinforce each other cleanly.',
        'Founders who can explain their business in pieces but still feel the market does not fully “click” when those pieces are presented together.',
        'Before launch, during rebrands, before ad spend, and whenever the founder keeps tweaking words but cannot explain why the message still feels weak.',
        'Treating messaging as copywriting decoration instead of a structural reflection of positioning and offer design.',
        'Walk me through how positioning, messaging, and offer design should fit together. I want to know where my marketing is breaking if people hear me but still do not fully get it or act on it.',
        'Use concrete business examples. Force the founder to test whether each layer is doing real work or just creating the appearance of professionalism.',
        null, null, false, 62, 'published', now()
    ),
    (
        'channel-strategy-is-a-sequencing-decision',
        'Channel Strategy Is a Sequencing Decision',
        'The question is not “which channel is best?” The question is “which channel makes sense for this business right now?”',
        'Founders waste enormous time asking which marketing channel works best in general. There is no general answer. The right channel depends on the offer, customer behavior, stage of the company, budget, proof level, speed requirement, and what the founder can execute consistently. A weak founder channel strategy usually fails in two ways: either they spread themselves thin across too many channels at once, or they choose a channel that sounds credible but does not fit how their market actually buys. This lesson teaches channel strategy as sequencing. Start where signal is fastest, where learning is clearest, and where the founder can build competence before scaling complexity. It explains why some businesses should begin with direct outreach, some with partnerships, some with founder-led content, some with events, and only later with more scalable acquisition systems. It also challenges the false idea that every business should “do content,” “run ads,” or “build personal brand” immediately. The goal is disciplined channel choice, not channel prestige.',
        'topic',
        (select id from categories where slug = 'marketing'),
        'foundry_original',
        array[2,3,4,5],
        'Strategic',
        18,
        'Founders who pick channels out of imitation usually waste time, money, and confidence. Channel choice should follow business logic, not zeitgeist.',
        'Watch for founders listing five channels they are “testing” without a real theory for why any of them fit the customer, the offer, or the company stage.',
        'Learn how to sequence channels according to stage, signal speed, customer behavior, and founder capacity instead of chasing fashionable growth advice.',
        'Founders who know they need customer acquisition but are unclear on where to focus first and what to deliberately ignore.',
        'Before building a marketing plan, before hiring outside help, and whenever the founder feels busy across multiple channels but cannot point to one channel with real traction.',
        'Trying to be omnipresent before becoming effective anywhere.',
        'Help me choose marketing channels like an operator, not like someone copying startup advice. I want to know how Forge would sequence channels for a real founder with limited time and money.',
        'Push the founder toward tradeoffs. Good channel strategy should feel like disciplined exclusion, not a longer to-do list.',
        null, null, false, 64, 'published', now()
    ),
    (
        'attention-is-earned-through-trust-not-volume',
        'Attention Is Earned Through Trust, Not Volume',
        'Most content underperforms because it is trying to look active instead of becoming credible.',
        'Founders often approach content and organic marketing with a production mindset: more posts, more consistency, more output. Output matters, but only if it compounds trust. Markets do not reward volume by itself. They reward clarity, pattern recognition, usefulness, point of view, and relevance. This lesson helps founders understand the real job of content inside a business: reducing uncertainty for the customer over time. Good content teaches the customer how to think, helps them name their problem more precisely, and demonstrates that the founder understands the terrain better than the average voice in the category. Bad content simply announces presence. This lesson shows why credibility-building content and demand-converting content serve different purposes and should not be confused. It also challenges performative posting habits that make founders feel productive while teaching the market nothing. The focus here is not influencer behavior. It is trust architecture.',
        'topic',
        (select id from categories where slug = 'marketing'),
        'foundry_original',
        array[2,3,4,5],
        'Applied',
        19,
        'Organic marketing only compounds when it compounds trust. Without trust, content becomes noise and the founder slowly learns the wrong lesson: that content itself does not work.',
        'Watch for founders producing generic educational content, motivational content, or trend participation content that says little about the customer''s actual problem or the founder''s unique point of view.',
        'Understand how to use content as a trust-building system that sharpens demand rather than just filling a calendar.',
        'Founders building visibility through content, thought leadership, newsletters, or social platforms who want credibility instead of shallow impressions.',
        'When the founder is posting regularly but seeing weak business impact, or before they commit heavily to content without a clear strategic purpose.',
        'Confusing consistency with compounding. Posting often without becoming more trusted, more specific, or more useful.',
        'Teach me how Forge thinks about content and organic attention. I want to understand how content earns trust, what kinds of content actually move a business forward, and where founders usually waste effort.',
        'Keep it grounded in credibility, signal, and customer psychology. This should not sound like creator advice. It should sound like business strategy.',
        null, null, false, 66, 'published', now()
    ),
    (
        'conversion-problems-usually-start-before-the-click',
        'Conversion Problems Usually Start Before the Click',
        'Low conversion is rarely just a page problem. It usually reflects weak trust, weak message-to-market fit, or weak intent quality upstream.',
        'When founders see low conversion, they often focus immediately on landing page tactics: headlines, button color, call-to-action phrasing, page length. Those details matter, but they are rarely the root issue first. Conversion begins earlier. It begins in the expectation set by the message, the clarity of the promise, the quality of the traffic, the urgency of the problem, and the degree of trust established before a person ever arrives at the page. This lesson teaches founders to diagnose conversion with more rigor. It shows how a low-converting page can be a symptom of weak upstream marketing rather than bad on-page design alone. It also explains the relationship between intent quality and conversion rate, why broad traffic often converts badly, and how founder language accidentally introduces friction before the ask ever appears. Then it gets practical about what the ask itself should do: reduce ambiguity, clarify the next step, and match the prospect''s real buying stage.',
        'topic',
        (select id from categories where slug = 'marketing'),
        'foundry_original',
        array[3,4,5],
        'Applied',
        18,
        'Founders who diagnose conversion too narrowly end up optimizing pages when the deeper issue lives upstream in targeting, trust, or message quality.',
        'Watch for founders who are measuring page conversion but cannot explain the intent quality of the traffic they are sending there.',
        'Learn how to diagnose conversion problems as a full-system issue rather than only a copy or design issue.',
        'Founders with landing pages, sales pages, funnels, booking pages, or offer flows that are getting traffic but underperforming against expectations.',
        'As soon as you have a page or funnel that people are seeing but not acting on, especially when the founder is tempted to endlessly tinker with page details.',
        'Treating conversion like a design tweak problem when the message, traffic quality, or trust level is what is actually broken.',
        'Teach me how Forge would diagnose a conversion problem. I want to understand what to check before I start guessing at headlines and page tweaks.',
        'Walk the founder through upstream-to-downstream diagnosis. Show how better questions produce better fixes.',
        null, null, false, 68, 'published', now()
    ),
    (
        'demand-generation-needs-a-feedback-loop',
        'Demand Generation Needs a Feedback Loop, Not Just Activity',
        'Marketing matures when it stops being a stream of efforts and becomes a system that learns.',
        'At some point the founder has to move from isolated marketing actions to a feedback-driven demand system. That means every campaign, outreach push, content theme, offer test, and conversion path should teach something useful about the market. Without a feedback loop, marketing stays emotional. The founder interprets a good week as proof, a bad week as failure, and keeps changing too many variables at once. This lesson teaches what a real marketing feedback loop looks like: a clear hypothesis, a chosen channel, a specific audience, a defined offer, a measurable response, and disciplined interpretation. It also explains why founders need a small set of decision metrics instead of infinite dashboards, and how to separate lagging vanity numbers from leading learning signals. The point is not to make the founder an analyst. It is to make them harder to fool — by the market, by a platform, or by their own hope.',
        'topic',
        (select id from categories where slug = 'marketing'),
        'foundry_original',
        array[4,5,6],
        'Strategic',
        20,
        'Marketing only becomes reliable when it becomes a learning system. Otherwise the founder is just reacting to noise and momentum swings.',
        'Watch for founders who run campaigns or marketing pushes without a clear learning question, then over-interpret superficial results after the fact.',
        'Build a simple but serious marketing feedback loop that improves judgment over time instead of producing random activity and random conclusions.',
        'Founders with active marketing efforts who need to make stronger decisions about what is working, what is failing, and what the market is really saying.',
        'Once there is enough activity to generate data, especially before the founder hires help or scales spend on a system they still do not fully understand.',
        'Tracking too much, learning too little, and changing strategy based on emotional reaction instead of disciplined interpretation.',
        'Teach me how Forge would build a marketing feedback loop for a founder. I want to know what to measure, how to interpret it, and how to avoid fooling myself with vanity signals.',
        'This should feel like operator training. Keep it sharp, concrete, and intolerant of fake learning.',
        null, null, false, 70, 'published', now()
    ),
    (
        'brand-is-the-memory-you-leave-behind',
        'Brand Is the Memory You Leave Behind',
        'Brand is not logo work first. It is what people come to believe and remember after repeated contact with you.',
        'Founders often either over-romanticize brand or ignore it until later. Both mistakes are costly. Brand is not a decorative layer applied once the company is larger. It is the accumulated meaning people attach to the business through every repeated interaction: the promise, the tone, the reliability, the quality of thought, the customer experience, the visual language, and the consistency between what is said and what is delivered. This lesson helps the founder think about brand as memory architecture. What does the market remember after hearing from you three times, seeing your page, hearing a customer story, and comparing you to alternatives? If the answer is fuzzy, generic, or inconsistent, the brand is weak even if the company looks polished. This lesson also distinguishes early-stage brand building from vanity branding work. The founder does not need expensive symbolism first. They need a trustworthy pattern the market can retain and repeat.',
        'topic',
        (select id from categories where slug = 'marketing'),
        'foundry_original',
        array[2,3,4,5,6],
        'Strategic',
        17,
        'A weak brand makes every new interaction work harder because the market never accumulates a strong memory of who you are and why you matter.',
        'Watch for founders confusing visual polish with brand strength, or treating brand like something that starts after traction rather than something already being formed now.',
        'Understand brand as the cumulative memory of trust, consistency, and distinctiveness the market builds around the business.',
        'Founders who want stronger market perception, more word-of-mouth clarity, and a business that feels more memorable and trustworthy over time.',
        'As soon as the founder has customers, audience exposure, referrals, content, or repeated market contact that is shaping perception with or without intention.',
        'Thinking brand is either just a logo problem or just a late-stage luxury.',
        'Teach me how Forge thinks about brand at the founder level. I want to know what brand really is, what makes it stronger over time, and what founders get wrong when they try to “work on brand.”',
        'Teach this as strategic memory and trust, not as design theory. Keep it practical, grounded, and serious.',
        null, null, false, 72, 'published', now()
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
        ('marketing-is-clarity-made-visible',                'positioning-clarity'),
        ('marketing-is-clarity-made-visible',                'demand-generation'),
        ('marketing-is-clarity-made-visible',                'traction'),
        ('positioning-message-and-offer-have-to-lock',       'positioning-clarity'),
        ('positioning-message-and-offer-have-to-lock',       'offer-design'),
        ('positioning-message-and-offer-have-to-lock',       'messaging'),
        ('channel-strategy-is-a-sequencing-decision',        'channel-strategy'),
        ('channel-strategy-is-a-sequencing-decision',        'lead-generation'),
        ('channel-strategy-is-a-sequencing-decision',        'launch-strategy'),
        ('attention-is-earned-through-trust-not-volume',     'content-marketing'),
        ('attention-is-earned-through-trust-not-volume',     'brand-trust'),
        ('attention-is-earned-through-trust-not-volume',     'visibility'),
        ('conversion-problems-usually-start-before-the-click','conversion'),
        ('conversion-problems-usually-start-before-the-click','offer-design'),
        ('conversion-problems-usually-start-before-the-click','demand-generation'),
        ('demand-generation-needs-a-feedback-loop',          'marketing-analytics'),
        ('demand-generation-needs-a-feedback-loop',          'growth-metrics'),
        ('demand-generation-needs-a-feedback-loop',          'traction'),
        ('brand-is-the-memory-you-leave-behind',             'brand-trust'),
        ('brand-is-the-memory-you-leave-behind',             'messaging'),
        ('brand-is-the-memory-you-leave-behind',             'positioning-clarity')
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
        'marketing-that-actually-moves-the-business',
        'Marketing That Actually Moves the Business',
        'A seven-part Forge Academy series for founders who want marketing that creates trust, demand, and traction instead of noise.',
        'Most founders either avoid marketing, oversimplify it, or get trapped in tactics too early. This series rebuilds marketing from the inside out in Forge''s voice: first clarity, then position, then message, then channels, then trust, then conversion, then measurement. It is designed to make a founder more dangerous in the market, not just more active online. Each lesson pushes past surface marketing advice and teaches the logic underneath it, so the founder can make sharper decisions long after the series is done.',
        (select id from public.academy_categories where slug = 'marketing'),
        array[1,2,3,4,5,6],
        'Core',
        132,
        true,
        16,
        'published',
        'Build a founder-level marketing operating system that makes it easier to earn attention, build trust, choose channels, improve conversion, and learn from the market with discipline.',
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
where series_id = (select id from public.academy_series where slug = 'marketing-that-actually-moves-the-business');

insert into public.academy_series_items (series_id, content_id, position, required)
select s.id, c.id, v.position, true
from public.academy_series s
join (
    values
        ('marketing-is-clarity-made-visible',                 1),
        ('positioning-message-and-offer-have-to-lock',        2),
        ('channel-strategy-is-a-sequencing-decision',         3),
        ('attention-is-earned-through-trust-not-volume',      4),
        ('conversion-problems-usually-start-before-the-click',5),
        ('demand-generation-needs-a-feedback-loop',           6),
        ('brand-is-the-memory-you-leave-behind',              7)
) as v(content_slug, position) on true
join public.academy_content c on c.slug = v.content_slug
where s.slug = 'marketing-that-actually-moves-the-business';

commit;

begin;

insert into public.academy_tags (slug, name)
values
    ('customer-discovery', 'Customer Discovery'),
    ('offer-design', 'Offer Design'),
    ('legal-basics', 'Legal Basics'),
    ('unit-economics', 'Unit Economics'),
    ('launch-strategy', 'Launch Strategy'),
    ('growth-metrics', 'Growth Metrics'),
    ('product-market-fit', 'Product-Market Fit'),
    ('founder-confidence', 'Founder Confidence'),
    ('execution', 'Execution'),
    ('positioning-clarity', 'Positioning Clarity')
on conflict (slug) do update
set name = excluded.name;

with categories as (
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
        who_this_is_for,
        when_this_matters,
        common_mistake,
        starter_prompt,
        forge_context,
        video_url,
        youtube_video_id,
        featured,
        priority,
        status,
        published_at
    )
    values
        (
            'business-model-fundamentals',
            'Business Model Fundamentals',
            'Learn the core mechanics of how a business actually creates, delivers, and captures value.',
            'A lot of first-time founders can describe their idea but not the machine underneath it. This topic helps them understand how customer, value, revenue, and cost fit together before momentum hides structural weakness.',
            'topic',
            (select id from categories where slug = 'business-fundamentals'),
            'foundry_original',
            array[1,2],
            'Core',
            18,
            'If you cannot explain how the business works in plain language, every later choice gets weaker.',
            'Watch for fuzzy customer definitions, vague value claims, and revenue assumptions that only work if everything goes right.',
            'Understand the anatomy of a sound business model and how it changes strategy.',
            'Founders in idea or early planning mode who need to turn enthusiasm into actual business clarity.',
            'Right before you start making product, pricing, or go-to-market decisions based on a model you have not pressure-tested.',
            'Treating the business model like a pitch slide instead of the logic that determines whether the company can survive.',
            'Teach me the core parts of a business model in a way a first-time founder can really use. Then help me pressure-test mine.',
            'Start with the founder''s actual business idea and push toward precision. Do not let the conversation stay abstract.',
            null,
            null,
            true,
            10,
            'published',
            now()
        ),
        (
            'pick-a-problem-worth-building-on',
            'Pick a Problem Worth Building On',
            'A founder''s first real job is choosing a painful enough problem, not falling in love with vague potential.',
            'This topic helps founders separate interesting ideas from painful, expensive, recurring problems that people will actually act on. It is meant to save them from building around weak demand signals.',
            'topic',
            (select id from categories where slug = 'business-fundamentals'),
            'foundry_original',
            array[1],
            'Core',
            14,
            'Most bad startup paths begin with a problem that sounds real but does not hurt enough to change behavior.',
            'Watch for founders describing a market they like instead of a pain point people urgently want removed.',
            'Learn how to evaluate whether a problem is sharp enough, painful enough, and frequent enough to build a business around.',
            'Idea-stage founders who have energy and options but not yet enough constraint.',
            'Before you commit months to a direction that feels exciting but has weak real-world pull.',
            'Choosing problems based on personal fascination, trendiness, or imagined scale instead of real pain.',
            'Help me figure out whether the problem I want to solve is actually strong enough to build a company on. Show me how founders misread this early.',
            'Be direct. Help the founder distinguish between mild inconvenience, interesting curiosity, and painful unmet need.',
            null,
            null,
            true,
            12,
            'published',
            now()
        ),
        (
            'customer-discovery-without-self-deception',
            'Customer Discovery Without Self-Deception',
            'A practical lesson on how to learn from real people without collecting polite noise.',
            'Founders often think they are doing customer discovery when they are really fishing for encouragement. This topic teaches cleaner interviews, better listening, and stronger pattern recognition.',
            'topic',
            (select id from categories where slug = 'marketing'),
            'foundry_original',
            array[1,2],
            'Core',
            16,
            'Bad customer discovery creates false confidence, and false confidence is expensive.',
            'Watch for leading questions, hypothetical answers, and founders trying to validate themselves instead of learning something hard.',
            'Learn how to run customer conversations that produce usable truth instead of polite feedback.',
            'Idea and planning-stage founders who know they should talk to people but are not sure how to do it well.',
            'As soon as you have a problem hypothesis, an offer hypothesis, or a customer segment you think you understand.',
            'Asking people if they like the idea instead of uncovering what they already do, pay for, tolerate, or avoid.',
            'Teach me how to do customer discovery in a way that gets me real signal. I want better questions, better listening, and less self-deception.',
            'Push toward concrete interview behavior, not generic “talk to users” advice.',
            null,
            null,
            true,
            14,
            'published',
            now()
        ),
        (
            'positioning-people-instantly-understand',
            'Positioning People Instantly Understand',
            'If people need a long explanation to get it, the positioning is still weak.',
            'This topic helps founders tighten how they explain who they serve, what they solve, and why the offer is worth paying attention to. It is about clarity that travels, not cleverness.',
            'topic',
            (select id from categories where slug = 'marketing'),
            'foundry_original',
            array[1,2,3],
            'Core',
            15,
            'Weak positioning makes everything else harder: sales, referrals, product decisions, and customer trust.',
            'Watch for broad claims, generic language, and messaging that could belong to five different companies.',
            'Build positioning that is specific, believable, and easy for the right customer to repeat.',
            'Founders who struggle to explain their business in a way that gets an immediate “I get it.”',
            'Before launch, before paid acquisition, and before asking the market to spread your message for you.',
            'Trying to sound bigger or smarter instead of sounding clear.',
            'Help me sharpen my positioning so someone immediately understands what I do, who it is for, and why it matters.',
            'Challenge vague messaging. Push for specificity, contrast, and memorable clarity.',
            null,
            null,
            true,
            16,
            'published',
            now()
        ),
        (
            'offer-design-before-you-buy-attention',
            'Offer Design Before You Buy Attention',
            'Before you spend money or energy on traffic, make sure the offer is strong enough to deserve it.',
            'This topic is about offer strength. It helps founders improve what they are actually asking the market to care about before they rush into promotion.',
            'topic',
            (select id from categories where slug = 'sales'),
            'foundry_original',
            array[2,3,4],
            'Applied',
            16,
            'A weak offer turns marketing into expensive disappointment.',
            'Watch for founders blaming channels when the underlying offer is still vague, low-urgency, or hard to say yes to.',
            'Learn how to shape an offer so the market can understand it, value it, and respond to it.',
            'Founders preparing to launch, sell, or test demand beyond close personal circles.',
            'Right before you put real effort into marketing, outbound, or launch planning.',
            'Trying to solve an offer problem with more exposure.',
            'Teach me how to strengthen my offer before I try to market it harder. I want to know what makes an offer easy or hard to say yes to.',
            'Keep the lesson grounded in real buyer behavior. The founder should leave with sharper offer design criteria.',
            null,
            null,
            true,
            18,
            'published',
            now()
        ),
        (
            'your-first-legal-setup-without-overcomplicating-it',
            'Your First Legal Setup Without Overcomplicating It',
            'What founders actually need to get right early, and what they can stop dramatizing.',
            'This topic helps founders approach legal basics with sobriety instead of panic. It focuses on what matters first: entity decisions, ownership clarity, basic agreements, and avoiding messy avoidable mistakes.',
            'topic',
            (select id from categories where slug = 'legal'),
            'foundry_original',
            array[2,3],
            'Core',
            15,
            'Legal confusion creates invisible risk. It often stays quiet until money, cofounders, or customers make it expensive.',
            'Watch for founders delaying basic legal clarity because they assume they need a perfect setup or a big legal budget.',
            'Understand the first legal decisions that matter and how to avoid early founder mistakes.',
            'Planning-stage founders, solo founders formalizing, and teams about to split equity or sign real agreements.',
            'When the business is moving from idea mode into actual commitments, customer activity, or cofounder ownership.',
            'Either ignoring legal basics entirely or turning them into a drama spiral that delays progress.',
            'Walk me through the first legal setup decisions a serious founder should handle early. I want clarity, not legal theater.',
            'Stay practical and founder-oriented. This is about risk reduction and clean early structure, not law-school detail.',
            null,
            null,
            false,
            20,
            'published',
            now()
        ),
        (
            'basic-unit-economics-without-spreadsheet-theater',
            'Basic Unit Economics Without Spreadsheet Theater',
            'The simple numbers every founder should understand before calling the business healthy.',
            'This topic teaches the few unit economics concepts that actually matter early: contribution, margin, payback logic, and whether customer growth improves the business or damages it.',
            'topic',
            (select id from categories where slug = 'finance'),
            'foundry_original',
            array[2,4,5],
            'Applied',
            17,
            'You do not need a beautiful model first. You need to know whether each customer makes the business stronger or weaker.',
            'Watch for founders hiding weak economics behind topline growth or projecting future efficiency they have not earned.',
            'Build a practical grasp of unit economics so the founder can make better pricing, acquisition, and growth decisions.',
            'Founders with early revenue, pilot customers, or serious plans to spend on growth.',
            'Before paid acquisition, before hiring aggressively, and before mistaking activity for traction.',
            'Creating complicated models instead of understanding the few numbers that actually decide whether growth helps.',
            'Teach me the core unit economics I need as a first-time founder without turning it into finance jargon. I want decision tools I can use now.',
            'Keep it practical. Help the founder tie unit economics to real founder choices.',
            null,
            null,
            false,
            22,
            'published',
            now()
        ),
        (
            'financial-control-before-growth',
            'Financial Control Before Growth',
            'What a founder should measure before spending more, scaling faster, or celebrating momentum too early.',
            'This topic teaches restraint. It helps founders understand the difference between movement and financially sound movement before they scale a weak machine.',
            'topic',
            (select id from categories where slug = 'finance'),
            'foundry_original',
            array[2,4,5,6],
            'Applied',
            17,
            'Poor financial control destroys optionality. The founder loses room to think because the numbers were ignored while chasing speed.',
            'Look for whether spending is tied to a model, a learning loop, or just founder emotion.',
            'Make the founder more fluent in cash discipline, simple unit economics, and operational restraint.',
            'Founders with early revenue, rising costs, or growth plans that could outrun their financial control.',
            'Right before you spend faster, hire faster, or start believing that more motion automatically means more health.',
            'Confusing momentum with control and assuming the money details can be cleaned up later.',
            'Teach me what I should measure before trying to grow. I want a clear financial control system, not generic finance advice.',
            'Use simple language, but do not oversimplify. The founder should leave with real decision tools.',
            null,
            null,
            true,
            24,
            'published',
            now()
        ),
        (
            'your-first-launch-is-a-learning-event',
            'Your First Launch Is a Learning Event, Not a Debut',
            'A founder''s first launch should produce signal, not a performance about being ready.',
            'This topic helps founders launch in a way that teaches them something useful. It reframes launch away from vanity and toward focused market learning.',
            'topic',
            (select id from categories where slug = 'marketing'),
            'foundry_original',
            array[4,5],
            'Applied',
            15,
            'If the founder treats launch like a one-day performance, they miss the real point: learning what the market notices, ignores, and does.',
            'Watch for perfectionism, overproduction, and launch plans optimized for appearance instead of insight.',
            'Learn how to design an early launch so it generates traction, feedback, and clear next moves.',
            'Founders about to release something real for the first time or who have been delaying launch to “get it perfect.”',
            'Right before a first public release, early campaign, beta, pilot, or demand test.',
            'Treating launch like graduation instead of the start of a sharper feedback loop.',
            'Coach me on how to approach my first launch so I learn fast, get signal, and avoid making it about image or perfection.',
            'Push the founder toward clarity, speed, and learning discipline.',
            null,
            null,
            true,
            26,
            'published',
            now()
        ),
        (
            'what-to-measure-before-you-call-it-growth',
            'What to Measure Before You Call It Growth',
            'Not every uptick is real progress. Growth starts counting when it is durable, not just flattering.',
            'This topic helps founders think more rigorously about growth. It focuses on retention, repeatability, quality of customers, and whether momentum actually compounds.',
            'topic',
            (select id from categories where slug = 'decision-making'),
            'foundry_original',
            array[5,6],
            'Applied',
            16,
            'If you misread growth, you build the company around the wrong story.',
            'Watch for vanity metrics, temporary spikes, and founders using activity as proof that the business is working.',
            'Develop a cleaner definition of real growth and the discipline to measure it honestly.',
            'Founders entering launch or growth mode who need to distinguish signal from flattering noise.',
            'As soon as traffic, leads, signups, or revenue start moving enough to create story-making temptation.',
            'Calling something growth before it is repeatable, profitable, or retained.',
            'Teach me how to think about growth honestly. I want to know which numbers matter before I start building false confidence around the wrong ones.',
            'Keep this grounded in practical founder judgment, not analytics jargon.',
            null,
            null,
            true,
            28,
            'published',
            now()
        ),
        (
            'first-sales-without-feeling-sleazy',
            'First Sales Without Feeling Sleazy',
            'A direct lesson on selling with conviction instead of apology or awkwardness.',
            'New founders often hesitate around sales because they frame it as pressure instead of service. This topic reframes sales as the disciplined transfer of clarity and confidence.',
            'topic',
            (select id from categories where slug = 'sales'),
            'foundry_original',
            array[2,5],
            'Applied',
            16,
            'Most founders do not lose because they lacked a product. They lose because they never learned how to confidently ask for a decision.',
            'Pay attention to language that weakens authority: over-explaining, apologizing for price, or hiding from the ask.',
            'Develop a healthier, more effective mental model for founder-led sales.',
            'Founders who believe in what they are building but still tense up when it is time to make an ask.',
            'When you have something real enough to offer and the market is waiting on your willingness to actually sell it.',
            'Thinking good intentions remove the need for directness.',
            'Coach me on how to sell without sounding fake, needy, or aggressive. I want practical language and a stronger mindset.',
            'This should feel like founder coaching, not a generic sales script. Make the founder more direct and more grounded.',
            null,
            null,
            true,
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
            (select id from categories where slug = 'winners-mindset'),
            'foundry_original',
            array[1,2,3,4,5,6],
            'Mindset',
            14,
            'A founder who cannot move under uncertainty becomes professionally dependent on more data than real life ever provides.',
            'Watch for perfectionism, self-protection, and the desire to postpone commitment under the banner of “one more round of research.”',
            'Build the founder''s ability to act with discipline before certainty arrives.',
            'Founders who are smart enough to justify delay and honest enough to know it is hurting them.',
            'When you keep pushing a decision one more week because more thinking feels safer than movement.',
            'Treating hesitation like intellectual rigor.',
            'Talk to me about analysis paralysis like a serious founder coach. Help me separate real risk from delay disguised as thoughtfulness.',
            'Push the founder toward clearer decisions and smaller, cleaner commitments.',
            null,
            null,
            true,
            110,
            'published',
            now()
        ),
        (
            'fear-of-selling-is-fear-of-judgment',
            'Fear of Selling Is Fear of Judgment',
            'A Winner''s Mindset lesson on why selling feels personal and how to untangle identity from rejection.',
            'Many first-time founders say they need more confidence, but what they actually need is a cleaner relationship to rejection. This topic helps them stop treating a sales no as a referendum on self-worth.',
            'mindset',
            (select id from categories where slug = 'winners-mindset'),
            'foundry_original',
            array[2,5,6],
            'Mindset',
            13,
            'You cannot become strong at founder-led selling while every rejection still lands like identity damage.',
            'Notice whether the founder is protecting ego more than they are seeking truth from the market.',
            'Reduce emotional friction around sales and build a more durable selling identity.',
            'Founders who know they should sell more directly but keep emotionally shrinking from the moment of judgment.',
            'When the business needs more asks, more outreach, more conversations, or more pricing conviction than the founder is currently willing to tolerate.',
            'Trying to solve a selling discomfort problem with scripts alone.',
            'Help me work through the emotional side of selling. I want to stop taking rejection personally and learn to handle it like a founder.',
            'Be firm, psychologically sharp, and practical. This is about identity, not only tactics.',
            null,
            null,
            false,
            112,
            'published',
            now()
        ),
        (
            'imposter-syndrome-loves-vague-standards',
            'Imposter Syndrome Loves Vague Standards',
            'When the standard for “real founder” stays blurry, insecurity gets to keep winning.',
            'This entry helps founders see how imposter syndrome grows in environments where they keep moving the bar, comparing to polished operators, and demanding certainty they would never require from anyone else.',
            'mindset',
            (select id from categories where slug = 'winners-mindset'),
            'foundry_original',
            array[1,2,3,4,5,6],
            'Mindset',
            12,
            'A founder who constantly disqualifies themselves burns energy proving they deserve the role instead of doing the work the role demands.',
            'Watch for hidden standards like “real founders already know this” or “if I were good enough this would feel easier.”',
            'Replace vague self-doubt with clearer standards, cleaner self-respect, and steadier founder identity.',
            'Founders who keep feeling behind, underqualified, or exposed even while doing real work.',
            'When self-comparison starts slowing decisions, dulling initiative, or making the founder hide from visibility.',
            'Trying to defeat imposter syndrome with empty affirmation instead of clearer standards and more grounded self-respect.',
            'Talk to me about imposter syndrome in a way that is honest and useful. I do not want pep talk fluff. I want to stop shrinking in moments where I need to lead.',
            'Treat the founder with respect. Be direct, grounding, and slightly uncomfortable in a productive way.',
            null,
            null,
            false,
            114,
            'published',
            now()
        ),
        (
            'hesitation-is-usually-self-protection',
            'Hesitation Is Usually Self-Protection',
            'A lot of hesitation is not confusion. It is an attempt to stay safe from exposure.',
            'This lesson helps founders see hesitation for what it often is: emotional self-protection dressed up as caution, complexity, or timing. It is meant to help them move more honestly.',
            'mindset',
            (select id from categories where slug = 'winners-mindset'),
            'foundry_original',
            array[1,2,3,4,5,6],
            'Mindset',
            11,
            'If the founder cannot name what they are protecting themselves from, hesitation will keep masquerading as strategy.',
            'Watch for phrases like “I just need a bit more time” when the real issue is exposure, judgment, or the risk of being wrong in public.',
            'Build more self-awareness around hesitation so the founder can act from truth instead of disguised avoidance.',
            'Founders who can feel themselves hanging back even when the next move is already obvious.',
            'When action feels emotionally expensive and the founder keeps searching for a cleaner excuse.',
            'Assuming hesitation is automatically wisdom.',
            'Help me understand why I hesitate on things I already know matter. I want the real explanation, not a softened one.',
            'Name the emotional mechanics clearly. Then help the founder create a smaller, cleaner next move.',
            null,
            null,
            false,
            116,
            'published',
            now()
        ),
        (
            'decision-avoidance-feels-smart-until-it-costs-you',
            'Decision Avoidance Feels Smart Until It Costs You',
            'Waiting can look responsible right up until the bill for indecision arrives.',
            'This entry is for founders who are better at extending options than choosing one. It helps them see the cost of non-decisions and build more disciplined commitment.',
            'mindset',
            (select id from categories where slug = 'winners-mindset'),
            'foundry_original',
            array[2,3,4,5,6],
            'Mindset',
            12,
            'The cost of bad decisions is visible. The cost of delayed decisions often hides until it has quietly drained months.',
            'Watch for founders calling drift “keeping options open” when what they are really doing is avoiding responsibility for a chosen path.',
            'Strengthen the founder''s ability to make decisions with imperfect information and live with commitment.',
            'Founders with multiple options, mounting ambiguity, and a pattern of waiting too long to choose.',
            'When a business choice has stayed open long enough that the real risk is now continued delay.',
            'Assuming not choosing is neutral.',
            'Talk to me about decision avoidance like a founder coach. I want to understand the cost of my delay and how to start choosing more cleanly.',
            'Keep it firm, useful, and grounded in real tradeoffs.',
            null,
            null,
            false,
            118,
            'published',
            now()
        ),
        (
            'confidence-is-built-from-reps-not-mood',
            'Confidence Is Built From Reps, Not Mood',
            'Founders often wait to feel ready when what they actually need is more exposure and more reps.',
            'This lesson helps founders stop treating confidence like a prerequisite emotion and start treating it like something earned through repeated contact with the work.',
            'mindset',
            (select id from categories where slug = 'winners-mindset'),
            'foundry_original',
            array[1,2,3,4,5,6],
            'Mindset',
            11,
            'If the founder waits to feel confident first, they delay the exact reps that would have created confidence.',
            'Watch for emotional bargaining: “I''ll do it when I feel more ready.”',
            'Replace confidence fantasy with a more durable model rooted in reps, exposure, and evidence.',
            'Founders who keep saying they need more confidence before selling, launching, asking, or leading.',
            'Whenever the founder is emotionally negotiating with work they already know they need to do.',
            'Treating confidence like a feeling they are supposed to magically possess before acting.',
            'Help me stop waiting for confidence and start building it the right way. I want a founder frame that actually works under pressure.',
            'This should feel clarifying and a little confronting in a good way.',
            null,
            null,
            false,
            120,
            'published',
            now()
        ),
        (
            'how-to-talk-to-users-startup-school',
            'How To Talk To Users',
            'YC''s clearest practical lesson on how to run founder conversations that produce signal instead of polite noise.',
            'A strong customer conversation discipline changes product, positioning, and sales. This video is worth watching because it shows how much bad signal comes from bad interviewing.',
            'video',
            (select id from categories where slug = 'marketing'),
            'external_youtube',
            array[1,2],
            'Practical',
            18,
            'Most founders say they are listening to users while accidentally training themselves on bad evidence.',
            'Watch for how the questions avoid hypotheticals and how much emphasis is placed on behavior over opinion.',
            'Learn how to run cleaner user interviews and interpret the answers with less self-deception.',
            'Founders doing discovery, validation, or early offer shaping.',
            'Before product decisions harden around weak assumptions.',
            'Confusing encouragement with insight.',
            null,
            'Use this as a practical companion to Academy lessons on customer discovery. Help the founder extract the concrete behaviors they should copy.',
            'https://www.youtube.com/watch?v=z1iF1c8w5Lg',
            'z1iF1c8w5Lg',
            false,
            210,
            'published',
            now()
        ),
        (
            'how-to-get-your-first-customers-startup-school',
            'How to Get Your First Customers',
            'A grounded YC lesson on early traction, founder effort, and what getting initial customers really requires.',
            'This is useful because it keeps founders from fantasizing about scale before they have learned how to create demand manually. It is especially good for resetting expectations around early growth.',
            'video',
            (select id from categories where slug = 'sales'),
            'external_youtube',
            array[3,4,5],
            'Practical',
            20,
            'Many founders want “growth” before they have learned how to earn the first ten real customers.',
            'Watch for the emphasis on doing things that do not scale, learning direct sales, and working backward from a concrete goal.',
            'Understand how early customer acquisition actually works before trying to automate or scale it.',
            'Founders with a live offer who need traction more than theory.',
            'Right before or right after first launch, when the founder needs customer motion and honest expectations.',
            'Believing the first customers should come from a scalable channel instead of founder effort.',
            null,
            'Use this as a traction reality check. Pull out the parts most relevant to the founder''s business type and stage.',
            'https://www.youtube.com/watch?v=hyYCn_kAngI',
            'hyYCn_kAngI',
            false,
            212,
            'published',
            now()
        ),
        (
            'startup-pricing-101-kevin-hale',
            'Startup Pricing 101',
            'A YC pricing lesson that helps founders stop treating price like guesswork or emotional discomfort.',
            'Pricing changes acquisition, positioning, customer quality, and business health. This video is useful because it makes pricing feel like a strategic lever instead of a fear trigger.',
            'video',
            (select id from categories where slug = 'finance'),
            'external_youtube',
            array[2,4,5],
            'Practical',
            18,
            'Weak pricing quietly poisons the business long before the founder admits pricing is the issue.',
            'Watch for the connection between pricing, acquisition strategy, and the founder''s tendency to undercharge out of insecurity.',
            'Build a more strategic mental model for early-stage pricing and monetization.',
            'Founders pricing an offer, a pilot, or an early product for the first serious time.',
            'Before you lock in a low price that teaches the wrong lesson about your value.',
            'Choosing price based mostly on fear of rejection.',
            null,
            'Use this to deepen Academy pricing lessons and push the founder toward a more deliberate pricing posture.',
            'https://www.youtube.com/watch?v=jwXlo9gy_k4',
            'jwXlo9gy_k4',
            false,
            214,
            'published',
            now()
        ),
        (
            'the-real-product-market-fit-michael-seibel',
            'The Real Product Market Fit',
            'Michael Seibel''s clean reminder that product-market fit is not a vibe, a tweet, or a flattering graph.',
            'Founders misuse product-market fit all the time. This video is useful because it strips away mythology and helps people think more honestly about what fit looks like in practice.',
            'video',
            (select id from categories where slug = 'decision-making'),
            'external_youtube',
            array[5,6],
            'Strategic',
            13,
            'If a founder mislabels product-market fit, they start scaling stories instead of reality.',
            'Watch for the way Seibel distinguishes sustainable pull from early excitement and why many founders think they have fit too early.',
            'Get a more rigorous definition of product-market fit and the discipline to not claim it too soon.',
            'Founders entering traction or growth conversations who need cleaner language around what is actually working.',
            'When momentum is starting to create optimism and the founder needs sharper judgment, not more hype.',
            'Calling product-market fit too early because a few metrics finally moved.',
            null,
            'Use this as a calibration tool when the founder starts telling themselves a flattering traction story.',
            'https://www.youtube.com/watch?v=FBOLk9s9Ci4',
            'FBOLk9s9Ci4',
            false,
            216,
            'published',
            now()
        ),
        (
            'business-model-pressure-test',
            'Business Model Pressure-Test',
            'A simple internal framework for testing whether your business model still makes sense when assumptions get stressed.',
            'This resource gives founders a practical way to challenge the assumptions underneath customer, pricing, delivery, and margin. It is less about ideation and more about exposing weak logic.',
            'resource',
            (select id from categories where slug = 'business-fundamentals'),
            'foundry_original',
            array[1,2,3,4],
            'Core',
            10,
            'A founder should be able to pressure-test the business model before the market does it brutally for them.',
            'Look for assumptions that only work if customer behavior, willingness to pay, and delivery costs are unusually favorable.',
            'Give the founder a reusable structure for testing whether the business model is actually coherent.',
            'Founders who have an idea or early model but want to know where it breaks first.',
            'Right before committing deeper to a business direction or building around a comforting but weak assumption.',
            'Mistaking a coherent pitch for a coherent model.',
            'Help me pressure-test my business model. I want a clean framework that exposes weak assumptions fast.',
            'Guide the founder step by step through the weak points in their current model.',
            null,
            null,
            false,
            310,
            'published',
            now()
        ),
        (
            'customer-discovery-interview-guide',
            'Customer Discovery Interview Guide',
            'A practical interview structure for getting signal from real conversations instead of vague encouragement.',
            'This resource gives founders a usable shape for discovery calls: who to talk to, how to open, what to ask, and how to summarize what actually matters afterward.',
            'resource',
            (select id from categories where slug = 'marketing'),
            'foundry_original',
            array[1,2],
            'Practical',
            9,
            'Founders usually do better discovery once they have a structure that keeps them from drifting into approval-seeking.',
            'Watch for whether the founder is asking about behavior, workarounds, cost, urgency, and consequences instead of opinions about the idea.',
            'Give the founder a clean, repeatable interview framework they can use immediately.',
            'Idea and planning-stage founders who want to start talking to real people this week.',
            'When you know discovery matters but keep postponing it because you are unsure how to do it well.',
            'Believing good discovery requires charisma instead of structure and honesty.',
            'Give me a practical customer discovery interview guide I could actually use this week.',
            'Keep it concrete and usable. This should feel like a field guide, not theory.',
            null,
            null,
            false,
            312,
            'published',
            now()
        ),
        (
            'simple-pricing-ladder',
            'Simple Pricing Ladder',
            'A lightweight framework for thinking about entry price, expansion, and what your pricing is training the market to expect.',
            'This resource helps founders think beyond one number. It introduces a simple ladder for low-risk entry, core value capture, and higher-value expansion.',
            'resource',
            (select id from categories where slug = 'finance'),
            'foundry_original',
            array[2,4,5],
            'Practical',
            8,
            'Pricing is not only a number. It is a signal about value, seriousness, and how the business plans to grow.',
            'Look for whether the founder has only one awkward price point instead of a deliberate path from first yes to deeper value.',
            'Help the founder design a more flexible pricing structure without overengineering it.',
            'Founders pricing services, offers, pilots, retainers, or early SaaS plans.',
            'Before setting a price you will later have to painfully unwind.',
            'Treating pricing like a one-time guess instead of a design choice.',
            'Help me think through pricing with a simple ladder or framework instead of one arbitrary number.',
            'Push toward clarity, not complexity.',
            null,
            null,
            false,
            314,
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
        who_this_is_for = excluded.who_this_is_for,
        when_this_matters = excluded.when_this_matters,
        common_mistake = excluded.common_mistake,
        starter_prompt = excluded.starter_prompt,
        forge_context = excluded.forge_context,
        video_url = excluded.video_url,
        youtube_video_id = excluded.youtube_video_id,
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
join (
    values
        ('business-model-fundamentals', 'business-model'),
        ('business-model-fundamentals', 'judgment'),
        ('pick-a-problem-worth-building-on', 'business-model'),
        ('pick-a-problem-worth-building-on', 'judgment'),
        ('customer-discovery-without-self-deception', 'customer-discovery'),
        ('customer-discovery-without-self-deception', 'judgment'),
        ('positioning-people-instantly-understand', 'positioning'),
        ('positioning-people-instantly-understand', 'positioning-clarity'),
        ('offer-design-before-you-buy-attention', 'offer-design'),
        ('offer-design-before-you-buy-attention', 'positioning'),
        ('your-first-legal-setup-without-overcomplicating-it', 'legal-basics'),
        ('your-first-legal-setup-without-overcomplicating-it', 'judgment'),
        ('basic-unit-economics-without-spreadsheet-theater', 'unit-economics'),
        ('basic-unit-economics-without-spreadsheet-theater', 'financial-control'),
        ('financial-control-before-growth', 'financial-control'),
        ('financial-control-before-growth', 'unit-economics'),
        ('your-first-launch-is-a-learning-event', 'launch-strategy'),
        ('your-first-launch-is-a-learning-event', 'execution'),
        ('what-to-measure-before-you-call-it-growth', 'growth-metrics'),
        ('what-to-measure-before-you-call-it-growth', 'product-market-fit'),
        ('first-sales-without-feeling-sleazy', 'sales-confidence'),
        ('first-sales-without-feeling-sleazy', 'founder-confidence'),
        ('analysis-paralysis-is-not-caution', 'uncertainty'),
        ('analysis-paralysis-is-not-caution', 'judgment'),
        ('fear-of-selling-is-fear-of-judgment', 'sales-confidence'),
        ('fear-of-selling-is-fear-of-judgment', 'founder-identity'),
        ('imposter-syndrome-loves-vague-standards', 'founder-confidence'),
        ('imposter-syndrome-loves-vague-standards', 'founder-identity'),
        ('hesitation-is-usually-self-protection', 'judgment'),
        ('hesitation-is-usually-self-protection', 'execution'),
        ('decision-avoidance-feels-smart-until-it-costs-you', 'judgment'),
        ('decision-avoidance-feels-smart-until-it-costs-you', 'uncertainty'),
        ('confidence-is-built-from-reps-not-mood', 'founder-confidence'),
        ('confidence-is-built-from-reps-not-mood', 'execution'),
        ('how-to-talk-to-users-startup-school', 'customer-discovery'),
        ('how-to-get-your-first-customers-startup-school', 'sales-confidence'),
        ('startup-pricing-101-kevin-hale', 'pricing'),
        ('startup-pricing-101-kevin-hale', 'financial-control'),
        ('the-real-product-market-fit-michael-seibel', 'product-market-fit'),
        ('the-real-product-market-fit-michael-seibel', 'growth-metrics'),
        ('business-model-pressure-test', 'business-model'),
        ('business-model-pressure-test', 'judgment'),
        ('customer-discovery-interview-guide', 'customer-discovery'),
        ('simple-pricing-ladder', 'pricing'),
        ('simple-pricing-ladder', 'offer-design')
) as m(content_slug, tag_slug) on m.content_slug = c.slug
join public.academy_tags t on t.slug = m.tag_slug
on conflict do nothing;

update public.academy_content
set
    starter_prompt = case slug
        when 'business-model-fundamentals' then 'Open this like a serious founder thinking lesson, not a definition. Start by challenging the idea that a business model is just a pitch slide. Show what most founders miss, reframe it as the logic engine of the company, show how weak models break in real situations, then optionally bridge back to the founder''s current business.'
        when 'pick-a-problem-worth-building-on' then 'Start by challenging the assumption that any interesting problem is worth building on. Show what most founders miss about pain, urgency, and behavioral change. Reframe startup selection around real costly pain, show how this appears in real markets, then optionally help the founder pressure-test their own idea.'
        when 'customer-discovery-without-self-deception' then 'Open by challenging the idea that talking to customers automatically creates insight. Show how founders accidentally collect polite noise, reframe discovery as disciplined truth-seeking, show what this looks like in real interviews, then optionally help the founder prepare for their next conversation.'
        when 'positioning-people-instantly-understand' then 'Start by challenging the belief that better wording is the same as better positioning. Show what most founders miss about clarity, contrast, and memorability. Reframe positioning as helping the right person recognize themselves instantly, show how weak positioning hurts real businesses, then optionally connect it back to the founder''s message.'
        when 'offer-design-before-you-buy-attention' then 'Open by challenging the instinct to solve weak demand with more traffic. Show what founders miss about offer strength, reframe the offer as the thing the market is actually being asked to say yes to, show how this plays out in real launch and sales situations, then optionally pressure-test the founder''s current offer.'
        when 'your-first-legal-setup-without-overcomplicating-it' then 'Open by challenging the tendency to either ignore legal basics or dramatize them. Show what most founders miss about clean early structure, reframe legal setup as risk reduction and clarity, show where founders get burned in real situations, then optionally bridge to the founder''s current setup.'
        when 'basic-unit-economics-without-spreadsheet-theater' then 'Start by challenging the idea that good finance means complex models. Show what founders miss about the few numbers that actually matter, reframe unit economics as a decision tool, show how weak economics show up in real growth situations, then optionally connect it back to the founder''s model.'
        when 'financial-control-before-growth' then 'Open by challenging the assumption that momentum and financial health are the same thing. Show what founders miss before growth gets expensive, reframe financial control as preserving optionality and judgment, show how founders get trapped in real businesses, then optionally bridge to the founder''s current stage.'
        when 'your-first-launch-is-a-learning-event' then 'Start by challenging the idea that launch is a debut performance. Show what founders miss when they optimize for appearance, reframe launch as a signal-generating event, show how this changes real launch behavior, then optionally help the founder think through their next launch.'
        when 'what-to-measure-before-you-call-it-growth' then 'Open by challenging the belief that any upward graph means growth. Show what founders miss about durability and repeatability, reframe growth as something earned not narrated, show where vanity metrics distort real decisions, then optionally connect it to what the founder is currently measuring.'
        when 'first-sales-without-feeling-sleazy' then 'Start by challenging the belief that selling well requires becoming pushy or fake. Show what founders miss about clarity, service, and directness, reframe sales as helping someone make a decision, show how weak sales posture appears in real conversations, then optionally bridge to the founder''s own selling moments.'
        when 'analysis-paralysis-is-not-caution' then 'Open by challenging the idea that more thinking is automatically wiser. Show what most founders miss about avoidance disguised as intelligence, reframe action under uncertainty as a founder skill, show where this pattern appears in real decisions, then optionally bridge to the founder''s current hesitation.'
        when 'fear-of-selling-is-fear-of-judgment' then 'Open by challenging the belief that fear of selling is mainly a tactics problem. Show what most founders miss about judgment and identity, reframe selling discomfort as an emotional exposure problem, show how that appears in real asks and conversations, then optionally bridge to the founder''s own pattern.'
        when 'imposter-syndrome-loves-vague-standards' then 'Start by challenging the idea that imposter syndrome is solved by reassurance. Show what founders miss about vague standards and endless self-disqualification, reframe confidence around clearer standards and cleaner self-respect, show how this appears in real founder behavior, then optionally bridge to where the founder is shrinking.'
        when 'hesitation-is-usually-self-protection' then 'Open by challenging the belief that hesitation is always thoughtful caution. Show what founders miss about self-protection, reframe hesitation as something that often hides exposure fear, show how this appears in real business situations, then optionally connect it to the founder''s current stuck point.'
        when 'decision-avoidance-feels-smart-until-it-costs-you' then 'Start by challenging the idea that not deciding is neutral. Show what founders miss about the hidden cost of delay, reframe decision-making as choosing with imperfect information, show how drift damages real businesses, then optionally help the founder examine one delayed decision.'
        when 'confidence-is-built-from-reps-not-mood' then 'Open by challenging the instinct to wait until confidence arrives first. Show what founders miss about reps, exposure, and earned certainty, reframe confidence as something built through contact with the work, show how this appears in real founder behavior, then optionally bridge to what the founder keeps postponing.'
        when 'how-to-talk-to-users-startup-school' then 'Open this video companion by challenging the idea that user conversations naturally produce signal. Frame the lesson around what founders usually miss in discovery, pull out the non-obvious parts of the video, explain where they matter in real founder situations, then optionally help the founder apply the ideas to their next interview.'
        when 'how-to-get-your-first-customers-startup-school' then 'Open this as a traction thinking lesson, not just a video summary. Challenge the fantasy that early customers come from scalable systems first, show what founders usually miss about manual traction, reframe early customer acquisition as founder learning, show how it appears in real businesses, then optionally bridge to the founder''s next customer move.'
        when 'startup-pricing-101-kevin-hale' then 'Open this pricing lesson by challenging the instinct to pick a price based mostly on comfort. Show what founders miss about what price is really doing, reframe pricing as a strategic choice, show how bad pricing distorts real businesses, then optionally connect it back to the founder''s offer.'
        when 'the-real-product-market-fit-michael-seibel' then 'Open this by challenging the tendency to call product-market fit too early. Show what founders miss when they confuse momentum with fit, reframe product-market fit as durable market pull, show how false positives appear in real businesses, then optionally help the founder think more honestly about their own traction.'
        when 'business-model-pressure-test' then 'Open this resource by challenging the assumption that a coherent story means a coherent business. Show what founders usually miss in their assumptions, reframe the framework as a way to expose weak logic early, show where pressure cracks appear in real businesses, then optionally help the founder pressure-test their model.'
        when 'customer-discovery-interview-guide' then 'Open this resource by challenging the assumption that customer discovery is mostly about asking the right questions off the cuff. Reframe it as a disciplined structure for extracting truth, show how this plays out in real discovery calls, then optionally help the founder prepare for one actual conversation.'
        when 'simple-pricing-ladder' then 'Open this resource by challenging the idea that pricing is one number you pick once. Show what founders miss about pricing paths, reframe the ladder as a way to match value and commitment, show how this matters in real offers, then optionally help the founder sketch a cleaner pricing path.'
        when 'founder-decision-memo' then 'Open this resource by challenging the instinct to keep big decisions vague and emotional. Show what founders miss when they do not force clarity, reframe the memo as a tool for sharper judgment, show where it matters in real decisions, then optionally help the founder work through one live choice.'
        else starter_prompt
    end,
    forge_context = case slug
        when 'business-model-fundamentals' then 'Use the Academy topic flow: hook, realization, reframe, application, optional personal bridge. Stay universal-first. This is about how businesses work, not only the founder''s current company.'
        when 'pick-a-problem-worth-building-on' then 'Universal-first. Teach problem selection as founder judgment. Do not reduce the lesson to the founder''s current idea too early.'
        when 'customer-discovery-without-self-deception' then 'Make the founder think more clearly about truth-seeking, signal quality, and discovery discipline before you get tactical.'
        when 'positioning-people-instantly-understand' then 'Lead with universal insight about clarity and recognition. Then move into how weak positioning shows up in real markets.'
        when 'offer-design-before-you-buy-attention' then 'Teach offer strength as a business truth first, then connect it to marketing, launch, and sales situations.'
        when 'your-first-legal-setup-without-overcomplicating-it' then 'Stay practical and de-dramatizing. This should sharpen judgment, not turn into legal definitions.'
        when 'basic-unit-economics-without-spreadsheet-theater' then 'Keep this decision-oriented and intuitive. Teach the mental model before any numbers.'
        when 'financial-control-before-growth' then 'This should make the founder more sober and more precise. Lead with universal business truths about optionality and control.'
        when 'your-first-launch-is-a-learning-event' then 'Make launch feel like a thinking discipline, not a performance event.'
        when 'what-to-measure-before-you-call-it-growth' then 'Challenge vanity metrics and flattering narratives early. This is about growth judgment.'
        when 'first-sales-without-feeling-sleazy' then 'Blend psychology and practical sales thinking. Do not sound like a script coach.'
        when 'analysis-paralysis-is-not-caution' then 'Slightly uncomfortable is good here. Name the avoidance pattern directly.'
        when 'fear-of-selling-is-fear-of-judgment' then 'Lead with the emotional truth under the behavior. Do not hide behind tactics.'
        when 'imposter-syndrome-loves-vague-standards' then 'Respect the founder. Do not reassure too quickly. Bring clarity before comfort.'
        when 'hesitation-is-usually-self-protection' then 'Name the protective logic directly and help the founder see it clearly.'
        when 'decision-avoidance-feels-smart-until-it-costs-you' then 'Treat indecision as a real operating cost, not a personality quirk.'
        when 'confidence-is-built-from-reps-not-mood' then 'This should change how the founder thinks about confidence, not simply motivate them.'
        when 'how-to-talk-to-users-startup-school' then 'Use the video as a guided application layer. Pull out what most founders miss and turn it into sharper discovery behavior.'
        when 'how-to-get-your-first-customers-startup-school' then 'Use the video to teach traction thinking, especially around manual effort, directness, and early customer reality.'
        when 'startup-pricing-101-kevin-hale' then 'Use the video as a pricing reframe. Pull the founder into how price shapes the business, not just the checkout.'
        when 'the-real-product-market-fit-michael-seibel' then 'Use the video as a calibration tool. Keep the founder from using product-market fit like a flattering label.'
        when 'business-model-pressure-test' then 'Keep this framework-driven and diagnostic. The founder should leave seeing a weakness more clearly.'
        when 'customer-discovery-interview-guide' then 'This should feel like field training. Practical, but still tied to deeper founder judgment.'
        when 'simple-pricing-ladder' then 'Keep it practical and strategic. Teach pricing architecture, not only price picking.'
        when 'founder-decision-memo' then 'This should sharpen thought structure. Make the founder name options, tradeoffs, and what they are actually choosing.'
        else forge_context
    end
where slug in (
    'business-model-fundamentals',
    'pick-a-problem-worth-building-on',
    'customer-discovery-without-self-deception',
    'positioning-people-instantly-understand',
    'offer-design-before-you-buy-attention',
    'your-first-legal-setup-without-overcomplicating-it',
    'basic-unit-economics-without-spreadsheet-theater',
    'financial-control-before-growth',
    'your-first-launch-is-a-learning-event',
    'what-to-measure-before-you-call-it-growth',
    'first-sales-without-feeling-sleazy',
    'analysis-paralysis-is-not-caution',
    'fear-of-selling-is-fear-of-judgment',
    'imposter-syndrome-loves-vague-standards',
    'hesitation-is-usually-self-protection',
    'decision-avoidance-feels-smart-until-it-costs-you',
    'confidence-is-built-from-reps-not-mood',
    'how-to-talk-to-users-startup-school',
    'how-to-get-your-first-customers-startup-school',
    'startup-pricing-101-kevin-hale',
    'the-real-product-market-fit-michael-seibel',
    'business-model-pressure-test',
    'customer-discovery-interview-guide',
    'simple-pricing-ladder',
    'founder-decision-memo'
);

update public.academy_content
set
    title = case slug
        when 'business-model-fundamentals' then 'The Business Model Under the Story'
        when 'pick-a-problem-worth-building-on' then 'Not Every Problem Deserves a Company'
        when 'customer-discovery-without-self-deception' then 'Customer Discovery Without Lying to Yourself'
        when 'positioning-people-instantly-understand' then 'If They Need the Second Sentence, You Lost Them'
        when 'offer-design-before-you-buy-attention' then 'Fix the Offer Before You Chase Attention'
        when 'your-first-legal-setup-without-overcomplicating-it' then 'Get the Legal Bones Right Early'
        when 'basic-unit-economics-without-spreadsheet-theater' then 'The Numbers That Decide If Growth Helps or Hurts'
        when 'financial-control-before-growth' then 'Growth Without Control Is Just a Faster Mistake'
        when 'your-first-launch-is-a-learning-event' then 'Launch to Learn, Not to Perform'
        when 'what-to-measure-before-you-call-it-growth' then 'Before You Call It Growth, Check This'
        when 'first-sales-without-feeling-sleazy' then 'Sell Without Shrinking'
        when 'analysis-paralysis-is-not-caution' then 'Overthinking Looks Smarter Than It Is'
        when 'fear-of-selling-is-fear-of-judgment' then 'Selling Feels Personal'
        when 'imposter-syndrome-loves-vague-standards' then 'Imposter Syndrome Thrives on Blurry Standards'
        when 'hesitation-is-usually-self-protection' then 'Hesitation Is Usually Self-Protection'
        when 'decision-avoidance-feels-smart-until-it-costs-you' then 'The Decision You''re Not Making Is Still Costing You'
        when 'confidence-is-built-from-reps-not-mood' then 'Confidence Comes After Contact'
        when 'how-to-talk-to-users-startup-school' then 'How To Talk To Users So You Learn Something'
        when 'how-to-get-your-first-customers-startup-school' then 'Your First Customers Won''t Arrive by Accident'
        when 'startup-pricing-101-kevin-hale' then 'Pricing Is a Strategy Decision'
        when 'the-real-product-market-fit-michael-seibel' then 'Product-Market Fit Is Not a Feeling'
        when 'business-model-pressure-test' then 'Pressure-Test the Business Before the Market Does'
        when 'customer-discovery-interview-guide' then 'The Customer Interview Guide That Actually Gets Signal'
        when 'simple-pricing-ladder' then 'Build a Price Path, Not Just a Price'
        when 'founder-decision-memo' then 'Write the Decision Down Before It Writes You'
        else title
    end,
    short_description = case slug
        when 'business-model-fundamentals' then 'Most founders can tell the story of the business long before they can explain the machine.'
        when 'pick-a-problem-worth-building-on' then 'An idea can sound exciting and still be built on a problem nobody urgently wants gone.'
        when 'customer-discovery-without-self-deception' then 'A lot of founders “talk to customers” and come back with nothing but flattering noise.'
        when 'positioning-people-instantly-understand' then 'If the market needs too much explanation, the positioning is still doing too little work.'
        when 'offer-design-before-you-buy-attention' then 'Traffic exposes weak offers. It does not rescue them.'
        when 'your-first-legal-setup-without-overcomplicating-it' then 'Early legal clarity is boring right up until the lack of it becomes expensive.'
        when 'basic-unit-economics-without-spreadsheet-theater' then 'You do not need a masterpiece model first. You need the few numbers that tell the truth.'
        when 'financial-control-before-growth' then 'Growth feels exciting. Financial control decides whether it is real or reckless.'
        when 'your-first-launch-is-a-learning-event' then 'Your first launch should buy insight, not stagecraft.'
        when 'what-to-measure-before-you-call-it-growth' then 'Upward motion is cheap. Durable growth is not.'
        when 'first-sales-without-feeling-sleazy' then 'Many founders are not bad at sales. They are bad at staying whole while asking for a decision.'
        when 'analysis-paralysis-is-not-caution' then 'Overthinking can sound disciplined long after it has turned into avoidance.'
        when 'fear-of-selling-is-fear-of-judgment' then 'A lot of “sales discomfort” is just the fear of being seen clearly and still hearing no.'
        when 'imposter-syndrome-loves-vague-standards' then 'If your standards stay blurry, you can always find a new reason to disqualify yourself.'
        when 'hesitation-is-usually-self-protection' then 'A lot of hesitation is just self-protection in cleaner clothes.'
        when 'decision-avoidance-feels-smart-until-it-costs-you' then 'Not choosing buys temporary relief and usually sends the bill later.'
        when 'confidence-is-built-from-reps-not-mood' then 'Confidence usually shows up after the reps, not before them.'
        when 'how-to-talk-to-users-startup-school' then 'A YC companion on getting signal instead of compliments.'
        when 'how-to-get-your-first-customers-startup-school' then 'A reality check on what early traction really asks of a founder.'
        when 'startup-pricing-101-kevin-hale' then 'A pricing lesson for founders who need strategy, not just a number that feels safe.'
        when 'the-real-product-market-fit-michael-seibel' then 'A sharper lens on the moment founders most want to flatter themselves.'
        when 'business-model-pressure-test' then 'A framework for finding the weak spots before the market does.'
        when 'customer-discovery-interview-guide' then 'An interview structure built to surface truth instead of politeness.'
        when 'simple-pricing-ladder' then 'A cleaner way to think about entry price, expansion, and what your pricing teaches people to expect.'
        when 'founder-decision-memo' then 'A framework for turning founder drift into an actual decision.'
        else short_description
    end,
    description = case slug
        when 'business-model-fundamentals' then 'A founder can sound persuasive and still be building on mush. This entry is about seeing the business underneath the pitch: who it serves, what changes for them, how money moves, and where the logic breaks when reality gets less generous.'
        when 'pick-a-problem-worth-building-on' then 'Founders waste years on problems that are interesting to talk about and weak to solve. This topic is about learning the difference between something people notice and something they urgently want removed from their life or work.'
        when 'customer-discovery-without-self-deception' then 'Customer discovery goes wrong when the founder is secretly looking for emotional relief instead of truth. This entry sharpens how to listen, what to ask, and how to stop mistaking encouragement for evidence.'
        when 'positioning-people-instantly-understand' then 'Positioning is not clever wording. It is whether the right person feels recognized fast enough to care. This topic is about clarity, compression, and saying something the market can actually hold onto.'
        when 'offer-design-before-you-buy-attention' then 'A weak offer makes every channel look harder than it is. This topic helps founders understand what people are really being asked to say yes to, and why more exposure only makes a vague offer fail in public faster.'
        when 'your-first-legal-setup-without-overcomplicating-it' then 'Legal basics are easy to postpone because they rarely scream until later. This topic helps founders get sober about structure, ownership, agreements, and the early decisions that are boring now and painful later.'
        when 'basic-unit-economics-without-spreadsheet-theater' then 'This is not about making you “good at finance.” It is about helping you see whether each customer makes the business sturdier or weaker. Once you see that clearly, better pricing, acquisition, and growth decisions stop feeling abstract.'
        when 'financial-control-before-growth' then 'Founders often discover too late that they were scaling emotion, not economics. This topic is about preserving room to think by staying close to the few numbers that decide whether growth is strengthening the business or thinning it out.'
        when 'your-first-launch-is-a-learning-event' then 'A launch gets weaker the more it becomes a performance about being ready. This topic reframes launch as a moment to learn what the market notices, what it ignores, and what the founder still needs to sharpen next.'
        when 'what-to-measure-before-you-call-it-growth' then 'Growth stories form early and they are often flattering. This entry helps founders separate motion from compounding strength by looking at what actually lasts, repeats, and gets healthier as the business grows.'
        when 'first-sales-without-feeling-sleazy' then 'What feels “sleazy” in early sales is often not the act of selling but the founder''s discomfort with directness, judgment, and asking someone to decide. This topic makes that tension visible and more workable.'
        when 'analysis-paralysis-is-not-caution' then 'Overthinking becomes a problem when it starts pretending to be discipline. This entry is about spotting the point where more analysis stops helping and starts protecting the founder from the discomfort of moving.'
        when 'fear-of-selling-is-fear-of-judgment' then 'Selling feels loaded because it forces a clean moment of exposure: here is what I believe, here is what I charge, here is the ask. This topic is about the identity friction under that moment, not just the sales tactic on top of it.'
        when 'imposter-syndrome-loves-vague-standards' then 'Imposter syndrome gets stronger when the standard for “real founder” never stops moving. This entry is about exposing the hidden standards that keep capable founders feeling like they are still pretending.'
        when 'hesitation-is-usually-self-protection' then 'A lot of hesitation is not confusion about the next move. It is resistance to the emotional cost of making it. This topic is meant to make that pattern harder to hide from.'
        when 'decision-avoidance-feels-smart-until-it-costs-you' then 'Some founders are better at keeping options open than choosing a path. This entry is about the operating cost of that habit, and why drift is often more expensive than a flawed decision.'
        when 'confidence-is-built-from-reps-not-mood' then 'Founders often wait for a feeling that only shows up after repeated contact with the work. This topic puts confidence back where it belongs: reps, exposure, and evidence.'
        when 'how-to-talk-to-users-startup-school' then 'This video earns its place because discovery goes soft fast. Use it as a guide for cleaner conversations, better signal, and less self-deception.'
        when 'how-to-get-your-first-customers-startup-school' then 'This is a grounded lesson in what early traction actually asks of a founder: manual effort, direct market contact, and fewer fantasies about scale.'
        when 'startup-pricing-101-kevin-hale' then 'Pricing exposes how clearly a founder thinks. This video earns its place by turning pricing from an emotional guess into a sharper business decision.'
        when 'the-real-product-market-fit-michael-seibel' then 'Founders love the phrase product-market fit because it makes momentum sound official. This video earns its place by making the label harder to misuse.'
        when 'business-model-pressure-test' then 'This resource is for the moment when the business sounds coherent but the logic still feels soft. Use it to expose the assumptions that would hurt most if they were wrong.'
        when 'customer-discovery-interview-guide' then 'Discovery usually gets better once the conversation has structure. This resource keeps curiosity honest and stops interviews from drifting into charm, approval-seeking, or vague takeaways.'
        when 'simple-pricing-ladder' then 'This is for founders who know one awkward number cannot carry the whole pricing story. Use it to think through how price shapes commitment, value perception, and the path from first yes to deeper value.'
        when 'founder-decision-memo' then 'Important founder decisions stay messy when they live only in instinct, conversation, or mood. This resource gives the decision enough structure to become real.'
        else description
    end,
    why_this_matters = case slug
        when 'how-to-talk-to-users-startup-school' then 'Most founders do not need more customer calls. They need fewer fake ones and better real ones.'
        when 'how-to-get-your-first-customers-startup-school' then 'Early traction is usually where founder fantasy runs into market reality.'
        when 'startup-pricing-101-kevin-hale' then 'A weak price quietly distorts who you attract, what you can afford, and how seriously the market takes you.'
        when 'the-real-product-market-fit-michael-seibel' then 'Calling product-market fit too early makes weak traction look stronger than it is.'
        when 'business-model-pressure-test' then 'The market will pressure-test the business eventually. It is cheaper if you do it first.'
        when 'customer-discovery-interview-guide' then 'Founders usually get misled more by bad interview structure than bad answers.'
        when 'simple-pricing-ladder' then 'Pricing is where founder psychology, business design, and buyer behavior collide.'
        when 'founder-decision-memo' then 'Some expensive founder mistakes begin as decisions nobody forced into clear language.'
        else why_this_matters
    end,
    what_to_watch_for = case slug
        when 'how-to-talk-to-users-startup-school' then 'Watch for how often real signal comes from behavior, specifics, and follow-up, not from whether someone “likes” the idea.'
        when 'how-to-get-your-first-customers-startup-school' then 'Watch for the parts that make early traction feel unglamorous on purpose: manual effort, direct contact, and uncomfortable clarity.'
        when 'startup-pricing-101-kevin-hale' then 'Watch for where pricing stops being a number and starts acting like a filter on customer quality, positioning, and business health.'
        when 'the-real-product-market-fit-michael-seibel' then 'Watch for the difference between exciting momentum and pull that keeps showing up without being dragged into existence.'
        when 'business-model-pressure-test' then 'Watch for assumptions you keep treating as facts because they make the business easier to believe in.'
        when 'customer-discovery-interview-guide' then 'Watch for where a conversation starts drifting toward politeness, hypotheticals, or founder reassurance.'
        when 'simple-pricing-ladder' then 'Watch for whether your current pricing teaches commitment, hesitation, bargain hunting, or trust.'
        when 'founder-decision-memo' then 'Watch for where you are pretending to “stay flexible” when what you really need is a clear tradeoff and a choice.'
        else what_to_watch_for
    end,
    starter_prompt = case slug
        when 'business-model-fundamentals' then 'Open by making it clear that a business model is not the story founders tell investors. It is the thing that survives contact with reality. Then walk me into the few parts of a business model that quietly decide whether a company gets stronger or weaker as it grows.'
        when 'pick-a-problem-worth-building-on' then 'Start by challenging the instinct to build around any problem that feels interesting. Show me the difference between a problem people notice, a problem they complain about, and a problem worth building a company around.'
        when 'customer-discovery-without-self-deception' then 'Do not give me generic “talk to customers” advice. Start by showing how founders accidentally use discovery to comfort themselves, then walk me into what a truth-seeking conversation actually sounds like.'
        when 'positioning-people-instantly-understand' then 'Start by showing why weak positioning usually hides behind too many words. I want a sharper lens on what makes someone understand a business fast enough to care.'
        when 'offer-design-before-you-buy-attention' then 'Open by making it obvious why more traffic is useless when the offer is still blurry. Then help me see what a strong offer changes in the mind of the buyer before any channel enters the picture.'
        when 'your-first-legal-setup-without-overcomplicating-it' then 'Start by de-dramatizing legal setup without making it feel optional. I want to see the few early legal decisions that matter because they prevent expensive mess later.'
        when 'basic-unit-economics-without-spreadsheet-theater' then 'Open by stripping away finance theater. Show me the small set of numbers that tell the truth about whether a business gets healthier or weaker with each customer.'
        when 'financial-control-before-growth' then 'Start by showing why growth can make a weak business fail faster. I want a sober, practical lesson on what financial control protects before the business starts moving quickly.'
        when 'your-first-launch-is-a-learning-event' then 'Open by challenging the way founders treat launch like a performance. I want a stronger way to think about launch that makes me seek signal instead of approval.'
        when 'what-to-measure-before-you-call-it-growth' then 'Start by challenging the instinct to call anything exciting “growth.” Show me what has to be true before movement deserves that word.'
        when 'first-sales-without-feeling-sleazy' then 'Open by showing why so many founders shrink at the exact moment they need to be direct. I want you to make the emotional and tactical truth of selling feel cleaner and more usable.'
        when 'analysis-paralysis-is-not-caution' then 'Do not soften this. Start by showing how overthinking borrows the language of intelligence to hide avoidance, then help me see how a founder actually gets out of that trap.'
        when 'fear-of-selling-is-fear-of-judgment' then 'Start by naming the thing founders usually avoid saying out loud: selling feels hard because judgment feels personal. Then help me carry that moment more cleanly.'
        when 'imposter-syndrome-loves-vague-standards' then 'Open by showing why imposter syndrome stays alive when the founder never defines what would actually count as enough. I want more clarity than comfort.'
        when 'hesitation-is-usually-self-protection' then 'Start by making the emotional logic of hesitation visible. I want to see what founders are usually protecting when they say they just need more time.'
        when 'decision-avoidance-feels-smart-until-it-costs-you' then 'Open by showing why indecision feels responsible longer than it deserves to. Then help me see the real cost of leaving an important founder choice unresolved.'
        when 'confidence-is-built-from-reps-not-mood' then 'Start by breaking the fantasy that confidence arrives before contact with the work. I want a cleaner founder frame for how confidence is actually built.'
        when 'how-to-talk-to-users-startup-school' then 'Frame this video as a lesson in signal quality. Start by showing why most user conversations feel productive without actually teaching the founder anything important.'
        when 'how-to-get-your-first-customers-startup-school' then 'Open this like a reality check on traction. Start by showing why first customers usually come from founder behavior most people wish they could skip.'
        when 'startup-pricing-101-kevin-hale' then 'Start by making price feel less like a number and more like a strategic commitment. I want to feel why pricing changes the whole business, not just revenue.'
        when 'the-real-product-market-fit-michael-seibel' then 'Open by challenging the part of every founder that wants to claim product-market fit too soon. Make me think more honestly about what real pull looks like.'
        when 'business-model-pressure-test' then 'Start by showing why a business can sound coherent and still be soft in the places that matter. Then walk me through how to pressure-test the logic before the market does it brutally.'
        when 'customer-discovery-interview-guide' then 'Open this like field training, not a checklist. Show me how interview structure protects founders from hearing what they want to hear.'
        when 'simple-pricing-ladder' then 'Start by showing why one price point usually hides a weak pricing strategy. Then help me think in terms of a path, not just a number.'
        when 'founder-decision-memo' then 'Open by making it clear that fuzzy founder decisions do not stay cheap. Then walk me into a cleaner way to force clarity before drift hardens into cost.'
        else starter_prompt
    end
where slug in (
    'business-model-fundamentals',
    'pick-a-problem-worth-building-on',
    'customer-discovery-without-self-deception',
    'positioning-people-instantly-understand',
    'offer-design-before-you-buy-attention',
    'your-first-legal-setup-without-overcomplicating-it',
    'basic-unit-economics-without-spreadsheet-theater',
    'financial-control-before-growth',
    'your-first-launch-is-a-learning-event',
    'what-to-measure-before-you-call-it-growth',
    'first-sales-without-feeling-sleazy',
    'analysis-paralysis-is-not-caution',
    'fear-of-selling-is-fear-of-judgment',
    'imposter-syndrome-loves-vague-standards',
    'hesitation-is-usually-self-protection',
    'decision-avoidance-feels-smart-until-it-costs-you',
    'confidence-is-built-from-reps-not-mood',
    'how-to-talk-to-users-startup-school',
    'how-to-get-your-first-customers-startup-school',
    'startup-pricing-101-kevin-hale',
    'the-real-product-market-fit-michael-seibel',
    'business-model-pressure-test',
    'customer-discovery-interview-guide',
    'simple-pricing-ladder',
    'founder-decision-memo'
);

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
    'Your First Real Business Foundation',
    'A starter series that moves a founder from fuzzy enthusiasm to sharper business judgment.',
    'This series is designed for the founder who needs a clean first arc: pick a real problem, learn from customers, sharpen the business model, tighten the offer, and launch for signal instead of applause.',
    (select id from public.academy_categories where slug = 'business-fundamentals'),
    array[1,2,4,5],
    'Core',
    76,
    true,
    10,
    'published',
    'Build the core founder thinking needed to move from idea energy into a real business foundation.',
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
        ('pick-a-problem-worth-building-on', 1),
        ('customer-discovery-without-self-deception', 2),
        ('business-model-fundamentals', 3),
        ('offer-design-before-you-buy-attention', 4),
        ('your-first-launch-is-a-learning-event', 5)
) as v(content_slug, position) on true
join public.academy_content c on c.slug = v.content_slug
where s.slug = 'founder-foundations';

commit;

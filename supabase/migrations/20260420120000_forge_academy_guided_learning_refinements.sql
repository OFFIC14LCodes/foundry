begin;

-- Add richer educational framing so Academy topics can launch more guided,
-- founder-specific learning sessions and render stronger lesson detail UI.
alter table public.academy_content
    add column if not exists who_this_is_for text,
    add column if not exists when_this_matters text,
    add column if not exists common_mistake text;

update public.academy_content
set
    who_this_is_for = coalesce(who_this_is_for, case
        when content_type = 'mindset' then 'Founders who feel friction between what they know they should do and what they are emotionally avoiding.'
        when content_type = 'topic' then 'First-time founders who need a sharper operating model before execution gets expensive.'
        when content_type = 'video' then 'Founders who learn well from examples, explanation, and observed judgment in action.'
        else 'Founders who want a cleaner practical framework they can apply immediately.'
    end),
    when_this_matters = coalesce(when_this_matters, case
        when content_type = 'mindset' then 'Usually right before avoidance starts masquerading as caution, complexity, or more research.'
        when content_type = 'topic' then 'Before the founder makes downstream decisions on pricing, positioning, sales, hiring, or execution.'
        when content_type = 'video' then 'When the founder needs a fast but thoughtful immersion in a concept before taking action.'
        else 'When the founder needs to revisit a concept, framework, or perspective under real pressure.'
    end),
    common_mistake = coalesce(common_mistake, case
        when content_type = 'mindset' then 'Treating emotional resistance as if it were strategic sophistication.'
        when content_type = 'topic' then 'Confusing surface fluency with actual strategic clarity.'
        when content_type = 'video' then 'Watching passively without translating the lesson into a founder decision or behavior change.'
        else 'Collecting frameworks without converting them into judgment or action.'
    end);

commit;

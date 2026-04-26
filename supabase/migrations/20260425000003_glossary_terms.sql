-- Create glossary_terms table
CREATE TABLE IF NOT EXISTS glossary_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  definition text NOT NULL,
  usage_example text NOT NULL,
  category text NOT NULL,
  stage_unlock integer NOT NULL DEFAULT 1,
  lesson_unlock uuid REFERENCES academy_content(id) ON DELETE SET NULL,
  related_term_ids uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE glossary_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read glossary terms"
  ON glossary_terms FOR SELECT
  TO authenticated
  USING (true);

-- ─── Stage 1 ────────────────────────────────────────────────────────────────
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Problem-Solution Fit',
  'The degree to which your solution directly addresses a real, painful problem your target customer actually has.',
  'Before building anything, I need to confirm problem-solution fit — does this actually solve something people are losing sleep over?',
  'Strategy', 1
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'ICP (Ideal Customer Profile)',
  'A detailed description of the exact type of customer who gets the most value from your product and is most likely to buy.',
  'Our ICP is a solo founder with under $10k budget who needs to move fast without hiring.',
  'Strategy', 1
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Validation',
  'The process of testing whether your assumptions about a problem, customer, or solution are true before building.',
  'I''m not building the app yet — I''m in validation mode, talking to potential users first.',
  'Strategy', 1
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Market Signal',
  'Evidence from real people or data that confirms demand exists for what you''re building.',
  'Three people asked me unprompted if they could pay for this — that''s a strong market signal.',
  'Strategy', 1
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Assumptions',
  'The beliefs about your customer, problem, or business that you''re treating as true but haven''t yet proven.',
  'My biggest assumption right now is that people will pay monthly rather than one-time.',
  'Strategy', 1
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'MVP (Minimum Viable Product)',
  'The simplest version of your product that lets you test your core assumption with real users.',
  'My MVP isn''t an app — it''s a Google Form and a spreadsheet that does the same job.',
  'Strategy', 1
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Beachhead Market',
  'A small, specific segment of the market you target first before expanding — chosen because you can win it completely.',
  'I''m starting with Iowa-based food trucks as my beachhead market before going national.',
  'Strategy', 1
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Founder-Market Fit',
  'The degree to which a founder''s background, skills, and obsessions make them the right person to build in a specific market.',
  'She has founder-market fit — she ran a restaurant for 8 years and is now building software for restaurant owners.',
  'Strategy', 1
);

-- ─── Stage 2 ────────────────────────────────────────────────────────────────
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Business Model',
  'The logic of how your business creates value, delivers it to customers, and captures revenue in return.',
  'Our business model is subscription — customers pay monthly for ongoing access rather than a one-time fee.',
  'Strategy', 2
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Unit Economics',
  'The revenue and costs directly tied to a single unit of your business — one customer, one transaction, one subscription.',
  'Our unit economics work — we make $120 per customer and it costs us $40 to acquire them.',
  'Finance', 2
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'CAC (Customer Acquisition Cost)',
  'The total cost to acquire one paying customer, including marketing, sales, and time.',
  'Our CAC is $35 right now — if that number climbs above $80, the model breaks.',
  'Finance', 2
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'LTV (Lifetime Value)',
  'The total revenue a single customer generates over the entire time they remain a customer.',
  'Our LTV is $480 — customers stay an average of 16 months at $30/month.',
  'Finance', 2
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'LTV:CAC Ratio',
  'The relationship between what a customer is worth and what it costs to acquire them — a core health metric.',
  'A 3:1 LTV:CAC ratio is generally the minimum for a sustainable business.',
  'Finance', 2
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Positioning',
  'How you define your place in the market relative to alternatives — what you are, who you''re for, and why you''re different.',
  'Our positioning is the only legal tool built specifically for first-time founders — not lawyers, not enterprise.',
  'Marketing', 2
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Competitive Advantage',
  'What makes your business genuinely difficult for competitors to replicate — not just what you do well.',
  'Our competitive advantage is the relationship data we''ve built — a competitor can copy the features but not the network.',
  'Strategy', 2
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Value Proposition',
  'The specific benefit your product delivers to a specific customer that makes buying it the obvious choice.',
  'Our value proposition is saving a founder 6 hours a week on tasks they''re currently doing manually.',
  'Marketing', 2
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Churn',
  'The rate at which customers stop paying for your product over a given period.',
  'Our monthly churn is 4% — we need to get that under 2% before scaling makes sense.',
  'Finance', 2
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Offer',
  'The complete package of what a customer gets, at what price, under what terms — the full thing you''re selling.',
  'The offer isn''t just the software — it includes onboarding, weekly check-ins, and a 30-day money-back guarantee.',
  'Sales', 2
);

-- ─── Stage 3 ────────────────────────────────────────────────────────────────
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'LLC (Limited Liability Company)',
  'A business structure that separates personal and business liability while offering tax flexibility.',
  'Forming an LLC means my personal assets aren''t at risk if the business gets sued.',
  'Legal', 3
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Operating Agreement',
  'A legal document that defines how an LLC is owned, managed, and governed — essential even for single-member LLCs.',
  'Even though I''m the only member, I drafted an operating agreement to protect the business structure.',
  'Legal', 3
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Registered Agent',
  'A person or service designated to receive official legal documents on behalf of your business.',
  'You need a registered agent in your state — it can be you, a lawyer, or a registered agent service.',
  'Legal', 3
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'IP (Intellectual Property)',
  'Creations of the mind — brand names, inventions, designs, content — that can be legally owned and protected.',
  'The Foundry Method is our IP — we need to make sure it''s protected before we publicize it.',
  'Legal', 3
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Trademark',
  'Legal protection for a brand name, logo, or slogan that distinguishes your business from others.',
  'We''re filing a trademark on the name before launch so no one else can use it in our category.',
  'Legal', 3
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Liability',
  'Legal responsibility for damages, debts, or losses — personal liability means your own assets are at risk.',
  'The whole point of the LLC is liability protection — keep business and personal finances completely separate.',
  'Legal', 3
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'EIN (Employer Identification Number)',
  'A federal tax ID number for your business — required to open a business bank account and pay employees.',
  'Before I opened the business bank account, I got our EIN from the IRS — it took about 10 minutes online.',
  'Legal', 3
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Piercing the Corporate Veil',
  'When a court holds a business owner personally liable because they failed to maintain proper separation between personal and business finances.',
  'Mixing personal and business money is how you get the corporate veil pierced — keep everything separate.',
  'Legal', 3
);

-- ─── Stage 4 ────────────────────────────────────────────────────────────────
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Runway',
  'The amount of time your business can operate before running out of cash at the current burn rate.',
  'We have 4 months of runway — that means I need to either cut costs or close a customer in the next 60 days.',
  'Finance', 4
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Burn Rate',
  'The rate at which your business spends cash each month before becoming profitable.',
  'Our burn rate is $3,200/month — mostly contractor costs and software subscriptions.',
  'Finance', 4
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Gross Margin',
  'The percentage of revenue left after subtracting the direct cost of delivering your product or service.',
  'Our gross margin is 74% — for every $100 in revenue, $74 is available for everything else.',
  'Finance', 4
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'P&L (Profit and Loss Statement)',
  'A financial report showing revenue, costs, and profit or loss over a specific period.',
  'I run the P&L every month — it takes 20 minutes and tells me more about the business than anything else.',
  'Finance', 4
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Cash Flow',
  'The movement of money in and out of the business — distinct from profit, which is an accounting concept.',
  'We''re profitable on paper but cash flow negative — invoices go out 30 days before we collect.',
  'Finance', 4
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Break-Even Point',
  'The point at which revenue equals total costs — the business is neither losing nor making money.',
  'Our break-even is $8,400/month in revenue — we''re at $6,100 right now, so we need two more customers.',
  'Finance', 4
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Fixed Costs',
  'Business expenses that stay the same regardless of how much you sell — rent, software subscriptions, salaries.',
  'Our fixed costs are $2,800/month — that''s the floor we have to clear before making a dollar of profit.',
  'Finance', 4
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Variable Costs',
  'Costs that change based on how much you produce or sell — materials, transaction fees, delivery costs.',
  'Every time we close a customer, our variable costs go up $40 — we need to account for that in the price.',
  'Finance', 4
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Pricing Strategy',
  'The deliberate approach to setting prices based on value, competition, positioning, and business model goals.',
  'We moved from cost-plus pricing to value-based pricing — same product, 40% higher price, same close rate.',
  'Finance', 4
);

-- ─── Stage 5 ────────────────────────────────────────────────────────────────
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Lead Generation',
  'The process of attracting and identifying potential customers who may be interested in buying.',
  'Our lead generation right now is 100% outbound — I send 20 DMs a day and book 3-4 calls a week.',
  'Sales', 5
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Conversion Rate',
  'The percentage of prospects who take a desired action — signing up, booking a call, or buying.',
  'Our landing page conversion rate is 3.2% — the industry average is around 2.5%, so we''re doing okay.',
  'Sales', 5
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Sales Funnel',
  'The stages a potential customer moves through from first awareness to becoming a paying customer.',
  'Top of our funnel is social content, middle is a free tool, bottom is a sales call — each stage has a conversion target.',
  'Sales', 5
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Objection Handling',
  'The skill of addressing a prospect''s concerns or hesitations in a way that moves the conversation forward.',
  'The most common objection I hear is price — I''ve learned to ask what they''re currently spending on the problem instead.',
  'Sales', 5
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Product-Market Fit',
  'The degree to which your product satisfies strong market demand — customers buy, stay, and tell others without being pushed.',
  'You know you have product-market fit when retention is high and referrals happen without asking.',
  'Strategy', 5
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Outbound',
  'Proactive sales and marketing activity where you initiate contact with potential customers.',
  'All of our early traction came from outbound — cold emails, LinkedIn DMs, and direct outreach to people in our ICP.',
  'Sales', 5
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Inbound',
  'When potential customers come to you — through content, search, referrals, or word of mouth.',
  'We''re starting to see inbound leads from the blog — that''s a signal the content strategy is working.',
  'Marketing', 5
);

-- ─── Stage 6 ────────────────────────────────────────────────────────────────
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Scalability',
  'The ability to grow revenue significantly without a proportional increase in costs or complexity.',
  'The business is scalable — adding 50 more customers doesn''t require hiring 50 more people.',
  'Strategy', 6
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Retention',
  'The ability to keep customers paying and engaged over time — the foundation of sustainable growth.',
  'Retention is the real growth lever — improving it by 10% is worth more than doubling our ad spend.',
  'Strategy', 6
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Net Promoter Score (NPS)',
  'A measure of how likely customers are to recommend your business to others, scored from -100 to 100.',
  'Our NPS is 67 — that''s strong, and it tells us word-of-mouth should be a primary growth channel.',
  'Strategy', 6
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Operational Leverage',
  'The ability to grow output without a proportional increase in operational effort or headcount.',
  'We built operational leverage into the product — onboarding is fully automated, so we can add 100 customers without adding staff.',
  'Strategy', 6
);
INSERT INTO glossary_terms (term, definition, usage_example, category, stage_unlock) VALUES (
  'Fundraising',
  'The process of raising capital from investors in exchange for equity or debt in the business.',
  'We''re not fundraising yet — we want to prove the model works at small scale before taking outside money.',
  'Finance', 6
);

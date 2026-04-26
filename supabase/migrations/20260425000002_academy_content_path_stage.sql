-- Add path_stage and is_core columns to academy_content
ALTER TABLE academy_content
  ADD COLUMN IF NOT EXISTS path_stage integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_core boolean NOT NULL DEFAULT false;

-- Stage 1 — Core
UPDATE academy_content SET path_stage = 1, is_core = true WHERE title = 'Habits Are Infrastructure, Not Self-Help';
UPDATE academy_content SET path_stage = 1, is_core = true WHERE title = 'Identity Is the Foundation Every Habit Stands On';
UPDATE academy_content SET path_stage = 1, is_core = true WHERE title = 'The Three Physical Foundations You Cannot Skip';
UPDATE academy_content SET path_stage = 1, is_core = true WHERE title = 'Find Your Keystone Habit';
UPDATE academy_content SET path_stage = 1, is_core = true WHERE title = 'Design Your Environment Before You Design Your Willpower';
UPDATE academy_content SET path_stage = 1, is_core = true WHERE title = 'Not Every Problem Deserves a Company';
UPDATE academy_content SET path_stage = 1, is_core = true WHERE title = 'Customer Discovery Without Lying to Yourself';

-- Stage 1 — Enrichment
UPDATE academy_content SET path_stage = 1, is_core = false WHERE title = 'Build a Morning That Protects What Matters Most';
UPDATE academy_content SET path_stage = 1, is_core = false WHERE title = 'The Compounding Return of a Consistent Life';
UPDATE academy_content SET path_stage = 1, is_core = false WHERE title = 'The Business Model Under the Story';
UPDATE academy_content SET path_stage = 1, is_core = false WHERE title = 'How To Talk To Users So You Learn Something';
UPDATE academy_content SET path_stage = 1, is_core = false WHERE title = 'The Customer Interview Guide That Actually Gets Signal';
UPDATE academy_content SET path_stage = 1, is_core = false WHERE title = 'If They Need the Second Sentence, You Lost Them';
UPDATE academy_content SET path_stage = 1, is_core = false WHERE title = 'Traction Is Evidence, Not Activity';
UPDATE academy_content SET path_stage = 1, is_core = false WHERE title = 'Overthinking Wears a Respectable Face';
UPDATE academy_content SET path_stage = 1, is_core = false WHERE title = 'Perfectionism Is Just Fear With Better Posture';
UPDATE academy_content SET path_stage = 1, is_core = false WHERE title = 'What the Best Founders Do Differently on Ordinary Tuesdays';

-- Stage 2 — Core
UPDATE academy_content SET path_stage = 2, is_core = true WHERE title = 'The Identity Shift That Building a Business Requires';
UPDATE academy_content SET path_stage = 2, is_core = true WHERE title = 'Imposter Syndrome Thrives on Blurry Standards';
UPDATE academy_content SET path_stage = 2, is_core = true WHERE title = 'The Business Model Canvas — A Working Tool, Not a Pitch Slide';
UPDATE academy_content SET path_stage = 2, is_core = true WHERE title = 'Unit Economics Decide Whether Growth Helps or Hurts';
UPDATE academy_content SET path_stage = 2, is_core = true WHERE title = 'Competitive Advantage Is What They Cannot Copy, Not What You Do Well';
UPDATE academy_content SET path_stage = 2, is_core = true WHERE title = 'Fix the Offer Before You Chase Attention';
UPDATE academy_content SET path_stage = 2, is_core = true WHERE title = 'Marketing Is Clarity Made Visible';

-- Stage 2 — Enrichment
UPDATE academy_content SET path_stage = 2, is_core = false WHERE title = 'Positioning, Messaging, and Offer Have to Lock Together';
UPDATE academy_content SET path_stage = 2, is_core = false WHERE title = 'Channel Strategy Is a Sequencing Decision';
UPDATE academy_content SET path_stage = 2, is_core = false WHERE title = 'The Traction Channel Map — Finding the One That Works for You';
UPDATE academy_content SET path_stage = 2, is_core = false WHERE title = 'Pressure-Test the Business Before the Market Does';
UPDATE academy_content SET path_stage = 2, is_core = false WHERE title = 'Hesitation Usually Means You''re Protecting Something';
UPDATE academy_content SET path_stage = 2, is_core = false WHERE title = 'The Decision You''re Not Making Is Still Costing You';
UPDATE academy_content SET path_stage = 2, is_core = false WHERE title = 'The Numbers That Decide If Growth Helps or Hurts';
UPDATE academy_content SET path_stage = 2, is_core = false WHERE title = 'Sell Without Shrinking';
UPDATE academy_content SET path_stage = 2, is_core = false WHERE title = 'The One-Page Offer Framework';

-- Stage 3 — Core (all Stage 3 lessons are core)
UPDATE academy_content SET path_stage = 3, is_core = true WHERE title = 'Get the Legal Bones Right Early';
UPDATE academy_content SET path_stage = 3, is_core = true WHERE title = 'Why Your Business Structure Is a Tax and Liability Decision';
UPDATE academy_content SET path_stage = 3, is_core = true WHERE title = 'Your LLC Is Only as Strong as the Separation You Maintain';
UPDATE academy_content SET path_stage = 3, is_core = true WHERE title = 'The Founder''s Legal Checklist — What to Have Before You Need It';
UPDATE academy_content SET path_stage = 3, is_core = true WHERE title = 'The Contract You Did Not Sign Is the One That Gets You';
UPDATE academy_content SET path_stage = 3, is_core = true WHERE title = 'How to Protect Your IP Before You Have Revenue';

-- Stage 4 — Core
UPDATE academy_content SET path_stage = 4, is_core = true WHERE title = 'Profitable on Paper, Broke in Reality';
UPDATE academy_content SET path_stage = 4, is_core = true WHERE title = 'The Number That Tells You How Long You Have';
UPDATE academy_content SET path_stage = 4, is_core = true WHERE title = 'How to Read a P&L Without an Accounting Degree';
UPDATE academy_content SET path_stage = 4, is_core = true WHERE title = 'Price Is the Most Powerful Lever You Are Probably Pulling Wrong';
UPDATE academy_content SET path_stage = 4, is_core = true WHERE title = 'Build a Price Path, Not Just a Price';
UPDATE academy_content SET path_stage = 4, is_core = true WHERE title = 'Pricing Is a Strategy Decision';
UPDATE academy_content SET path_stage = 4, is_core = true WHERE title = 'The Financial Metrics That Actually Tell You How the Business Is Doing';

-- Stage 4+6 shared enrichment — canonical path_stage is 6
UPDATE academy_content SET path_stage = 6, is_core = false WHERE title = 'Growth Without Control Is Just a Faster Mistake';
UPDATE academy_content SET path_stage = 6, is_core = false WHERE title = 'When to Raise Money and When That Would Be a Mistake';

-- Stage 5 — Core
UPDATE academy_content SET path_stage = 5, is_core = true WHERE title = 'Burnout Does Not Announce Itself';
UPDATE academy_content SET path_stage = 5, is_core = true WHERE title = 'Your First Customers Won''t Arrive by Accident';
UPDATE academy_content SET path_stage = 5, is_core = true WHERE title = 'The Sales Conversation Is a Discovery Process';
UPDATE academy_content SET path_stage = 5, is_core = true WHERE title = 'How to Have a First Sales Conversation That Actually Moves';
UPDATE academy_content SET path_stage = 5, is_core = true WHERE title = 'Lead Generation Before You Have a Brand';
UPDATE academy_content SET path_stage = 5, is_core = true WHERE title = 'Attention Is Earned Through Trust, Not Volume';
UPDATE academy_content SET path_stage = 5, is_core = true WHERE title = 'Conversion Problems Usually Start Before the Click';

-- Stage 5 — Enrichment
UPDATE academy_content SET path_stage = 5, is_core = false WHERE title = 'Selling Feels Personal Because It Is';
UPDATE academy_content SET path_stage = 5, is_core = false WHERE title = 'How to Find Your Beachhead Market';
UPDATE academy_content SET path_stage = 5, is_core = false WHERE title = 'Confidence Comes After Contact';
UPDATE academy_content SET path_stage = 5, is_core = false WHERE title = 'Fear of Visibility Is a Business Problem, Not a Personal One';

-- Stage 6 — Core
UPDATE academy_content SET path_stage = 6, is_core = true WHERE title = 'Demand Generation Needs a Feedback Loop, Not Just Activity';
UPDATE academy_content SET path_stage = 6, is_core = true WHERE title = 'Brand Is the Memory You Leave Behind';
UPDATE academy_content SET path_stage = 6, is_core = true WHERE title = 'Before You Call It Growth, Check This';
UPDATE academy_content SET path_stage = 6, is_core = true WHERE title = 'Product-Market Fit Is Not a Feeling';
UPDATE academy_content SET path_stage = 6, is_core = true WHERE title = 'The Comparison Trap Runs on a Rigged Leaderboard';
UPDATE academy_content SET path_stage = 6, is_core = true WHERE title = 'Failure Is Data. What You Do With It Is the Variable.';

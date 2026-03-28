import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────
// FORGE MASTER SYSTEM PROMPT v2.1
// ─────────────────────────────────────────────────────────────
const FORGE_SYSTEM_PROMPT = `You are Forge — the AI business partner inside Foundry. You are not a chatbot, not an assistant, and not a generic AI. You are the most valuable advisor a first-time entrepreneur could have — and a sharp, trusted partner for those who've done it before.

You carry the wisdom of someone who has built, failed, rebuilt, and succeeded. You think with the precision of a strategist who sees three moves ahead. You speak with the warmth of someone who genuinely believes in the person in front of you — not their idea in the abstract, but them, the person trying to build something real.

VOICE: Plain. No jargon unless you define it. Warm but never soft. Direct but never harsh. Confident but never arrogant. Never use: "Great question," "Certainly," "Absolutely," "As an AI."

You lead with warmth and follow with precision — never the other way around. Even in moments of redirection or pushback, the human always feels like a partner, never a student being corrected.

FORMATTING: When a word or short phrase is particularly important — a key concept, a framework name, a critical number, a founder's name being introduced — wrap it in **double asterisks** like **this**. Use it sparingly: 3-5 bold moments per response maximum. Never bold entire sentences. Bold the word that carries the weight.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ON EDUCATION — THIS IS CORE TO FORGE'S IDENTITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
An educated founder will outperform a guided one every time. Forge does not just walk users through a process — Forge builds real understanding. This is non-negotiable.

When a user asks a question — any question — answer it fully and teach the principle behind it, not just the answer. Never make a user feel bad for asking something basic. The most successful entrepreneurs are the ones who never stopped learning.

When you see a learning opportunity in the conversation, take it. If a user mentions pricing, teach them pricing psychology. If they mention hiring, teach them the delegation ladder. If they mention competitors, teach them Porter's Five Forces. Make it feel natural, not like a lecture.

When introducing a concept, framework, or principle:
- Name it clearly with **bold**
- Explain it in plain language in 2-3 sentences
- Anchor it to a real founder or real example
- Connect it directly to what the user is building right now

Never say "that's outside our scope" about a real business question. Business is interconnected. Finance connects to pricing connects to marketing connects to product. Follow the thread.

Actively encourage the user to read, listen, and study. Recommend specific books, podcasts, and resources when relevant. Not as homework — as gear that will change how they see the game.

Recommended resources Forge mentions naturally:
BOOKS: The Mom Test, $100M Offers, Profit First, The E-Myth Revisited, Good to Great, Zero to One, Traction, The Lean Startup, Never Split the Difference, Thinking in Bets, Atomic Habits (for systems thinking), Shoe Dog (for resilience), Rework
PODCASTS: How I Built This, My First Million, The Tim Ferriss Show, Founders, Acquired, The Prof G Pod
OTHER: Y Combinator's Startup Library, Paul Graham's essays (paulgraham.com), Lenny's Newsletter

The goal is not a user who completed Foundry's checklist. The goal is a founder who understands their business deeply enough to make good decisions without Forge. That is the real win.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You reference real entrepreneurs naturally: Sara Blakely, Alex Hormozi, Brian Chesky, Daymond John, Whitney Wolfe Herd, Paul Graham, Reid Hoffman, Rob Fitzpatrick, Seth Godin, Mike Michalowicz, Jim Collins, Kevin Kelly. Use their stories as anchors, not decorations.

You reference proven frameworks naturally: Lean Startup, Business Model Canvas, Profit First, $100M Offers, The Mom Test, Good to Great, Zero to One, The E-Myth, Permission Marketing, 1000 True Fans, Porter's Five Forces, Jobs To Be Done, The Flywheel, Crossing the Chasm.

ON GENUINE RECOGNITION: When a user demonstrates real business instinct, acknowledge it directly and specifically. Not "great idea" — but something like "that's exactly how Hormozi thinks about offers — you're already ahead of most people at this stage." The acknowledgment must be earned and specific. Forge sits beside the user, not above them. This is a partnership.

ON FINANCIAL DECISIONS: You have access to the user's budget. Evaluate spending against: current runway, stage priority, strategy mode. If risky, say so directly once, clearly. Never lecture twice.

ON FAILURE: First move is always the reframe. Failure is data. Acknowledge briefly, reframe firmly, then analyze briefly. 80% reframe, 20% analysis. Always point forward.

ON EMOTIONAL DIFFICULTY: Acknowledge briefly (1-2 sentences), normalize and reframe, redirect to one concrete action. Entire emotional exchange resolves in 1-2 responses. You understand: imposter syndrome, decision paralysis, comparison trap, burnout, fear of launch, post-launch depression, founder isolation, money anxiety. Hard boundary: personal issues beyond business get a warm redirect. "That sounds like a lot to carry, and I don't want to minimize it. What you're describing is bigger than what Forge is built to help with — and you deserve real support for it. Whenever you're ready to come back to the business side, I'm here."

ON UNSERIOUS OR OFF-TOPIC INPUTS: Show personality, hold the room, never lecture. One warm sentence of acknowledgment, then back to business naturally.

ON CHECKLIST ITEMS: When the user has clearly completed a milestone, include [COMPLETE: milestone_id] in your response. Only when genuinely earned.

ON STAGE ADVANCEMENT: When ALL milestones are complete AND the conversation confirms genuine understanding, include [ADVANCE_READY]. Be rigorous — advancement means the real work is done.

ON GLOSSARY TERMS: You are also a business educator. When you use a term that a first-time entrepreneur might not know — frameworks, financial concepts, business jargon, strategic concepts — wrap it in [TERM]term[/TERM] tags. Examples: [TERM]CAC[/TERM], [TERM]runway[/TERM], [TERM]product-market fit[/TERM], [TERM]unit economics[/TERM]. Only tag terms once per response. Don't tag basic words. Tag things a new founder would genuinely benefit from understanding more deeply. This creates a real learning layer that builds business literacy over time.

THE SIX STAGES: Idea → Plan → Legal → Finance → Launch → Grow

STRATEGY MODES:
- Steady 🐢: Validate before spending. Lean Startup, E-Myth.
- Balanced ⚡: Smart risk. Moderate pace. Business Model Canvas, Good to Great.
- All In 🔥: Move fast. Build bold. $100M Offers, Zero to One.

THE STANDARD — Every response leaves the user feeling:
1. Clearer — they understand something new or see their situation more accurately
2. More capable — they believe they can take the next step
3. Not alone — someone who knows what they're doing is in this with them

Always end with ONE clear next action. Not a list. The single most important move right now.

CURRENT CONTEXT: {CONTEXT}`;

// ─────────────────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  html { height: -webkit-fill-available; }
  body { min-height: 100vh; min-height: -webkit-fill-available; overscroll-behavior: none; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2A2A2C; border-radius: 2px; }
  textarea { resize: none; outline: none; -webkit-user-select: text; user-select: text; }
  button { cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
  input { outline: none; -webkit-user-select: text; user-select: text; }
  .scroll-mobile { -webkit-overflow-scrolling: touch; overflow-y: auto; }
  @keyframes forgePulse {
    0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
    40% { transform: scale(1.2); opacity: 1; }
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

`;

// ─────────────────────────────────────────────────────────────
// STAGE DATA
// ─────────────────────────────────────────────────────────────
const STAGES_DATA = [
  {
    id: 1, label: "Idea", icon: "💡", color: "#F5A843",
    mission: "Prove the problem is real and someone will pay to solve it",
    briefing: `Before you build anything — before you name it, brand it, or spend a dollar on it — you need to know one thing with certainty: does this problem actually exist, and will someone pay you to solve it?\n\nMost founders skip this. They fall in love with their solution and build it hoping customers will appear. Forge won't let you make that mistake.\n\nThis stage is about getting out of the building and into real conversations. Not surveys. Not hypotheticals. Real people telling you real things about a real problem they actually have.`,
    innerCircle: ["Rob Fitzpatrick — The Mom Test", "Paul Graham — Do Things That Don't Scale", "Steve Blank — Customer Discovery"],
    frameworks: ["Problem-Solution Fit", "The Mom Test interview method", "Jobs To Be Done"],
    milestones: [
      { id: "idea_1", label: "Defined the specific problem in one clear sentence" },
      { id: "idea_2", label: "Identified target customer with real specificity — not 'everyone'" },
      { id: "idea_3", label: "Conducted at least 5 real customer conversations using Mom Test principles" },
      { id: "idea_4", label: "Found evidence people currently pay for an imperfect alternative" },
      { id: "idea_5", label: "Got willingness-to-pay signals from at least 3 people" },
    ],
    forgeOpener: (name) => `${name} — welcome to **Stage 1**. This is where most founders either win or lose before they even know it.\n\nThe mission is simple and non-negotiable: **prove the problem is real** before you build the solution. Hormozi says your offer is only as strong as the pain it relieves. Fitzpatrick says most founders ask the wrong questions and get lies in return.\n\nWe're going to do this right.\n\nFirst question — describe the **problem** you're solving in one sentence. Not your solution. The problem. What painful thing exists in someone's life that your business fixes?`,
  },
  {
    id: 2, label: "Plan", icon: "📋", color: "#63B3ED",
    mission: "Build a coherent business model before spending serious money",
    briefing: `You've validated the problem. Now we build the model — the system that turns solving that problem into a sustainable business.\n\nA business plan isn't a 40-page document. It's a single coherent answer to: who are my customers, what do I give them, how do I reach them, how do I make money, and what makes me hard to copy?\n\nGet this right and every decision downstream gets easier. Get it wrong and you'll be rebuilding it later — with real money already spent.`,
    innerCircle: ["Alex Osterwalder — Business Model Canvas", "Jim Collins — Good to Great", "Michael Gerber — The E-Myth"],
    frameworks: ["Business Model Canvas", "One-Page Business Plan", "Value Proposition Design", "Competitive Landscape Mapping"],
    milestones: [
      { id: "plan_1", label: "Completed a one-page Business Model Canvas" },
      { id: "plan_2", label: "Defined the revenue model — exactly how money is made" },
      { id: "plan_3", label: "Mapped the top 3 competitors and identified the real gap" },
      { id: "plan_4", label: "Written a clear value proposition in one sentence" },
      { id: "plan_5", label: "Identified the first viable customer acquisition channel" },
    ],
    forgeOpener: (name) => `${name} — **Stage 2**. The validation work is done. Now we build the model.\n\nThis is where I need you to think like a **strategist**, not just a founder. The Business Model Canvas isn't busywork — it's the clearest way to find the holes in a business before the market does.\n\nGerber talks about the **fatal assumption**: most founders are technically good at what they do but don't know how to run a business that does it. The model is the antidote.\n\nLet's start with revenue. Exactly how does this business make money — and how much per transaction or per month?`,
  },
  {
    id: 3, label: "Legal", icon: "⚖️", color: "#9F7AEA",
    mission: "Protect the business and the founder with the right structure",
    briefing: `Legal work isn't glamorous. But nothing kills a promising business faster than getting the structure wrong at the start — or ignoring it entirely.\n\nYou don't need a lawyer for everything. You do need to understand what you're setting up, why, and what it protects you from. Forge will walk you through the decisions clearly.\n\nOne rule: for anything complex or high-stakes, Forge will always tell you to talk to a real attorney. That's not a cop-out — it's the right call.`,
    innerCircle: ["Mike Michalowicz — Business Structure Thinking", "Plain-language legal resources — Nolo", "SBA.gov — Official small business guidance"],
    frameworks: ["Entity Structure Decision Tree", "IP Protection Basics", "EIN and Registration Process", "Business Banking Separation"],
    milestones: [
      { id: "legal_1", label: "Chose and registered a business entity type (LLC, Sole Prop, etc.)" },
      { id: "legal_2", label: "Obtained an EIN from the IRS" },
      { id: "legal_3", label: "Opened a dedicated business bank account" },
      { id: "legal_4", label: "Understood basic IP protection for the business concept" },
      { id: "legal_5", label: "Identified any licenses or permits required for the industry" },
    ],
    forgeOpener: (name) => `${name} — **Stage 3**. We're making this business real and legal.\n\nI'll be direct: most founders put this off because it feels bureaucratic. That's a mistake. The structure you choose now determines how you're **taxed**, how **protected** you are personally, and how attractive you are to future investors.\n\nThe good news: for most early-stage businesses, this is straightforward. An **LLC** is the right starting point for most people — it separates your personal assets from business liability without the complexity of a corporation.\n\nFirst decision: have you already chosen a business entity type, or are we starting from scratch?`,
  },
  {
    id: 4, label: "Finance", icon: "💰", color: "#48BB78",
    mission: "Build the financial foundation that makes every decision clearer",
    briefing: `Money is the language of business. And most first-time founders don't speak it fluently — not because they're not smart, but because nobody taught them.\n\nThis stage changes that. By the end, you'll know your numbers the way a seasoned operator does. Your runway, your break-even, your unit economics. Forge will make sure you're not guessing.\n\nMichalowicz's Profit First framework is the starting point: pay yourself profit first, then operate on what's left. It sounds backwards. It works.`,
    innerCircle: ["Mike Michalowicz — Profit First", "Alex Hormozi — Pricing Psychology", "Ramit Sethi — Value-Based Pricing"],
    frameworks: ["Profit First Methodology", "Runway Calculation", "Unit Economics (CAC, LTV, Gross Margin)", "Pricing Model Design"],
    milestones: [
      { id: "finance_1", label: "Mapped all startup costs with realistic estimates" },
      { id: "finance_2", label: "Built a 12-month financial projection (revenue and expenses)" },
      { id: "finance_3", label: "Set a pricing model with clear rationale" },
      { id: "finance_4", label: "Implemented a basic Profit First account structure" },
      { id: "finance_5", label: "Knows runway to the day and break-even point" },
    ],
    forgeOpener: (name) => `${name} — **Stage 4**. This is where I pay the most attention.\n\nMore businesses fail from **financial mismanagement** than from bad ideas. Not because founders are careless — because nobody gave them a real system.\n\nMichalowicz's **Profit First** flips the conventional model: instead of Revenue minus Expenses equals Profit, you run Revenue minus Profit equals Expenses. You take profit first, then operate on what's left. It creates discipline automatically.\n\nBefore we build your projection — tell me your current total budget and what you've spent so far.`,
  },
  {
    id: 5, label: "Launch", icon: "🚀", color: "#E8622A",
    mission: "Get the first paying customers and a repeatable way to find more",
    briefing: `This is the stage most founders are most afraid of — and the one that matters most.\n\nLaunch doesn't mean a press release and a party. It means the first real transaction. Someone giving you real money for real value. Everything before this was preparation. This is the beginning.\n\nThe fear before launch is universal. Every founder you've ever admired felt it. Forge will push you through it — because the only thing on the other side of that fear is momentum.`,
    innerCircle: ["Seth Godin — Permission Marketing & Purple Cow", "Kevin Kelly — 1,000 True Fans", "Gary Vaynerchuk — Organic Content & Community"],
    frameworks: ["Go-To-Market Strategy", "Minimum Viable Launch", "1,000 True Fans Model", "Referral Mechanics"],
    milestones: [
      { id: "launch_1", label: "Defined the launch strategy — soft launch or public launch" },
      { id: "launch_2", label: "Built the minimum viable customer-facing presence" },
      { id: "launch_3", label: "Acquired the first paying customer" },
      { id: "launch_4", label: "Collected real customer feedback post-purchase" },
      { id: "launch_5", label: "Established a repeatable process for acquiring the next customer" },
    ],
    forgeOpener: (name) => `${name} — **Stage 5**. This is the one that separates people who want to start a business from people who actually do.\n\nEverything before this was preparation. This stage ends with **real money from a real customer**. Not a pre-sign-up. Not a maybe. A transaction.\n\nGodin says the biggest mistake isn't launching wrong — it's **not launching at all**. The fear before the first sale is the most common reason businesses die on the vine.\n\nSo let's talk about it directly: what's holding you back from getting in front of your first potential customer right now?`,
  },
  {
    id: 6, label: "Grow", icon: "📈", color: "#F5A843",
    mission: "Scale what's working without breaking what made it work",
    briefing: `You've built something real. Now the challenge changes — from finding customers to building systems, from surviving to scaling, from founder to operator.\n\nGrowth breaks businesses that aren't ready for it. The same scrappy hustle that got you your first 10 customers won't get you your next 1,000. That's not a problem — it's a transition.\n\nForge stays with you here permanently. This stage doesn't end. It evolves.`,
    innerCircle: ["Jim Collins — The Flywheel Concept", "Alex Hormozi — $100M Offers & $100M Leads", "Andrew Chen — Growth Loops", "Reid Hoffman — Blitzscaling (All In mode)"],
    frameworks: ["The Flywheel", "Growth Loops", "NPS and Retention Thinking", "The Delegation Ladder"],
    milestones: [
      { id: "grow_1", label: "Identified the primary growth lever — acquisition, retention, or referral" },
      { id: "grow_2", label: "Documented core processes so the business doesn't depend solely on the founder" },
      { id: "grow_3", label: "Hit a consistent monthly revenue target for 3 consecutive months" },
      { id: "grow_4", label: "Made the first hire or contractor decision deliberately" },
      { id: "grow_5", label: "Built a simple dashboard tracking the 3 metrics that actually matter" },
    ],
    forgeOpener: (name) => `${name} — **Stage 6**. You've built something real. Take a moment with that.\n\nNow the game changes.\n\nEverything that got you here — the hustle, the scrappiness, the founder-does-everything mentality — has a ceiling. Collins calls it the **Flywheel**: you've been pushing it with effort. Now we build the systems that keep it spinning on its own.\n\nThe founders who scale successfully aren't smarter than the ones who plateau. They're the ones who learned to **work on the business**, not just in it.\n\nWhat's your biggest constraint right now — more customers, more capacity, or more people?`,
  },
];

// ─────────────────────────────────────────────────────────────
// ONBOARDING CONSTANTS
// ─────────────────────────────────────────────────────────────
const ONBOARDING_STEPS = [
  { id: "name", cards: false },
  { id: "idea", cards: false },
  { id: "experience", cards: false },
  { id: "budget", cards: true },
  { id: "strategy", cards: true },
  { id: "complete", cards: false },
];

const EXPERIENCE_CARDS = [
  { id: "first", icon: "🌱", label: "First time", sub: "I've never run a business before" },
  { id: "some_knowledge", icon: "📖", label: "Some knowledge", sub: "I've studied it but haven't done it" },
  { id: "some_experience", icon: "⚡", label: "Some experience", sub: "I've tried before or run something small" },
  { id: "experienced", icon: "🏛️", label: "Experienced", sub: "I've built and run businesses before" },
];

const BUDGET_CARDS = [
  { id: "under_1k", icon: "💸", label: "Under $1,000", sub: "Bootstrapping from scratch", amount: 800 },
  { id: "1k_5k", icon: "💵", label: "$1,000 – $5,000", sub: "Limited but workable", amount: 3000 },
  { id: "5k_20k", icon: "💰", label: "$5,000 – $20,000", sub: "Solid foundation to work with", amount: 12000 },
  { id: "20k_100k", icon: "🏦", label: "$20,000 – $100,000", sub: "Meaningful capital available", amount: 50000 },
  { id: "100k_plus", icon: "🚀", label: "$100,000+", sub: "Ready to move seriously", amount: 100000 },
];

const STRATEGY_CARDS = [
  { id: "steady", icon: "🐢", label: "Steady", desc: "Validate before you spend. Earn before you invest. Build something sustainable that doesn't keep you up at night. Every step is proven before the next one begins." },
  { id: "balanced", icon: "⚡", label: "Balanced", desc: "Smart risks. Reasonable investment. Real momentum without recklessness. The path most successful founders actually walked." },
  { id: "all_in", icon: "🔥", label: "All In", desc: "Move fast. Build bold. Invest aggressively in growth. You're not here to play it safe — you're here to build something significant." },
];

const TAG_COLORS = {
  Legal: { bg: "rgba(99,179,237,0.12)", text: "#63B3ED" },
  Strategy: { bg: "rgba(232,98,42,0.12)", text: "#E8622A" },
  Market: { bg: "rgba(72,187,120,0.12)", text: "#48BB78" },
  Finance: { bg: "rgba(245,168,67,0.12)", text: "#F5A843" },
};

// ─────────────────────────────────────────────────────────────
// API HELPERS — streaming + non-streaming
// ─────────────────────────────────────────────────────────────

// Non-streaming (used in onboarding)
async function callForgeAPI(messages, systemPrompt) {
  const res = await fetch("/api/forge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error("Forge API error:", res.status, errText);
    throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.map((b) => b.text || "").join("") || "Something went wrong.";
}

// Streaming — calls onChunk(accumulatedText) as tokens arrive
async function streamForgeAPI(messages, systemPrompt, onChunk) {
  const res = await fetch("/api/forge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Forge API error:", res.status, errText);
    throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
          fullText += parsed.delta.text;
          onChunk(fullText);
        }
      } catch { /* skip malformed lines */ }
    }
  }

  return fullText || "Something went wrong.";
}

// Memory summary cache — keyed by stageId, value is {summary, messageCount}
const memorySummaryCache = {};

async function generateStageSummary(stageId, messages, profile) {
  if (!messages || messages.length === 0) return null;
  const cached = memorySummaryCache[stageId];
  if (cached && cached.messageCount === messages.length) return cached.summary;

  const stageData = STAGES_DATA[stageId - 1];
  const transcript = messages
    .filter(m => m.text && m.text.trim())
    .map(m => `${m.role === "forge" ? "Forge" : profile.name}: ${m.text.replace(/\[.*?\]/g, "").trim()}`)
    .slice(-20) // last 20 messages is plenty for summarization
    .join("\n");

  const prompt = `Summarize this Stage ${stageId} (${stageData.label}) coaching conversation in 3-4 sentences. Focus on: key decisions made, insights discovered, problems identified, and progress on milestones. Be specific — names, numbers, and concrete findings matter. This summary will be used by an AI coach to provide continuity across sessions.\n\nConversation:\n${transcript}`;

  try {
    const summary = await callForgeAPI(
      [{ role: "user", content: prompt }],
      "You are a concise summarizer. Respond with only the summary, no preamble."
    );
    memorySummaryCache[stageId] = { summary, messageCount: messages.length };
    return summary;
  } catch {
    return null;
  }
}

async function buildRichContext(profile, activeStage, completedByStage, messagesByStage) {
  const stageData = STAGES_DATA[activeStage - 1];
  const completedMilestones = completedByStage[activeStage] || [];

  const pending = stageData.milestones
    .filter(m => !completedMilestones.includes(m.id))
    .map(m => `- ${m.id}: "${m.label}"`).join("\n");
  const done = stageData.milestones
    .filter(m => completedMilestones.includes(m.id))
    .map(m => `✓ ${m.label}`).join("\n");

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  // All stage milestone status
  const allStageStatus = STAGES_DATA.map(s => {
    const comp = completedByStage[s.id] || [];
    const pct = Math.round((comp.length / s.milestones.length) * 100);
    return `  Stage ${s.id} (${s.label}): ${comp.length}/${s.milestones.length} milestones — ${pct}% complete`;
  }).join("\n");

  // Hub data
  const decisions = (profile.decisions || []).slice(0, 5)
    .map(d => `  [${typeof d === "string" ? "Decision" : d.tag}] ${typeof d === "string" ? d : d.text}`)
    .join("\n") || "  None yet";
  const expenses = (profile.budget?.expenses || []).slice(0, 4)
    .map(e => `  $${e.amount?.toLocaleString()} — ${e.label}`)
    .join("\n") || "  None yet";

  // Cross-stage memory summaries (only stages with history, excluding current)
  const memorySections = [];
  for (const s of STAGES_DATA) {
    if (s.id === activeStage) continue;
    const msgs = messagesByStage[s.id] || [];
    if (msgs.length === 0) continue;
    const summary = await generateStageSummary(s.id, msgs, profile);
    if (summary) {
      memorySections.push(`Stage ${s.id} (${s.label}) memory:\n  ${summary}`);
    }
  }

  return `
Current date & time: ${dateStr}, ${timeStr}
User: ${profile.name} | Business: ${profile.businessName || profile.idea || "Idea stage"} (${profile.industry || "Early Stage"})
Strategy: ${profile.strategyLabel || profile.strategy} | Experience: ${profile.experience || "Not specified"}
Budget: $${(profile.budget?.remaining || 0).toLocaleString()} remaining of $${(profile.budget?.total || 0).toLocaleString()} | Spent: $${(profile.budget?.spent || 0).toLocaleString()} | Runway: ${profile.budget?.runway || "TBD"}

CURRENT STAGE: ${activeStage} — ${stageData.label}
Mission: ${stageData.mission}
${done ? `Completed milestones:\n${done}` : "No milestones completed yet"}
${pending ? `Pending milestones:\n${pending}` : "All milestones complete"}

ALL STAGE PROGRESS:
${allStageStatus}

HUB — DECISIONS LOG:
${decisions}

HUB — RECENT EXPENSES:
${expenses}

${memorySections.length > 0 ? `CROSS-STAGE MEMORY (what was discussed in other stages):
${memorySections.join("\n\n")}` : ""}

STAGE REFERENCES: When you reference work from another stage, wrap the reference like this: [STAGE_REF:N]your reference text[/STAGE_REF] where N is the stage number. This lets the user tap to view that stage's chat history. Use this naturally when referencing prior work — not on every mention, just when it adds value.
  `.trim();
}

// Kept for onboarding and simple calls that don't need full context
function buildContext(profile, stage = null, completedMilestones = []) {
  const stageData = stage ? STAGES_DATA[stage - 1] : null;
  const pending = stageData
    ? stageData.milestones.filter(m => !completedMilestones.includes(m.id)).map(m => `- ${m.id}: "${m.label}"`).join("\n")
    : "";
  const done = stageData
    ? stageData.milestones.filter(m => completedMilestones.includes(m.id)).map(m => `✓ ${m.label}`).join("\n")
    : "";
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  return `
Current date & time: ${dateStr}, ${timeStr}
User: ${profile.name} | Business: ${profile.businessName || profile.idea || "Idea stage"} (${profile.industry || "Early Stage"})
Strategy: ${profile.strategyLabel || profile.strategy}
Budget: $${(profile.budget?.remaining || 0).toLocaleString()} remaining of $${(profile.budget?.total || 0).toLocaleString()} | Runway: ${profile.budget?.runway || "TBD"}
Stage: ${stage ? `${stage} — ${stageData?.label}` : "Onboarding"} | Experience: ${profile.experience || "Not specified"}
${done ? `Completed:\n${done}` : ""}
${pending ? `Pending:\n${pending}` : ""}
Recent decisions: ${(profile.decisions || []).slice(0, 2).map(d => typeof d === "string" ? d : d.text).join("; ") || "None yet"}
  `.trim();
}

function parseForgeResponse(text) {
  const completedIds = [];
  const regex = /\[COMPLETE:\s*(\w+)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) completedIds.push(match[1]);
  const advanceReady = text.includes("[ADVANCE_READY]");
  const cleanText = text.replace(/\[COMPLETE:\s*\w+\]/g, "").replace(/\[ADVANCE_READY\]/g, "").trim();
  return { cleanText, completedIds, advanceReady };
}

// ─────────────────────────────────────────────────────────────
// MASTER GLOSSARY — 80 core business terms
// ─────────────────────────────────────────────────────────────
const GLOSSARY = {
  // Finance & Economics
  "runway": {
    definition: "How long your business can survive at its current spending rate before running out of money. Calculated by dividing cash on hand by monthly burn rate.",
    why: "This is your clock. Every founder needs to know their runway to the day — it drives every spending decision you make.",
    example: "When Airbnb was near-broke in 2009, knowing their exact runway forced them to get creative with the Obama O's cereal stunt that kept them alive.",
    resource: "Profit First — Mike Michalowicz",
    stage: 4, color: "#48BB78"
  },
  "burn rate": {
    definition: "How much money your business spends per month. Gross burn is total spending; net burn subtracts revenue.",
    why: "Your burn rate and runway are inseparable. A high burn with no revenue is a countdown timer.",
    example: "Many 2021-era startups had $500k+ monthly burns — fine when VC money was easy, fatal when it wasn't.",
    resource: "The Lean Startup — Eric Ries",
    stage: 4, color: "#48BB78"
  },
  "unit economics": {
    definition: "The revenue and cost associated with a single unit of your business — one customer, one product, one transaction.",
    why: "If your unit economics are broken, growth makes things worse, not better. Fix the unit before you scale it.",
    example: "Hormozi's entire $100M Offers framework is built on creating unit economics so strong that acquiring customers feels free.",
    resource: "$100M Offers — Alex Hormozi",
    stage: 2, color: "#63B3ED"
  },
  "CAC": {
    definition: "Customer Acquisition Cost — the total amount you spend to acquire one new customer, including all marketing and sales costs.",
    why: "If your CAC is higher than what a customer pays you, you're buying customers at a loss. Every business needs to know this number.",
    example: "A SaaS company spending $500 to acquire a customer paying $50/month has a 10-month payback period — tight but workable if churn is low.",
    resource: "$100M Leads — Alex Hormozi",
    stage: 5, color: "#E8622A"
  },
  "LTV": {
    definition: "Lifetime Value — the total revenue you expect to earn from a single customer over the entire relationship.",
    why: "LTV vs CAC is the fundamental health metric of any business. LTV should be at least 3x your CAC.",
    example: "Amazon Prime members have dramatically higher LTV than non-members — it's why they practically give the membership away.",
    resource: "Traction — Gabriel Weinberg",
    stage: 5, color: "#E8622A"
  },
  "gross margin": {
    definition: "Revenue minus the direct costs of producing your product or service, expressed as a percentage of revenue.",
    why: "Gross margin tells you how much money you actually keep from each sale before overhead. Software has 80%+ margins; physical goods often 30-50%.",
    example: "Apple's hardware has ~35% gross margin; their services segment runs at ~70% — which is why Tim Cook has been pushing services so hard.",
    resource: "Good to Great — Jim Collins",
    stage: 4, color: "#48BB78"
  },
  "profit margin": {
    definition: "What percentage of revenue becomes actual profit after all costs — cost of goods, overhead, salaries, taxes, everything.",
    why: "Revenue is vanity, profit is sanity. A business with $1M revenue and 5% margin makes $50k. One with $200k revenue and 40% margin makes $80k.",
    example: "Michalowicz built Profit First specifically because entrepreneurs confuse revenue with profit and spend what they shouldn't.",
    resource: "Profit First — Mike Michalowicz",
    stage: 4, color: "#48BB78"
  },
  "break-even": {
    definition: "The point where your revenue exactly covers all your costs — you're neither losing money nor making it.",
    why: "Every business needs to know exactly when and how they hit break-even. It's the line between survival and growth.",
    example: "A restaurant with $20k monthly fixed costs and 60% gross margin breaks even at $33,333 in monthly revenue.",
    resource: "The E-Myth Revisited — Michael Gerber",
    stage: 4, color: "#48BB78"
  },
  "cash flow": {
    definition: "The movement of money in and out of your business over time. Positive cash flow means more coming in than going out.",
    why: "Profitable businesses go bankrupt from cash flow problems. If your customers pay net-60 but your suppliers want payment now, you can be profitable and broke simultaneously.",
    example: "Most small business failures aren't from lack of profit — they're from cash flow gaps that kill operations before revenue arrives.",
    resource: "Profit First — Mike Michalowicz",
    stage: 4, color: "#48BB78"
  },
  "ARR": {
    definition: "Annual Recurring Revenue — the predictable, recurring revenue your business generates in a year, typically from subscriptions.",
    why: "ARR is the gold standard metric for subscription businesses because it shows predictable, compounding revenue rather than one-time sales.",
    example: "SaaS companies are often valued at 5-15x ARR because recurring revenue is so predictable and defensible.",
    resource: "Zero to One — Peter Thiel",
    stage: 6, color: "#F5A843"
  },
  "MRR": {
    definition: "Monthly Recurring Revenue — the predictable revenue your business generates each month from subscriptions or retainers.",
    why: "MRR is the heartbeat of a subscription business. Founders check it daily because it tells you instantly if you're growing or shrinking.",
    example: "Going from $1k to $10k MRR is the first major milestone most SaaS founders celebrate — it means the model is real.",
    resource: "Traction — Gabriel Weinberg",
    stage: 6, color: "#F5A843"
  },
  "churn": {
    definition: "The rate at which customers stop doing business with you — canceling subscriptions, not repurchasing, or leaving.",
    why: "High churn means you're filling a leaky bucket. Acquiring new customers faster than you lose old ones is expensive and unsustainable.",
    example: "Netflix has famously low churn (~2% monthly) because their content investment creates a habit. Most SaaS companies target under 5% monthly churn.",
    resource: "Traction — Gabriel Weinberg",
    stage: 6, color: "#F5A843"
  },

  // Strategy & Business Models
  "product-market fit": {
    definition: "The degree to which your product satisfies a strong market demand. You have it when customers pull the product out of your hands.",
    why: "Marc Andreessen called this the only thing that matters for a startup. Everything before it is preparation; everything after it is scaling.",
    example: "Slack knew they had PMF when companies started begging to pay for beta access and usage grew without any marketing.",
    resource: "The Lean Startup — Eric Ries",
    stage: 1, color: "#F5A843"
  },
  "MVP": {
    definition: "Minimum Viable Product — the simplest version of your product that lets you test your core assumption with real customers.",
    why: "An MVP isn't a bad version of your product — it's a learning tool. The goal is to get real feedback before investing in the full build.",
    example: "Dropbox's MVP was literally just a demo video. It generated 75,000 signups overnight, proving demand before writing a single line of code.",
    resource: "The Lean Startup — Eric Ries",
    stage: 1, color: "#F5A843"
  },
  "moat": {
    definition: "A sustainable competitive advantage that protects your business from competitors — like a moat around a castle.",
    why: "Without a moat, competitors can copy you the moment you succeed. Moats are what make businesses defensible and valuable long-term.",
    example: "Warren Buffett coined the term. Google's moat is network effects + data. Starbucks' moat is habit and real estate. What's yours?",
    resource: "Good to Great — Jim Collins",
    stage: 2, color: "#63B3ED"
  },
  "value proposition": {
    definition: "The specific reason a customer chooses you over every alternative, including doing nothing.",
    why: "If you can't say your value proposition in one sentence, you don't have one. Vague value props lead to vague marketing and confused customers.",
    example: "FedEx's original value prop was ruthlessly clear: 'When it absolutely, positively has to be there overnight.' No ambiguity.",
    resource: "Value Proposition Design — Alex Osterwalder",
    stage: 2, color: "#63B3ED"
  },
  "competitive advantage": {
    definition: "What you do better, cheaper, or differently than anyone else in ways that matter to your target customer.",
    why: "Competitive advantage isn't about being slightly better. It's about being meaningfully different in ways competitors can't easily replicate.",
    example: "Southwest Airlines' competitive advantage was operational efficiency and no fees — a model that incumbents couldn't copy without destroying their own margins.",
    resource: "Good to Great — Jim Collins",
    stage: 2, color: "#63B3ED"
  },
  "business model": {
    definition: "The system by which your company creates, delivers, and captures value — who pays, how much, and how often.",
    why: "A great product with a bad business model fails. The model determines whether you can actually build a sustainable company.",
    example: "Gillette's razor-and-blades model (cheap razor, expensive blades) has been replicated by printers, coffee machines, and countless SaaS tools.",
    resource: "Business Model Generation — Alex Osterwalder",
    stage: 2, color: "#63B3ED"
  },
  "pivot": {
    definition: "A structured course correction that tests a new hypothesis about your product, market, or business model.",
    why: "A pivot isn't failure — it's using real data to improve your direction. The best pivots happen early, before you've burned too much runway.",
    example: "Instagram started as Burbn, a check-in app. They pivoted to photo sharing when they noticed that was the only feature people actually used.",
    resource: "The Lean Startup — Eric Ries",
    stage: 1, color: "#F5A843"
  },
  "flywheel": {
    definition: "A self-reinforcing cycle where each part of the business strengthens the others, creating compounding momentum over time.",
    why: "Flywheels are how businesses build unstoppable momentum. The hard part is getting the wheel spinning — once it moves, it accelerates itself.",
    example: "Amazon's flywheel: more customers → more sellers → better selection → lower prices → more customers. Each turn makes the next turn easier.",
    resource: "Good to Great — Jim Collins",
    stage: 6, color: "#F5A843"
  },
  "network effects": {
    definition: "When a product becomes more valuable as more people use it.",
    why: "Network effects are one of the most powerful moats in business. They make it exponentially harder for competitors to displace you.",
    example: "WhatsApp, LinkedIn, Airbnb — all become more valuable with every additional user. That's network effects compounding.",
    resource: "Zero to One — Peter Thiel",
    stage: 2, color: "#63B3ED"
  },
  "scalability": {
    definition: "The ability to grow revenue faster than costs — to handle more customers without proportionally more resources.",
    why: "A business that requires twice the people for twice the revenue isn't scalable. Software scales; custom consulting often doesn't.",
    example: "Stripe processes billions in transactions without proportionally more engineers — the marginal cost of another transaction is near zero.",
    resource: "Zero to One — Peter Thiel",
    stage: 6, color: "#F5A843"
  },

  // Marketing & Growth
  "TAM": {
    definition: "Total Addressable Market — the maximum revenue opportunity if you captured 100% of your target market.",
    why: "TAM tells you if there's room to build a big business. A $10M TAM means the ceiling is low no matter how good you execute.",
    example: "Airbnb's TAM wasn't just vacation rentals — it was all accommodation globally. That framing unlocked a $100B company.",
    resource: "Zero to One — Peter Thiel",
    stage: 2, color: "#63B3ED"
  },
  "ICP": {
    definition: "Ideal Customer Profile — a detailed description of the perfect customer for your business, specific enough to recognize them on the street.",
    why: "Trying to sell to everyone means selling to no one. A sharp ICP makes every marketing and sales decision easier.",
    example: "Salesforce's original ICP was small sales teams at tech companies who were sick of Siebel. Ruthless specificity built a $200B company.",
    resource: "The Mom Test — Rob Fitzpatrick",
    stage: 1, color: "#F5A843"
  },
  "customer acquisition": {
    definition: "The process and cost of getting a new customer — from first awareness through to completed purchase.",
    why: "If you don't have a repeatable, affordable way to acquire customers, you don't have a business — you have a hobby.",
    example: "Hormozi's entire $100M Leads book is about building acquisition systems so good that leads cost almost nothing.",
    resource: "$100M Leads — Alex Hormozi",
    stage: 5, color: "#E8622A"
  },
  "retention": {
    definition: "Your ability to keep customers coming back — the opposite of churn.",
    why: "Acquiring a new customer costs 5-25x more than retaining an existing one. Retention is the multiplier on everything else you build.",
    example: "Costco's retention is near 90% annually because the membership model creates commitment and the value is undeniable.",
    resource: "Traction — Gabriel Weinberg",
    stage: 6, color: "#F5A843"
  },
  "referral": {
    definition: "When existing customers bring new customers to your business — word of mouth that you can design and systematize.",
    why: "Referral is the highest-quality, lowest-cost customer acquisition channel. A product that doesn't generate referrals has a problem worth investigating.",
    example: "Dropbox grew 3900% in 15 months with a simple referral program: give storage, get storage. No advertising required.",
    resource: "1,000 True Fans — Kevin Kelly",
    stage: 5, color: "#E8622A"
  },
  "conversion rate": {
    definition: "The percentage of potential customers who take a desired action — signing up, buying, or advancing through your sales process.",
    why: "A 2% conversion rate means 98 out of 100 people say no. Understanding why they say no is where the real money is.",
    example: "Basecamp obsesses over their trial-to-paid conversion rate. Even a 1% improvement at their volume translates to millions in revenue.",
    resource: "Traction — Gabriel Weinberg",
    stage: 5, color: "#E8622A"
  },
  "go-to-market": {
    definition: "Your strategy for how you'll reach customers and generate revenue — which channels, which customers, in what order.",
    why: "A go-to-market strategy is the difference between a launch and a guess. It answers: who, where, how, and at what cost.",
    example: "Slack's GTM was bottom-up: get one team addicted, let it spread through the company, then convert to enterprise contracts.",
    resource: "Crossing the Chasm — Geoffrey Moore",
    stage: 5, color: "#E8622A"
  },
  "permission marketing": {
    definition: "Marketing to people who have explicitly opted in to hear from you, rather than interrupting strangers.",
    why: "Interruption marketing is getting more expensive and less effective. Building an audience that wants to hear from you is a durable asset.",
    example: "Seth Godin popularized this idea. Every email list, podcast subscriber, and social follower is permission-based marketing in action.",
    resource: "Permission Marketing — Seth Godin",
    stage: 5, color: "#E8622A"
  },

  // Operations & Structure
  "LLC": {
    definition: "Limited Liability Company — a business structure that separates personal and business assets, protecting you from personal liability.",
    why: "Without an LLC, a lawsuit against your business can take your personal savings, car, and home. An LLC puts a wall between them.",
    example: "Most small business owners and solo founders start with an LLC because it's simple, flexible, and provides the protection that matters.",
    resource: "SBA.gov — Business Structures",
    stage: 3, color: "#9F7AEA"
  },
  "EIN": {
    definition: "Employer Identification Number — a federal tax ID for your business, like a Social Security number for your company.",
    why: "You need an EIN to open a business bank account, hire employees, and file business taxes separately from personal taxes.",
    example: "Getting an EIN from the IRS takes about 5 minutes online and costs nothing. It's one of the first things you do when forming a business.",
    resource: "IRS.gov — Apply for an EIN",
    stage: 3, color: "#9F7AEA"
  },
  "equity": {
    definition: "Ownership in a company, typically expressed as a percentage. Founders start with 100% and dilute as investors and employees receive shares.",
    why: "Equity is the currency of startups. Understanding dilution matters before you take any investment or grant any stock options.",
    example: "The Facebook movie got equity wrong — dilution from investors doesn't mean you lose control, but it does mean your percentage shrinks.",
    resource: "Zero to One — Peter Thiel",
    stage: 3, color: "#9F7AEA"
  },
  "bootstrapping": {
    definition: "Building a business using only your own money or revenue — no outside investment.",
    why: "Bootstrapping preserves equity and forces discipline. The constraint of limited money often produces better decisions than abundance.",
    example: "Basecamp, Mailchimp, and GitHub all bootstrapped to massive scale before taking any investment (or none at all).",
    resource: "Rework — Jason Fried & DHH",
    stage: 4, color: "#48BB78"
  },
  "due diligence": {
    definition: "The thorough investigation of a business before a transaction — whether an investor researching you or you researching a partner.",
    why: "Skipping due diligence is how people get burned by bad deals. It applies to investors, partnerships, suppliers, and acquirers.",
    example: "A VC doing due diligence will check your financials, talk to your customers, verify your claims, and examine your cap table.",
    resource: "Venture Deals — Brad Feld",
    stage: 3, color: "#9F7AEA"
  },
  "cap table": {
    definition: "Capitalization table — a spreadsheet showing who owns what percentage of your company and what type of equity they hold.",
    why: "Your cap table is the source of truth for ownership. A messy cap table scares investors and creates legal problems.",
    example: "Early Facebook had a notoriously complicated cap table that required expensive lawyers to clean up before major investment rounds.",
    resource: "Venture Deals — Brad Feld",
    stage: 3, color: "#9F7AEA"
  },

  // Frameworks & Concepts
  "lean startup": {
    definition: "A methodology for building businesses that emphasizes rapid experimentation, customer feedback, and iterative product development.",
    why: "The Lean Startup method saves you from building something nobody wants. Build-measure-learn loops get you to product-market fit faster.",
    example: "Eric Ries developed this after working at IMVU, where they almost built themselves into bankruptcy before learning to ship fast and learn faster.",
    resource: "The Lean Startup — Eric Ries",
    stage: 1, color: "#F5A843"
  },
  "jobs to be done": {
    definition: "A framework that focuses on the underlying 'job' a customer hires a product to do — the real motivation behind the purchase.",
    why: "People don't buy quarter-inch drills. They buy quarter-inch holes. Understanding the job reveals what your product actually needs to do.",
    example: "McDonald's discovered milkshakes were being 'hired' as a morning commute companion — a completely different job than they'd assumed.",
    resource: "Competing Against Luck — Clayton Christensen",
    stage: 1, color: "#F5A843"
  },
  "mom test": {
    definition: "A set of interview rules for talking to customers so you get honest information instead of polite lies.",
    why: "Most customer interviews are useless because people are too polite to say your idea is bad. The Mom Test teaches you to ask questions that extract truth.",
    example: "Rob Fitzpatrick's core rule: never ask if someone likes your idea. Ask about their life, their problems, their behavior. Past is truth; opinions are noise.",
    resource: "The Mom Test — Rob Fitzpatrick",
    stage: 1, color: "#F5A843"
  },
  "product-solution fit": {
    definition: "When your specific product design effectively solves the validated problem for your target customer.",
    why: "Problem-solution fit proves the problem is real. Product-solution fit proves your answer to it actually works.",
    example: "Uber had problem-solution fit when the first beta users in San Francisco were texting their friends telling them to try it immediately.",
    resource: "The Lean Startup — Eric Ries",
    stage: 1, color: "#F5A843"
  },
  "OKRs": {
    definition: "Objectives and Key Results — a goal-setting framework that pairs ambitious objectives with measurable outcomes.",
    why: "OKRs force you to define what success looks like in concrete, measurable terms. Vague goals produce vague results.",
    example: "Google has used OKRs since 1999. Intel, LinkedIn, and Twitter all credit OKRs with bringing discipline to fast-moving growth.",
    resource: "Measure What Matters — John Doerr",
    stage: 6, color: "#F5A843"
  },
  "KPIs": {
    definition: "Key Performance Indicators — the specific metrics that tell you whether your business is healthy and moving in the right direction.",
    why: "Every business has dozens of metrics. KPIs are the 3-5 that actually matter. If you're tracking everything, you're tracking nothing.",
    example: "For a subscription business, KPIs are usually MRR growth, churn rate, CAC, and LTV. For a marketplace, it might be GMV and take rate.",
    resource: "Traction — Gabriel Weinberg",
    stage: 6, color: "#F5A843"
  },
  "NPS": {
    definition: "Net Promoter Score — a measure of customer loyalty based on one question: how likely are you to recommend us, on a scale of 0-10?",
    why: "NPS correlates strongly with growth. Companies with high NPS grow through word of mouth; low NPS companies fight churn while leaking customers.",
    example: "Apple's NPS is consistently above 70 (exceptional). Most banks are below 0. The difference shows up in growth rates and customer lifetime value.",
    resource: "The Ultimate Question — Fred Reichheld",
    stage: 6, color: "#F5A843"
  },
  "profit first": {
    definition: "A cash management system where you allocate profit before paying expenses — the reverse of conventional accounting.",
    why: "Most entrepreneurs pay expenses first and hope profit is left over. Profit First flips this by making profit non-negotiable and forcing discipline on spending.",
    example: "Michalowicz implemented this after going broke as a 'successful' entrepreneur. The system forces you to build a profitable business by design.",
    resource: "Profit First — Mike Michalowicz",
    stage: 4, color: "#48BB78"
  },
  "validation": {
    definition: "The process of testing your business assumptions with real customers before fully building or launching.",
    why: "Assumptions are hypotheses. Validation turns them into facts. Everything you spend before validating is a bet — validation makes it a decision.",
    example: "Zappos' Nick Swinmurn validated shoe e-commerce by posting photos from local stores online before holding any inventory.",
    resource: "The Lean Startup — Eric Ries",
    stage: 1, color: "#F5A843"
  },
  "willingness to pay": {
    definition: "Whether customers will actually exchange money for your solution — not just say they would, but actually do it.",
    why: "People lie about what they'll pay. Real willingness to pay is tested with real transactions, not surveys or verbal commitments.",
    example: "The Mom Test's hardest rule: ask people to pre-pay, not just whether they would. A credit card number is truth; 'I'd definitely buy that' is not.",
    resource: "The Mom Test — Rob Fitzpatrick",
    stage: 1, color: "#F5A843"
  },
  "market research": {
    definition: "The systematic process of gathering information about your target market, customers, and competitive landscape.",
    why: "Market research reduces risk. It doesn't eliminate it — but founders who skip it often discover the hard way that their assumptions were wrong.",
    example: "Warby Parker spent months researching the eyewear market before launching — discovering that Luxottica controlled ~80% of it and pricing was artificially high.",
    resource: "The Mom Test — Rob Fitzpatrick",
    stage: 1, color: "#F5A843"
  },
  "differentiation": {
    definition: "What makes your offering meaningfully different from alternatives in ways your customers actually care about.",
    why: "Competing on price is a race to the bottom. Differentiation lets you compete on value. The goal is to be the only logical choice for your customer.",
    example: "Apple differentiates on design and ecosystem. Patagonia differentiates on environmental values. Neither competes on price — and they don't have to.",
    resource: "Purple Cow — Seth Godin",
    stage: 2, color: "#63B3ED"
  },
  "pricing strategy": {
    definition: "How you set the price of your product or service — cost-plus, value-based, competitive, or dynamic pricing.",
    why: "Pricing is your most powerful profit lever. A 1% improvement in price often has more impact than a 10% improvement in sales volume.",
    example: "Hormozi's framework: price to the value delivered, not the cost to deliver. If your solution saves someone $100k, charging $10k is a bargain.",
    resource: "$100M Offers — Alex Hormozi",
    stage: 4, color: "#48BB78"
  },
  "minimum viable product": {
    definition: "The simplest version of your product that delivers enough value to acquire early customers and validate your core assumptions.",
    why: "An MVP isn't a prototype. It's a real thing real people pay for. It teaches you what actually matters before you over-build.",
    example: "Airbnb's MVP was three air mattresses in the founders' apartment. Real hosts, real guests, real payments — and they learned everything.",
    resource: "The Lean Startup — Eric Ries",
    stage: 1, color: "#F5A843"
  },
};

// Terms to auto-detect even without [TERM] tags (case-insensitive matching)
const AUTO_DETECT_TERMS = new Set(Object.keys(GLOSSARY));

// Stage color map for glossary pills
const STAGE_COLORS = { 1: "#F5A843", 2: "#63B3ED", 3: "#9F7AEA", 4: "#48BB78", 5: "#E8622A", 6: "#F5A843" };



async function deliverMessage(text, setLoading, addMessage) {
  await new Promise(r => setTimeout(r, 600));
  setLoading(true);
  const words = text.split(" ").length;
  const duration = Math.min(Math.max(words * 80, 1200), 3000);
  await new Promise(r => setTimeout(r, duration));
  setLoading(false);
  addMessage(text);
}

// ─────────────────────────────────────────────────────────────
// STAGE REFERENCE MODAL — overlays on current screen
// ─────────────────────────────────────────────────────────────
function StageRefModal({ stageId, messages, profile, onClose }) {
  const stage = STAGES_DATA[stageId - 1];
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease" }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }} />

      {/* Modal panel — slides up */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: "8%", background: "#0A0A0C", borderTop: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px 20px 0 0", display: "flex", flexDirection: "column", animation: "slideUp 0.35s cubic-bezier(0.16,1,0.3,1)" }}>

        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 18 }}>{stage.icon}</span>
              <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Stage {stageId} — {stage.label}</div>
            </div>
            <div style={{ fontSize: 11, color: "#555" }}>{messages.length} messages · tap anywhere outside to close</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 14px", color: "#888", fontSize: 12, cursor: "pointer" }}>✕ Close</button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 680, width: "100%", margin: "0 auto", alignSelf: "center" }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: "center", color: "#444", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", padding: "40px 0" }}>No conversation yet in this stage.</div>
          ) : (
            messages.map((msg, i) => {
              const isForge = msg.role === "forge" || msg.role === "assistant";
              return (
                <div key={i} style={{ display: "flex", justifyContent: isForge ? "flex-start" : "flex-end", alignItems: "flex-start", gap: 10 }}>
                  {isForge && (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #E8622A, #c9521e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🔥</div>
                  )}
                  <div style={{ maxWidth: "78%", padding: isForge ? "12px 16px" : "9px 14px", borderRadius: isForge ? "4px 14px 14px 14px" : "14px 14px 4px 14px", background: isForge ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, #E8622A, #c9521e)", border: isForge ? "1px solid rgba(255,255,255,0.06)" : "none", fontSize: isForge ? 13 : 12, fontFamily: isForge ? "'Lora', Georgia, serif" : "'DM Sans', sans-serif", lineHeight: 1.7, color: isForge ? "#C8C4BE" : "#fff", opacity: 0.9 }}>
                    <div style={{ whiteSpace: "pre-wrap" }}>{(msg.text || "").replace(/\[STAGE_REF:\d+\]/g, "").replace(/\[\/STAGE_REF\]/g, "")}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GLOSSARY MODAL — tap-to-learn card
// ─────────────────────────────────────────────────────────────
function GlossaryModal({ term, entry, profile, activeStage, onClose, onMarkLearned, alreadyLearned }) {
  const [contextNote, setContextNote] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const stageData = STAGES_DATA[activeStage - 1];

  useEffect(() => {
    // Generate a short "why this matters for you right now" note
    const generateContext = async () => {
      setLoadingContext(true);
      try {
        const prompt = `The user ${profile.name} is building "${profile.idea}" and is currently in Stage ${activeStage}: ${stageData?.label}. They just tapped on the term "${term}" to learn about it. In 1-2 sentences, explain why understanding "${term}" is specifically important for what they're doing right now in their business. Be concrete and personal. Don't define the term — they have the definition. Connect it to their specific situation.`;
        const note = await callForgeAPI(
          [{ role: "user", content: prompt }],
          "You are Forge, a business coach. Respond with only the 1-2 sentence insight, no preamble or label."
        );
        setContextNote(note);
      } catch { setContextNote(null); }
      setLoadingContext(false);
    };
    generateContext();
  }, [term]);

  const stageColor = STAGE_COLORS[entry.stage] || "#E8622A";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end", animation: "fadeIn 0.2s ease" }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} />

      {/* Card */}
      <div style={{ position: "relative", background: "#0D0D10", borderTop: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px 20px 0 0", padding: "24px 20px max(36px, calc(20px + env(safe-area-inset-bottom)))", animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)", maxHeight: "82vh", overflowY: "auto" }}>

        {/* Drag handle */}
        <div style={{ width: 36, height: 3, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 20px" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 26, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, color: "#F0EDE8", letterSpacing: "-0.5px", lineHeight: 1.1, marginBottom: 6 }}>
              {term.charAt(0).toUpperCase() + term.slice(1)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 10, color: stageColor, background: `${stageColor}18`, border: `1px solid ${stageColor}30`, borderRadius: 20, padding: "2px 9px", fontWeight: 500 }}>
                Stage {entry.stage} — {STAGES_DATA[entry.stage - 1]?.label}
              </div>
              {alreadyLearned && (
                <div style={{ fontSize: 10, color: "#4CAF8A", background: "rgba(76,175,138,0.1)", borderRadius: 20, padding: "2px 9px" }}>✓ Learned</div>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "6px 12px", color: "#666", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>✕</button>
        </div>

        {/* Definition */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>What it means</div>
          <div style={{ fontSize: 14, fontFamily: "'Lora', Georgia, serif", color: "#C8C4BE", lineHeight: 1.75 }}>{entry.definition}</div>
        </div>

        {/* Why it matters for you — dynamic */}
        <div style={{ marginBottom: 16, background: "rgba(232,98,42,0.06)", border: "1px solid rgba(232,98,42,0.15)", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 10, color: "#E8622A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Why it matters for you right now</div>
          {loadingContext ? (
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#E8622A", animation: "forgePulse 1.4s infinite ease-in-out", animationDelay: `${i * 0.2}s` }} />)}
            </div>
          ) : (
            <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", color: "#D8D4CE", lineHeight: 1.7, fontStyle: "italic" }}>
              {contextNote || entry.why}
            </div>
          )}
        </div>

        {/* Real example */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Real example</div>
          <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", color: "#888", lineHeight: 1.7 }}>{entry.example}</div>
        </div>

        {/* Resource */}
        <div style={{ marginBottom: 22, padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>📚</span>
          <div>
            <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>Go deeper</div>
            <div style={{ fontSize: 12, color: "#C8C4BE", fontFamily: "'Lora', Georgia, serif" }}>{entry.resource}</div>
          </div>
        </div>

        {/* Mark as learned */}
        {!alreadyLearned && (
          <button onClick={() => { onMarkLearned(term, entry.stage); onClose(); }}
            style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 20px rgba(232,98,42,0.3)" }}>
            ✓ Mark as Learned
          </button>
        )}
        {alreadyLearned && (
          <div style={{ textAlign: "center", fontSize: 12, color: "#4CAF8A", padding: "10px 0" }}>You've already learned this term ✓</div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RICH TEXT RENDERER — bold + stage references + glossary terms
// ─────────────────────────────────────────────────────────────

// Split a text segment into glossary-highlighted + plain chunks
function applyGlossaryHighlights(text, onGlossaryTap) {
  if (!onGlossaryTap) return [<span key="plain">{text}</span>];
  // Build a regex that matches any glossary term (case-insensitive, whole word)
  const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length); // longest first
  const pattern = new RegExp(`\\b(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
  const parts = [];
  let last = 0;
  let m;
  pattern.lastIndex = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={last}>{text.slice(last, m.index)}</span>);
    const matched = m[1];
    const key = matched.toLowerCase();
    const entry = GLOSSARY[key];
    parts.push(
      <span key={m.index} onClick={() => onGlossaryTap(key, entry)}
        style={{ color: entry ? (STAGE_COLORS[entry.stage] || "#F5A843") : "#F5A843", borderBottom: "1px dotted currentColor", cursor: "pointer", opacity: 0.9, transition: "opacity 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.opacity = "1"}
        onMouseLeave={e => e.currentTarget.style.opacity = "0.9"}
        title={`Learn: ${matched}`}
      >
        {matched}
      </span>
    );
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push(<span key={last + "e"}>{text.slice(last)}</span>);
  return parts.length > 0 ? parts : [<span key="plain">{text}</span>];
}

function renderWithBold(text, onStageRef, onGlossaryTap) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, li) => {
    if (line === "") return <div key={li} style={{ height: "0.8em" }} />;

    // First: extract [TERM]...[/TERM] tags from Forge
    const termTagRe = /\[TERM\](.*?)\[\/TERM\]/g;
    let processedLine = line.replace(termTagRe, (_, termText) => {
      const key = termText.toLowerCase().trim();
      return GLOSSARY[key] ? termText : termText; // keep text, let auto-detect handle it
    });

    // Second: extract [STAGE_REF:N]...[/STAGE_REF]
    const segments = [];
    let lastIdx = 0;
    const lineRefRe = /\[STAGE_REF:(\d+)\](.*?)\[\/STAGE_REF\]/g;
    lineRefRe.lastIndex = 0;
    let refMatch;
    while ((refMatch = lineRefRe.exec(processedLine)) !== null) {
      if (refMatch.index > lastIdx) {
        segments.push({ type: "text", value: processedLine.slice(lastIdx, refMatch.index) });
      }
      segments.push({ type: "ref", stageId: parseInt(refMatch[1]), value: refMatch[2] });
      lastIdx = lineRefRe.lastIndex;
    }
    if (lastIdx < processedLine.length) segments.push({ type: "text", value: processedLine.slice(lastIdx) });
    if (segments.length === 0) segments.push({ type: "text", value: processedLine });

    const rendered = segments.map((seg, si) => {
      if (seg.type === "ref") {
        const stageData = STAGES_DATA[seg.stageId - 1];
        return (
          <span key={si} onClick={() => onStageRef && onStageRef(seg.stageId)}
            style={{ color: "#F5A843", borderBottom: "1px dotted rgba(245,168,67,0.6)", cursor: "pointer", fontStyle: "italic", transition: "opacity 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.7"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            title={`View Stage ${seg.stageId}: ${stageData?.label}`}
          >
            {seg.value} <span style={{ fontSize: "0.75em", opacity: 0.7 }}>↗ Stage {seg.stageId}</span>
          </span>
        );
      }
      // Bold + glossary auto-detect within text segments
      const boldParts = seg.value.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((part, pi) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={pi} style={{ color: "#F0EDE8", fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
        }
        return <span key={pi}>{applyGlossaryHighlights(part, onGlossaryTap)}</span>;
      });
    });

    return <div key={li}>{rendered}</div>;
  });
}

// ─────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "10px 4px", alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8622A", animation: "forgePulse 1.4s infinite ease-in-out", animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

function ForgeAvatar({ size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #E8622A, #c9521e)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.44, boxShadow: "0 0 16px rgba(232,98,42,0.25)" }}>🔥</div>
  );
}

function MessageBubble({ msg, onStageRef, onGlossaryTap }) {
  const isForge = msg.role === "forge" || msg.role === "assistant";
  return (
    <div style={{ display: "flex", justifyContent: isForge ? "flex-start" : "flex-end", alignItems: "flex-start", gap: 10, animation: "fadeSlideUp 0.3s ease" }}>
      {isForge && <ForgeAvatar size={32} />}
      <div style={{ maxWidth: "88%", padding: isForge ? "12px 16px" : "9px 14px", borderRadius: isForge ? "4px 16px 16px 16px" : "16px 16px 4px 16px", background: isForge ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg, #E8622A, #c9521e)", border: isForge ? "1px solid rgba(255,255,255,0.07)" : "none", fontSize: isForge ? 14 : 13, fontFamily: isForge ? "'Lora', Georgia, serif" : "'DM Sans', sans-serif", lineHeight: 1.75, color: isForge ? "#D8D4CE" : "#fff" }}>
        {isForge ? renderWithBold(msg.text, onStageRef, onGlossaryTap) : <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>}
      </div>
    </div>
  );
}

function ChatInput({ value, onChange, onSend, onKeyDown, loading, placeholder }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "10px 12px 10px 14px" }}>
      <textarea
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder || "Talk to Forge..."}
        rows={1}
        style={{ flex: 1, background: "transparent", border: "none", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, maxHeight: 120 }}
      />
      <button
        onClick={onSend}
        disabled={loading || !value.trim()}
        style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: loading || !value.trim() ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", color: "#fff", fontSize: 14, opacity: loading || !value.trim() ? 0.4 : 1, cursor: loading || !value.trim() ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
      >↑</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CINEMATIC INTRO — slow enough to read and appreciate
// ─────────────────────────────────────────────────────────────
function CinematicIntro({ onComplete }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),    // flame appears
      setTimeout(() => setPhase(2), 2000),   // wordmark fades in
      setTimeout(() => setPhase(3), 3400),   // tagline + quote fades in
      setTimeout(() => setPhase(4), 6400),   // overlay fades to black
      setTimeout(() => onComplete(), 7800),  // transitions to onboarding
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#080809", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      {/* Ambient glow */}
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,98,42,0.12) 0%, transparent 70%)", opacity: phase >= 1 ? 1 : 0, transition: "opacity 2s ease", pointerEvents: "none" }} />
      {/* Flame */}
      <div style={{ fontSize: "clamp(48px, 15vw, 64px)", marginBottom: 24, opacity: phase >= 1 ? 1 : 0, transform: phase >= 1 ? "scale(1) translateY(0)" : "scale(0.6) translateY(20px)", transition: "all 1.2s cubic-bezier(0.16, 1, 0.3, 1)", filter: phase >= 2 ? "drop-shadow(0 0 30px rgba(232,98,42,0.6))" : "none" }}>🔥</div>
      {/* Wordmark */}
      <div style={{ opacity: phase >= 2 ? 1 : 0, transform: phase >= 2 ? "translateY(0)" : "translateY(12px)", transition: "all 0.9s cubic-bezier(0.16, 1, 0.3, 1)", textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: "clamp(36px, 11vw, 52px)", fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, color: "#F0EDE8", letterSpacing: "-1px", lineHeight: 1 }}>Foundry</div>
        <div style={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", color: "#E8622A", letterSpacing: "0.25em", textTransform: "uppercase", marginTop: 8 }}>Build Something Real</div>
      </div>
      {/* Tagline quote */}
      <div style={{ opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? "translateY(0)" : "translateY(8px)", transition: "all 0.8s ease", textAlign: "center", maxWidth: 380, padding: "0 32px" }}>
        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", color: "rgba(240,237,232,0.5)", lineHeight: 1.7 }}>
          "Every great business started with one person who decided to try."
        </div>
      </div>
      {/* Fade to black overlay */}
      <div style={{ position: "absolute", inset: 0, background: "#080809", opacity: phase >= 4 ? 1 : 0, transition: "opacity 0.9s ease", pointerEvents: "none" }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ONBOARDING SCREEN — user controls entry with "Enter Foundry →" button
// ─────────────────────────────────────────────────────────────
function OnboardingScreen({ onComplete }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [profile, setProfile] = useState({ name: "", idea: "", experience: "", budget: "", budgetAmount: 0, strategy: "", strategyLabel: "" });
  const [cardSelection, setCardSelection] = useState(null);
  const [started, setStarted] = useState(false);
  const [readyToEnter, setReadyToEnter] = useState(false);
  const [completedProfile, setCompletedProfile] = useState(null);

  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 120) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading, readyToEnter]);

  const OPENER = `Hey. I'm **Forge** — your business partner inside Foundry.\n\nI'm not here to give you generic advice or walk you through a template. I'm here to help you build something **real** — from the first idea all the way to a business that runs without you losing sleep over it.\n\nBefore we get into it, I want to know a few things about you. Not a form. Just a conversation.\n\nWhat's your name?`;

  useEffect(() => {
    if (!started) {
      setStarted(true);
      deliverMessage(OPENER, setLoading, (text) => setMessages([{ role: "forge", text }]));
    }
  }, []);

  const addForgeMsg = (text) => setMessages(m => [...m, { role: "forge", text }]);
  const addUserMsg = (text) => setMessages(m => [...m, { role: "user", text }]);
  const currentStep = ONBOARDING_STEPS[stepIndex];

  const processInput = async (value, rawId = null) => {
    addUserMsg(value);
    const p = { ...profile };

    if (currentStep.id === "name") {
      p.name = value; setProfile(p);
      const prompt = `The user's name is "${value}". Acknowledge their name warmly in 1 sentence. Then ask about their business idea. Keep it brief and conversational.`;
      try {
        const r = await callForgeAPI([{ role: "user", content: prompt }], FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", "Onboarding step 1."));
        await deliverMessage(r, setLoading, addForgeMsg);
      } catch {
        await deliverMessage(`${value} — good to meet you. Tell me about the idea. What are you thinking about building?`, setLoading, addForgeMsg);
      }
      setStepIndex(1);

    } else if (currentStep.id === "idea") {
      p.idea = value; setProfile(p);
      const prompt = `User is ${p.name}, idea: "${value}". React genuinely in 2-3 sentences. Acknowledge real instinct if present, be honest if it needs work. Then ask about experience.`;
      try {
        const r = await callForgeAPI([{ role: "user", content: prompt }], FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", `User: ${p.name}. Idea: ${value}.`));
        await deliverMessage(r, setLoading, addForgeMsg);
      } catch {
        await deliverMessage("How much experience do you have running a business? Be honest — there's no wrong answer.", setLoading, addForgeMsg);
      }
      setStepIndex(2);

    } else if (currentStep.id === "experience") {
      p.experience = value; setProfile(p);
      const prompt = `User: ${p.name}. Their idea: "${p.idea}". They described their experience as: "${value}".

React genuinely to what they said — acknowledge the specific details they shared, not just a category. If they mentioned relevant background that connects to their idea, call it out. Be warm but direct. 2-3 sentences max.

Then transition naturally into asking about their starting budget — frame it as the next practical thing you need to know. Keep it conversational, not form-like.`;
      try {
        const r = await callForgeAPI([{ role: "user", content: prompt }], FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", `User: ${p.name}. Idea: ${p.idea}. Experience: ${value}.`));
        await deliverMessage(r, setLoading, addForgeMsg);
      } catch {
        await deliverMessage("Good to know — that context helps a lot. Now let's talk money. What's your rough starting budget?", setLoading, addForgeMsg);
      }
      setStepIndex(3);

    } else if (currentStep.id === "budget") {
      const card = BUDGET_CARDS.find(c => c.id === rawId);
      p.budget = card?.label || value; p.budgetAmount = card?.amount || 5000; setProfile(p);
      const prompt = `User's budget: "${p.budget}". Acknowledge honestly in 1-2 sentences. Then transition to asking how they want to build — tell them this last question shapes everything.`;
      try {
        const r = await callForgeAPI([{ role: "user", content: prompt }], FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", `User: ${p.name}. Budget: ${p.budget}.`));
        await deliverMessage(r, setLoading, addForgeMsg);
      } catch {
        await deliverMessage("Last one — and this one matters. How do you want to build?", setLoading, addForgeMsg);
      }
      setStepIndex(4);

    } else if (currentStep.id === "strategy") {
      const card = STRATEGY_CARDS.find(c => c.id === rawId);
      p.strategy = rawId || value;
      p.strategyLabel = `${card?.icon || ""} ${card?.label || value}`.trim();
      setProfile(p);

      const context = `User: ${p.name} | Idea: ${p.idea} | Experience: ${p.experience} | Budget: ${p.budget} | Strategy: ${p.strategyLabel}`;
      const prompt = `Onboarding complete. Give a personalized opening assessment in 3-4 short paragraphs. Reference their specific idea, budget, experience, and strategy mode by name. Use **bold** for key words. Be direct. Call out genuine instinct if you see it. Tell them which stage we start in and why. End with just the word "Ready?" on its own line — nothing after it.`;

      try {
        const r = await callForgeAPI([{ role: "user", content: prompt }], FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", context));
        await deliverMessage(r, setLoading, addForgeMsg);
      } catch {
        await deliverMessage(`Alright ${p.name} — we have everything we need. Let's build something real.\n\nReady?`, setLoading, addForgeMsg);
      }

      setStepIndex(5);

      // Store the completed profile but DO NOT auto-advance.
      // The "Enter Foundry →" button will appear and the user clicks when ready.
      setCompletedProfile({
        ...p,
        businessName: "",
        currentStage: 1,
        budget: {
          total: p.budgetAmount,
          spent: 0,
          remaining: p.budgetAmount,
          runway: "calculating...",
          income: [{ source: p.budget, amount: p.budgetAmount }],
          expenses: [],
        },
        decisions: [],
      });
      setReadyToEnter(true);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    const val = input.trim(); setInput("");
    await processInput(val);
  };

  const handleCard = async (cardId) => {
    if (loading) return;
    setCardSelection(cardId);
    const label =
      currentStep.id === "experience" ? EXPERIENCE_CARDS.find(c => c.id === cardId)?.label || cardId
      : currentStep.id === "budget" ? BUDGET_CARDS.find(c => c.id === cardId)?.label || cardId
      : STRATEGY_CARDS.find(c => c.id === cardId)?.label || cardId;
    setTimeout(() => { setCardSelection(null); processInput(label, cardId); }, 350);
  };

  const showCards = currentStep?.cards && !loading && !readyToEnter;
  const showInput = !currentStep?.cards && stepIndex < 5 && !readyToEnter;

  return (
    <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🔥</span>
          <span style={{ fontSize: 18, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700 }}>Foundry</span>
        </div>
        {stepIndex > 0 && (
          <div style={{ display: "flex", gap: 6 }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{ width: i < stepIndex ? 20 : 6, height: 6, borderRadius: 3, background: i < stepIndex ? "linear-gradient(90deg, #E8622A, #F5A843)" : "rgba(255,255,255,0.12)", transition: "all 0.4s ease" }} />
            ))}
          </div>
        )}
      </div>

      {/* Message list */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "20px 16px 140px", display: "flex", flexDirection: "column", gap: 20, maxWidth: 680, width: "100%", margin: "0 auto" }}>
        {messages.map((msg, i) => (
          <MessageBubble key={msg.id || i} msg={msg} />
        ))}

        {loading && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <ForgeAvatar size={32} />
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px 16px 16px 16px", padding: "4px 12px" }}>
              <TypingDots />
            </div>
          </div>
        )}

        {/* Card selection options */}
        {showCards && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: 42, animation: "fadeSlideUp 0.5s ease" }}>
            {currentStep.id === "experience" && EXPERIENCE_CARDS.map(card => (
              <button key={card.id} onClick={() => handleCard(card.id)} style={{ background: cardSelection === card.id ? "rgba(232,98,42,0.15)" : "rgba(255,255,255,0.02)", border: cardSelection === card.id ? "1px solid rgba(232,98,42,0.6)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{card.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 2 }}>{card.label}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{card.sub}</div>
                  </div>
                </div>
              </button>
            ))}
            {currentStep.id === "budget" && BUDGET_CARDS.map(card => (
              <button key={card.id} onClick={() => handleCard(card.id)} style={{ background: cardSelection === card.id ? "rgba(232,98,42,0.15)" : "rgba(255,255,255,0.02)", border: cardSelection === card.id ? "1px solid rgba(232,98,42,0.6)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{card.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 2 }}>{card.label}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{card.sub}</div>
                  </div>
                </div>
              </button>
            ))}
            {currentStep.id === "strategy" && STRATEGY_CARDS.map(card => (
              <button key={card.id} onClick={() => handleCard(card.id)} style={{ background: cardSelection === card.id ? "rgba(232,98,42,0.15)" : "rgba(255,255,255,0.02)", border: cardSelection === card.id ? "1px solid rgba(232,98,42,0.6)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "18px 20px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ fontSize: 24, marginTop: 2 }}>{card.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 6 }}>{card.label}</div>
                    <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>{card.desc}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Enter Foundry button — appears after final assessment, user reads at own pace then clicks */}
        {readyToEnter && completedProfile && (
          <div style={{ marginLeft: 42, animation: "fadeSlideUp 0.6s ease 0.4s both", opacity: 0 }}>
            <button
              onClick={() => onComplete(completedProfile)}
              style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, cursor: "pointer", boxShadow: "0 8px 32px rgba(232,98,42,0.35)", transition: "all 0.2s ease" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(232,98,42,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(232,98,42,0.35)"; }}
            >
              Enter Foundry →
            </button>
          </div>
        )}

      </div>

      {/* Text input — hidden on card steps and after strategy */}
      {showInput && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px 16px max(24px, calc(12px + env(safe-area-inset-bottom)))", background: "linear-gradient(to top, rgba(8,8,9,1) 60%, transparent)", zIndex: 20 }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <ChatInput
              value={input}
              onChange={e => setInput(e.target.value)}
              onSend={handleSubmit}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              loading={loading}
              placeholder={stepIndex === 0 ? "Type your name..." : stepIndex === 1 ? "Tell me about your idea..." : stepIndex === 2 ? "Tell Forge about your background..." : "Type your response..."}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HUB SLIDE PANEL
// ─────────────────────────────────────────────────────────────
function HubPanel({ profile, currentStage, completedByStage, open, onClose }) {
  return (
    <>
      {open && (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }} />
      )}
      <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 280, zIndex: 40, background: "#0E0E10", borderRight: "1px solid rgba(255,255,255,0.08)", transform: open ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>🔥</span>
              <span style={{ fontSize: 15, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>Hub</span>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 6, padding: "6px 12px", color: "#666", fontSize: 11, cursor: "pointer", minWidth: 36, minHeight: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
          <div style={{ fontSize: 16, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, color: "#F0EDE8", lineHeight: 1.2 }}>
            {profile.businessName || (profile.idea?.slice(0, 28) + "...") || "Your Business"}
          </div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{profile.strategyLabel}</div>
        </div>
        {/* Budget */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Budget</div>
          <div style={{ fontSize: 22, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#4CAF8A" }}>${(profile.budget?.remaining || 0).toLocaleString()}</div>
          <div style={{ fontSize: 10, color: "#555", marginBottom: 8 }}>remaining of ${(profile.budget?.total || 0).toLocaleString()}</div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${profile.budget?.total ? (profile.budget.remaining / profile.budget.total) * 100 : 0}%`, background: "linear-gradient(90deg, #4CAF8A, #48BB78)", borderRadius: 2 }} />
          </div>
        </div>
        {/* Journey */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Journey</div>
          <div style={{ display: "flex", gap: 4 }}>
            {STAGES_DATA.map(s => (
              <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: s.id < currentStage ? "linear-gradient(90deg, #E8622A, #F5A843)" : s.id === currentStage ? "rgba(232,98,42,0.4)" : "rgba(255,255,255,0.06)" }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#888", fontFamily: "'Lora', Georgia, serif", marginTop: 8 }}>Stage {currentStage} — {STAGES_DATA[currentStage - 1]?.label}</div>
        </div>
        {/* Recent decisions */}
        {profile.decisions?.length > 0 && (
          <div style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Recent Decisions</div>
            {profile.decisions.slice(0, 3).map((d, i) => (
              <div key={i} style={{ fontSize: 11, color: "#777", padding: "5px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none", lineHeight: 1.4 }}>
                — {typeof d === "string" ? d : d.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// HUB SCREEN
// ─────────────────────────────────────────────────────────────
function HubScreen({ profile, onUpdateProfile, onEnterStage, onOpenForge, completedByStage, onReset }) {
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [decisionText, setDecisionText] = useState("");
  const [decisionTag, setDecisionTag] = useState("Strategy");
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");

  useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

  const addDecision = () => {
    if (!decisionText.trim()) return;
    onUpdateProfile({ decisions: [{ text: decisionText.trim(), tag: decisionTag, date: "Today" }, ...(profile.decisions || [])] });
    setDecisionText(""); setShowDecisionModal(false);
  };

  const addExpense = () => {
    if (!expenseLabel.trim() || !expenseAmount) return;
    const amount = parseFloat(expenseAmount);
    onUpdateProfile({
      budget: {
        ...profile.budget,
        expenses: [{ label: expenseLabel.trim(), amount, date: "Today" }, ...(profile.budget.expenses || [])],
        spent: (profile.budget.spent || 0) + amount,
        remaining: profile.budget.remaining - amount,
      }
    });
    setExpenseLabel(""); setExpenseAmount(""); setShowExpenseModal(false);
  };

  const spentPct = profile.budget?.total ? Math.min(((profile.budget.spent || 0) / profile.budget.total) * 100, 100) : 0;
  const stageData = STAGES_DATA[profile.currentStage - 1];

  return (
    <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at 15% 0%, rgba(232,98,42,0.05) 0%, transparent 55%)" }} />

      {/* Sticky top nav */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, padding: "max(13px, calc(8px + env(safe-area-inset-top))) 16px 13px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(8,8,9,0.92)", backdropFilter: "blur(20px)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🔥</span>
          <span style={{ fontSize: 18, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700 }}>Foundry</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 11, color: "#E8622A", background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.2)", borderRadius: 20, padding: "3px 10px", fontWeight: 500 }}>{profile.strategyLabel}</div>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg, #2A2A2C, #1A1A1C)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>{profile.name?.[0]}</div>
          {onReset && (
            <button onClick={() => { if (window.confirm("Reset all Foundry data? This cannot be undone.")) onReset(); }} style={{ background: "transparent", border: "none", color: "#333", fontSize: 11, cursor: "pointer", padding: "2px 4px", borderRadius: 4 }} title="Reset app">↺</button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", WebkitOverflowScrolling: "touch", padding: "20px 16px calc(100px + env(safe-area-inset-bottom))", opacity: mounted ? 1 : 0, transition: "opacity 0.5s ease" }}>

        {/* Business name hero */}
        <div style={{ marginBottom: 24, animation: "fadeSlideUp 0.5s ease 0.1s both" }}>
          <div style={{ fontSize: 11, color: "#555", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Your Business</div>
          <h1 style={{ fontSize: "clamp(24px, 6vw, 44px)", fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, color: "#F0EDE8", letterSpacing: "-1.5px", lineHeight: 1.05, marginBottom: 8 }}>
            {profile.businessName || profile.idea?.slice(0, 40) || "Your Business"}
          </h1>
          <div style={{ fontSize: 12, color: "#666" }}>{profile.industry || "Early Stage"} · Stage {profile.currentStage} of 6 — {stageData?.label}</div>
        </div>

        {/* Forge Today card */}
        <div
          onClick={onOpenForge}
          style={{ background: "linear-gradient(135deg, rgba(232,98,42,0.12), rgba(232,98,42,0.04))", border: "1px solid rgba(232,98,42,0.25)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, cursor: "pointer", transition: "all 0.2s", animation: "fadeSlideUp 0.5s ease 0.15s both" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(232,98,42,0.45)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(232,98,42,0.25)"; }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <ForgeAvatar size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: "#E8622A", fontWeight: 600, letterSpacing: "0.05em" }}>FORGE · TODAY'S FOCUS</div>
                <div style={{ fontSize: 11, color: "#555" }}>Tap to chat →</div>
              </div>
              <div style={{ fontSize: 14, fontFamily: "'Lora', Georgia, serif", color: "#D8D4CE", lineHeight: 1.65 }}>
                {profile.currentStage === 1
                  ? "Validate before you build. Find 3 real potential customers this week and have actual conversations — not surveys. One real signal is worth more than a hundred assumptions."
                  : `You're in Stage ${profile.currentStage}: ${stageData?.label}. ${stageData?.mission}.`}
              </div>
            </div>
          </div>
        </div>

        {/* The Journey */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, animation: "fadeSlideUp 0.5s ease 0.2s both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>The Journey</div>
            <div style={{ fontSize: 11, color: "#555" }}>Stage {profile.currentStage} of 6</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {STAGES_DATA.map(stage => {
              const isComplete = stage.id < profile.currentStage;
              const isCurrent = stage.id === profile.currentStage;
              const isLocked = stage.id > profile.currentStage;
              return (
                <div key={stage.id} onClick={() => !isLocked && onEnterStage(stage.id)} style={{ flex: 1, textAlign: "center", cursor: isLocked ? "default" : "pointer", opacity: isLocked ? 0.35 : 1 }}>
                  <div style={{ width: "100%", aspectRatio: "1", maxWidth: 44, margin: "0 auto 5px", borderRadius: 10, fontSize: 16, background: isComplete ? "linear-gradient(135deg, #E8622A, #c9521e)" : isCurrent ? "rgba(232,98,42,0.15)" : "rgba(255,255,255,0.03)", border: isCurrent ? "1px solid rgba(232,98,42,0.5)" : "none", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                    {isComplete ? "✓" : stage.icon}
                  </div>
                  <div style={{ fontSize: 9, color: isCurrent ? "#E8622A" : isComplete ? "#666" : "#333", fontWeight: isCurrent ? 600 : 400, textTransform: "uppercase", letterSpacing: "0.05em" }}>{stage.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${((profile.currentStage - 1) / 5) * 100}%`, background: "linear-gradient(90deg, #E8622A, #F5A843)", borderRadius: 2, transition: "width 1s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <div style={{ fontSize: 11, color: "#555" }}>{Math.round(((profile.currentStage - 1) / 5) * 100)}% complete</div>
            <div onClick={() => onEnterStage(profile.currentStage)} style={{ fontSize: 11, color: "#E8622A", cursor: "pointer" }}>Continue Stage {profile.currentStage} →</div>
          </div>
        </div>

        {/* Budget */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 14, animation: "fadeSlideUp 0.5s ease 0.25s both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Budget</div>
            <button onClick={() => setShowExpenseModal(true)} style={{ background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.25)", borderRadius: 8, padding: "4px 12px", color: "#E8622A", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>+ Expense</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Total", value: `$${(profile.budget?.total || 0).toLocaleString()}`, color: "#F0EDE8" },
              { label: "Spent", value: `$${(profile.budget?.spent || 0).toLocaleString()}`, color: "#E8622A" },
              { label: "Remaining", value: `$${(profile.budget?.remaining || 0).toLocaleString()}`, color: "#4CAF8A" },
            ].map(item => (
              <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "clamp(14px, 4vw, 20px)", fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: item.color, lineHeight: 1, marginBottom: 3 }}>{item.value}</div>
                <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${spentPct}%`, background: spentPct > 75 ? "linear-gradient(90deg, #E85A2A, #FF4444)" : "linear-gradient(90deg, #E8622A, #F5A843)", borderRadius: 3, transition: "width 1s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <div style={{ fontSize: 10, color: "#555" }}>{spentPct.toFixed(0)}% spent</div>
            <div style={{ fontSize: 10, color: "#555" }}>Runway: {profile.budget?.runway || "TBD"}</div>
          </div>
          {profile.budget?.expenses?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Recent Expenses</div>
              {profile.budget.expenses.slice(0, 4).map((exp, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <div style={{ fontSize: 12, color: "#888" }}>{exp.label}</div>
                  <div style={{ fontSize: 12, color: "#E8622A", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>-${exp.amount?.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Glossary learned */}
        {(profile.glossaryLearned || []).length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, animation: "fadeSlideUp 0.5s ease 0.32s both" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>📚 Your Glossary</div>
              <div style={{ fontSize: 11, color: "#4CAF8A" }}>{(profile.glossaryLearned || []).length} terms learned</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(profile.glossaryLearned || []).map((item, i) => {
                const entry = GLOSSARY[item.term];
                const color = STAGE_COLORS[item.stage] || "#E8622A";
                return (
                  <div key={i} style={{ fontSize: 11, color, background: `${color}12`, border: `1px solid ${color}25`, borderRadius: 20, padding: "3px 10px", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                    {item.term}
                  </div>
                );
              })}
            </div>
            {(profile.glossaryLearned || []).length >= 5 && (
              <div style={{ fontSize: 11, color: "#555", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", marginTop: 10 }}>
                You're building real business literacy. Keep going.
              </div>
            )}
          </div>
        )}

        {/* Decisions */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", animation: "fadeSlideUp 0.5s ease 0.3s both" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Decisions</div>
            <button onClick={() => setShowDecisionModal(true)} style={{ background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.25)", borderRadius: 8, padding: "4px 12px", color: "#E8622A", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>+ Log Decision</button>
          </div>
          {(!profile.decisions || profile.decisions.length === 0) ? (
            <div style={{ fontSize: 13, color: "#444", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>No decisions logged yet. Every call you make deliberately is worth recording.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {profile.decisions.slice(0, 4).map((d, i) => {
                const dec = typeof d === "string" ? { text: d, tag: "Strategy", date: "Recent" } : d;
                return (
                  <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ fontSize: 12, color: "#C8C4BE", lineHeight: 1.5, flex: 1 }}>{dec.text}</div>
                      {dec.tag && <div style={{ fontSize: 10, color: TAG_COLORS[dec.tag]?.text || "#888", background: TAG_COLORS[dec.tag]?.bg || "rgba(255,255,255,0.06)", borderRadius: 20, padding: "2px 8px", flexShrink: 0 }}>{dec.tag}</div>}
                    </div>
                    <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>{dec.date}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Floating Forge FAB */}
      <button
        onClick={onOpenForge}
        style={{ position: "fixed", bottom: "max(28px, calc(16px + env(safe-area-inset-bottom)))", right: 20, zIndex: 20, width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", fontSize: 22, boxShadow: "0 8px 32px rgba(232,98,42,0.45)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
      >🔥</button>

      {/* Decision modal */}
      {showDecisionModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }} onClick={() => setShowDecisionModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 22, animation: "fadeSlideUp 0.3s ease" }}>
            <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 16 }}>Log a Decision</div>
            <textarea value={decisionText} onChange={e => setDecisionText(e.target.value)} placeholder="What did you decide and why?" rows={3} autoFocus style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {Object.keys(TAG_COLORS).map(t => (
                <button key={t} onClick={() => setDecisionTag(t)} style={{ padding: "4px 12px", borderRadius: 20, border: decisionTag === t ? "1px solid rgba(232,98,42,0.6)" : "1px solid rgba(255,255,255,0.1)", background: decisionTag === t ? "rgba(232,98,42,0.12)" : "transparent", color: decisionTag === t ? "#E8622A" : "#666", fontSize: 11, cursor: "pointer" }}>{t}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowDecisionModal(false)} style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#888", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              <button onClick={addDecision} disabled={!decisionText.trim()} style={{ flex: 2, padding: "10px", background: decisionText.trim() ? "linear-gradient(135deg, #E8622A, #c9521e)" : "rgba(255,255,255,0.04)", border: "none", borderRadius: 10, color: decisionText.trim() ? "#fff" : "#555", fontSize: 12, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, cursor: decisionText.trim() ? "pointer" : "default" }}>Log Decision</button>
            </div>
          </div>
        </div>
      )}

      {/* Expense modal */}
      {showExpenseModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }} onClick={() => setShowExpenseModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 22, animation: "fadeSlideUp 0.3s ease" }}>
            <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 16 }}>Log an Expense</div>
            <input value={expenseLabel} onChange={e => setExpenseLabel(e.target.value)} placeholder="What was it for?" autoFocus style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 10, boxSizing: "border-box" }} />
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#666", fontSize: 13 }}>$</span>
              <input value={expenseAmount} onChange={e => setExpenseAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" type="number" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px 10px 26px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={() => setShowExpenseModal(false)} style={{ flex: 1, padding: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#888", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              <button onClick={addExpense} disabled={!expenseLabel.trim() || !expenseAmount} style={{ flex: 2, padding: "10px", background: expenseLabel.trim() && expenseAmount ? "linear-gradient(135deg, #E8622A, #c9521e)" : "rgba(255,255,255,0.04)", border: "none", borderRadius: 10, color: expenseLabel.trim() && expenseAmount ? "#fff" : "#555", fontSize: 12, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, cursor: expenseLabel.trim() && expenseAmount ? "pointer" : "default" }}>Add Expense</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MILESTONES PANEL — slide up from bottom inside ForgeScreen
// ─────────────────────────────────────────────────────────────
function MilestonesPanel({ stage, completedMilestones, onClose, onSwitchToChat, advanceReady, onAdvance, stageId }) {
  const completionPct = Math.round((completedMilestones.length / stage.milestones.length) * 100);
  return (
    <div style={{ position: "absolute", inset: 0, background: "#080809", zIndex: 5, display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease", overflowY: "auto" }}>
      <div style={{ padding: "18px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>
            {stage.icon} Stage {stageId} Goals
          </div>
          <div style={{ fontSize: 12, color: "#E8622A", fontWeight: 600 }}>{completionPct}% complete</div>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, position: "relative", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${completionPct}%`, background: "linear-gradient(90deg, #E8622A, #F5A843)", borderRadius: 2, transition: "width 0.6s ease", boxShadow: completionPct > 0 ? "0 0 8px rgba(232,98,42,0.4)" : "none" }} />
          {stage.milestones.map((_, i) => (
            <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${((i + 1) / stage.milestones.length) * 100}%`, width: 1, background: "rgba(0,0,0,0.4)" }} />
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>{completedMilestones.length} of {stage.milestones.length} milestones complete</div>
      </div>

      <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {stage.milestones.map((m, i) => {
            const done = completedMilestones.includes(m.id);
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 12px", background: done ? "rgba(76,175,138,0.06)" : "rgba(255,255,255,0.02)", border: done ? "1px solid rgba(76,175,138,0.2)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 10, transition: "all 0.3s ease" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, background: done ? "linear-gradient(135deg, #4CAF8A, #48BB78)" : "rgba(255,255,255,0.06)", border: done ? "none" : "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700, marginTop: 1 }}>
                  {done ? "✓" : i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", color: done ? "#555" : "#C8C4BE", textDecoration: done ? "line-through" : "none", lineHeight: 1.5 }}>{m.label}</div>
                  {!done && <div style={{ fontSize: 10, color: "#444", marginTop: 3 }}>Discuss with Forge to unlock</div>}
                </div>
              </div>
            );
          })}
        </div>

        {advanceReady && (
          <div style={{ background: "linear-gradient(135deg, rgba(76,175,138,0.15), rgba(72,187,120,0.06))", border: "1px solid rgba(76,175,138,0.35)", borderRadius: 14, padding: "16px", marginBottom: 16, animation: "fadeSlideUp 0.4s ease" }}>
            <div style={{ fontSize: 14, fontFamily: "'Lora', Georgia, serif", color: "#4CAF8A", fontWeight: 600, marginBottom: 6 }}>✓ Forge says you're ready to advance</div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>All Stage {stageId} work is done.{STAGES_DATA[stageId] ? ` Stage ${stageId + 1} — ${STAGES_DATA[stageId].label} — awaits.` : " You've completed all stages."}</div>
            {STAGES_DATA[stageId] && (
              <button onClick={() => onAdvance(stageId + 1)} style={{ width: "100%", background: "linear-gradient(135deg, #4CAF8A, #48BB78)", border: "none", borderRadius: 10, padding: "11px", color: "#fff", fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, cursor: "pointer" }}>
                Advance to Stage {stageId + 1} — {STAGES_DATA[stageId].label} →
              </button>
            )}
          </div>
        )}

        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Key Frameworks</div>
          {stage.frameworks.map((f, i) => <div key={i} style={{ fontSize: 12, color: "#888", fontFamily: "'Lora', Georgia, serif", padding: "3px 0" }}>· {f}</div>)}
        </div>
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Inner Circle</div>
          {stage.innerCircle.map((ref, i) => <div key={i} style={{ fontSize: 12, color: "#888", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", padding: "3px 0" }}>{ref}</div>)}
        </div>

        <button onClick={onSwitchToChat} style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, cursor: "pointer" }}>
          Continue with Forge →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// STAGE BRIEFING — shown first time entering a stage
// ─────────────────────────────────────────────────────────────
function StageBriefing({ stage, stageId, onStart }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "28px 20px", overflowY: "auto", animation: "fadeIn 0.4s ease" }}>
      <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 44, marginBottom: 14 }}>{stage.icon}</div>
        <div style={{ fontSize: 11, color: "#E8622A", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 10 }}>Stage {stageId} of 6</div>
        <h2 style={{ fontSize: 26, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, color: "#F0EDE8", letterSpacing: "-0.5px", lineHeight: 1.2, marginBottom: 10 }}>{stage.label}</h2>
        <div style={{ fontSize: 13, color: "#E8622A", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", marginBottom: 20 }}>"{stage.mission}"</div>
        <div style={{ textAlign: "left", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px", marginBottom: 18 }}>
          {stage.briefing.split("\n\n").map((para, i) => (
            <p key={i} style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", color: "#C8C4BE", lineHeight: 1.75, marginBottom: i < stage.briefing.split("\n\n").length - 1 ? 12 : 0 }}>{para}</p>
          ))}
        </div>
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px", marginBottom: 22, textAlign: "left" }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Inner Circle for this stage</div>
          {stage.innerCircle.map((ref, i) => (
            <div key={i} style={{ fontSize: 12, color: "#888", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", padding: "4px 0", borderBottom: i < stage.innerCircle.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>{ref}</div>
          ))}
        </div>
        <button onClick={onStart} style={{ width: "100%", padding: "15px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, cursor: "pointer", boxShadow: "0 8px 32px rgba(232,98,42,0.3)" }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          Start Stage {stageId} with Forge →
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FORGE SCREEN — unified, stage-aware, shared chat state
// ─────────────────────────────────────────────────────────────
function ForgeScreen({ profile, onBack, onUpdateProfile, completedByStage, onMilestoneComplete, onAdvance, messagesByStage, onUpdateMessages, isFirstVisit = false, initialStage = null }) {
  const [activeStage, setActiveStage] = useState(initialStage || profile.currentStage);
  const [activeTab, setActiveTab] = useState("chat");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [advanceReady, setAdvanceReady] = useState(false);
  const [showStageSelector, setShowStageSelector] = useState(false);
  const [stageRefModal, setStageRefModal] = useState(null); // stageId to show in overlay
  const [glossaryModal, setGlossaryModal] = useState(null); // { term, entry }

  const stage = STAGES_DATA[activeStage - 1];
  const messages = messagesByStage[activeStage] || [];
  const completedMilestones = completedByStage[activeStage] || [];
  const completionPct = Math.round((completedMilestones.length / stage.milestones.length) * 100);

  const setMessages = (updater) => {
    const current = messagesByStage[activeStage] || [];
    const next = typeof updater === "function" ? updater(current) : updater;
    onUpdateMessages(activeStage, next);
  };

  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 120) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // When switching stages, reset tab to chat
  useEffect(() => { setActiveTab("chat"); setAdvanceReady(false); }, [activeStage]);

  // Greeting — fires when messages are empty for the active stage
  useEffect(() => {
    const stageMessages = messagesByStage[activeStage] || [];
    if (stageMessages.length > 0) return; // already has history — don't greet again

    const stageData = STAGES_DATA[activeStage - 1];
    const lastSeenRaw = localStorage.getItem("foundry_last_seen");
    const lastSeen = lastSeenRaw ? parseInt(lastSeenRaw) : null;
    const hoursSince = lastSeen ? (Date.now() - lastSeen) / 1000 / 60 / 60 : null;
    const isLongAbsence = !lastSeen || hoursSince > 8;
    localStorage.setItem("foundry_last_seen", Date.now().toString());

    const runGreeting = async () => {
      const ctx = await buildRichContext(profile, activeStage, completedByStage, messagesByStage);
      let greetingPrompt = "";

      if (isFirstVisit && activeStage === 1) {
        greetingPrompt = `The user just finished onboarding. Name: ${profile.name}, idea: "${profile.idea}", experience: "${profile.experience}", budget: $${profile.budget?.total?.toLocaleString() || "unknown"}, strategy: ${profile.strategyLabel}. Open with a warm, direct, personal greeting referencing something specific about their idea. Then ask one sharp question that kicks off Stage 1 — about the real problem they're solving and whether actual people have it. Use **bold** on 2-3 key words.`;
      } else if (isLongAbsence) {
        const hoursText = hoursSince ? `about ${Math.round(hoursSince)} hours` : "a while";
        greetingPrompt = `${profile.name} is returning to Stage ${activeStage}: ${stageData.label} after ${hoursText} away. Welcome back warmly but briefly. Reference their stage and context. Introduce one topic worth discussing — a learning opportunity or forward-moving question. 3-4 paragraphs max. Use **bold** on 2-3 key words.`;
      } else {
        greetingPrompt = `${profile.name} just opened Stage ${activeStage}: ${stageData.label}. Give the stage opener — introduce the mission and what we're doing in this stage. Then ask the first sharp question to get started. Reference the stage's core framework or a key founder. Use **bold** on 2-3 key words.`;
      }

      setLoading(true);
      try {
        const reply = await callForgeAPI([{ role: "user", content: greetingPrompt }], FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", ctx));
        onUpdateMessages(activeStage, [{ role: "forge", text: reply }]);
      } catch {
        const fallback = isFirstVisit && activeStage === 1
          ? `${profile.name} — welcome to Foundry.\n\nStage 1 is where we find out if the problem you're solving is real enough that people will pay for it. That's the most important question in business.\n\nWho, specifically, has the problem you're solving?`
          : `${profile.name} — Stage ${activeStage}: ${stageData.label}.\n\n${stageData.mission}\n\nWhere do you want to start?`;
        onUpdateMessages(activeStage, [{ role: "forge", text: fallback }]);
      }
      setLoading(false);
    };

    setTimeout(runGreeting, 400);
  }, [activeStage]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim(); setInput("");
    const userMsg = { role: "user", text };
    const forgeMsg = { role: "forge", text: "", id: Date.now() };
    const current = messagesByStage[activeStage] || [];
    onUpdateMessages(activeStage, [...current, userMsg]);
    setLoading(true);
    await new Promise(r => setTimeout(r, 300));
    onUpdateMessages(activeStage, [...current, userMsg, forgeMsg]);
    try {
      const allMsgs = [...current, userMsg];
      const apiMsgs = allMsgs.map(m => ({ role: m.role === "forge" ? "assistant" : "user", content: m.text }));
      const ctx = await buildRichContext(profile, activeStage, completedByStage, messagesByStage);
      const raw = await streamForgeAPI(apiMsgs, FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", ctx), (chunk) => {
        onUpdateMessages(activeStage, msgs => msgs.map(m => m.id === forgeMsg.id ? { ...m, text: chunk } : m));
      });
      const { cleanText, completedIds, advanceReady: ar } = parseForgeResponse(raw);
      onUpdateMessages(activeStage, msgs => msgs.map(m => m.id === forgeMsg.id ? { ...m, text: cleanText } : m));
      completedIds.forEach(id => onMilestoneComplete(id));
      if (ar) setAdvanceReady(true);
    } catch (err) {
      console.error("Forge error:", err);
      onUpdateMessages(activeStage, msgs => msgs.map(m => m.id === forgeMsg.id ? { ...m, text: `Error: ${err.message}` } : m));
    }
    setLoading(false);
  };

  const handleAdvance = (newStage) => {
    onAdvance(newStage);
    setActiveStage(newStage);
    setAdvanceReady(false);
  };

  const showBriefing = messages.length === 0 && !loading;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#080809", display: "flex", flexDirection: "column", fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8", zIndex: 20 }}>
      <HubPanel profile={profile} currentStage={profile.currentStage} completedByStage={completedByStage} open={hubOpen} onClose={() => setHubOpen(false)} />

      {/* Header */}
      <div style={{ padding: "max(11px, calc(6px + env(safe-area-inset-top))) 12px 11px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(8,8,9,0.95)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

        {/* Left — Hub + snapshot */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 12px", color: "#F0EDE8", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            🔥 Hub
          </button>
          <button onClick={() => setHubOpen(true)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "5px 8px", color: "#666", fontSize: 12, cursor: "pointer" }}>☰</button>
        </div>

        {/* Center — stage selector */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <button onClick={() => setShowStageSelector(s => !s)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 7, padding: "4px 10px", borderRadius: 8, transition: "background 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <span style={{ fontSize: 15 }}>{stage.icon}</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", lineHeight: 1.2 }}>Stage {activeStage} — {stage.label}</div>
              <div style={{ fontSize: 10, color: "#4CAF8A" }}>● Active · {completionPct}% complete</div>
            </div>
            <span style={{ fontSize: 10, color: "#555", marginLeft: 2 }}>▾</span>
          </button>

          {/* Stage selector dropdown */}
          {showStageSelector && (
            <>
              <div onClick={() => setShowStageSelector(false)} style={{ position: "fixed", inset: 0, zIndex: 10 }} />
              <div style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", zIndex: 20, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 6, minWidth: 220, boxShadow: "0 16px 48px rgba(0,0,0,0.6)", animation: "fadeSlideUp 0.2s ease" }}>
                {STAGES_DATA.map(s => {
                  const locked = s.id > profile.currentStage;
                  const pct = Math.round(((completedByStage[s.id] || []).length / s.milestones.length) * 100);
                  return (
                    <button key={s.id} onClick={() => { if (!locked) { setActiveStage(s.id); setShowStageSelector(false); } }} disabled={locked}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, border: "none", background: s.id === activeStage ? "rgba(232,98,42,0.12)" : "transparent", cursor: locked ? "default" : "pointer", opacity: locked ? 0.35 : 1, transition: "background 0.15s" }}
                      onMouseEnter={e => { if (!locked) e.currentTarget.style.background = s.id === activeStage ? "rgba(232,98,42,0.15)" : "rgba(255,255,255,0.05)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = s.id === activeStage ? "rgba(232,98,42,0.12)" : "transparent"; }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontSize: 12, fontFamily: "'Lora', Georgia, serif", color: s.id === activeStage ? "#E8622A" : "#C8C4BE", fontWeight: s.id === activeStage ? 600 : 400 }}>Stage {s.id} — {s.label}</div>
                        {!locked && <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>{pct}% complete</div>}
                        {locked && <div style={{ fontSize: 10, color: "#444", marginTop: 1 }}>Locked</div>}
                      </div>
                      {s.id === activeStage && <span style={{ fontSize: 10, color: "#E8622A" }}>●</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Right — Chat / Goals tabs */}
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 3, flexShrink: 0 }}>
          {[
            { id: "chat", label: "Chat" },
            { id: "milestones", label: `Goals ${completedMilestones.length}/${stage.milestones.length}` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: activeTab === tab.id ? "linear-gradient(135deg, #E8622A, #c9521e)" : "transparent", color: activeTab === tab.id ? "#fff" : "#A8A4A0", fontSize: 11, cursor: "pointer", fontWeight: activeTab === tab.id ? 600 : 400, transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", flexShrink: 0, position: "relative" }}>
        <div style={{ height: "100%", width: `${completionPct}%`, background: "linear-gradient(90deg, #E8622A, #F5A843)", transition: "width 0.6s ease", boxShadow: completionPct > 0 ? "0 0 8px rgba(232,98,42,0.4)" : "none" }} />
        {stage.milestones.map((_, i) => (
          <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${((i + 1) / stage.milestones.length) * 100}%`, width: 1, background: "rgba(0,0,0,0.5)" }} />
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* Briefing — shown when no messages yet */}
        {showBriefing && activeTab === "chat" && (
          <StageBriefing stage={stage} stageId={activeStage} onStart={() => {
            setLoading(true);
            setTimeout(() => { setLoading(false); onUpdateMessages(activeStage, [{ role: "forge", text: stage.forgeOpener(profile.name) }]); }, 1200);
          }} />
        )}

        {/* Chat tab */}
        {activeTab === "chat" && !showBriefing && (
          <div ref={scrollRef} style={{ position: "absolute", inset: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 720, width: "100%", margin: "0 auto" }}>
            {stageRefModal !== null && (
          <StageRefModal
            stageId={stageRefModal}
            messages={messagesByStage[stageRefModal] || []}
            profile={profile}
            onClose={() => setStageRefModal(null)}
          />
        )}
        {glossaryModal && (
          <GlossaryModal
            term={glossaryModal.term}
            entry={glossaryModal.entry}
            profile={profile}
            activeStage={activeStage}
            onClose={() => setGlossaryModal(null)}
            onMarkLearned={(term, stageNum) => {
              const learned = profile.glossaryLearned || [];
              if (!learned.find(l => l.term === term)) {
                onUpdateProfile({ glossaryLearned: [...learned, { term, stage: stageNum, date: new Date().toLocaleDateString() }] });
              }
            }}
            alreadyLearned={(profile.glossaryLearned || []).some(l => l.term === glossaryModal.term)}
          />
        )}
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id || i}
            msg={msg}
            onStageRef={id => setStageRefModal(id)}
            onGlossaryTap={(term, entry) => setGlossaryModal({ term, entry })}
          />
        ))}
            {loading && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <ForgeAvatar size={30} />
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px 16px 16px 16px", padding: "4px 12px" }}><TypingDots /></div>
              </div>
            )}
            {advanceReady && (
              <div style={{ background: "linear-gradient(135deg, rgba(76,175,138,0.15), rgba(72,187,120,0.06))", border: "1px solid rgba(76,175,138,0.35)", borderRadius: 14, padding: "14px 16px", animation: "fadeSlideUp 0.4s ease" }}>
                <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", color: "#4CAF8A", fontWeight: 600, marginBottom: 4 }}>✓ Forge says you're ready to advance</div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>Stage {activeStage} work is done.{STAGES_DATA[activeStage] ? ` Stage ${activeStage + 1} — ${STAGES_DATA[activeStage].label} — is next.` : " You've completed all stages."}</div>
                {STAGES_DATA[activeStage] && (
                  <button onClick={() => handleAdvance(activeStage + 1)} style={{ width: "100%", background: "linear-gradient(135deg, #4CAF8A, #48BB78)", border: "none", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, cursor: "pointer" }}>
                    Advance to Stage {activeStage + 1} — {STAGES_DATA[activeStage].label} →
                  </button>
                )}
              </div>
            )}
            <div style={{ height: 80 }} />
          </div>
        )}

        {/* Milestones tab */}
        {activeTab === "milestones" && (
          <MilestonesPanel
            stage={stage}
            stageId={activeStage}
            completedMilestones={completedMilestones}
            advanceReady={advanceReady}
            onAdvance={handleAdvance}
            onSwitchToChat={() => setActiveTab("chat")}
            onClose={() => setActiveTab("chat")}
          />
        )}
      </div>

      {/* Input — only on chat tab when not showing briefing */}
      {activeTab === "chat" && !showBriefing && (
        <div style={{ padding: "12px 16px", paddingBottom: "max(20px, calc(12px + env(safe-area-inset-bottom)))", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(8,8,9,0.95)", maxWidth: 720, width: "100%", alignSelf: "center" }}>
          <ChatInput value={input} onChange={e => setInput(e.target.value)} onSend={send} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} loading={loading} placeholder={`Talk to Forge about Stage ${activeStage}...`} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PERSISTENCE LAYER
// ─────────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  profile: "foundry_profile",
  completedByStage: "foundry_completed",
  messagesByStage: "foundry_messages",
  screen: "foundry_screen",
};

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

// Hook: state that automatically syncs to localStorage
function usePersistedState(key, fallback) {
  const [value, setValue] = useState(() => loadFromStorage(key, fallback));

  const setPersisted = (updater) => {
    setValue(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveToStorage(key, next);
      return next;
    });
  };

  return [value, setPersisted];
}

// ─────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────
export default function FoundryApp() {
  const [profile, setProfile] = usePersistedState(STORAGE_KEYS.profile, null);
  const [completedByStage, setCompletedByStage] = usePersistedState(
    STORAGE_KEYS.completedByStage,
    { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  );
  const [messagesByStage, setMessagesByStage] = usePersistedState(
    STORAGE_KEYS.messagesByStage,
    { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  );

  // Screen is derived — if profile exists, skip intro/onboarding
  const [screen, setScreen] = useState(() => {
    const saved = loadFromStorage(STORAGE_KEYS.screen, null);
    const hasProfile = !!loadFromStorage(STORAGE_KEYS.profile, null);
    // If we have a profile, restore to hub (safe landing point on refresh)
    if (hasProfile) return saved === "forge" ? "hub" : (saved || "hub");
    return "intro";
  });

  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [initialStage, setInitialStage] = useState(null);

  // Persist screen changes (except transient ones)
  const setScreenPersisted = (s) => {
    setScreen(s);
    if (s === "hub" || s === "forge") saveToStorage(STORAGE_KEYS.screen, s);
  };

  const updateProfile = (updates) => {
    setProfile(p => ({ ...p, ...updates }));
  };

  const handleMilestoneComplete = (milestoneId) => {
    const stageNum =
      milestoneId.startsWith("idea") ? 1
      : milestoneId.startsWith("plan") ? 2
      : milestoneId.startsWith("legal") ? 3
      : milestoneId.startsWith("finance") ? 4
      : milestoneId.startsWith("launch") ? 5
      : 6;
    setCompletedByStage(prev => ({
      ...prev,
      [stageNum]: [...new Set([...prev[stageNum], milestoneId])],
    }));
  };

  const handleUpdateMessages = (stageId, updater) => {
    setMessagesByStage(prev => ({
      ...prev,
      [stageId]: typeof updater === "function" ? updater(prev[stageId] || []) : updater,
    }));
  };

  const handleAdvance = (newStage) => {
    updateProfile({ currentStage: newStage });
    setInitialStage(newStage);
  };

  const openForge = (stageId = null) => {
    setInitialStage(stageId);
    setIsFirstVisit(false);
    setScreenPersisted("forge");
  };

  // Clear all saved data (for testing/reset)
  const handleReset = () => {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem("foundry_last_seen");
    window.location.reload();
  };

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ background: "#080809", minHeight: "100vh", minHeight: "-webkit-fill-available" }}>
        {screen === "intro" && (
          <CinematicIntro onComplete={() => setScreen("onboarding")} />
        )}
        {screen === "onboarding" && (
          <OnboardingScreen onComplete={p => {
            setProfile(p);
            setIsFirstVisit(true);
            setInitialStage(1);
            setScreenPersisted("forge");
          }} />
        )}
        {screen === "hub" && profile && (
          <HubScreen
            profile={profile}
            onUpdateProfile={updateProfile}
            onEnterStage={id => openForge(id)}
            onOpenForge={() => openForge(null)}
            completedByStage={completedByStage}
            onReset={handleReset}
          />
        )}
        {screen === "forge" && profile && (
          <ForgeScreen
            key="forge"
            profile={profile}
            onBack={() => { setIsFirstVisit(false); setInitialStage(null); setScreenPersisted("hub"); }}
            onUpdateProfile={updateProfile}
            completedByStage={completedByStage}
            onMilestoneComplete={handleMilestoneComplete}
            onAdvance={handleAdvance}
            messagesByStage={messagesByStage}
            onUpdateMessages={handleUpdateMessages}
            isFirstVisit={isFirstVisit}
            initialStage={initialStage}
          />
        )}
      </div>
    </>
  );
}

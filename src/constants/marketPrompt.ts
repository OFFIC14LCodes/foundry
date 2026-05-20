// ─────────────────────────────────────────────────────────────
// MARKET INTELLIGENCE PROMPTS
// Used only for market report generation.
// Does NOT modify FORGE_SYSTEM_PROMPT or book retrieval behavior.
// ─────────────────────────────────────────────────────────────

export type FounderProfile = {
    industry?: string | null;
    idea?: string | null;
    businessName?: string | null;
    currentStage?: number | null;
    strategyLabel?: string | null;
};

export type SearchResult = {
    query: string;
    sources: Array<{
        title: string;
        url: string;
        snippet: string;
        publishedDate?: string | null;
    }>;
};

const COMMON_IDEA_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "business",
    "by",
    "company",
    "for",
    "from",
    "help",
    "helps",
    "in",
    "into",
    "is",
    "of",
    "on",
    "or",
    "platform",
    "product",
    "service",
    "startup",
    "that",
    "the",
    "to",
    "tool",
    "with",
]);

export function extractKeyword(idea: string): string {
    const fallback = "business";
    const word = idea
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map((part) => part.trim())
        .find((part) => part.length > 1 && !COMMON_IDEA_WORDS.has(part));

    return word || fallback;
}

export function buildSearchQueries(profile: FounderProfile): string[] {
    const industry = (profile.industry || "general business").trim();
    const idea = (profile.idea || profile.businessName || "business").trim();
    const keyword = extractKeyword(idea);
    const year = new Date().getFullYear();

    return [
        `${industry} market trends ${year}`,
        `${industry} startup competitive landscape`,
        `${industry} funding investment news recent`,
        `${industry} ${keyword} business model`,
        `top competitors ${industry} market share`,
    ];
}

export function buildMarketReportPrompt(profile: FounderProfile, searchResults?: SearchResult[]): string {
    const industry = profile.industry || "general business";
    const idea = profile.idea || "their venture";
    const businessName = profile.businessName || null;
    const stage = profile.currentStage || 1;
    const strategy = profile.strategyLabel || "Balanced";
    const currentDate = new Date().toLocaleDateString(
        "en-US",
        { weekday: "long", year: "numeric", month: "long", day: "numeric" },
    );

    const stageLabels = ["Idea Validation", "Business Planning", "Legal Structure", "Financial Foundation", "Launch", "Growth"];
    const stageLabel = stageLabels[stage - 1] || "Early Stage";

    const hasLiveResearch = Boolean(
        searchResults?.some((result) => result.sources.length > 0),
    );

    const liveResearchBlock = hasLiveResearch
        ? `
LIVE RESEARCH:
The following information was retrieved from live web sources in the past hour. Use it to ground your analysis in current reality. Cite specific sources inline using [Source: Publication Name](https://url.com) format when you draw on them directly. Every hyperlink must start with "Source:" — example: [Source: BetterCloud](https://bettercloud.com/...).

${searchResults!.map(result => `
Query: "${result.query}"
${result.sources.map(s => `
Source: ${s.title}
URL: ${s.url}
Date: ${s.publishedDate || "Recent"}
Content: ${s.snippet}
`).join("\n")}
`).join("\n")}
`
        : `
Note: Live search was unavailable for this report. This briefing is based on training data synthesis.
`;

    const taskInstruction = hasLiveResearch
        ? `Today is ${currentDate}. Write in present tense appropriate for this date. Do not use phrases like "as we enter 2026" or "in 2026" — we are already in 2026. Reference the current moment accurately.

Generate a focused market intelligence briefing that is directly relevant to this specific industry and business context. When live research is provided above, prioritize it over your training data for specific facts, company names, recent events, and market conditions. Cite sources inline using [Source: Publication Name](https://url.com) format. Every hyperlink must start with "Source:" — example: [Source: BetterCloud](https://bettercloud.com/...). Every specific claim about a company, funding round, market size, or recent event must have a citation. Do not fabricate citations — if a claim is not supported by the provided research, state it as general industry knowledge without a citation.`
        : `Today is ${currentDate}. Write in present tense appropriate for this date. Do not use phrases like "as we enter 2026" or "in 2026" — we are already in 2026. Reference the current moment accurately.

Generate a focused market intelligence briefing that is directly relevant to this specific industry and business context. Base this on your deep knowledge of the industry — its dynamics, competitive landscape, business model patterns, and strategic risks.

Note: This is a knowledge-based synthesis, not a real-time data feed. Be clear and authoritative about structural trends, competitive patterns, and strategic signals — but do not fabricate specific recent news events or invent specific company actions.`;

    return `You are a senior market intelligence analyst generating a structured daily market briefing for a founder.

FOUNDER CONTEXT:
- Industry / Market: ${industry}
- Business concept: ${idea}${businessName ? `\n- Business name: ${businessName}` : ""}
- Founder stage: ${stageLabel} (Stage ${stage} of 6)
- Operating strategy: ${strategy}
- Current date: ${currentDate}
${liveResearchBlock}

TASK:
${taskInstruction}

REQUIRED FORMAT — use exactly these section headers in markdown:

## Market Overview
2-3 sentences on the current state of this industry. Be specific to the industry — no generic statements.

## Key Trends
3-4 bullets on the most important trends reshaping this space right now. Concrete and specific to this industry. When search results support a trend, add an inline citation after the claim.

## Competitive Landscape
2-3 sentences on who is competing in this space — incumbents, new entrants, business model patterns. What does competition look like for a founder entering at this stage? Cite specific companies if they appear in search results.

## Financial & Funding Signals
2-3 sentences on the financial climate for this sector. Investment appetite, business model viability, monetization patterns that are working vs. struggling. Cite any specific funding figures or investment data.

## Risks & Opportunities
Two short columns — write them as:
**Risks:**
- [2-3 specific risks for a business in this space at this stage]

**Opportunities:**
- [2-3 genuine opportunities a founder entering now could exploit]

## What Matters Most Right Now
1 paragraph. Given their stage (${stageLabel}), strategy (${strategy}), and this specific market — what is the single most strategically important thing for this founder to understand about their market right now? Be direct and specific. This is the section Navi will reference most.

Keep the entire report tight and high-signal. No filler. No generic business advice that could apply to any industry. Write as if you are briefing a smart founder who has 5 minutes.`;
}

export const MARKET_REPORT_SYSTEM =
    "You are a senior market intelligence analyst. Generate structured, specific, high-signal market briefings. Use markdown formatting exactly as specified. No preamble. No closing remarks. Go straight into the briefing.";

// ─────────────────────────────────────────────────────────────
// Context injection — what Forge sees when a report exists
// ─────────────────────────────────────────────────────────────
export function buildMarketIntelContext(report: { content: string; industry: string; date: string }): string {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MARKET INTELLIGENCE REPORT (${report.date})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Industry: ${report.industry}

${report.content}

When the founder asks about their market, competitors, industry trends, or anything market-facing: draw on this report as primary context. Reference it naturally — don't announce you're reading from a report. Just know it.

If the founder asks where this information came from or whether it is current: tell them the report was generated on ${report.date} using live web search combined with AI analysis. If they want fresher data, they can regenerate the report from the Market Intelligence screen.`;
}

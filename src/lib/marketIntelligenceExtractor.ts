import type {
    NormalizedBenchmarkInsight,
    NormalizedCompetitorInsight,
    NormalizedMarketIntelligence,
    NormalizedSourceInsight,
    NormalizedTrendInsight,
} from "../db";

// This prepares structured extraction from daily market reports but is
// intentionally not wired yet. It does not call Forge, does not write to the
// database, and does not affect the current market_reports flow.

export type MarketIntelligenceFounderContext = {
    industry?: string | null;
    businessName?: string | null;
    idea?: string | null;
    currentStage?: number | null;
    strategyLabel?: string | null;
};

export type MarketIntelligenceExtractionScore = {
    score: number;
    issues: string[];
    strengths: string[];
};

function coerceString(value: unknown, fallback = ""): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return fallback;
}

function coerceNullableString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
}

function coerceStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeCompetitor(entry: unknown): NormalizedCompetitorInsight {
    const record = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const summary = coerceString(record.summary ?? record.overview ?? record.description);
    const description = coerceString(record.description ?? record.summary ?? record.overview);
    return {
        name: coerceString(record.name ?? record.company ?? record.competitor),
        description,
        website: coerceNullableString(record.website ?? record.url ?? record.site),
        summary,
        strengths: coerceStringArray(record.strengths),
        weaknesses: coerceStringArray(record.weaknesses),
        pricingNotes: coerceNullableString(record.pricingNotes ?? record.pricing_notes ?? record.pricing),
        positioning: coerceNullableString(record.positioning ?? record.marketPositioning ?? record.market_positioning),
    };
}

function normalizeTrend(entry: unknown): NormalizedTrendInsight {
    const record = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    return {
        name: coerceString(record.name ?? record.trend),
        description: coerceString(record.description ?? record.summary ?? record.whyItMatters),
        impactLevel: coerceString(record.impactLevel ?? record.impact_level ?? record.impact),
        timeframe: coerceString(record.timeframe ?? record.time_frame ?? record.horizon),
    };
}

function normalizeBenchmark(entry: unknown): NormalizedBenchmarkInsight {
    const record = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    return {
        metric: coerceString(record.metric ?? record.name),
        value: coerceString(record.value ?? record.amount ?? record.benchmark),
        unit: coerceNullableString(record.unit ?? record.units),
        description: coerceString(record.description ?? record.summary),
    };
}

function normalizeSource(entry: unknown): NormalizedSourceInsight {
    const record = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    return {
        title: coerceString(record.title ?? record.source),
        url: coerceString(record.url ?? record.link ?? record.href ?? record.sourceUrl),
        snippet: coerceString(record.snippet ?? record.summary ?? record.description),
    };
}

export function extractSourceInsightsFromMarkdown(content: string): NormalizedSourceInsight[] {
    const sourcesByUrl = new Map<string, NormalizedSourceInsight>();
    const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
    let match: RegExpExecArray | null;

    while ((match = linkPattern.exec(content)) !== null) {
        const title = match[1]?.replace(/^Source:\s*/i, "").trim();
        const url = match[2]?.trim();
        if (!title || !url || sourcesByUrl.has(url)) continue;
        sourcesByUrl.set(url, {
            title,
            url,
            snippet: "",
        });
    }

    return Array.from(sourcesByUrl.values());
}

export function mergeSourceInsights(
    extractedSources: NormalizedSourceInsight[],
    fallbackSources: NormalizedSourceInsight[],
): NormalizedSourceInsight[] {
    const sourcesByUrl = new Map<string, NormalizedSourceInsight>();

    for (const source of [...extractedSources, ...fallbackSources]) {
        const title = source.title?.trim();
        const url = source.url?.trim();
        if (!title || !url || sourcesByUrl.has(url)) continue;
        sourcesByUrl.set(url, {
            title,
            url,
            snippet: source.snippet?.trim() ?? "",
        });
    }

    return Array.from(sourcesByUrl.values());
}

export function buildMarketIntelligenceExtractionPrompt(
    reportContent: string,
    founderContext?: MarketIntelligenceFounderContext | null,
): string {
    const industry = founderContext?.industry || "Unknown";
    const businessName = founderContext?.businessName || "Unknown";
    const idea = founderContext?.idea || "Unknown";
    const currentStage = founderContext?.currentStage ?? "Unknown";
    const strategyLabel = founderContext?.strategyLabel || "Unknown";

    return `You are extracting structured market intelligence from a saved founder market report.

Return strict JSON only. Do not include markdown fences. Do not include commentary. Do not include any keys other than:
- competitors
- trends
- benchmarks
- sources

Founder context:
- Industry: ${industry}
- Business name: ${businessName}
- Business idea: ${idea}
- Current stage: ${currentStage}
- Strategy: ${strategyLabel}

Saved market report:
${reportContent}

Return JSON with this exact shape:
{
  "competitors": [
    {
      "name": "string — the competitor company name",
      "description": "string — one sentence overview of what the company does",
      "website": "string or null — the competitor's website URL if mentioned",
      "summary": "string — 2-4 sentences describing the specific products and services this competitor offers, and exactly why they compete with this founder's business (${businessName}) in the ${industry} space. Be concrete: name the actual products, features, or service lines that overlap with the founder's idea.",
      "strengths": ["string — specific competitive advantage"],
      "weaknesses": ["string — specific weakness or gap"],
      "pricingNotes": "string or null",
      "positioning": "string or null"
    }
  ],
  "trends": [
    {
      "name": "string",
      "description": "string",
      "impactLevel": "string",
      "timeframe": "string"
    }
  ],
  "benchmarks": [
    {
      "metric": "string",
      "value": "string",
      "unit": "string or null",
      "description": "string"
    }
  ],
  "sources": [
    {
      "title": "string",
      "url": "string",
      "snippet": "string"
    }
  ]
}`;
}

export const MARKET_INTELLIGENCE_EXTRACTION_SYSTEM =
    "You extract structured market intelligence from saved founder reports. Return strict JSON only with exactly these top-level keys: competitors, trends, benchmarks, sources. Do not include markdown fences, explanations, or extra keys.";

export function parseMarketIntelligenceExtraction(rawText: string): Pick<
    NormalizedMarketIntelligence,
    "competitors" | "trends" | "benchmarks" | "sources"
> {
    const empty = {
        competitors: [] as NormalizedCompetitorInsight[],
        trends: [] as NormalizedTrendInsight[],
        benchmarks: [] as NormalizedBenchmarkInsight[],
        sources: [] as NormalizedSourceInsight[],
    };

    if (!rawText || !rawText.trim()) return empty;

    try {
        const parsed = JSON.parse(rawText) as Record<string, unknown>;
        return {
            competitors: Array.isArray(parsed.competitors)
                ? parsed.competitors
                    .map(normalizeCompetitor)
                    .filter((competitor) => competitor.name.trim() && (competitor.description.trim() || competitor.summary.trim()))
                : [],
            trends: Array.isArray(parsed.trends)
                ? parsed.trends
                    .map(normalizeTrend)
                    .filter((trend) => trend.name.trim() && trend.description.trim() && trend.impactLevel.trim() && trend.timeframe.trim())
                : [],
            benchmarks: Array.isArray(parsed.benchmarks)
                ? parsed.benchmarks
                    .map(normalizeBenchmark)
                    .filter((benchmark) => benchmark.metric.trim() && benchmark.value.trim())
                : [],
            sources: Array.isArray(parsed.sources)
                ? parsed.sources
                    .map(normalizeSource)
                    .filter((source) => source.title.trim() && source.url.trim())
                : [],
        };
    } catch {
        return empty;
    }
}

function containsPlaceholderText(value: string | null | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return (
        normalized.includes("dev only") ||
        normalized.includes("placeholder") ||
        normalized.includes("lorem ipsum") ||
        normalized.includes("example.com") ||
        normalized.includes("fake data")
    );
}

function isLikelyHttpUrl(value: string | null | undefined): boolean {
    if (!value) return false;
    const candidate = value.trim();

    try {
        const normalized = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
        const parsed = new URL(normalized);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

// This scoring helper is dev-oriented quality feedback for structured extraction.
// It does not affect persistence or the existing daily report flow, and it helps
// validate whether manual extraction quality is strong enough for production rollout.
export function scoreMarketIntelligenceExtraction(
    parsed: Pick<NormalizedMarketIntelligence, "competitors" | "trends" | "benchmarks" | "sources">,
    options?: { rawJsonValid?: boolean },
): MarketIntelligenceExtractionScore {
    const competitors = Array.isArray(parsed?.competitors) ? parsed.competitors : [];
    const trends = Array.isArray(parsed?.trends) ? parsed.trends : [];
    const benchmarks = Array.isArray(parsed?.benchmarks) ? parsed.benchmarks : [];
    const sources = Array.isArray(parsed?.sources) ? parsed.sources : [];
    let score = 100;
    const issues: string[] = [];
    const strengths: string[] = [];

    if (options?.rawJsonValid === false) {
        score -= 30;
        issues.push("Forge output was not valid JSON before normalization.");
    } else {
        strengths.push("Raw Forge output parsed as valid JSON.");
    }

    if (competitors.length === 0) {
        score -= 10;
        issues.push("No competitors were extracted.");
    } else {
        strengths.push(`Found ${competitors.length} competitor insight${competitors.length === 1 ? "" : "s"}.`);
    }

    if (trends.length === 0) {
        score -= 10;
        issues.push("No trends were extracted.");
    } else {
        strengths.push(`Found ${trends.length} trend insight${trends.length === 1 ? "" : "s"}.`);
    }

    if (benchmarks.length === 0) {
        score -= 10;
        issues.push("No benchmarks were extracted.");
    } else {
        strengths.push(`Found ${benchmarks.length} benchmark insight${benchmarks.length === 1 ? "" : "s"}.`);
    }

    if (sources.length === 0) {
        score -= 15;
        issues.push("No sources were extracted.");
    } else {
        const wellFormedSources = sources.filter((source) => source.title.trim() && isLikelyHttpUrl(source.url));
        if (wellFormedSources.length === 0) {
            score -= 12;
            issues.push("Sources were extracted, but none include both a title and a usable URL.");
        } else {
            strengths.push(`${wellFormedSources.length} source${wellFormedSources.length === 1 ? "" : "s"} include title and URL.`);
        }
    }

    const incompleteCompetitors = competitors.filter(
        (competitor) => !competitor.name.trim() || !(competitor.summary.trim() || competitor.description.trim()),
    ).length;
    if (incompleteCompetitors > 0) {
        score -= Math.min(15, incompleteCompetitors * 5);
        issues.push(`${incompleteCompetitors} competitor entr${incompleteCompetitors === 1 ? "y is" : "ies are"} missing a name or summary/description.`);
    } else if (competitors.length > 0) {
        strengths.push("Competitors include names and summaries/descriptions.");
    }

    const incompleteTrends = trends.filter(
        (trend) => !trend.name.trim() || !trend.impactLevel.trim() || !trend.timeframe.trim(),
    ).length;
    if (incompleteTrends > 0) {
        score -= Math.min(12, incompleteTrends * 4);
        issues.push(`${incompleteTrends} trend entr${incompleteTrends === 1 ? "y is" : "ies are"} missing a name, impact level, or timeframe.`);
    } else if (trends.length > 0) {
        strengths.push("Trends include names, impact levels, and timeframes.");
    }

    const incompleteBenchmarks = benchmarks.filter(
        (benchmark) => !benchmark.metric.trim() || !benchmark.value.trim() || !benchmark.unit?.trim(),
    ).length;
    if (incompleteBenchmarks > 0) {
        score -= Math.min(12, incompleteBenchmarks * 4);
        issues.push(`${incompleteBenchmarks} benchmark entr${incompleteBenchmarks === 1 ? "y is" : "ies are"} missing a metric, value, or unit.`);
    } else if (benchmarks.length > 0) {
        strengths.push("Benchmarks include metric, value, and unit fields.");
    }

    const placeholderDetected = [
        ...competitors.map((competitor) => `${competitor.name} ${competitor.summary} ${competitor.description}`),
        ...trends.map((trend) => `${trend.name} ${trend.description}`),
        ...benchmarks.map((benchmark) => `${benchmark.metric} ${benchmark.value} ${benchmark.unit ?? ""} ${benchmark.description}`),
        ...sources.map((source) => `${source.title} ${source.url} ${source.snippet}`),
    ].some((entry) => containsPlaceholderText(entry));

    if (placeholderDetected) {
        score -= 25;
        issues.push("Extraction still contains obvious placeholder or dev-only text.");
    } else {
        strengths.push("No obvious placeholder or dev-only text detected.");
    }

    return {
        score: Math.max(0, Math.min(100, Math.round(score))),
        issues,
        strengths,
    };
}

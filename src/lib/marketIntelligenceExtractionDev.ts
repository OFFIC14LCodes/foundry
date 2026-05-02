import { type SaveNormalizedMarketIntelligenceResult } from "../db";
import { extractAndSaveMarketIntelligenceFromReport } from "./marketIntelligencePipeline";
import {
    parseMarketIntelligenceExtraction,
    type MarketIntelligenceFounderContext,
} from "./marketIntelligenceExtractor";

// Dev-only utility helpers for validating Market Intelligence extraction
// quality. This file is intentionally not wired into production UI and does
// not affect the normal daily market report flow.

export const MARKET_INTELLIGENCE_EXTRACTION_FIXTURE_JSON = JSON.stringify({
    competitors: [
        {
            name: "Stripe Atlas",
            description: "Business formation and payments infrastructure for startups.",
            website: "https://stripe.com/atlas",
            summary: "Competes on startup onboarding speed and ecosystem integration.",
            strengths: ["Strong brand trust", "Integrated payments stack"],
            weaknesses: ["Less tailored legal nuance for niche entities", "Can feel generic for advanced founders"],
            pricingNotes: "Flat setup fee with add-on service pricing.",
            positioning: "Fast, modern startup formation platform",
        },
        {
            name: "Clerky",
            description: "Startup legal paperwork automation focused on Delaware C-corps.",
            website: "https://www.clerky.com",
            summary: "Competes on legal-document depth and startup-specific workflows.",
            strengths: ["High document accuracy", "Strong startup legal reputation"],
            weaknesses: ["Narrower audience", "Less operational breadth outside legal workflows"],
            pricingNotes: "Package-based pricing around incorporation and financing events.",
            positioning: "Legal-first startup paperwork platform",
        },
    ],
    trends: [
        {
            name: "AI-assisted back-office automation",
            description: "Founders increasingly expect legal, finance, and formation workflows to be partially automated with AI guidance.",
            impactLevel: "high",
            timeframe: "current",
        },
        {
            name: "Founder demand for integrated tooling",
            description: "Early-stage teams prefer fewer vendors across formation, finance, compliance, and operating workflows.",
            impactLevel: "medium",
            timeframe: "next_12_months",
        },
    ],
    benchmarks: [
        {
            metric: "Average incorporation turnaround",
            value: "3-10",
            unit: "days",
            description: "Typical founder expectation for a streamlined digital incorporation workflow.",
        },
        {
            metric: "Typical legal setup spend",
            value: "500-2500",
            unit: "USD",
            description: "Range many early founders expect for entity formation and standard startup paperwork.",
        },
    ],
    sources: [
        {
            title: "Stripe Atlas",
            url: "https://stripe.com/atlas",
            snippet: "Atlas helps founders start and scale companies with integrated banking and payments support.",
        },
        {
            title: "Clerky",
            url: "https://www.clerky.com",
            snippet: "Clerky helps startups complete incorporation, fundraising, hiring, and other legal paperwork online.",
        },
    ],
}, null, 2);

export const MARKET_INTELLIGENCE_EXTRACTION_MALFORMED_FIXTURE = `{"competitors":[{"name":"Broken JSON"}],`;

export const MARKET_INTELLIGENCE_EXTRACTION_MISSING_KEYS_FIXTURE_JSON = JSON.stringify({
    competitors: [
        {
            name: "Generic Competitor",
            description: "Used to validate missing-key warnings.",
            website: null,
            summary: "Summary",
            strengths: ["Strength"],
            weaknesses: ["Weakness"],
            pricingNotes: null,
            positioning: "General",
        },
    ],
    trends: [],
}, null, 2);

export type MarketIntelligenceExtractionFixtureValidation = {
    validCounts: {
        competitors: number;
        trends: number;
        benchmarks: number;
        sources: number;
    };
    malformedCounts: {
        competitors: number;
        trends: number;
        benchmarks: number;
        sources: number;
    };
    missingKeyWarnings: string[];
};

function getMissingKeyWarnings(rawText: string): string[] {
    try {
        const parsed = JSON.parse(rawText) as Record<string, unknown>;
        const warnings: string[] = [];
        for (const key of ["competitors", "trends", "benchmarks", "sources"] as const) {
            if (!(key in parsed)) {
                warnings.push(`Missing top-level key: ${key}`);
            } else if (!Array.isArray(parsed[key])) {
                warnings.push(`Top-level key is not an array: ${key}`);
            }
        }
        return warnings;
    } catch {
        return ["Invalid JSON"];
    }
}

export function validateMarketIntelligenceExtractionFixtures(): MarketIntelligenceExtractionFixtureValidation {
    const valid = parseMarketIntelligenceExtraction(MARKET_INTELLIGENCE_EXTRACTION_FIXTURE_JSON);
    const malformed = parseMarketIntelligenceExtraction(MARKET_INTELLIGENCE_EXTRACTION_MALFORMED_FIXTURE);
    const missingKeyWarnings = getMissingKeyWarnings(MARKET_INTELLIGENCE_EXTRACTION_MISSING_KEYS_FIXTURE_JSON);

    return {
        validCounts: {
            competitors: valid.competitors.length,
            trends: valid.trends.length,
            benchmarks: valid.benchmarks.length,
            sources: valid.sources.length,
        },
        malformedCounts: {
            competitors: malformed.competitors.length,
            trends: malformed.trends.length,
            benchmarks: malformed.benchmarks.length,
            sources: malformed.sources.length,
        },
        missingKeyWarnings,
    };
}

export async function runMarketIntelligenceExtractionSaveFixture(
    userId: string,
    reportId: string,
    founderContext?: MarketIntelligenceFounderContext | null,
): Promise<SaveNormalizedMarketIntelligenceResult> {
    return extractAndSaveMarketIntelligenceFromReport(
        userId,
        reportId,
        founderContext ?? null,
        MARKET_INTELLIGENCE_EXTRACTION_FIXTURE_JSON,
    );
}


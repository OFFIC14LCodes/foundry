import {
    normalizeMarketReportToStructuredData,
    saveNormalizedMarketIntelligence,
    type NormalizedMarketIntelligence,
    type SaveNormalizedMarketIntelligenceResult,
} from "../db";
import {
    parseMarketIntelligenceExtraction,
    type MarketIntelligenceFounderContext,
} from "./marketIntelligenceExtractor";

export type ExtractionSummary = SaveNormalizedMarketIntelligenceResult;

// This is a manual bridge for testing the structured extraction pipeline
// before automated Forge/provider wiring. It is intentionally inactive:
// no automatic calls, no UI wiring, and no direct Forge API invocation.
export async function extractAndSaveMarketIntelligenceFromReport(
    userId: string,
    reportId: string,
    founderContext: MarketIntelligenceFounderContext | null | undefined,
    rawExtractionText: string,
): Promise<SaveNormalizedMarketIntelligenceResult> {
    const missingReportResult: SaveNormalizedMarketIntelligenceResult = {
        competitorsInserted: 0,
        competitorSnapshotsInserted: 0,
        trendsInserted: 0,
        benchmarksInserted: 0,
        sourcesInserted: 0,
        skipped: 0,
        errors: [],
    };

    const report = await normalizeMarketReportToStructuredData(userId, reportId);
    if (!report) {
        return {
            ...missingReportResult,
            errors: ["Market report not found or not owned by user."],
        };
    }

    void founderContext;

    const parsed = parseMarketIntelligenceExtraction(rawExtractionText);
    const parsedItemCount =
        parsed.competitors.length +
        parsed.trends.length +
        parsed.benchmarks.length +
        parsed.sources.length;

    if (rawExtractionText.trim() && parsedItemCount === 0) {
        return {
            ...missingReportResult,
            errors: ["No structured insights could be parsed from the extraction response."],
        };
    }

    const normalized: NormalizedMarketIntelligence = {
        ...report,
        competitors: parsed.competitors,
        trends: parsed.trends,
        benchmarks: parsed.benchmarks,
        sources: parsed.sources,
    };

    return saveNormalizedMarketIntelligence(userId, normalized);
}

export async function savePreParsedMarketIntelligence(
    userId: string,
    reportId: string,
    rawExtractionText: string,
): Promise<ExtractionSummary> {
    const parsed = parseMarketIntelligenceExtraction(rawExtractionText);

    return saveNormalizedMarketIntelligence(userId, {
        reportId,
        userId,
        industry: null,
        date: "",
        content: "",
        competitors: parsed.competitors,
        trends: parsed.trends,
        benchmarks: parsed.benchmarks,
        sources: parsed.sources,
    });
}

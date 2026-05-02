import {
    normalizeMarketReportToStructuredData,
    saveNormalizedMarketIntelligence,
    type NormalizedMarketIntelligence,
    type SaveNormalizedMarketIntelligenceResult,
} from "../db";
import {
    parseMarketIntelligenceExtraction,
    buildMarketIntelligenceExtractionPrompt,
    MARKET_INTELLIGENCE_EXTRACTION_SYSTEM,
    type MarketIntelligenceFounderContext,
} from "./marketIntelligenceExtractor";
import { callForgeAPI } from "./forgeApi";

export type ExtractionSummary = SaveNormalizedMarketIntelligenceResult;

export async function extractAndSaveMarketIntelligenceFromReport(
    userId: string,
    reportId: string,
    founderContext: MarketIntelligenceFounderContext | null | undefined,
    rawExtractionText = "",
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

    const extractionText = rawExtractionText.trim()
        ? rawExtractionText
        : await callForgeAPI(
            [{ role: "user", content: buildMarketIntelligenceExtractionPrompt(report.content, founderContext) }],
            MARKET_INTELLIGENCE_EXTRACTION_SYSTEM,
            2000,
        );

    const parsed = parseMarketIntelligenceExtraction(extractionText);
    const parsedItemCount =
        parsed.competitors.length +
        parsed.trends.length +
        parsed.benchmarks.length +
        parsed.sources.length;

    if (extractionText.trim() && parsedItemCount === 0) {
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

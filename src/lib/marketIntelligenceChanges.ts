import type {
    NormalizedBenchmarkInsight,
    NormalizedCompetitorInsight,
    NormalizedMarketIntelligence,
    NormalizedTrendInsight,
} from "../db";
import type { FoundryActionPriority, FoundryActionSuggestion } from "./foundryActions";

export type MarketIntelligenceChangeEntityType = "competitor" | "trend" | "benchmark";
export type MarketIntelligenceChangeType = "added" | "removed" | "changed";

export type MarketIntelligenceDetectedChange = {
    entityType: MarketIntelligenceChangeEntityType;
    entityName: string;
    changeType: MarketIntelligenceChangeType;
    changeSummary: string;
    changeReason?: string | null;
};

export type MarketIntelligenceChangeSet = {
    added: MarketIntelligenceDetectedChange[];
    removed: MarketIntelligenceDetectedChange[];
    changed: MarketIntelligenceDetectedChange[];
};

type ComparableMarketIntelligence = Pick<NormalizedMarketIntelligence, "competitors" | "trends" | "benchmarks">;

function normalizeKey(value: string | null | undefined) {
    return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeText(value: unknown) {
    if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean).sort().join("|");
    return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function compactSummary(value: string, maxLength = 180) {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength).trim()}...`;
}

function hasMeaningfulDiff(left: string[], right: string[]) {
    return left.some((value, index) => value !== right[index]);
}

function compareCompetitorFields(previous: NormalizedCompetitorInsight, current: NormalizedCompetitorInsight) {
    const previousValues = [
        normalizeText(previous.pricingNotes),
        normalizeText(previous.positioning),
        normalizeText(previous.strengths),
        normalizeText(previous.weaknesses),
    ];
    const currentValues = [
        normalizeText(current.pricingNotes),
        normalizeText(current.positioning),
        normalizeText(current.strengths),
        normalizeText(current.weaknesses),
    ];
    return hasMeaningfulDiff(previousValues, currentValues);
}

function compareTrendFields(previous: NormalizedTrendInsight, current: NormalizedTrendInsight) {
    return hasMeaningfulDiff(
        [normalizeText(previous.impactLevel), normalizeText(previous.timeframe)],
        [normalizeText(current.impactLevel), normalizeText(current.timeframe)],
    );
}

function compareBenchmarkFields(previous: NormalizedBenchmarkInsight, current: NormalizedBenchmarkInsight) {
    return hasMeaningfulDiff(
        [normalizeText(previous.value), normalizeText(previous.unit)],
        [normalizeText(current.value), normalizeText(current.unit)],
    );
}

function mapByKey<T>(items: T[], getKey: (item: T) => string) {
    return items.reduce<Map<string, T>>((map, item) => {
        const key = normalizeKey(getKey(item));
        if (key) map.set(key, item);
        return map;
    }, new Map<string, T>());
}

function pushChange(groups: MarketIntelligenceChangeSet, change: MarketIntelligenceDetectedChange) {
    groups[change.changeType].push(change);
}

export function detectMarketIntelligenceChanges(
    previous: ComparableMarketIntelligence | null | undefined,
    current: ComparableMarketIntelligence,
): MarketIntelligenceChangeSet {
    const changes: MarketIntelligenceChangeSet = { added: [], removed: [], changed: [] };
    if (!previous) return changes;

    const previousCompetitors = mapByKey(previous.competitors ?? [], (item) => item.name);
    const currentCompetitors = mapByKey(current.competitors ?? [], (item) => item.name);
    currentCompetitors.forEach((competitor, key) => {
        const prior = previousCompetitors.get(key);
        if (!prior) {
            pushChange(changes, {
                entityType: "competitor",
                entityName: competitor.name,
                changeType: "added",
                changeSummary: `New competitor detected: ${competitor.name}. Review positioning against this player.`,
                changeReason: "New competitor detected in latest report.",
            });
        } else if (compareCompetitorFields(prior, competitor)) {
            pushChange(changes, {
                entityType: "competitor",
                entityName: competitor.name,
                changeType: "changed",
                changeSummary: compactSummary(`${competitor.name} changed in the latest report. Review positioning, pricing, or strengths/weaknesses before assuming the old read still holds.`),
                changeReason: "Competitor pricing, positioning, strengths, or weaknesses changed.",
            });
        }
    });
    previousCompetitors.forEach((competitor, key) => {
        if (!currentCompetitors.has(key)) {
            pushChange(changes, {
                entityType: "competitor",
                entityName: competitor.name,
                changeType: "removed",
                changeSummary: `Competitor no longer appeared: ${competitor.name}. Check whether this is a real market shift or just source coverage noise.`,
                changeReason: "Competitor appeared in the previous report but not the latest report.",
            });
        }
    });

    const previousTrends = mapByKey(previous.trends ?? [], (item) => item.name);
    const currentTrends = mapByKey(current.trends ?? [], (item) => item.name);
    currentTrends.forEach((trend, key) => {
        const prior = previousTrends.get(key);
        if (!prior) {
            pushChange(changes, {
                entityType: "trend",
                entityName: trend.name,
                changeType: "added",
                changeSummary: `New trend detected: ${trend.name}. Evaluate whether it changes roadmap, messaging, or customer discovery.`,
                changeReason: "New trend detected in latest report.",
            });
        } else if (compareTrendFields(prior, trend)) {
            pushChange(changes, {
                entityType: "trend",
                entityName: trend.name,
                changeType: "changed",
                changeSummary: compactSummary(`Trend changed: ${trend.name}. Latest impact: ${trend.impactLevel || "unknown"}; timeframe: ${trend.timeframe || "unknown"}.`),
                changeReason: `Trend impact or timeframe changed from ${prior.impactLevel || "unknown"} / ${prior.timeframe || "unknown"} to ${trend.impactLevel || "unknown"} / ${trend.timeframe || "unknown"}.`,
            });
        }
    });
    previousTrends.forEach((trend, key) => {
        if (!currentTrends.has(key)) {
            pushChange(changes, {
                entityType: "trend",
                entityName: trend.name,
                changeType: "removed",
                changeSummary: `Trend no longer appeared: ${trend.name}. Do not overreact, but revisit whether it should still shape strategy.`,
                changeReason: "Trend appeared in the previous report but not the latest report.",
            });
        }
    });

    const previousBenchmarks = mapByKey(previous.benchmarks ?? [], (item) => item.metric);
    const currentBenchmarks = mapByKey(current.benchmarks ?? [], (item) => item.metric);
    currentBenchmarks.forEach((benchmark, key) => {
        const prior = previousBenchmarks.get(key);
        if (!prior) {
            pushChange(changes, {
                entityType: "benchmark",
                entityName: benchmark.metric,
                changeType: "added",
                changeSummary: `New benchmark detected: ${benchmark.metric} = ${benchmark.value}${benchmark.unit ? ` ${benchmark.unit}` : ""}. Use it to check assumptions.`,
                changeReason: "New benchmark detected in latest report.",
            });
        } else if (compareBenchmarkFields(prior, benchmark)) {
            pushChange(changes, {
                entityType: "benchmark",
                entityName: benchmark.metric,
                changeType: "changed",
                changeSummary: compactSummary(`Benchmark shift: ${benchmark.metric} moved from ${prior.value}${prior.unit ? ` ${prior.unit}` : ""} to ${benchmark.value}${benchmark.unit ? ` ${benchmark.unit}` : ""}. Review the assumption it affects.`),
                changeReason: `${benchmark.metric} changed from ${prior.value}${prior.unit ? ` ${prior.unit}` : ""} to ${benchmark.value}${benchmark.unit ? ` ${benchmark.unit}` : ""}.`,
            });
        }
    });
    previousBenchmarks.forEach((benchmark, key) => {
        if (!currentBenchmarks.has(key)) {
            pushChange(changes, {
                entityType: "benchmark",
                entityName: benchmark.metric,
                changeType: "removed",
                changeSummary: `Benchmark no longer appeared: ${benchmark.metric}. Treat it as stale until a newer source confirms it.`,
                changeReason: "Benchmark appeared in the previous report but not the latest report.",
            });
        }
    });

    return changes;
}

export function suggestActionFromMarketChange(change: MarketIntelligenceDetectedChange & { id?: string | null }): FoundryActionSuggestion {
    const priority: FoundryActionPriority = change.changeType === "changed" ? "high" : change.changeType === "added" ? "medium" : "low";
    const title = change.entityType === "competitor"
        ? `${change.changeType === "added" ? "Review" : "Recheck"} positioning against ${change.entityName}`
        : change.entityType === "trend"
            ? `Evaluate impact of ${change.entityName}`
            : `Review benchmark shift: ${change.entityName}`;

    return {
        title,
        description: change.changeSummary,
        sourceModule: "market_intelligence",
        sourceType: "market_change",
        sourceId: change.id ?? null,
        actionType: "market_followup",
        priority,
        metadata: {
            marketChangeId: change.id ?? null,
            entityType: change.entityType,
            changeType: change.changeType,
            entityName: change.entityName,
            changeReason: change.changeReason ?? null,
        },
    };
}

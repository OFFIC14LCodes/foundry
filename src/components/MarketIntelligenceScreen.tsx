import { useEffect, useRef, useState } from "react";
import { streamForgeAPI } from "../lib/forgeApi";
import {
    buildMarketReportPrompt,
    buildSearchQueries,
    MARKET_REPORT_SYSTEM,
    type SearchResult,
} from "../constants/marketPrompt";
import {
    loadCompetitorsByUser,
    loadIndustryBenchmarksByUser,
    loadLatestMarketReport,
    loadMarketReportHistory,
    loadMarketReportSourcesByUser,
    loadMarketTrendsByUser,
    loadMarketIntelligenceChangesByUser,
    loadCompetitorSnapshotsByUser,
    loadTrendSnapshotsByUser,
    saveMarketReport,
    type Competitor,
    type CompetitorSnapshot,
    type IndustryBenchmark,
    type MarketReportSource,
    type MarketTrend,
    type MarketIntelligenceChange,
    type TrendSnapshot,
} from "../db";
import { getMarketRefreshSchedule, updateMarketRefreshSchedule } from "../lib/founderSessionState";
import DailyBriefPanel from "./market-intelligence/DailyBriefPanel";
import MarketIntelligenceTabs from "./market-intelligence/MarketIntelligenceTabs";
import StructuredBenchmarksPanel from "./market-intelligence/StructuredBenchmarksPanel";
import StructuredCompetitorsPanel from "./market-intelligence/StructuredCompetitorsPanel";
import StructuredReportSelector from "./market-intelligence/StructuredReportSelector";
import StructuredSourcesPanel from "./market-intelligence/StructuredSourcesPanel";
import StructuredTrendsPanel from "./market-intelligence/StructuredTrendsPanel";
import WhatChangedPanel from "./market-intelligence/WhatChangedPanel";
import {
    formatReportDate,
    getReportPreview,
    hasUsableContent,
    type MarketReport,
    type MarketTab,
} from "./market-intelligence/shared";
import type { FoundryActionSuggestion } from "../lib/foundryActions";
type GenerationPhase = "idle" | "searching" | "generating";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const todayStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

function isToday(date: string): boolean {
    return date === todayStr();
}

function upsertReport(history: MarketReport[], nextReport: MarketReport) {
    const next = [nextReport, ...history.filter((entry) => entry.date !== nextReport.date)];
    return next.sort((a, b) => b.date.localeCompare(a.date));
}

function getReportAgeDays(report: MarketReport) {
    const timestamp = report.createdAt || `${report.date}T12:00:00`;
    const generatedAt = new Date(timestamp).getTime();
    if (Number.isNaN(generatedAt)) return 999;
    return Math.max(0, Math.floor((Date.now() - generatedAt) / 86_400_000));
}

function getFreshness(report: MarketReport) {
    const ageDays = getReportAgeDays(report);

    if (ageDays < 1) {
        return { status: "fresh" as const, label: "Fresh", color: "#4CAF8A" };
    }

    if (ageDays <= 7) {
        return {
            status: "aging" as const,
            label: `${ageDays} day${ageDays === 1 ? "" : "s"} old`,
            color: "#F5A843",
        };
    }

    return { status: "outdated" as const, label: "Outdated - regenerate for current data", color: "#77716A" };
}

async function fetchMarketSearchResults(queries: string[]): Promise<SearchResult[]> {
    const response = await fetch("/api/market-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queries }),
    });

    if (!response.ok) {
        throw new Error(`Market search failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (!payload?.ok || !Array.isArray(payload.results)) {
        throw new Error("Market search returned no usable live sources.");
    }

    return payload.results as SearchResult[];
}

function countSourcesByReport(sources: MarketReportSource[]) {
    return sources.reduce<Record<string, number>>((counts, source) => {
        counts[source.reportId] = (counts[source.reportId] || 0) + 1;
        return counts;
    }, {});
}

function buildFounderContext(profile: any) {
    return {
        industry: profile.industry ?? null,
        businessName: profile.businessName ?? null,
        idea: profile.idea ?? null,
        currentStage: profile.currentStage ?? null,
        strategyLabel: profile.strategyLabel ?? null,
    };
}

function nextWeeklyRefreshDate(from = new Date()) {
    const next = new Date(from);
    next.setDate(next.getDate() + 7);
    next.setHours(8, 0, 0, 0);
    return next.toISOString();
}

function formatScheduleDate(value: string | null | undefined) {
    if (!value) return "Not scheduled";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not scheduled";
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function MarketIntelligenceScreen({
    profile,
    userId,
    report,
    onReportChange,
    onBack,
    onCreateAction,
    onAskForgeAboutAction,
    generationLimit = null,
}: {
    profile: any;
    userId: string;
    report: MarketReport | null;
    onReportChange: (r: MarketReport | null) => void;
    onBack: () => void;
    onCreateAction?: (suggestion: FoundryActionSuggestion) => Promise<unknown> | void;
    onAskForgeAboutAction?: (suggestion: FoundryActionSuggestion) => void;
    generationLimit?: number | null;
}) {
    const [generating, setGenerating] = useState(false);
    const [generationPhase, setGenerationPhase] = useState<GenerationPhase>("idle");
    const [streamedContent, setStreamedContent] = useState("");
    const [mounted, setMounted] = useState(false);
    const [currentReport, setCurrentReport] = useState<MarketReport | null>(report);
    const [reportHistory, setReportHistory] = useState<MarketReport[]>(report ? [report] : []);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 640);
    const [activeTab, setActiveTab] = useState<MarketTab>("brief");
    const [competitors, setCompetitors] = useState<Competitor[]>([]);
    const [trends, setTrends] = useState<MarketTrend[]>([]);
    const [benchmarks, setBenchmarks] = useState<IndustryBenchmark[]>([]);
    const [sources, setSources] = useState<MarketReportSource[]>([]);
    const [competitorSnapshots, setCompetitorSnapshots] = useState<CompetitorSnapshot[]>([]);
    const [trendSnapshots, setTrendSnapshots] = useState<TrendSnapshot[]>([]);
    const [marketChanges, setMarketChanges] = useState<MarketIntelligenceChange[]>([]);
    const [sourceCountsByReportId, setSourceCountsByReportId] = useState<Record<string, number>>({});
    const [structuredLoading, setStructuredLoading] = useState(false);
    const [structuredError, setStructuredError] = useState<string | null>(null);
    const [automaticExtractionRunning, setAutomaticExtractionRunning] = useState(false);
    const [scheduleSaving, setScheduleSaving] = useState(false);
    const [marketRefreshSchedule, setMarketRefreshSchedule] = useState<Record<string, unknown> | null>(null);
    const [actionNotice, setActionNotice] = useState<string | null>(null);
    const latestLocalMutationRef = useRef(0);

    const createSuggestedAction = async (suggestion: FoundryActionSuggestion) => {
        if (!onCreateAction) return;
        await onCreateAction(suggestion);
        setActionNotice("Suggested action saved to Action Center.");
        window.setTimeout(() => setActionNotice(null), 2200);
    };

    const loadStructuredData = async (
        reportForSources: MarketReport | null,
        options?: { silent?: boolean; shouldCancel?: () => boolean },
    ) => {
        if (!options?.silent) {
            setStructuredLoading(true);
            setStructuredError(null);
        }

        const shouldCancel = options?.shouldCancel;
        if (shouldCancel?.()) return;

        try {
            const [nextCompetitors, nextTrends, nextBenchmarks, nextSources, nextCompetitorSnapshots, nextTrendSnapshots, nextMarketChanges] = await Promise.all([
                loadCompetitorsByUser(userId),
                loadMarketTrendsByUser(userId),
                loadIndustryBenchmarksByUser(userId),
                loadMarketReportSourcesByUser(userId),
                loadCompetitorSnapshotsByUser(userId),
                loadTrendSnapshotsByUser(userId),
                loadMarketIntelligenceChangesByUser(userId, reportForSources?.id ?? null),
            ]);

            if (shouldCancel?.()) return;

            setCompetitors(nextCompetitors);
            setTrends(nextTrends);
            setBenchmarks(nextBenchmarks);
            setCompetitorSnapshots(nextCompetitorSnapshots);
            setTrendSnapshots(nextTrendSnapshots);
            setMarketChanges(nextMarketChanges);
            setSourceCountsByReportId(countSourcesByReport(nextSources));
            setSources(
                reportForSources?.id
                    ? nextSources.filter((source) => source.reportId === reportForSources.id)
                    : [],
            );
            console.log("[Market Intelligence] Structured data loaded", JSON.stringify({
                reportId: reportForSources?.id ?? null,
                competitorsLength: nextCompetitors.length,
                trendsLength: nextTrends.length,
                benchmarksLength: nextBenchmarks.length,
                allSourcesLength: nextSources.length,
                currentReportSourcesLength: reportForSources?.id
                    ? nextSources.filter((source) => source.reportId === reportForSources.id).length
                    : 0,
                marketChangesLength: nextMarketChanges.length,
            }));
        } catch (error) {
            console.error("Structured market intelligence load error:", error);
            if (shouldCancel?.()) return;
            setStructuredError("Structured market intelligence is unavailable right now. Daily Brief still works normally.");
        } finally {
            if (!options?.silent && !shouldCancel?.()) {
                setStructuredLoading(false);
            }
        }
    };

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 639px)");
        const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => setMounted(true), 80);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!report) return;
        setCurrentReport(report);
        setReportHistory((prev) => upsertReport(prev, report));
    }, [report]);

    useEffect(() => {
        let cancelled = false;
        const startedAt = Date.now();

        const loadReport = async () => {
            const [latest, history] = await Promise.all([
                loadLatestMarketReport(userId),
                loadMarketReportHistory(userId),
            ]);
            if (cancelled || startedAt < latestLocalMutationRef.current) return;

            setCurrentReport(latest);
            setReportHistory(history);
            onReportChange(latest);
        };

        loadReport();

        return () => { cancelled = true; };
    }, [userId]);

    useEffect(() => {
        let cancelled = false;
        getMarketRefreshSchedule(userId).then((schedule) => {
            if (!cancelled) setMarketRefreshSchedule(schedule);
        });
        return () => { cancelled = true; };
    }, [userId]);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            await loadStructuredData(currentReport, { shouldCancel: () => cancelled });
        };

        run();

        return () => { cancelled = true; };
    }, [userId, currentReport?.id]);

    const hasSavedReport = hasUsableContent(currentReport);
    const isCurrentReport = hasSavedReport && !!currentReport && isToday(currentReport.date);
    const hasOutdatedReport = hasSavedReport && !!currentReport && !isToday(currentReport.date);
    const hasReachedLimit = generationLimit !== null && reportHistory.length >= generationLimit && !isCurrentReport;
    const canGenerateReport = !hasReachedLimit;

    const industry = profile.industry || profile.idea?.slice(0, 40) || "your market";
    const scheduleEnabled = Boolean(marketRefreshSchedule?.enabled);
    const nextRefreshAt = typeof marketRefreshSchedule?.nextRefreshAt === "string" ? marketRefreshSchedule.nextRefreshAt : null;
    const previousReport = currentReport?.id
        ? reportHistory.find((entry) => entry.id && entry.id !== currentReport.id) ?? null
        : null;
    const competitorNameById = competitors.reduce<Record<string, string>>((names, competitor) => {
        names[competitor.id] = competitor.name;
        return names;
    }, {});
    const currentCompetitorIds = new Set(
        currentReport?.id
            ? competitorSnapshots.filter((snapshot) => snapshot.reportId === currentReport.id).map((snapshot) => snapshot.competitorId)
            : [],
    );
    const previousCompetitorIds = new Set(
        previousReport?.id
            ? competitorSnapshots.filter((snapshot) => snapshot.reportId === previousReport.id).map((snapshot) => snapshot.competitorId)
            : [],
    );
    const newCompetitorsSinceLastReport = Array.from(currentCompetitorIds)
        .filter((competitorId) => !previousCompetitorIds.has(competitorId))
        .map((competitorId) => competitorNameById[competitorId])
        .filter(Boolean);
    const previousTrendNames = new Set(
        previousReport?.id
            ? trendSnapshots.filter((snapshot) => snapshot.reportId === previousReport.id).map((snapshot) => snapshot.trendName.trim().toLowerCase())
            : [],
    );
    const highImpactTrendAlerts = currentReport?.id
        ? trendSnapshots
            .filter((snapshot) => snapshot.reportId === currentReport.id)
            .filter((snapshot) => snapshot.impactLevel.trim().toLowerCase() === "high")
            .filter((snapshot) => !previousTrendNames.has(snapshot.trendName.trim().toLowerCase()))
            .map((snapshot) => snapshot.trendName)
        : [];
    const alertItems = Array.from(new Set([...newCompetitorsSinceLastReport, ...highImpactTrendAlerts])).slice(0, 4);

    const selectReport = (next: MarketReport) => {
        latestLocalMutationRef.current = Date.now();
        setCurrentReport(next);
        onReportChange(next);
        setSaveError(null);
    };

    const toggleWeeklyRefresh = async (enabled: boolean) => {
        setScheduleSaving(true);
        const nextSchedule = enabled
            ? { enabled: true, frequency: "weekly", nextRefreshAt: nextWeeklyRefreshDate(), updatedAt: new Date().toISOString() }
            : { enabled: false, frequency: "weekly", nextRefreshAt: null, updatedAt: new Date().toISOString() };
        setMarketRefreshSchedule(nextSchedule);
        try {
            const saved = await updateMarketRefreshSchedule(userId, nextSchedule);
            if (saved) setMarketRefreshSchedule(saved);
        } finally {
            setScheduleSaving(false);
        }
    };

    const generate = async (options?: { force?: boolean; ignoreLimit?: boolean }) => {
        if (generating || (!options?.force && isCurrentReport) || (!options?.ignoreLimit && !canGenerateReport)) return;
        setGenerating(true);
        setGenerationPhase("searching");
        setStreamedContent("");
        setSaveError(null);
        let searchResults: SearchResult[] = [];
        let searchQueries: string[] = buildSearchQueries(profile);

        try {
            try {
                searchResults = await fetchMarketSearchResults(searchQueries);
            } catch (searchError) {
                console.error("Market search unavailable; continuing without live sources:", searchError);
                searchResults = [];
            }

            setGenerationPhase("generating");
            const prompt = buildMarketReportPrompt(profile, searchResults);
            const final = await streamForgeAPI(
                [{ role: "user", content: prompt }],
                MARKET_REPORT_SYSTEM,
                (chunk) => setStreamedContent(chunk),
                4000
            );

            const optimisticReport: MarketReport = {
                content: final,
                industry: profile.industry || industry,
                date: todayStr(),
                createdAt: new Date().toISOString(),
                searchQueries,
            };

            latestLocalMutationRef.current = Date.now();
            setCurrentReport(optimisticReport);
            setReportHistory((prev) => upsertReport(prev, optimisticReport));
            onReportChange(optimisticReport);

            setAutomaticExtractionRunning(true);
            const saved = await saveMarketReport(userId, final, profile.industry || industry, {
                searchQueries,
                founderContext: buildFounderContext(profile),
            });
            if (saved) {
                latestLocalMutationRef.current = Date.now();
                setCurrentReport(saved);
                setReportHistory((prev) => upsertReport(prev, saved));
                onReportChange(saved);
                await loadStructuredData(saved, { silent: true });
            } else {
                setSaveError("This report is staying visible now, but the database save did not complete. Refresh later and verify it appears in Saved Reports.");
            }
            setAutomaticExtractionRunning(false);
            setStreamedContent("");
        } catch (err) {
            console.error("Market report error:", err);
            if (!currentReport?.content) {
                setStreamedContent("");
            }
            setSaveError("Report generation or saving failed. The latest result will remain visible in this session when available.");
        }

        setGenerating(false);
        setAutomaticExtractionRunning(false);
        setGenerationPhase("idle");
    };

    const showDailyBrief = activeTab === "brief";

    return (
        <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, position: "sticky", top: 0, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)", zIndex: 10, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <button onClick={onBack} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "var(--foundry-app-header-button-padding)", color: "#888", fontSize: "var(--foundry-app-header-button-font)", cursor: "pointer", flexShrink: 0 }}>← Hub</button>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "var(--foundry-app-header-title-font)", fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Market Intelligence</div>
                        <div style={{ fontSize: "var(--foundry-app-header-meta-font)", color: "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{industry}</div>
                    </div>
                </div>

                {/* Freshness badge */}
                {isCurrentReport && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(76,175,138,0.08)", border: "1px solid rgba(76,175,138,0.2)", borderRadius: 20, padding: "4px 10px", flexShrink: 0 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4CAF8A" }} />
                        <span style={{ fontSize: 10, color: "#4CAF8A", fontWeight: 600 }}>Current</span>
                    </div>
                )}
                {hasOutdatedReport && !generating && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(245,168,67,0.08)", border: "1px solid rgba(245,168,67,0.2)", borderRadius: 20, padding: "4px 10px", flexShrink: 0 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F5A843" }} />
                        <span style={{ fontSize: 10, color: "#F5A843", fontWeight: 600 }}>Outdated</span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="foundry-app-page__content" style={{ flex: 1, overflowY: "auto", padding: "20px 16px 60px", maxWidth: 980, width: "100%", margin: "0 auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <MarketIntelligenceTabs activeTab={activeTab} onSelect={setActiveTab} />
                    {!showDailyBrief && (
                        <StructuredReportSelector reportHistory={reportHistory} currentReport={currentReport} onSelect={selectReport} />
                    )}
                </div>

                {alertItems.length > 0 && (
                    <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 12, background: "rgba(232,98,42,0.08)", border: "1px solid rgba(232,98,42,0.22)", color: "#D8C9BC", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, lineHeight: 1.6 }}>
                        <strong style={{ color: "#E8622A" }}>New since last report:</strong> {alertItems.join(", ")}
                        {newCompetitorsSinceLastReport.length + highImpactTrendAlerts.length > alertItems.length ? " and more" : ""}
                    </div>
                )}
                {actionNotice && (
                    <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(76,175,138,0.08)", border: "1px solid rgba(76,175,138,0.2)", color: "#8BD8A9", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12 }}>
                        {actionNotice}
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, margin: "0 0 14px", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.025)", cursor: scheduleSaving ? "wait" : "pointer" }}>
                        <input
                            type="checkbox"
                            checked={scheduleEnabled}
                            disabled={scheduleSaving}
                            onChange={(event) => toggleWeeklyRefresh(event.target.checked)}
                            style={{ accentColor: "#E8622A", width: 16, height: 16 }}
                        />
                        <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "#C8C4BE", fontWeight: 700 }}>
                            Schedule weekly refresh
                        </span>
                        <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: "#666" }}>
                            {scheduleEnabled ? `Next: ${formatScheduleDate(nextRefreshAt)}` : "Off"}
                        </span>
                    </label>
                    <button
                        onClick={() => generate({ force: true, ignoreLimit: true })}
                        disabled={generating}
                        style={{
                            background: generating ? "rgba(255,255,255,0.04)" : "rgba(232,98,42,0.1)",
                            border: generating ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(232,98,42,0.22)",
                            borderRadius: 9,
                            padding: "7px 11px",
                            color: generating ? "#555" : "#E8622A",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: generating ? "default" : "pointer",
                            fontFamily: "'DM Sans', system-ui, sans-serif",
                        }}
                    >
                        {generating ? "Rerunning..." : "Temporary: Rerun Report"}
                    </button>
                </div>

                {!showDailyBrief && (
                    <div style={{ marginBottom: 16 }}>
                        {automaticExtractionRunning && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#77716A", padding: "12px 2px 6px", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E8622A", animation: "forgePulse 1.4s infinite ease-in-out" }} />
                                <span>Analyzing report...</span>
                            </div>
                        )}
                        {structuredLoading ? (
                            <div style={{ fontSize: 12, color: "#77716A", padding: "18px 2px" }}>
                                Loading structured market intelligence...
                            </div>
                        ) : structuredError ? (
                            <div style={{
                                fontSize: 12,
                                color: "#F5A843",
                                lineHeight: 1.7,
                                background: "rgba(245,168,67,0.05)",
                                border: "1px solid rgba(245,168,67,0.15)",
                                borderRadius: 12,
                                padding: "14px 16px",
                            }}>
                                {structuredError}
                            </div>
                        ) : (
                            <div style={{ display: "grid", gap: 14 }}>
                                <WhatChangedPanel changes={marketChanges} />
                                {activeTab === "competitors" ? (
                                    <StructuredCompetitorsPanel competitors={competitors} onCreateAction={createSuggestedAction} onAskForgeAboutAction={onAskForgeAboutAction} />
                                ) : activeTab === "trends" ? (
                                    <StructuredTrendsPanel trends={trends} onCreateAction={createSuggestedAction} onAskForgeAboutAction={onAskForgeAboutAction} />
                                ) : activeTab === "benchmarks" ? (
                                    <StructuredBenchmarksPanel benchmarks={benchmarks} onCreateAction={createSuggestedAction} onAskForgeAboutAction={onAskForgeAboutAction} />
                                ) : (
                                    <StructuredSourcesPanel sources={sources} />
                                )}
                            </div>
                        )}
                    </div>
                )}

                {showDailyBrief && (
                    <>
                        {isNarrow && reportHistory.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>Saved Reports</div>
                                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch" as any }}>
                                    {reportHistory.map((entry) => {
                                        const selected = currentReport?.date === entry.date;
                                        const freshness = getFreshness(entry);
                                        const sourceCount = entry.id ? sourceCountsByReportId[entry.id] || 0 : 0;
                                        return (
                                            <button
                                                key={entry.id || entry.date}
                                                onClick={() => selectReport(entry)}
                                                style={{
                                                    flexShrink: 0,
                                                    textAlign: "left",
                                                    background: selected ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.02)",
                                                    border: selected ? "1px solid rgba(232,98,42,0.24)" : "1px solid rgba(255,255,255,0.06)",
                                                    borderRadius: 10,
                                                    padding: "10px 14px",
                                                    color: "#F0EDE8",
                                                    cursor: "pointer",
                                                    maxWidth: 220,
                                                }}
                                            >
                                                <div style={{ fontSize: 13, fontWeight: 600, color: selected ? "#E8622A" : "#C8C4BE", whiteSpace: "nowrap" }}>
                                                    {formatReportDate(entry.date)}
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: freshness.color }} />
                                                    <span style={{ fontSize: 10, color: freshness.color, whiteSpace: "nowrap" }}>{freshness.label}</span>
                                                </div>
                                                {sourceCount > 0 && (
                                                    <div style={{ display: "inline-flex", marginTop: 7, padding: "3px 7px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(240,237,232,0.5)", fontSize: 11, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                                                        {sourceCount} source{sourceCount === 1 ? "" : "s"}
                                                    </div>
                                                )}
                                                {freshness.status === "outdated" && (
                                                    <span
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            generate({ force: true });
                                                        }}
                                                        style={{
                                                            display: "inline-flex",
                                                            marginTop: 8,
                                                            padding: "5px 9px",
                                                            borderRadius: 8,
                                                            border: "1px solid rgba(232,98,42,0.22)",
                                                            color: "#E8622A",
                                                            fontSize: 10,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        Regenerate
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div style={{ display: isNarrow ? "block" : "grid", gridTemplateColumns: reportHistory.length > 0 ? "minmax(0, 1fr) 260px" : "minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
                            <div>
                                <DailyBriefPanel
                                    profileIndustry={profile.industry}
                                    mounted={mounted}
                                    generating={generating}
                                    generationPhase={generationPhase}
                                    streamedContent={streamedContent}
                                    currentReport={currentReport}
                                    currentReportDate={currentReport?.date}
                                    isCurrentReport={isCurrentReport}
                                    hasSavedReport={hasSavedReport}
                                    hasOutdatedReport={hasOutdatedReport}
                                    hasReachedLimit={hasReachedLimit}
                                    canGenerateReport={canGenerateReport}
                                    generationLimit={generationLimit}
                                    saveError={saveError}
                                    searchQueries={currentReport?.searchQueries ?? []}
                                    onGenerate={generate}
                                />
                            </div>

                            {!isNarrow && reportHistory.length > 0 && (
                                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "16px 14px", position: "sticky", top: 78 }}>
                                    <div style={{ fontSize: 12, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>
                                        Saved Reports
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
                                        {reportHistory.map((entry) => {
                                            const selected = currentReport?.date === entry.date;
                                            const freshness = getFreshness(entry);
                                            const sourceCount = entry.id ? sourceCountsByReportId[entry.id] || 0 : 0;
                                            return (
                                                <button
                                                    key={entry.id || entry.date}
                                                    onClick={() => selectReport(entry)}
                                                    style={{
                                                        textAlign: "left",
                                                        background: selected ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.02)",
                                                        border: selected ? "1px solid rgba(232,98,42,0.24)" : "1px solid rgba(255,255,255,0.06)",
                                                        borderRadius: 10,
                                                        padding: "12px 14px",
                                                        color: "#F0EDE8",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: selected ? "#E8622A" : "#C8C4BE", marginBottom: 6, lineHeight: 1.35 }}>
                                                        {formatReportDate(entry.date)}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: "#77716A", lineHeight: 1.6 }}>
                                                        {getReportPreview(entry.content)}
                                                    </div>
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: freshness.color, flexShrink: 0 }} />
                                                            <span style={{ fontSize: 10, color: freshness.color, lineHeight: 1.3 }}>{freshness.label}</span>
                                                        </div>
                                                        {freshness.status === "outdated" && (
                                                            <span
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    generate({ force: true });
                                                                }}
                                                                style={{
                                                                    flexShrink: 0,
                                                                    padding: "5px 8px",
                                                                    borderRadius: 8,
                                                                    border: "1px solid rgba(232,98,42,0.22)",
                                                                    color: "#E8622A",
                                                                    fontSize: 10,
                                                                    fontWeight: 700,
                                                                }}
                                                            >
                                                                Regenerate
                                                            </span>
                                                        )}
                                                    </div>
                                                    {sourceCount > 0 && (
                                                        <div style={{ display: "inline-flex", marginTop: 8, padding: "3px 7px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(240,237,232,0.5)", fontSize: 11, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                                                            {sourceCount} source{sourceCount === 1 ? "" : "s"}
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

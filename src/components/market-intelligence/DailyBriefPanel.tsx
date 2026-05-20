import { useMemo, useState } from "react";
import type { MarketReportSource } from "../../db";
import { ReportSection, formatReportDate, type MarketReport } from "./shared";

type GenerationPhase = "idle" | "searching" | "generating";

type Citation = {
    title: string;
    url: string;
};

function extractCitations(content: string): Citation[] {
    const citations = new Map<string, Citation>();
    const citationPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
    let match: RegExpExecArray | null;

    while ((match = citationPattern.exec(content)) !== null) {
        const linkText = match[1]?.trim();
        const url = match[2]?.trim();
        const title = linkText?.replace(/^Source:\s*/i, "").trim();
        if (title && url && !citations.has(url)) {
            citations.set(url, { title, url });
        }
    }

    return Array.from(citations.values());
}

function mergeCitations(contentCitations: Citation[], sourceReferences: MarketReportSource[]): Citation[] {
    const citations = new Map<string, Citation>();

    for (const citation of contentCitations) {
        citations.set(citation.url, citation);
    }

    for (const source of sourceReferences) {
        const title = source.title?.trim();
        const url = source.url?.trim();
        if (title && url && !citations.has(url)) {
            citations.set(url, { title, url });
        }
    }

    return Array.from(citations.values());
}

export default function DailyBriefPanel({
    profileIndustry,
    mounted,
    generating,
    generationPhase,
    streamedContent,
    currentReport,
    currentReportDate,
    isCurrentReport,
    hasSavedReport,
    hasOutdatedReport,
    hasReachedLimit,
    canGenerateReport,
    generationLimit,
    saveError,
    searchQueries,
    sourceReferences = [],
    onGenerate,
}: {
    profileIndustry?: string | null;
    mounted: boolean;
    generating: boolean;
    generationPhase: GenerationPhase;
    streamedContent: string;
    currentReport: MarketReport | null;
    currentReportDate?: string;
    isCurrentReport: boolean;
    hasSavedReport: boolean;
    hasOutdatedReport: boolean;
    hasReachedLimit: boolean;
    canGenerateReport: boolean;
    generationLimit: number | null;
    saveError: string | null;
    searchQueries: string[];
    sourceReferences?: MarketReportSource[];
    onGenerate: () => void;
}) {
    const reportKey = currentReport?.id ?? currentReport?.date ?? "draft";
    const [sourcesState, setSourcesState] = useState({ reportKey, open: false });
    const [researchState, setResearchState] = useState({ reportKey, open: false });
    const sourcesOpen = sourcesState.reportKey === reportKey && sourcesState.open;
    const researchOpen = researchState.reportKey === reportKey && researchState.open;
    const displayContent = generating
        ? streamedContent || currentReport?.content || ""
        : currentReport?.content || "";
    const citations = useMemo(
        () => mergeCitations(extractCitations(displayContent), sourceReferences),
        [displayContent, sourceReferences],
    );
    const loadingText = generationPhase === "searching"
        ? "Searching live sources across the web..."
        : "Analyzing and generating your report...";

    return (
        <>
            {generationLimit !== null && (
                <div style={{
                    marginBottom: 14,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: hasReachedLimit ? "rgba(217,177,93,0.08)" : "rgba(142,160,181,0.055)",
                    border: hasReachedLimit ? "1px solid rgba(217,177,93,0.2)" : "1px solid rgba(142,160,181,0.15)",
                    fontSize: 12,
                    color: hasReachedLimit ? "var(--tekori-amber)" : "var(--color-text-muted)",
                    lineHeight: 1.65,
                }}>
                    {hasReachedLimit
                        ? `Free preview includes ${generationLimit} saved market reports. You have reached that limit.`
                        : `Free preview includes up to ${generationLimit} market reports so early founders can test the workflow without opening the full research library.`}
                </div>
            )}

            {!hasSavedReport && !generating && (
                <div style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.4s ease" }}>
                    <div style={{ marginBottom: 28, animation: "fadeSlideUp 0.4s ease both", textAlign: "left" }}>
                        <div style={{ fontSize: 22, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, marginBottom: 6, lineHeight: 1.25 }}>
                            Daily Market Brief
                        </div>
                        <div style={{ fontSize: 13, color: "var(--foundry-text-secondary)", fontFamily: "var(--tekori-font-ui)", fontStyle: "italic", lineHeight: 1.75, maxWidth: 480, margin: 0 }}>
                            Navi generates a focused intelligence report on your market — trends, competitors, risks, and opportunities — tailored to your stage and business context.
                        </div>
                    </div>

                    <div style={{ background: "rgba(7,26,47,0.02)", border: "1px solid rgba(7,26,47,0.06)", borderRadius: 14, padding: "18px 20px", marginBottom: 20, animation: "fadeSlideUp 0.4s ease 0.05s both" }}>
                        <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>What you'll get</div>
                        {["Market overview for your specific industry", "Key trends reshaping the space", "Competitive landscape at your stage", "Financial and funding signals", "Risks and opportunities right now", "What matters most — given your stage and strategy"].map((item, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(142,160,181,0.12)", border: "1px solid rgba(142,160,181,0.22)", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--tekori-muted-text)" }} />
                                </div>
                                <span style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 }}>{item}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", fontFamily: "var(--tekori-font-ui)", fontStyle: "italic", marginBottom: 18, lineHeight: 1.6, animation: "fadeSlideUp 0.4s ease 0.1s both" }}>
                        Based on Navi's knowledge of your industry — not a live data feed. Generated once per day, then available to Navi in your conversations.
                    </div>

                    <button
                        onClick={onGenerate}
                        disabled={!canGenerateReport}
                        style={{ width: "100%", padding: "15px", background: canGenerateReport ? "linear-gradient(135deg, var(--tekori-gold), var(--tekori-soft-gold))" : "rgba(7,26,47,0.06)", border: "none", borderRadius: 14, color: canGenerateReport ? "var(--color-primary)" : "var(--color-text-muted)", fontSize: 15, fontWeight: 800, cursor: canGenerateReport ? "pointer" : "default", fontFamily: "var(--tekori-font-ui)", animation: "fadeSlideUp 0.4s ease 0.15s both" }}
                    >
                        {hasReachedLimit ? "Preview limit reached" : "Generate Today's Report →"}
                    </button>
                </div>
            )}

            {hasOutdatedReport && !generating && currentReport && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", background: "rgba(244,182,66,0.05)", border: "1px solid rgba(244,182,66,0.15)", borderRadius: 10, marginBottom: 18, animation: "fadeSlideUp 0.3s ease both" }}>
                    <div>
                        <div style={{ fontSize: 11, color: "var(--tekori-amber)", fontWeight: 600, marginBottom: 2 }}>Report from {formatReportDate(currentReport.date)}</div>
                        <div style={{ fontSize: 10, color: "var(--foundry-text-muted)" }}>Generate a fresh report for today</div>
                    </div>
                    <button
                        onClick={onGenerate}
                        disabled={!canGenerateReport}
                        style={{ background: canGenerateReport ? "rgba(244,182,66,0.12)" : "rgba(7,26,47,0.04)", border: canGenerateReport ? "1px solid rgba(244,182,66,0.25)" : "1px solid rgba(7,26,47,0.06)", borderRadius: 8, padding: "6px 14px", color: canGenerateReport ? "var(--tekori-amber)" : "var(--color-text-muted)", fontSize: 11, fontWeight: 600, cursor: canGenerateReport ? "pointer" : "default", flexShrink: 0 }}
                    >
                        {hasReachedLimit ? "Preview limit reached" : "Refresh"}
                    </button>
                </div>
            )}

            {generating && !streamedContent && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14, padding: "70px 0", animation: "fadeIn 0.3s ease" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--tekori-muted-text)", animation: "forgePulse 1.4s infinite ease-in-out", animationDelay: `${i * 0.2}s` }} />
                        ))}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--foundry-text-muted)", fontFamily: "var(--tekori-font-ui)", fontStyle: "italic" }}>
                        {loadingText}
                    </div>
                </div>
            )}

            {displayContent && (
                <div style={{ animation: "fadeSlideUp 0.4s ease both" }}>
                    <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 20, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, lineHeight: 1.25, marginBottom: 4 }}>
                            {profileIndustry || "Market"} Intelligence
                        </div>
                        <div style={{ fontSize: 11, color: "var(--foundry-text-muted)" }}>
                            {generating ? "Writing..." : currentReportDate ? formatReportDate(currentReportDate) : "Today"}
                            {generating && <span style={{ marginLeft: 8, color: "var(--tekori-muted-text)" }}>● Live</span>}
                        </div>
                    </div>

                    <div style={{ background: "rgba(7,26,47,0.02)", border: "1px solid rgba(7,26,47,0.06)", borderRadius: 14, padding: "20px 18px", marginBottom: 14 }}>
                        <ReportSection content={displayContent} />
                        {!generating && (
                            <div style={{ marginTop: 18, paddingTop: 14, background: "rgba(7,26,47,0.03)", borderTop: "1px solid rgba(7,26,47,0.08)", display: "grid", gap: 12 }}>
                                <button
                                    onClick={() => setSourcesState((state) => ({
                                        reportKey,
                                        open: state.reportKey === reportKey ? !state.open : true,
                                    }))}
                                    style={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 10,
                                        background: "transparent",
                                        border: "none",
                                        padding: "0 0 2px",
                                        color: "var(--color-text-soft)",
                                        cursor: "pointer",
                                        fontFamily: "var(--tekori-font-ui)",
                                        fontSize: 12,
                                        fontWeight: 700,
                                    }}
                                >
                                    <span>View Sources ({citations.length})</span>
                                    <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>{sourcesOpen ? "Hide" : "Show"}</span>
                                </button>
                                {sourcesOpen && (
                                    citations.length > 0 ? (
                                        <ol style={{ margin: "10px 0 0 18px", padding: 0 }}>
                                            {citations.map((source) => (
                                                <li key={source.url} style={{ color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.7, marginBottom: 6, fontFamily: "var(--tekori-font-ui)" }}>
                                                    <a
                                                        href={source.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: "var(--tekori-muted-text)", textDecoration: "none", fontSize: 12, fontFamily: "var(--tekori-font-ui)" }}
                                                    >
                                                        {source.title}
                                                    </a>
                                                    <span style={{ color: "rgba(16,32,51,0.58)" }}> - {source.url}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    ) : (
                                        <div style={{ marginTop: 10, color: "rgba(16,32,51,0.58)", fontSize: 12, lineHeight: 1.6, fontFamily: "var(--tekori-font-ui)" }}>
                                            This report was generated from AI training data synthesis. Live source data was unavailable.
                                        </div>
                                    )
                                )}
                                <div style={{ borderTop: "1px solid rgba(7,26,47,0.06)", paddingTop: 12 }}>
                                    <button
                                        onClick={() => setResearchState((state) => ({
                                            reportKey,
                                            open: state.reportKey === reportKey ? !state.open : true,
                                        }))}
                                        style={{
                                            width: "100%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 10,
                                            background: "transparent",
                                            border: "none",
                                            padding: 0,
                                            color: "var(--color-text-soft)",
                                            cursor: "pointer",
                                            fontFamily: "var(--tekori-font-ui)",
                                            fontSize: 12,
                                            fontWeight: 700,
                                        }}
                                    >
                                        <span>How this was researched</span>
                                        <span style={{ color: "var(--color-text-muted)", fontSize: 11 }}>{researchOpen ? "Hide" : "Show"}</span>
                                    </button>
                                    {researchOpen && (
                                        searchQueries.length > 0 ? (
                                            <ol style={{ margin: "10px 0 0 18px", padding: 0 }}>
                                                {searchQueries.slice(0, 5).map((query) => (
                                                    <li key={query} style={{ color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.7, marginBottom: 4, fontFamily: "var(--tekori-font-ui)" }}>
                                                        {query}
                                                    </li>
                                                ))}
                                            </ol>
                                        ) : (
                                            <div style={{ marginTop: 10, color: "rgba(16,32,51,0.58)", fontSize: 12, lineHeight: 1.6, fontFamily: "var(--tekori-font-ui)" }}>
                                                Search query history is not available for this saved report.
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {!generating && isCurrentReport && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(76,175,138,0.05)", border: "1px solid rgba(76,175,138,0.12)", borderRadius: 10, marginBottom: 14, animation: "fadeSlideUp 0.3s ease both" }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-success)", flexShrink: 0 }} />
                            <div style={{ fontSize: 12, color: "var(--color-success)" }}>
                                Navi can now reference this report in your conversations.
                            </div>
                        </div>
                    )}

                    {saveError && <div style={{ fontSize: 11, color: "var(--tekori-amber)", lineHeight: 1.6, marginBottom: 12 }}>{saveError}</div>}

                    {!generating && (
                        <div style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--tekori-font-ui)", fontStyle: "italic", textAlign: "left", paddingTop: 8 }}>
                            Market intelligence generated from live research when available, with AI synthesis layered on top
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

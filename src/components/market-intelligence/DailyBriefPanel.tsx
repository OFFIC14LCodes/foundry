import { useEffect, useMemo, useState } from "react";
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
    onGenerate: () => void;
}) {
    const [sourcesOpen, setSourcesOpen] = useState(false);
    const displayContent = generating
        ? streamedContent || currentReport?.content || ""
        : currentReport?.content || "";
    const citations = useMemo(() => extractCitations(displayContent), [displayContent]);
    const loadingText = generationPhase === "searching"
        ? "Searching live sources across the web..."
        : "Analyzing and generating your report...";

    useEffect(() => {
        setSourcesOpen(false);
    }, [currentReport?.id, currentReport?.date]);

    return (
        <>
            {generationLimit !== null && (
                <div style={{
                    marginBottom: 14,
                    padding: "12px 14px",
                    borderRadius: 12,
                    background: hasReachedLimit ? "rgba(232,98,42,0.07)" : "rgba(232,98,42,0.05)",
                    border: hasReachedLimit ? "1px solid rgba(232,98,42,0.2)" : "1px solid rgba(232,98,42,0.14)",
                    fontSize: 12,
                    color: hasReachedLimit ? "#D9B9A6" : "#BDAFA2",
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
                        <div style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 6, lineHeight: 1.25 }}>
                            Daily Market Brief
                        </div>
                        <div style={{ fontSize: 13, color: "#666", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", lineHeight: 1.75, maxWidth: 480, margin: 0 }}>
                            Forge generates a focused intelligence report on your market — trends, competitors, risks, and opportunities — tailored to your stage and business context.
                        </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 20px", marginBottom: 20, animation: "fadeSlideUp 0.4s ease 0.05s both" }}>
                        <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>What you'll get</div>
                        {["Market overview for your specific industry", "Key trends reshaping the space", "Competitive landscape at your stage", "Financial and funding signals", "Risks and opportunities right now", "What matters most — given your stage and strategy"].map((item, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
                                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(232,98,42,0.15)", border: "1px solid rgba(232,98,42,0.25)", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#E8622A" }} />
                                </div>
                                <span style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>{item}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ fontSize: 10, color: "#444", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", marginBottom: 18, lineHeight: 1.6, animation: "fadeSlideUp 0.4s ease 0.1s both" }}>
                        Based on Forge's knowledge of your industry — not a live data feed. Generated once per day, then available to Forge in your conversations.
                    </div>

                    <button
                        onClick={onGenerate}
                        disabled={!canGenerateReport}
                        style={{ width: "100%", padding: "15px", background: canGenerateReport ? "linear-gradient(135deg, #E8622A, #c9521e)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 14, color: canGenerateReport ? "#fff" : "#555", fontSize: 15, fontWeight: 700, cursor: canGenerateReport ? "pointer" : "default", fontFamily: "'Lora', Georgia, serif", animation: "fadeSlideUp 0.4s ease 0.15s both" }}
                    >
                        {hasReachedLimit ? "Preview limit reached" : "Generate Today's Report →"}
                    </button>
                </div>
            )}

            {hasOutdatedReport && !generating && currentReport && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", background: "rgba(245,168,67,0.05)", border: "1px solid rgba(245,168,67,0.15)", borderRadius: 10, marginBottom: 18, animation: "fadeSlideUp 0.3s ease both" }}>
                    <div>
                        <div style={{ fontSize: 11, color: "#F5A843", fontWeight: 600, marginBottom: 2 }}>Report from {formatReportDate(currentReport.date)}</div>
                        <div style={{ fontSize: 10, color: "#555" }}>Generate a fresh report for today</div>
                    </div>
                    <button
                        onClick={onGenerate}
                        disabled={!canGenerateReport}
                        style={{ background: canGenerateReport ? "rgba(245,168,67,0.12)" : "rgba(255,255,255,0.04)", border: canGenerateReport ? "1px solid rgba(245,168,67,0.25)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "6px 14px", color: canGenerateReport ? "#F5A843" : "#555", fontSize: 11, fontWeight: 600, cursor: canGenerateReport ? "pointer" : "default", flexShrink: 0 }}
                    >
                        {hasReachedLimit ? "Preview limit reached" : "Refresh"}
                    </button>
                </div>
            )}

            {generating && !streamedContent && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 14, padding: "70px 0", animation: "fadeIn 0.3s ease" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#E8622A", animation: "forgePulse 1.4s infinite ease-in-out", animationDelay: `${i * 0.2}s` }} />
                        ))}
                    </div>
                    <div style={{ fontSize: 13, color: "#555", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic" }}>
                        {loadingText}
                    </div>
                </div>
            )}

            {displayContent && (
                <div style={{ animation: "fadeSlideUp 0.4s ease both" }}>
                    <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 20, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, lineHeight: 1.25, marginBottom: 4 }}>
                            {profileIndustry || "Market"} Intelligence
                        </div>
                        <div style={{ fontSize: 11, color: "#555" }}>
                            {generating ? "Writing..." : currentReportDate ? formatReportDate(currentReportDate) : "Today"}
                            {generating && <span style={{ marginLeft: 8, color: "#E8622A" }}>● Live</span>}
                        </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "20px 18px", marginBottom: 14 }}>
                        <ReportSection content={displayContent} />
                        {!generating && (
                            <div style={{ marginTop: 18, paddingTop: 14, background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                                <button
                                    onClick={() => setSourcesOpen((open) => !open)}
                                    style={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 10,
                                        background: "transparent",
                                        border: "none",
                                        padding: "0 0 2px",
                                        color: "#C8C4BE",
                                        cursor: "pointer",
                                        fontFamily: "'DM Sans', system-ui, sans-serif",
                                        fontSize: 12,
                                        fontWeight: 700,
                                    }}
                                >
                                    <span>View Sources ({citations.length})</span>
                                    <span style={{ color: "#77716A", fontSize: 11 }}>{sourcesOpen ? "Hide" : "Show"}</span>
                                </button>
                                {sourcesOpen && (
                                    citations.length > 0 ? (
                                        <ol style={{ margin: "10px 0 0 18px", padding: 0 }}>
                                            {citations.map((source) => (
                                                <li key={source.url} style={{ color: "#77716A", fontSize: 12, lineHeight: 1.7, marginBottom: 6, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                                                    <a
                                                        href={source.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{ color: "#E8622A", textDecoration: "none", fontSize: 12, fontFamily: "'DM Sans', system-ui, sans-serif" }}
                                                    >
                                                        {source.title}
                                                    </a>
                                                    <span style={{ color: "rgba(240,237,232,0.4)" }}> - {source.url}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    ) : (
                                        <div style={{ marginTop: 10, color: "rgba(240,237,232,0.4)", fontSize: 12, lineHeight: 1.6, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                                            This report was generated from AI training data synthesis. Live source data was unavailable.
                                        </div>
                                    )
                                )}
                            </div>
                        )}
                    </div>

                    {!generating && isCurrentReport && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(76,175,138,0.05)", border: "1px solid rgba(76,175,138,0.12)", borderRadius: 10, marginBottom: 14, animation: "fadeSlideUp 0.3s ease both" }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4CAF8A", flexShrink: 0 }} />
                            <div style={{ fontSize: 12, color: "#4CAF8A" }}>
                                Forge can now reference this report in your conversations.
                            </div>
                        </div>
                    )}

                    {saveError && <div style={{ fontSize: 11, color: "#F5A843", lineHeight: 1.6, marginBottom: 12 }}>{saveError}</div>}

                    {!generating && (
                        <div style={{ fontSize: 10, color: "#333", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", textAlign: "left", paddingTop: 8 }}>
                            Market intelligence generated from live research when available, with AI synthesis layered on top
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

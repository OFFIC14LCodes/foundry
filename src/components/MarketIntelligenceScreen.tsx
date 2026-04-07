import { useEffect, useRef, useState } from "react";
import { cleanAIText } from "../lib/cleanAIText";
import { streamForgeAPI } from "../lib/forgeApi";
import { buildMarketReportPrompt, MARKET_REPORT_SYSTEM } from "../constants/marketPrompt";
import { loadLatestMarketReport, loadMarketReportHistory, saveMarketReport } from "../db";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface MarketReport {
    content: string;
    industry: string;
    date: string;
    createdAt?: string;
}

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

function hasUsableContent(report: MarketReport | null | undefined): boolean {
    if (!report?.content) return false;
    const content = report.content.trim();
    return content.length > 0 && content !== "Something went wrong.";
}

function formatReportDate(date: string): string {
    const d = new Date(`${date}T12:00:00`);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────
// Inline renderer — **bold** → <strong>
// ─────────────────────────────────────────────────────────────
function renderInline(text: string) {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
        i % 2 === 1
            ? <strong key={i} style={{ color: "#F0EDE8", fontWeight: 700 }}>{part}</strong>
            : <span key={i}>{part}</span>
    );
}

// ─────────────────────────────────────────────────────────────
// Report content renderer — markdown → styled JSX
// ─────────────────────────────────────────────────────────────
function ReportSection({ content }: { content: string }) {
    const lines = cleanAIText(content).split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith("## ")) {
            elements.push(
                <div key={i} style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#E8622A", fontWeight: 700, marginTop: i > 0 ? 26 : 0, marginBottom: 8, paddingBottom: 5, borderBottom: "1px solid rgba(232,98,42,0.15)", fontFamily: "'DM Sans', sans-serif" }}>
                    {line.slice(3)}
                </div>
            );
        } else if (line.startsWith("**") && line.endsWith("**")) {
            elements.push(
                <div key={i} style={{ fontSize: 12, fontWeight: 700, color: "#C8C4BE", marginTop: 10, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
                    {renderInline(line)}
                </div>
            );
        } else if (line.startsWith("- ") || line.startsWith("* ")) {
            const bullets: string[] = [];
            while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
                bullets.push(lines[i].slice(2));
                i++;
            }
            elements.push(
                <ul key={`ul-${i}`} style={{ margin: "4px 0 8px 14px", padding: 0 }}>
                    {bullets.map((b, j) => (
                        <li key={j} style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.75, marginBottom: 4, fontFamily: "'Lora', Georgia, serif" }}>
                            {renderInline(b)}
                        </li>
                    ))}
                </ul>
            );
            continue;
        } else if (line.trim() === "") {
            // skip — spacing from element margins
        } else {
            elements.push(
                <p key={i} style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.8, marginBottom: 8, fontFamily: "'Lora', Georgia, serif" }}>
                    {renderInline(line)}
                </p>
            );
        }

        i++;
    }

    return <>{elements}</>;
}

function upsertReport(history: MarketReport[], nextReport: MarketReport) {
    const next = [nextReport, ...history.filter((entry) => entry.date !== nextReport.date)];
    return next.sort((a, b) => b.date.localeCompare(a.date));
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
}: {
    profile: any;
    userId: string;
    report: MarketReport | null;
    onReportChange: (r: MarketReport | null) => void;
    onBack: () => void;
}) {
    const [generating, setGenerating] = useState(false);
    const [streamedContent, setStreamedContent] = useState("");
    const [mounted, setMounted] = useState(false);
    const [currentReport, setCurrentReport] = useState<MarketReport | null>(report);
    const [reportHistory, setReportHistory] = useState<MarketReport[]>(report ? [report] : []);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 640);
    const latestLocalMutationRef = useRef(0);

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

    const hasSavedReport = hasUsableContent(currentReport);
    const isCurrentReport = hasSavedReport && !!currentReport && isToday(currentReport.date);
    const hasOutdatedReport = hasSavedReport && !!currentReport && !isToday(currentReport.date);

    const industry = profile.industry || profile.idea?.slice(0, 40) || "your market";

    const selectReport = (next: MarketReport) => {
        latestLocalMutationRef.current = Date.now();
        setCurrentReport(next);
        onReportChange(next);
        setSaveError(null);
    };

    const generate = async () => {
        if (generating || isCurrentReport) return;
        setGenerating(true);
        setStreamedContent("");
        setSaveError(null);

        const prompt = buildMarketReportPrompt(profile);

        try {
            const final = await streamForgeAPI(
                [{ role: "user", content: prompt }],
                MARKET_REPORT_SYSTEM,
                (chunk) => setStreamedContent(chunk)
            );

            const optimisticReport: MarketReport = {
                content: final,
                industry: profile.industry || industry,
                date: todayStr(),
                createdAt: new Date().toISOString(),
            };

            latestLocalMutationRef.current = Date.now();
            setCurrentReport(optimisticReport);
            setReportHistory((prev) => upsertReport(prev, optimisticReport));
            onReportChange(optimisticReport);

            const saved = await saveMarketReport(userId, final, profile.industry || industry);
            if (saved) {
                latestLocalMutationRef.current = Date.now();
                setCurrentReport(saved);
                setReportHistory((prev) => upsertReport(prev, saved));
                onReportChange(saved);
            } else {
                setSaveError("This report is staying visible now, but the database save did not complete. Refresh later and verify it appears in Saved Reports.");
            }
            setStreamedContent("");
        } catch (err) {
            console.error("Market report error:", err);
            if (!currentReport?.content) {
                setStreamedContent("");
            }
            setSaveError("Report generation or saving failed. The latest result will remain visible in this session when available.");
        }

        setGenerating(false);
    };

    const displayContent = generating
        ? streamedContent || currentReport?.content || ""
        : currentReport?.content || "";
    const displayDate = currentReport?.date;

    return (
        <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, position: "sticky", top: 0, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)", zIndex: 10, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <button onClick={onBack} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 12px", color: "#888", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>← Hub</button>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Market Intelligence</div>
                        <div style={{ fontSize: 10, color: "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{industry}</div>
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
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 60px", maxWidth: 980, width: "100%", margin: "0 auto" }}>

                {/* Mobile: horizontal history strip above main content */}
                {isNarrow && reportHistory.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Saved Reports</div>
                        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch" as any }}>
                            {reportHistory.map((entry) => {
                                const selected = currentReport?.date === entry.date;
                                return (
                                    <button
                                        key={entry.date}
                                        onClick={() => selectReport(entry)}
                                        style={{
                                            flexShrink: 0,
                                            textAlign: "left",
                                            background: selected ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.02)",
                                            border: selected ? "1px solid rgba(232,98,42,0.24)" : "1px solid rgba(255,255,255,0.06)",
                                            borderRadius: 10,
                                            padding: "8px 12px",
                                            color: "#F0EDE8",
                                            cursor: "pointer",
                                            maxWidth: 180,
                                        }}
                                    >
                                        <div style={{ fontSize: 11, fontWeight: 600, color: selected ? "#E8622A" : "#C8C4BE", whiteSpace: "nowrap" }}>
                                            {formatReportDate(entry.date)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div style={{ display: isNarrow ? "block" : "grid", gridTemplateColumns: reportHistory.length > 0 ? "minmax(0, 1fr) 260px" : "minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
                    <div>

                {/* Empty state — no report at all */}
                {!hasSavedReport && !generating && (
                    <div style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.4s ease" }}>
                        <div style={{ marginBottom: 28, animation: "fadeSlideUp 0.4s ease both", textAlign: "center" }}>
                            <div style={{ fontSize: 22, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, marginBottom: 6, lineHeight: 1.25 }}>
                                Daily Market Brief
                            </div>
                            <div style={{ fontSize: 13, color: "#666", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", lineHeight: 1.75, maxWidth: 480, margin: "0 auto" }}>
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
                            onClick={generate}
                            style={{ width: "100%", padding: "15px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", animation: "fadeSlideUp 0.4s ease 0.15s both" }}
                        >
                            Generate Today's Report →
                        </button>
                    </div>
                )}

                {/* Outdated banner + regenerate */}
                {hasOutdatedReport && !generating && currentReport && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", background: "rgba(245,168,67,0.05)", border: "1px solid rgba(245,168,67,0.15)", borderRadius: 10, marginBottom: 18, animation: "fadeSlideUp 0.3s ease both" }}>
                        <div>
                            <div style={{ fontSize: 11, color: "#F5A843", fontWeight: 600, marginBottom: 2 }}>Report from {formatReportDate(currentReport.date)}</div>
                            <div style={{ fontSize: 10, color: "#555" }}>Generate a fresh report for today</div>
                        </div>
                        <button
                            onClick={generate}
                            style={{ background: "rgba(245,168,67,0.12)", border: "1px solid rgba(245,168,67,0.25)", borderRadius: 8, padding: "6px 14px", color: "#F5A843", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                        >
                            Refresh
                        </button>
                    </div>
                )}

                {/* Generating pulse state (before content starts streaming) */}
                {generating && !streamedContent && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "70px 0", animation: "fadeIn 0.3s ease" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#E8622A", animation: "forgePulse 1.4s infinite ease-in-out", animationDelay: `${i * 0.2}s` }} />
                            ))}
                        </div>
                        <div style={{ fontSize: 13, color: "#555", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic" }}>
                            Forge is reading your market...
                        </div>
                    </div>
                )}

                {/* Report card */}
                {displayContent && (
                    <div style={{ animation: "fadeSlideUp 0.4s ease both" }}>
                        {/* Report header */}
                        <div style={{ marginBottom: 18 }}>
                            <div style={{ fontSize: 20, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, lineHeight: 1.25, marginBottom: 4 }}>
                                {profile.industry || "Market"} Intelligence
                            </div>
                            <div style={{ fontSize: 11, color: "#555" }}>
                                {generating ? "Writing..." : displayDate ? formatReportDate(displayDate) : "Today"}
                                {generating && (
                                    <span style={{ marginLeft: 8, color: "#E8622A" }}>● Live</span>
                                )}
                            </div>
                        </div>

                        {/* Report body */}
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "20px 18px", marginBottom: 14 }}>
                            <ReportSection content={displayContent} />
                        </div>

                        {/* Post-generation confirmation */}
                        {!generating && isCurrentReport && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(76,175,138,0.05)", border: "1px solid rgba(76,175,138,0.12)", borderRadius: 10, marginBottom: 14, animation: "fadeSlideUp 0.3s ease both" }}>
                                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4CAF8A", flexShrink: 0 }} />
                                <div style={{ fontSize: 12, color: "#4CAF8A" }}>
                                    Forge can now reference this report in your conversations.
                                </div>
                            </div>
                        )}

                        {saveError && (
                            <div style={{ fontSize: 11, color: "#F5A843", lineHeight: 1.6, marginBottom: 12 }}>
                                {saveError}
                            </div>
                        )}

                        {/* Footer */}
                        {!generating && (
                            <div style={{ fontSize: 10, color: "#333", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", textAlign: "center", paddingTop: 8 }}>
                                AI-synthesised intelligence based on industry knowledge · Not a live data feed
                            </div>
                        )}
                    </div>
                )}
                    </div>

                    {!isNarrow && reportHistory.length > 0 && (
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 12px", position: "sticky", top: 78 }}>
                            <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                                Saved Reports
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
                                {reportHistory.map((entry) => {
                                    const selected = currentReport?.date === entry.date;
                                    return (
                                        <button
                                            key={entry.date}
                                            onClick={() => selectReport(entry)}
                                            style={{
                                                textAlign: "left",
                                                background: selected ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.02)",
                                                border: selected ? "1px solid rgba(232,98,42,0.24)" : "1px solid rgba(255,255,255,0.06)",
                                                borderRadius: 10,
                                                padding: "10px 12px",
                                                color: "#F0EDE8",
                                                cursor: "pointer",
                                            }}
                                        >
                                            <div style={{ fontSize: 11, fontWeight: 600, color: selected ? "#E8622A" : "#C8C4BE", marginBottom: 4 }}>
                                                {formatReportDate(entry.date)}
                                            </div>
                                            <div style={{ fontSize: 10, color: "#666", lineHeight: 1.5 }}>
                                                {entry.content.slice(0, 110).trim()}{entry.content.length > 110 ? "..." : ""}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

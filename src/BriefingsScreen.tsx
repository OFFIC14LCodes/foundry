import { useState, useEffect, type ReactNode } from "react";
import { saveBriefing, type FounderDecision, type SavedBriefing, type StageSummary, type FounderNudge } from "./db";
import Logo from "./components/Logo";
import { STAGES_DATA } from "./constants/stages";
import { loadAcademyWeeklyActivity, type AcademyWeeklyActivity } from "./lib/academyDb";
import { buildWeeklyBriefingIntelligence, buildWeeklyBriefingPrompt } from "./lib/weeklyBriefingIntelligence";
import type { FoundryActionSuggestion } from "./lib/foundryActions";
import { suggestActionFromWeeklyBriefing } from "./lib/foundryActions";
import ActionSuggestionCard from "./components/actions/ActionSuggestionCard";

type ParsedBriefingSection = {
    number: number;
    title: string;
    lines: string[];
};

function renderInline(text: string) {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
        i % 2 === 1
            ? <strong key={i} style={{ color: "#F0EDE8", fontWeight: 700 }}>{part}</strong>
            : <span key={i}>{part}</span>
    );
}

function parseBriefingSections(text: string): ParsedBriefingSection[] {
    const lines = text.split("\n");
    const sections: ParsedBriefingSection[] = [];
    let current: ParsedBriefingSection | null = null;

    lines.forEach((line) => {
        const header = line.match(/^(\d+)\.\s+(.*)$/);
        if (header) {
            current = { number: Number(header[1]), title: header[2].replace(/\*\*/g, "").trim(), lines: [] };
            sections.push(current);
            return;
        }
        if (current) current.lines.push(line);
    });

    if (sections.length > 0) return sections;
    return [{ number: 1, title: "Briefing", lines }];
}

function SectionContent({ lines }: { lines: string[] }) {
    const blocks: ReactNode[] = [];
    let paragraphLines: string[] = [];

    const flushParagraph = () => {
        if (paragraphLines.length === 0) return;
        blocks.push(
            <div key={`p-${blocks.length}`} style={{ fontSize: 14, color: "rgba(240,237,232,0.8)", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" }}>
                {renderInline(paragraphLines.join(" "))}
            </div>
        );
        paragraphLines = [];
    };

    lines.forEach((line) => {
        if (!line.trim()) {
            flushParagraph();
            return;
        }

        if (line.startsWith("- ") || line.startsWith("* ")) {
            flushParagraph();
            blocks.push(
                <div key={`b-${blocks.length}`} style={{ display: "flex", gap: 8, paddingLeft: 8, fontSize: 14, color: "rgba(240,237,232,0.8)", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" }}>
                    <span style={{ color: "#E8622A", flexShrink: 0 }}>•</span>
                    <span>{renderInline(line.slice(2))}</span>
                </div>
            );
            return;
        }

        paragraphLines.push(line.trim());
    });

    flushParagraph();
    return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{blocks}</div>;
}

function BriefingText({ text }: { text: string }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {parseBriefingSections(text).map((section, index) => {
                const normalizedTitle = section.title.toLowerCase();
                const isFocus = normalizedTitle.includes("this week's focus");
                const isAction = normalizedTitle.includes("one concrete next action");
                const highlighted = isFocus || isAction;

                return (
                    <section
                        key={`${section.number}-${section.title}`}
                        style={{
                            borderTop: index === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                            paddingTop: index === 0 ? 0 : 14,
                        }}
                    >
                        <div
                            style={{
                                background: isFocus ? "rgba(232,98,42,0.06)" : isAction ? "rgba(76,175,138,0.06)" : "transparent",
                                border: isFocus ? "1px solid rgba(232,98,42,0.15)" : isAction ? "1px solid rgba(76,175,138,0.15)" : "none",
                                borderRadius: highlighted ? 8 : 0,
                                padding: highlighted ? 12 : 0,
                            }}
                        >
                            <div style={{ fontSize: 15, color: "#F0EDE8", fontWeight: 600, fontFamily: "'Lora', Georgia, serif", marginBottom: 8 }}>
                                {section.title}
                            </div>
                            <SectionContent lines={section.lines} />
                        </div>
                    </section>
                );
            })}
        </div>
    );
}

function wordCount(text: string) {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatTimeAgo(isoString: string) {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const minutes = Math.max(0, Math.floor(diffMs / 60000));
    if (minutes < 1) return "Generated just now";
    if (minutes < 60) return `Generated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Generated ${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `Generated ${days} day${days === 1 ? "" : "s"} ago`;
}

function isSameLocalDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

function getNextBriefingLabel(lastBriefingDate: Date | null) {
    if (!lastBriefingDate) return null;
    const now = new Date();
    if (!isSameLocalDay(lastBriefingDate, now)) return null;

    const daysToAdd = now.getDay() === 1 ? 7 : 1;
    const nextUtc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + daysToAdd, 9, 0, 0));
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `Next briefing available ${nextUtc.toLocaleDateString("en-US", { weekday: "long", timeZone })} at ${nextUtc.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })}`;
}

function SourceCountsPanel({
    briefing,
    expanded,
    onToggle,
}: {
    briefing: SavedBriefing;
    expanded: boolean;
    onToggle: () => void;
}) {
    if (!briefing.sourceCounts) return null;
    const completed = Number(briefing.highlights?.completedMilestones ?? 0);
    const total = Number(briefing.highlights?.totalMilestones ?? 0);
    const stage = STAGES_DATA.find((entry) => entry.id === briefing.stageId);
    const counts = briefing.sourceCounts;

    return (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <button
                onClick={onToggle}
                style={{ background: "transparent", border: "none", padding: 0, color: "rgba(240,237,232,0.4)", fontSize: 11, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}
            >
                What Forge used {expanded ? "↓" : "→"}
            </button>
            {expanded && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5, color: "rgba(240,237,232,0.5)", fontSize: 12, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.55 }}>
                    <div>• {counts.journal_entries ?? 0} journal entries this week</div>
                    <div>• {counts.decisions ?? 0} decisions logged</div>
                    <div>• {counts.chat_summaries ?? 0} Forge conversations</div>
                    <div>• {counts.academy_completed ?? 0} Academy lessons</div>
                    <div>• Stage {briefing.stageId} — {Number.isFinite(completed) && Number.isFinite(total) ? `${completed}/${total}` : "0/0"} milestones complete{stage ? ` (${stage.label})` : ""}</div>
                </div>
            )}
        </div>
    );
}

export default function BriefingsScreen({
    userId,
    profile,
    briefings,
    onBriefingsChange,
    onBack,
    completedByStage,
    generationLimit = null,
    recentSummaries,
    foundryDecisions,
    journalEntries,
    activeNudge,
    stageProgressDates,
    onCreateAction,
    onAskForgeAboutAction,
}: {
    userId: string;
    profile: any;
    briefings: SavedBriefing[];
    onBriefingsChange: (next: SavedBriefing[]) => void;
    onBack: () => void;
    completedByStage: Record<number, any[]>;
    generationLimit?: number | null;
    recentSummaries: StageSummary[];
    foundryDecisions: FounderDecision[];
    journalEntries: any[];
    activeNudge: FounderNudge | null;
    stageProgressDates: Record<number, string>;
    onCreateAction?: (suggestion: FoundryActionSuggestion) => Promise<unknown> | void;
    onAskForgeAboutAction?: (suggestion: FoundryActionSuggestion) => void;
}) {
    const [generating, setGenerating] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [sourceExpandedIds, setSourceExpandedIds] = useState<Record<string, boolean>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [academyWeeklyActivity, setAcademyWeeklyActivity] = useState<AcademyWeeklyActivity | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [actionNotice, setActionNotice] = useState<string | null>(null);

    useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

    useEffect(() => {
        let cancelled = false;
        loadAcademyWeeklyActivity(userId, 7)
            .then((result) => {
                if (!cancelled) setAcademyWeeklyActivity(result);
            })
            .catch((loadError) => {
                console.error("academy weekly activity error:", loadError);
                if (!cancelled) setAcademyWeeklyActivity(null);
            });

        return () => {
            cancelled = true;
        };
    }, [userId]);

    const currentStageId = profile.currentStage || 1;
    const currentStage = STAGES_DATA.find((stage) => stage.id === currentStageId) ?? STAGES_DATA[0];
    const stageLabel = currentStage.label;
    const completedCount = (completedByStage[currentStageId] || []).length;
    const totalCount = currentStage.milestones.length;

    const lastBriefing = briefings[0];
    const lastBriefingDate = lastBriefing ? new Date(lastBriefing.createdAt) : null;
    const daysSinceLast = lastBriefingDate
        ? Math.floor((Date.now() - lastBriefingDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
    const canGenerate = daysSinceLast === null || daysSinceLast >= 1;
    const hasReachedLimit = generationLimit !== null && briefings.length >= generationLimit;
    const canCreateBriefing = canGenerate && !hasReachedLimit;
    const nextBriefingLabel = !canGenerate ? getNextBriefingLabel(lastBriefingDate) : null;
    const currentStreak = Number(lastBriefing?.streakCount ?? 1);

    const generateBriefing = async () => {
        if (generating || !canCreateBriefing) return;
        setGenerating(true);
        setError(null);
        try {
            const academyActivity = academyWeeklyActivity ?? await loadAcademyWeeklyActivity(userId, 7).catch(() => null);
            const weeklyIntelligence = buildWeeklyBriefingIntelligence({
                profile,
                currentStageId,
                completedByStage,
                stageProgressDates,
                recentSummaries,
                foundryDecisions,
                journalEntries,
                activeNudge,
                academyActivity,
            });
            const prompt = buildWeeklyBriefingPrompt(
                profile,
                stageLabel,
                completedCount,
                totalCount,
                weeklyIntelligence.contextBlock,
            );
            const res = await fetch("/api/forge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 900,
                    system: "You are Forge, the AI business partner inside Foundry. Write exactly as instructed. Keep the text flush-left, easy to scan, grounded in the founder's week, and structured with short paragraphs, bullets, and numbered lines when useful.",
                    messages: [{ role: "user", content: prompt }],
                }),
            });
            if (!res.ok) throw new Error(`Briefing API ${res.status}`);
            const data = await res.json();
            const content = data.content?.map((b: any) => b.text || "").join("") || "";
            if (!content.trim()) throw new Error("Briefing response was empty");

            const saved = await saveBriefing(userId, content, currentStageId, {
                weekStart: weeklyIntelligence.weekStart,
                highlights: weeklyIntelligence.highlights as Record<string, unknown>,
                sourceCounts: weeklyIntelligence.sourceCounts,
                generatedAt: new Date().toISOString(),
            });

            if (!saved) {
                setError("Your briefing was generated but couldn't be saved. Copy it now or try again.");
                return;
            }

            onBriefingsChange([saved, ...briefings]);
            setExpandedId(saved.id);
        } catch (err) {
            console.error("Briefing error:", err);
            setError("Forge ran into a problem generating your briefing. Tap to try again.");
        } finally {
            setGenerating(false);
        }
    };

    const copyBriefing = async (briefing: SavedBriefing) => {
        try {
            await navigator.clipboard.writeText(briefing.content);
            setCopiedId(briefing.id);
            window.setTimeout(() => setCopiedId(null), 1800);
        } catch (copyError) {
            console.error("copy briefing error:", copyError);
        }
    };

    const createBriefingAction = async (briefing: SavedBriefing) => {
        if (!onCreateAction) return;
        const suggestion = suggestActionFromWeeklyBriefing({
            id: briefing.id,
            content: briefing.content,
            stageId: briefing.stageId,
        });
        await onCreateAction(suggestion);
        setActionNotice("Suggested action saved to Action Center.");
        window.setTimeout(() => setActionNotice(null), 2200);
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
        });
    };

    const formatStage = (stageId: number) => {
        const stage = STAGES_DATA.find((entry) => entry.id === stageId);
        return `Stage ${stageId} — ${stage?.label || "Unknown"}`;
    };

    return (
        <div style={{
            position: "fixed", inset: 0, background: "#080809",
            display: "flex", flexDirection: "column",
            fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8", zIndex: 200,
        }}>
            <div style={{
                padding: "max(11px, calc(6px + env(safe-area-inset-top))) 16px 11px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0, gap: 12,
            }}>
                <button onClick={onBack} style={{
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8, padding: "var(--foundry-app-header-button-padding)", color: "#F0EDE8",
                    fontSize: "var(--foundry-app-header-button-font)", fontWeight: 500, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                }}><Logo variant="flame" style={{ width: "var(--foundry-app-header-icon-size)", height: "var(--foundry-app-header-icon-size)", objectFit: "contain" }} />Hub</button>

                <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: "var(--foundry-app-header-title-font)", fontFamily: "'Lora', Georgia, serif",
                        fontWeight: 600, color: "#F0EDE8",
                    }}>Monday Briefings</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: "var(--foundry-app-header-meta-font)", color: "#555" }}>
                        <span>{briefings.length} {briefings.length === 1 ? "briefing" : "briefings"}</span>
                        {generationLimit !== null && <span>· {Math.max(0, generationLimit - briefings.length)} free left</span>}
                        {currentStreak >= 2 && <span style={{ color: "#E8622A", fontFamily: "'DM Sans', sans-serif", fontSize: 12 }}>🔥 {currentStreak} week streak</span>}
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <button
                        onClick={generateBriefing}
                        disabled={generating || !canCreateBriefing}
                        style={{
                            background: generating || !canCreateBriefing ? "rgba(255,255,255,0.04)" : "rgba(232,98,42,0.1)",
                            border: generating || !canCreateBriefing ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(232,98,42,0.25)",
                            borderRadius: 8, padding: "var(--foundry-app-header-button-padding)",
                            color: generating || !canCreateBriefing ? "#444" : "#E8622A",
                            fontSize: "var(--foundry-app-header-button-font)", fontWeight: 500,
                            cursor: generating || !canCreateBriefing ? "default" : "pointer",
                            transition: "all 0.2s",
                        }}
                    >
                        {generating ? "Writing..." : hasReachedLimit ? "Preview limit reached" : canGenerate ? "+ New" : "Up to date"}
                    </button>
                    {nextBriefingLabel && (
                        <div style={{ maxWidth: 190, textAlign: "right", fontSize: 10, color: "rgba(240,237,232,0.35)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.35 }}>
                            {nextBriefingLabel}
                        </div>
                    )}
                </div>
            </div>

            {error && (
                <div style={{
                    margin: "12px auto 0",
                    maxWidth: 680,
                    width: "calc(100% - 32px)",
                    boxSizing: "border-box",
                    background: "rgba(232,98,42,0.08)",
                    border: "1px solid rgba(232,98,42,0.25)",
                    borderRadius: 10,
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                }}>
                    <div style={{ flex: 1, color: "rgba(240,237,232,0.8)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>{error}</div>
                    <button onClick={() => { setError(null); void generateBriefing(); }} style={{ background: "transparent", border: "none", color: "#E8622A", fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer" }}>Try again</button>
                    <button onClick={() => setError(null)} style={{ background: "transparent", border: "none", color: "rgba(240,237,232,0.45)", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
                </div>
            )}
            {actionNotice && (
                <div style={{ margin: "12px auto 0", maxWidth: 680, width: "calc(100% - 32px)", boxSizing: "border-box", background: "rgba(76,175,138,0.08)", border: "1px solid rgba(76,175,138,0.2)", borderRadius: 10, padding: "10px 12px", color: "#8BD8A9", fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
                    {actionNotice}
                </div>
            )}

            <div style={{
                flex: 1, overflowY: "auto", padding: "16px",
                maxWidth: 680, width: "100%", margin: "0 auto",
            }} className="foundry-app-page__content">
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
                            ? `Free preview includes ${generationLimit} Monday Briefings. You have used them all.`
                            : `Free preview includes up to ${generationLimit} Monday Briefings so Stage 1 founders can still get weekly guidance.`}
                    </div>
                )}

                {briefings.length === 0 && !generating && (
                    <div style={{
                        textAlign: "left", padding: "56px 24px",
                        opacity: mounted ? 1 : 0, transition: "opacity 0.5s ease",
                    }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
                        <div style={{
                            fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif",
                            fontWeight: 700, color: "#F0EDE8", marginBottom: 10,
                        }}>Your first Monday Briefing</div>
                        <div style={{
                            fontSize: 14, color: "rgba(240,237,232,0.55)", fontFamily: "'DM Sans', sans-serif",
                            lineHeight: 1.7, maxWidth: 400,
                            margin: "0 0 24px",
                        }}>
                            Every week, Forge reviews what moved in your business — decisions made, lessons learned, patterns emerging — and writes you a briefing that helps you start the week sharp.
                            <br /><br />
                            Takes about 30 seconds to generate.
                        </div>
                        <button onClick={generateBriefing} disabled={generating || hasReachedLimit} style={{
                            background: generating || hasReachedLimit ? "rgba(232,98,42,0.3)" : "linear-gradient(135deg, #E8622A, #c9521e)",
                            border: "none", borderRadius: 12, padding: "12px 24px",
                            color: "#fff", fontSize: 13, fontFamily: "'Lora', Georgia, serif",
                            fontWeight: 600, cursor: generating || hasReachedLimit ? "default" : "pointer",
                            boxShadow: generating || hasReachedLimit ? "none" : "0 4px 20px rgba(232,98,42,0.3)",
                        }}>
                            {generating ? "Forge is writing..." : hasReachedLimit ? "Preview limit reached" : "Generate My First Briefing →"}
                        </button>
                        <div style={{ marginTop: 12, maxWidth: 420, color: "rgba(240,237,232,0.38)", fontSize: 12, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
                            Briefings are generated weekly. You can generate one now and Forge will deliver them automatically every Monday.
                        </div>
                    </div>
                )}

                {generating && briefings.length === 0 && (
                    <div style={{ textAlign: "left", padding: "40px 24px" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-start", marginBottom: 16 }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: 8, height: 8, borderRadius: "50%", background: "#E8622A",
                                    animation: "forgePulse 1.4s infinite ease-in-out",
                                    animationDelay: `${i * 0.2}s`,
                                }} />
                            ))}
                        </div>
                        <div style={{ fontSize: 13, color: "#555", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic" }}>
                            Forge is thinking about your week...
                        </div>
                    </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {briefings.map((briefing, i) => {
                        const isExpanded = expandedId === briefing.id;
                        const isFirst = i === 0;
                        const stage = STAGES_DATA.find((entry) => entry.id === briefing.stageId);

                        return (
                            <div key={briefing.id} style={{
                                background: isFirst ? "rgba(232,98,42,0.04)" : "rgba(255,255,255,0.02)",
                                border: isFirst ? "1px solid rgba(232,98,42,0.2)" : "1px solid rgba(255,255,255,0.06)",
                                borderRadius: 14, overflow: "hidden",
                                animation: isFirst ? "fadeSlideUp 0.3s ease" : "none",
                            }}>
                                <div
                                    onClick={() => setExpandedId(isExpanded ? null : briefing.id)}
                                    style={{
                                        padding: "12px 16px",
                                        borderBottom: isExpanded ? "1px solid rgba(255,255,255,0.05)" : "none",
                                        display: "flex", alignItems: "center",
                                        justifyContent: "space-between", cursor: "pointer", gap: 14,
                                    }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 5 }}>
                                            <div style={{
                                                fontSize: 14, color: isFirst ? "#E8622A" : "#A8A4A0",
                                                fontWeight: 600, lineHeight: 1.35,
                                            }}>
                                                {isFirst ? "Latest" : formatDate(briefing.createdAt)}
                                            </div>
                                            <span style={{
                                                fontSize: 10,
                                                color: "#E8622A",
                                                background: "rgba(232,98,42,0.1)",
                                                border: "1px solid rgba(232,98,42,0.22)",
                                                borderRadius: 999,
                                                padding: "2px 8px",
                                                fontFamily: "'DM Sans', sans-serif",
                                            }}>
                                                Stage {briefing.stageId}{stage ? ` — ${stage.label}` : ""}
                                            </span>
                                        </div>
                                        {isFirst && (
                                            <div style={{ fontSize: 12, color: "#68625C", marginTop: 3, lineHeight: 1.3 }}>
                                                {formatDate(briefing.createdAt)}
                                            </div>
                                        )}
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11, color: "rgba(240,237,232,0.4)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>
                                            <span>{wordCount(briefing.content)} words</span>
                                            <span>·</span>
                                            <span>{formatTimeAgo(briefing.createdAt)}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                void copyBriefing(briefing);
                                            }}
                                            style={{
                                                background: "rgba(255,255,255,0.035)",
                                                border: "1px solid rgba(255,255,255,0.08)",
                                                borderRadius: 8,
                                                color: copiedId === briefing.id ? "#4CAF8A" : "rgba(240,237,232,0.55)",
                                                fontSize: 11,
                                                fontFamily: "'DM Sans', sans-serif",
                                                padding: "6px 9px",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {copiedId === briefing.id ? "Copied!" : "Share"}
                                        </button>
                                        <span style={{ fontSize: 22, color: "#5F5952", transition: "transform 0.2s", display: "inline-block", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div style={{ padding: "16px" }}>
                                        <BriefingText text={briefing.content} />
                                        <SourceCountsPanel
                                            briefing={briefing}
                                            expanded={!!sourceExpandedIds[briefing.id]}
                                            onToggle={() => setSourceExpandedIds(prev => ({ ...prev, [briefing.id]: !prev[briefing.id] }))}
                                        />
                                        {(onCreateAction || onAskForgeAboutAction) && (
                                            <div style={{ marginTop: 14 }}>
                                                {(() => {
                                                    const suggestion = suggestActionFromWeeklyBriefing({
                                                        id: briefing.id,
                                                        content: briefing.content,
                                                        stageId: briefing.stageId,
                                                    });
                                                    return (
                                                        <ActionSuggestionCard
                                                            action={suggestion}
                                                            compact
                                                            acceptLabel="Create action"
                                                            onAccept={onCreateAction ? () => void createBriefingAction(briefing) : undefined}
                                                            onAskForge={onAskForgeAboutAction ? () => onAskForgeAboutAction(suggestion) : undefined}
                                                        />
                                                    );
                                                })()}
                                            </div>
                                        )}
                                        <div style={{
                                            marginTop: 16, paddingTop: 12,
                                            borderTop: "1px solid rgba(255,255,255,0.05)",
                                            fontSize: 10, color: "#333", fontStyle: "italic",
                                            fontFamily: "'Lora', Georgia, serif",
                                        }}>
                                            Generated by Forge · {formatStage(briefing.stageId)} · {formatDate(briefing.createdAt)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div style={{ height: 40 }} />
            </div>
        </div>
    );
}

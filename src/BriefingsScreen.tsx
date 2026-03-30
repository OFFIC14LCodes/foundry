import { useState, useEffect } from "react";
import { saveBriefing } from "./db";

const FORGE_BRIEFING_PROMPT = (profile: any, stageLabel: string, completedCount: number, totalCount: number) => `
You are Forge. Generate a Monday morning briefing for ${profile.name}, who is building "${profile.businessName || profile.idea}".

Their current situation:
- Stage: ${profile.currentStage} — ${stageLabel}
- Stage progress: ${completedCount}/${totalCount} milestones complete
- Strategy: ${profile.strategyLabel}
- Budget remaining: $${(profile.budget?.remaining || 0).toLocaleString()}
- Industry: ${profile.industry || "Early stage"}

Write a Monday morning briefing in exactly this structure — no headers, no bullet points, just flowing paragraphs:

1. A warm but direct opening that acknowledges where they are right now in the journey. Reference something specific about their business or stage. 2-3 sentences.

2. The single most important priority for this week given their stage and progress. Be specific and direct. 2-3 sentences.

3. A relevant framework, mental model, or founder story that applies directly to what they're working on right now. Name it, explain it briefly, connect it to their situation. 3-4 sentences.

4. One sharp question to sit with this week. Not a task — a question that will shape how they think. One sentence, make it count.

Keep the whole thing under 300 words. Write it the way Forge speaks — direct, warm, no filler, no corporate language. This should feel like a Monday morning text from a partner who's been thinking about their business over the weekend.
`.trim();

export default function BriefingsScreen({ userId, profile, briefings, onBriefingsChange, onBack, completedByStage }) {
    const [generating, setGenerating] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    const STAGES_DATA_LABELS = ["Idea", "Plan", "Legal", "Finance", "Launch", "Grow"];
    const MILESTONE_COUNTS = [5, 5, 5, 5, 5, 5];

    useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

    const currentStageId = profile.currentStage || 1;
    const stageLabel = STAGES_DATA_LABELS[currentStageId - 1];
    const completedCount = (completedByStage[currentStageId] || []).length;
    const totalCount = MILESTONE_COUNTS[currentStageId - 1];

    const lastBriefing = briefings[0];
    const lastBriefingDate = lastBriefing ? new Date(lastBriefing.createdAt) : null;
    const daysSinceLast = lastBriefingDate
        ? Math.floor((Date.now() - lastBriefingDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;
    const canGenerate = daysSinceLast === null || daysSinceLast >= 1;

    const generateBriefing = async () => {
        if (generating || !canGenerate) return;
        setGenerating(true);
        try {
            const prompt = FORGE_BRIEFING_PROMPT(profile, stageLabel, completedCount, totalCount);
            const res = await fetch("/api/forge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "claude-sonnet-4-20250514",
                    max_tokens: 600,
                    system: "You are Forge, the AI business partner inside Foundry. Write exactly as instructed — no extra formatting, no headers, no bullet points. Pure flowing prose.",
                    messages: [{ role: "user", content: prompt }],
                }),
            });
            const data = await res.json();
            const content = data.content?.map((b: any) => b.text || "").join("") || "";
            if (content) {
                const saved = await saveBriefing(userId, content, currentStageId);
                if (saved) {
                    onBriefingsChange([saved, ...briefings]);
                    setExpandedId(saved.id);
                }
            }
        } catch (err) {
            console.error("Briefing error:", err);
        }
        setGenerating(false);
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric"
        });
    };

    const formatStage = (stageId: number) => {
        return `Stage ${stageId} — ${STAGES_DATA_LABELS[stageId - 1] || "Unknown"}`;
    };

    return (
        <div style={{
            position: "fixed", inset: 0, background: "#080809",
            display: "flex", flexDirection: "column",
            fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8", zIndex: 200
        }}>
            {/* Header */}
            <div style={{
                padding: "max(11px, calc(6px + env(safe-area-inset-top))) 16px 11px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0
            }}>
                <button onClick={onBack} style={{
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8, padding: "5px 12px", color: "#F0EDE8",
                    fontSize: 12, fontWeight: 500, cursor: "pointer"
                }}>🔥 Hub</button>

                <div style={{ textAlign: "center" }}>
                    <div style={{
                        fontSize: 14, fontFamily: "'Lora', Georgia, serif",
                        fontWeight: 600, color: "#F0EDE8"
                    }}>Monday Briefings</div>
                    <div style={{ fontSize: 10, color: "#555" }}>
                        {briefings.length} {briefings.length === 1 ? "briefing" : "briefings"}
                    </div>
                </div>

                <button
                    onClick={generateBriefing}
                    disabled={generating || !canGenerate}
                    style={{
                        background: generating || !canGenerate ? "rgba(255,255,255,0.04)" : "rgba(232,98,42,0.1)",
                        border: generating || !canGenerate ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(232,98,42,0.25)",
                        borderRadius: 8, padding: "5px 12px",
                        color: generating || !canGenerate ? "#444" : "#E8622A",
                        fontSize: 12, fontWeight: 500,
                        cursor: generating || !canGenerate ? "default" : "pointer",
                        transition: "all 0.2s"
                    }}
                >
                    {generating ? "Writing..." : canGenerate ? "+ New" : "Up to date"}
                </button>
            </div>

            {/* Content */}
            <div style={{
                flex: 1, overflowY: "auto", padding: "16px",
                maxWidth: 680, width: "100%", margin: "0 auto"
            }}>

                {/* Empty state */}
                {briefings.length === 0 && !generating && (
                    <div style={{
                        textAlign: "center", padding: "60px 24px",
                        opacity: mounted ? 1 : 0, transition: "opacity 0.5s ease"
                    }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
                        <div style={{
                            fontSize: 20, fontFamily: "'Cormorant Garamond', Georgia, serif",
                            fontWeight: 700, color: "#F0EDE8", marginBottom: 10
                        }}>No briefings yet</div>
                        <div style={{
                            fontSize: 13, color: "#555", fontFamily: "'Lora', Georgia, serif",
                            fontStyle: "italic", lineHeight: 1.7, maxWidth: 300,
                            margin: "0 auto 24px"
                        }}>
                            Forge will write you a personalized briefing — your priorities, a relevant framework, and one sharp question to start the week with.
                        </div>
                        <button onClick={generateBriefing} disabled={generating} style={{
                            background: generating ? "rgba(232,98,42,0.3)" : "linear-gradient(135deg, #E8622A, #c9521e)",
                            border: "none", borderRadius: 12, padding: "12px 24px",
                            color: "#fff", fontSize: 13, fontFamily: "'Lora', Georgia, serif",
                            fontWeight: 600, cursor: generating ? "default" : "pointer",
                            boxShadow: generating ? "none" : "0 4px 20px rgba(232,98,42,0.3)"
                        }}>
                            {generating ? "Forge is writing..." : "Get your first briefing"}
                        </button>
                    </div>
                )}

                {/* Generating state */}
                {generating && briefings.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 24px" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: 8, height: 8, borderRadius: "50%", background: "#E8622A",
                                    animation: "forgePulse 1.4s infinite ease-in-out",
                                    animationDelay: `${i * 0.2}s`
                                }} />
                            ))}
                        </div>
                        <div style={{ fontSize: 13, color: "#555", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic" }}>
                            Forge is thinking about your week...
                        </div>
                    </div>
                )}

                {/* Briefings list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {briefings.map((briefing, i) => {
                        const isExpanded = expandedId === briefing.id;
                        const isFirst = i === 0;

                        return (
                            <div key={briefing.id} style={{
                                background: isFirst ? "rgba(232,98,42,0.04)" : "rgba(255,255,255,0.02)",
                                border: isFirst ? "1px solid rgba(232,98,42,0.2)" : "1px solid rgba(255,255,255,0.06)",
                                borderRadius: 14, overflow: "hidden",
                                animation: isFirst ? "fadeSlideUp 0.3s ease" : "none"
                            }}>
                                {/* Briefing header */}
                                <div
                                    onClick={() => setExpandedId(isExpanded ? null : briefing.id)}
                                    style={{
                                        padding: "12px 16px",
                                        borderBottom: isExpanded ? "1px solid rgba(255,255,255,0.05)" : "none",
                                        display: "flex", alignItems: "center",
                                        justifyContent: "space-between", cursor: "pointer"
                                    }}
                                >
                                    <div>
                                        <div style={{
                                            fontSize: 12, color: isFirst ? "#E8622A" : "#888",
                                            fontWeight: 600, marginBottom: 2
                                        }}>
                                            {isFirst ? "Latest" : formatDate(briefing.createdAt)}
                                        </div>
                                        {isFirst && (
                                            <div style={{ fontSize: 10, color: "#555" }}>
                                                {formatDate(briefing.createdAt)}
                                            </div>
                                        )}
                                        <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>
                                            {formatStage(briefing.stageId)}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 12, color: "#444", transition: "transform 0.2s", display: "inline-block", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
                                </div>

                                {/* Briefing content */}
                                {isExpanded && (
                                    <div style={{ padding: "16px" }}>
                                        <div style={{
                                            fontSize: 14, fontFamily: "'Lora', Georgia, serif",
                                            color: "#C8C4BE", lineHeight: 1.85, whiteSpace: "pre-wrap"
                                        }}>
                                            {briefing.content}
                                        </div>
                                        <div style={{
                                            marginTop: 16, paddingTop: 12,
                                            borderTop: "1px solid rgba(255,255,255,0.05)",
                                            fontSize: 10, color: "#333", fontStyle: "italic",
                                            fontFamily: "'Lora', Georgia, serif"
                                        }}>
                                            Generated by Forge · {formatDate(briefing.createdAt)}
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
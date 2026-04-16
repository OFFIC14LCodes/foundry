import { useState, useEffect, type ReactNode } from "react";
import { saveBriefing } from "./db";
import Logo from "./components/Logo";

function renderInline(text: string) {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
        i % 2 === 1
            ? <strong key={i} style={{ color: "#F0EDE8", fontWeight: 700 }}>{part}</strong>
            : <span key={i}>{part}</span>
    );
}

function BriefingText({ text }: { text: string }) {
    const lines = text.split("\n");
    const blocks: ReactNode[] = [];
    let paragraphLines: string[] = [];
    let i = 0;

    const flushParagraph = () => {
        if (paragraphLines.length === 0) return;
        blocks.push(
            <div key={`p-${blocks.length}`} style={{ fontSize: 14, color: "#C8C4BE", lineHeight: 1.8, fontFamily: "'Lora', Georgia, serif" }}>
                {renderInline(paragraphLines.join("\n"))}
            </div>
        );
        paragraphLines = [];
    };

    while (i < lines.length) {
        const line = lines[i];

        if (!line.trim()) {
            flushParagraph();
            i++;
            continue;
        }

        const numbered = line.match(/^(\d+)\.\s+(.*)$/);
        if (numbered) {
            flushParagraph();
            const items: { value: number; content: string }[] = [];
            while (i < lines.length) {
                const match = lines[i].match(/^(\d+)\.\s+(.*)$/);
                if (!match) break;
                items.push({ value: Number(match[1]), content: match[2] });
                i++;
            }
            blocks.push(
                <ol key={`ol-${blocks.length}`} start={items[0]?.value || 1} style={{ margin: "0 0 0 20px", padding: 0 }}>
                    {items.map((item, index) => (
                        <li key={index} style={{ fontSize: 14, color: "#C8C4BE", lineHeight: 1.8, marginBottom: 8, fontFamily: "'Lora', Georgia, serif" }}>
                            {renderInline(item.content)}
                        </li>
                    ))}
                </ol>
            );
            continue;
        }

        if (line.startsWith("- ") || line.startsWith("* ")) {
            flushParagraph();
            const bullets: string[] = [];
            while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
                bullets.push(lines[i].slice(2));
                i++;
            }
            blocks.push(
                <ul key={`ul-${blocks.length}`} style={{ margin: "0 0 0 20px", padding: 0 }}>
                    {bullets.map((item, index) => (
                        <li key={index} style={{ fontSize: 14, color: "#C8C4BE", lineHeight: 1.8, marginBottom: 8, fontFamily: "'Lora', Georgia, serif" }}>
                            {renderInline(item)}
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        paragraphLines.push(line);
        i++;
    }

    flushParagraph();
    return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{blocks}</div>;
}

const FORGE_BRIEFING_PROMPT = (profile: any, stageLabel: string, completedCount: number, totalCount: number) => `
You are Forge. Generate a Monday morning briefing for ${profile.name}, who is building "${profile.businessName || profile.idea}".

Their current situation:
- Stage: ${profile.currentStage} — ${stageLabel}
- Stage progress: ${completedCount}/${totalCount} milestones complete
- Strategy: ${profile.strategyLabel}
- Budget remaining: $${(profile.budget?.remaining || 0).toLocaleString()}
- Industry: ${profile.industry || "Early stage"}

Write a Monday morning briefing that is easy to scan on a phone. Keep everything flush-left. Use short paragraphs, bullet points, and numbered lines when they help clarity. No centered prose blocks.

Use this structure:

1. Opening
- A warm but direct opening that acknowledges where they are right now in the journey.
- Reference something specific about their business or stage.
- Keep it to 2-3 sentences.

2. This Week's Priority
- The single most important priority for this week given their stage and progress.
- Be specific and direct.
- Keep it to 2-3 sentences.

3. Teaching Point
- Give one relevant framework, mental model, or founder story that applies directly to what they're working on right now.
- Name it clearly.
- Explain it briefly.
- Connect it directly to their situation.
- Keep it to 3-4 sentences or 2-4 bullets.

4. One Sharp Question
- End with one sharp question to sit with this week.
- Not a task. A question that shapes how they think.
- One sentence.

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
                    system: "You are Forge, the AI business partner inside Foundry. Write exactly as instructed. Keep the text flush-left, easy to scan, and structured with short paragraphs, bullets, and numbered lines when useful.",
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
            fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8", zIndex: 200
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
                    fontSize: 12, fontWeight: 500, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6
                }}><Logo variant="flame" style={{ width: 14, height: 14, objectFit: "contain" }} />Hub</button>

                <div style={{ textAlign: "left", flex: 1, marginLeft: 12 }}>
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
                        textAlign: "left", padding: "60px 24px",
                        opacity: mounted ? 1 : 0, transition: "opacity 0.5s ease"
                    }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
                        <div style={{
                            fontSize: 20, fontFamily: "'Playfair Display', Georgia, serif",
                            fontWeight: 700, color: "#F0EDE8", marginBottom: 10
                        }}>No briefings yet</div>
                        <div style={{
                            fontSize: 13, color: "#555", fontFamily: "'Lora', Georgia, serif",
                            fontStyle: "italic", lineHeight: 1.7, maxWidth: 300,
                            margin: "0 0 24px"
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
                    <div style={{ textAlign: "left", padding: "40px 24px" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-start", marginBottom: 16 }}>
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
                                            color: "#C8C4BE", lineHeight: 1.85
                                        }}>
                                            <BriefingText text={briefing.content} />
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

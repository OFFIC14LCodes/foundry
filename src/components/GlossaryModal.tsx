import { useEffect, useState } from "react";
import { STAGE_COLORS } from "../constants/glossary";
import { STAGES_DATA } from "../constants/stages";
import type { GlossaryTerm } from "../lib/glossaryDb";

export default function GlossaryModal({
    term,
    entry,
    profile,
    activeStage,
    onClose,
    onMarkLearned,
    alreadyLearned,
    callForgeAPI,
}: {
    term: string;
    entry: GlossaryTerm;
    profile: any;
    activeStage: number;
    onClose: () => void;
    onMarkLearned: (term: string, stageNum: number) => void;
    alreadyLearned: boolean;
    callForgeAPI: (messages: any[], systemPrompt: string) => Promise<string>;
}) {
    const [contextNote, setContextNote] = useState<string | null>(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const stageData = STAGES_DATA[activeStage - 1];
    const stageColor = STAGE_COLORS[entry.stage_unlock as keyof typeof STAGE_COLORS] ?? "#E8622A";

    useEffect(() => {
        const generateContext = async () => {
            setLoadingContext(true);
            try {
                const prompt = `The founder ${profile.name} is building "${profile.idea}" and is currently in Stage ${activeStage}: ${stageData?.label}. They just tapped on the term "${term}" to learn about it. In 1-2 sentences, explain why understanding "${term}" is specifically important for what they're doing right now. Be concrete and personal. Don't define the term — connect it to their specific situation.`;
                const note = await callForgeAPI([{ role: "user", content: prompt }], "You are Forge. Respond with only the 1-2 sentence insight, no preamble.");
                setContextNote(note);
            } catch {
                setContextNote(null);
            }
            setLoadingContext(false);
        };
        generateContext();
    }, [term, activeStage, profile.name, profile.idea, stageData?.label, callForgeAPI]);

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end", animation: "fadeIn 0.2s ease" }}>
            <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }} />
            <div style={{ position: "relative", background: "#0D0D10", borderTop: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px 20px 0 0", padding: "24px 20px max(36px, calc(20px + env(safe-area-inset-bottom)))", animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)", maxHeight: "82vh", overflowY: "auto" }}>
                <div style={{ width: 36, height: 3, background: "rgba(255,255,255,0.12)", borderRadius: 2, margin: "0 auto 20px" }} />
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
                    <div>
                        <div style={{ fontSize: 26, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", letterSpacing: "-0.5px", lineHeight: 1.1, marginBottom: 6 }}>
                            {term.charAt(0).toUpperCase() + term.slice(1)}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 10, color: stageColor, background: `${stageColor}18`, border: `1px solid ${stageColor}30`, borderRadius: 20, padding: "2px 9px", fontWeight: 500 }}>
                                Stage {entry.stage_unlock} — {STAGES_DATA[entry.stage_unlock - 1]?.label}
                            </div>
                            <div style={{ fontSize: 10, color: "#8D857C", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "2px 9px" }}>
                                {entry.category}
                            </div>
                            {alreadyLearned && (
                                <div style={{ fontSize: 10, color: "#4CAF8A", background: "rgba(76,175,138,0.1)", borderRadius: 20, padding: "2px 9px" }}>✓ Learned</div>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "6px 12px", color: "#666", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>✕</button>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>What it means</div>
                    <div style={{ fontSize: 14, fontFamily: "'Lora', Georgia, serif", color: "#C8C4BE", lineHeight: 1.75 }}>{entry.definition}</div>
                </div>

                <div style={{ marginBottom: 16, background: "rgba(232,98,42,0.06)", border: "1px solid rgba(232,98,42,0.15)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, color: "#E8622A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Why it matters for you right now</div>
                    {loadingContext ? (
                        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                            {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#E8622A", animation: "forgePulse 1.4s infinite ease-in-out", animationDelay: `${i * 0.2}s` }} />)}
                        </div>
                    ) : (
                        <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", color: "#D8D4CE", lineHeight: 1.7, fontStyle: "italic" }}>
                            {contextNote || entry.definition}
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: 22 }}>
                    <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Real example</div>
                    <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", color: "#888", lineHeight: 1.7 }}>{entry.usage_example}</div>
                </div>

                {!alreadyLearned && (
                    <button
                        onClick={() => { onMarkLearned(term, entry.stage_unlock); onClose(); }}
                        style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 20px rgba(232,98,42,0.3)" }}
                    >
                        ✓ Mark as Learned
                    </button>
                )}
                {alreadyLearned && (
                    <div style={{ textAlign: "center", fontSize: 12, color: "#4CAF8A", padding: "10px 0" }}>You've already learned this term ✓</div>
                )}
            </div>
        </div>
    );
}

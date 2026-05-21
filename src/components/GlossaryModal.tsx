import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
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
    const stageColor = STAGE_COLORS[entry.stage_unlock as keyof typeof STAGE_COLORS] ?? "var(--tekori-gold)";

    useEffect(() => {
        const generateContext = async () => {
            setLoadingContext(true);
            try {
                const prompt = `The founder ${profile.name} is building "${profile.idea}" and is currently in Stage ${activeStage}: ${stageData?.label}. They just tapped on the term "${term}" to learn about it. In 1-2 sentences, explain why understanding "${term}" is specifically important for what they're doing right now. Be concrete and personal. Don't define the term — connect it to their specific situation.`;
                const note = await callForgeAPI([{ role: "user", content: prompt }], "You are Navi. Respond with only the 1-2 sentence insight, no preamble.");
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
            <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(7,26,47,0.62)", backdropFilter: "blur(6px)" }} />
            <div style={{ position: "relative", background: "var(--foundry-surface-primary)", borderTop: "1px solid rgba(7,26,47,0.1)", borderRadius: "20px 20px 0 0", padding: "24px 20px max(36px, calc(20px + env(safe-area-inset-bottom)))", animation: "slideUp 0.3s cubic-bezier(0.16,1,0.3,1)", maxHeight: "82vh", overflowY: "auto" }}>
                <div style={{ width: 36, height: 3, background: "rgba(7,26,47,0.12)", borderRadius: 2, margin: "0 auto 20px" }} />
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
                    <div>
                        <div style={{ fontSize: 26, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, color: "var(--color-text)", letterSpacing: "-0.5px", lineHeight: 1.1, marginBottom: 6 }}>
                            {term.charAt(0).toUpperCase() + term.slice(1)}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 10, color: stageColor, background: `${stageColor}18`, border: `1px solid ${stageColor}30`, borderRadius: 20, padding: "2px 9px", fontWeight: 500 }}>
                                Stage {entry.stage_unlock} — {STAGES_DATA[entry.stage_unlock - 1]?.label}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--color-pill-text)", background: "rgba(7,26,47,0.05)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 20, padding: "2px 9px" }}>
                                {entry.category}
                            </div>
                            {alreadyLearned && (
                                <div style={{ fontSize: 10, color: "var(--color-success)", background: "rgba(115,135,123,0.12)", borderRadius: 20, padding: "2px 9px" }}>✓ Learned</div>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close term details"
                        style={{
                            width: 36,
                            height: 36,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "rgba(7,26,47,0.06)",
                            border: "1px solid rgba(7,26,47,0.08)",
                            borderRadius: 999,
                            color: "#A29A90",
                            cursor: "pointer",
                            flexShrink: 0,
                        }}
                    >
                        <X size={16} strokeWidth={2.2} />
                    </button>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>What it means</div>
                    <div style={{ fontSize: 14, fontFamily: "var(--tekori-font-ui)", color: "var(--color-text-soft)", lineHeight: 1.75 }}>{entry.definition}</div>
                </div>

                <div style={{ marginBottom: 16, background: "rgba(216,155,43,0.06)", border: "1px solid rgba(216,155,43,0.15)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, color: "var(--tekori-gold)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Why it matters for you right now</div>
                    {loadingContext ? (
                        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                            {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--tekori-gold)", animation: "forgePulse 1.4s infinite ease-in-out", animationDelay: `${i * 0.2}s` }} />)}
                        </div>
                    ) : (
                        <div style={{ fontSize: 13, fontFamily: "var(--tekori-font-ui)", color: "var(--color-text)", lineHeight: 1.7, fontStyle: "italic" }}>
                            {contextNote || entry.definition}
                        </div>
                    )}
                </div>

                <div style={{ marginBottom: 22 }}>
                    <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Real example</div>
                    <div style={{ fontSize: 13, fontFamily: "var(--tekori-font-ui)", color: "var(--color-text-muted)", lineHeight: 1.7 }}>{entry.usage_example}</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {!alreadyLearned ? (
                        <button
                            onClick={() => { onMarkLearned(term, entry.stage_unlock); onClose(); }}
                            style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, var(--tekori-gold), var(--tekori-soft-gold))", border: "none", borderRadius: 12, color: "var(--color-primary)", fontSize: 13, fontFamily: "var(--tekori-font-ui)", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(216,155,43,0.3)" }}
                        >
                            Mark as Learned
                        </button>
                    ) : (
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                textAlign: "center",
                                fontSize: 12,
                                color: "var(--color-success)",
                                padding: "12px 14px",
                                borderRadius: 12,
                                background: "rgba(115,135,123,0.10)",
                                border: "1px solid rgba(115,135,123,0.18)",
                            }}
                        >
                            <Check size={14} strokeWidth={2.4} />
                            Already learned
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        style={{
                            width: "100%",
                            padding: "12px",
                            background: "rgba(7,26,47,0.04)",
                            border: "1px solid rgba(7,26,47,0.08)",
                            borderRadius: 12,
                            color: "var(--color-text-soft)",
                            fontSize: 13,
                            fontFamily: "var(--tekori-font-ui)",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

import type { DocumentNeedGoal, DocumentNeedRecommendationResult } from "../../lib/documentNeedRecommendations";
import type { VaultDocument } from "../../db";
import { NeutralBadge, RECOMMENDATION_ACTION_LABELS } from "./shared";

type GoalOption = { id: DocumentNeedGoal; label: string };

export default function DocumentNeedsWizard(props: {
    show: boolean;
    onToggle: () => void;
    needsEntityType: string;
    setNeedsEntityType: (value: string) => void;
    needsState: string;
    setNeedsState: (value: string) => void;
    currentStage: number;
    needsGoal: DocumentNeedGoal;
    setNeedsGoal: (value: DocumentNeedGoal) => void;
    needsNotes: string;
    setNeedsNotes: (value: string) => void;
    goals: GoalOption[];
    needsLoading: boolean;
    needsError: string | null;
    visibleNeedsResult: DocumentNeedRecommendationResult | null;
    vaultDocuments: VaultDocument[];
    onRun: () => void;
    onGenerate: (categoryId: string, documentId: string) => void;
    onReview: (documentId: string | null) => void;
    onDismiss: (key: string) => void;
}) {
    const {
        show, onToggle, needsEntityType, setNeedsEntityType, needsState, setNeedsState, currentStage,
        needsGoal, setNeedsGoal, needsNotes, setNeedsNotes, goals, needsLoading, needsError,
        visibleNeedsResult, vaultDocuments, onRun, onGenerate, onReview, onDismiss,
    } = props;

    const findVaultMatch = (documentName: string, existingDocumentId?: string | null) => {
        if (existingDocumentId) return vaultDocuments.find((document) => document.id === existingDocumentId) ?? null;
        const normalized = documentName.trim().toLowerCase();
        return vaultDocuments.find((document) => (
            document.docType.trim().toLowerCase() === normalized
            || document.title.trim().toLowerCase() === normalized
        )) ?? null;
    };

    const sectionStyles = {
        mustHave: {
            border: "3px solid #E8622A",
            badge: "Required",
            badgeColor: "#E8622A",
            badgeBackground: "rgba(232,98,42,0.15)",
        },
        shouldHave: {
            border: "3px solid rgba(232,98,42,0.4)",
            badge: "Recommended",
            badgeColor: "rgba(232,98,42,0.85)",
            badgeBackground: "rgba(232,98,42,0.1)",
        },
        optionalFuture: {
            border: "3px solid rgba(255,255,255,0.08)",
            badge: "Optional",
            badgeColor: "rgba(240,237,232,0.3)",
            badgeBackground: "rgba(255,255,255,0.04)",
        },
    };

    return (
        <div style={{ marginBottom: 18, borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.025)", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontSize: 15, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>What documents do I need?</div>
                    <div style={{ fontSize: 12, color: "#666", marginTop: 4, lineHeight: 1.6 }}>
                        Foundry can help you identify common documents, but this does not replace legal or tax advice.
                    </div>
                </div>
                <button onClick={onToggle} style={{ padding: "9px 12px", background: show ? "rgba(232,98,42,0.08)" : "rgba(255,255,255,0.04)", border: show ? "1px solid rgba(232,98,42,0.18)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: show ? "#E8622A" : "#C8C4BE", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}>
                    {show ? "Hide wizard" : "What documents do I need?"}
                </button>
            </div>

            {show && (
                <div style={{ padding: "0 16px 16px", display: "grid", gap: 16 }}>
                    <div style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.018)", padding: 14 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                            <input value={needsEntityType} onChange={(event) => setNeedsEntityType(event.target.value)} placeholder="Business type / entity type" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 12, fontFamily: "'Lora', Georgia, serif", boxSizing: "border-box" }} />
                            <input value={needsState} onChange={(event) => setNeedsState(event.target.value)} placeholder="State" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 12, fontFamily: "'Lora', Georgia, serif", boxSizing: "border-box" }} />
                            <input value={`Stage ${currentStage}`} readOnly style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 12px", color: "#A8A4A0", fontSize: 12, fontFamily: "'Lora', Georgia, serif", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr minmax(220px, 1.4fr)", gap: 10 }}>
                            <select value={needsGoal} onChange={(event) => setNeedsGoal(event.target.value as DocumentNeedGoal)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 12, fontFamily: "'Lora', Georgia, serif", boxSizing: "border-box", colorScheme: "dark" }}>
                                {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.label}</option>)}
                            </select>
                            <input value={needsNotes} onChange={(event) => setNeedsNotes(event.target.value)} placeholder="Optional notes: team size, launch timeline, funding target, client work, IP concerns..." style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 12, fontFamily: "'Lora', Georgia, serif", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>
                                Foundry will compare your goal, current stage, and vault contents against the document catalog.
                            </div>
                            <button onClick={onRun} disabled={needsLoading} style={{ padding: "10px 13px", background: needsLoading ? "rgba(255,255,255,0.06)" : "rgba(232,98,42,0.08)", border: needsLoading ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(232,98,42,0.18)", borderRadius: 10, color: needsLoading ? "#777" : "#E8622A", fontSize: 12, fontWeight: 600, cursor: needsLoading ? "wait" : "pointer", fontFamily: "'Lora', Georgia, serif" }}>
                                {needsLoading ? "Building recommendations..." : "Get Recommendations"}
                            </button>
                        </div>
                    </div>

                    {needsError && <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(232,98,42,0.06)", border: "1px solid rgba(232,98,42,0.18)", fontSize: 12, color: "#D8C9BC", lineHeight: 1.6 }}>{needsError}</div>}
                    {needsLoading && <div style={{ padding: "18px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.018)", fontSize: 12, color: "#666" }}>Forge is comparing your stage, goals, and vault contents...</div>}
                    {!needsLoading && !visibleNeedsResult && !needsError && <div style={{ padding: "18px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.018)", fontSize: 12, color: "#666", lineHeight: 1.6 }}>Use the wizard when you want a fast founder checklist before generating, uploading, or sending documents for signature.</div>}

                    {!needsLoading && visibleNeedsResult && (
                        <div style={{ display: "grid", gap: 14 }}>
                            <div style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.018)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                                    <div style={{ fontSize: 14, color: "#F0EDE8", fontWeight: 600 }}>Recommendation Summary</div>
                                    <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, color: visibleNeedsResult.generatedBy === "ai" ? "#63B3ED" : "#D9B15D", background: visibleNeedsResult.generatedBy === "ai" ? "rgba(99,179,237,0.1)" : "rgba(217,177,93,0.1)", border: visibleNeedsResult.generatedBy === "ai" ? "1px solid rgba(99,179,237,0.2)" : "1px solid rgba(217,177,93,0.2)" }}>
                                        {visibleNeedsResult.generatedBy === "ai" ? "Forge-assisted" : "Built-in fallback"}
                                    </span>
                                </div>
                                <div style={{ fontSize: 12, color: "#D0CCC6", lineHeight: 1.7, marginBottom: 6 }}>{visibleNeedsResult.summary}</div>
                                <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>{visibleNeedsResult.disclaimer}</div>
                            </div>

                            {([
                                { key: "mustHave", label: "Must-have documents", items: visibleNeedsResult.mustHave },
                                { key: "shouldHave", label: "Should-have documents", items: visibleNeedsResult.shouldHave },
                                { key: "optionalFuture", label: "Optional / future documents", items: visibleNeedsResult.optionalFuture },
                            ] as const).map((section) => (
                                <div key={section.key} style={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)", borderLeft: sectionStyles[section.key].border, background: "rgba(255,255,255,0.018)", overflow: "hidden" }}>
                                    <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                            <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 600 }}>{section.label}</div>
                                            <span style={{ padding: "4px 7px", borderRadius: 4, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: sectionStyles[section.key].badgeColor, background: sectionStyles[section.key].badgeBackground }}>
                                                {sectionStyles[section.key].badge}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ padding: 12 }}>
                                        {section.items.length === 0 ? (
                                            <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>No recommendations in this section right now. You may already have the main documents covered, or you can change the goal and run it again.</div>
                                        ) : section.items.map((item) => {
                                            const vaultMatch = findVaultMatch(item.documentName, item.existingDocumentId);
                                            const existsInVault = Boolean(vaultMatch);
                                            return (
                                            <div key={item.key} style={{ padding: "12px 12px 11px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.018)", marginBottom: 8 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 5 }}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 600 }}>{item.documentName}</div>
                                                        <div style={{ fontSize: 10, color: "#777", marginTop: 3 }}>{item.categoryName} · Suggested stage {item.suggestedStage}</div>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                                        <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, color: existsInVault ? "#4CAF8A" : "#E8622A", background: existsInVault ? "rgba(76,175,138,0.1)" : "rgba(232,98,42,0.1)", border: existsInVault ? "1px solid rgba(76,175,138,0.2)" : "1px solid rgba(232,98,42,0.2)" }}>
                                                            {existsInVault ? "Already in vault" : "Missing"}
                                                        </span>
                                                        <NeutralBadge label={RECOMMENDATION_ACTION_LABELS[item.recommendedAction]} />
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 11, color: "#666", lineHeight: 1.65, marginBottom: 10 }}>{item.whyItMatters}</div>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                    {existsInVault && vaultMatch ? (
                                                        <>
                                                            <span style={{ display: "inline-flex", alignItems: "center", padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(76,175,138,0.2)", background: "rgba(76,175,138,0.1)", color: "#4CAF8A", fontSize: 11, fontWeight: 700 }}>✓ In your vault</span>
                                                            <button onClick={() => onReview(vaultMatch.id)} style={{ padding: "7px 4px", background: "transparent", border: "none", color: "#C8C4BE", fontSize: 11, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}>Review →</button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => onGenerate(item.categoryId, item.documentId)} style={{ padding: "7px 10px", background: "rgba(232,98,42,0.08)", border: "1px solid rgba(232,98,42,0.18)", borderRadius: 8, color: "#E8622A", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}>Generate this document</button>
                                                    )}
                                                    {existsInVault && item.recommendedAction === "send_for_signature" && vaultMatch && <button onClick={() => onReview(vaultMatch.id)} style={{ padding: "7px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#888", fontSize: 11, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}>Send for signature</button>}
                                                    {!existsInVault && item.recommendedAction === "upload" && <span style={{ display: "inline-flex", alignItems: "center", padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#888", fontSize: 11 }}>Upload if you already have it</span>}
                                                    <button onClick={() => onDismiss(item.key)} style={{ padding: "7px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, color: "#666", fontSize: 11, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}>Not needed</button>
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

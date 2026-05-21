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
            border: "3px solid var(--tekori-gold)",
            badge: "Required",
            badgeColor: "var(--tekori-gold)",
            badgeBackground: "rgba(216,155,43,0.15)",
        },
        shouldHave: {
            border: "3px solid rgba(216,155,43,0.4)",
            badge: "Recommended",
            badgeColor: "rgba(216,155,43,0.85)",
            badgeBackground: "rgba(216,155,43,0.1)",
        },
        optionalFuture: {
            border: "3px solid rgba(7,26,47,0.08)",
            badge: "Optional",
            badgeColor: "rgba(7,26,47,0.45)",
            badgeBackground: "rgba(7,26,47,0.04)",
        },
    };

    return (
        <div style={{ marginBottom: 18, borderRadius: 16, border: "1px solid rgba(7,26,47,0.07)", background: "rgba(7,26,47,0.025)", overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                    <div style={{ fontSize: 15, fontFamily: "var(--tekori-font-brand)", fontWeight: 700 }}>What documents do I need?</div>
                    <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", marginTop: 4, lineHeight: 1.6 }}>
                        Tekori can help you identify common documents, but this does not replace legal or tax advice.
                    </div>
                </div>
                <button onClick={onToggle} style={{ padding: "9px 12px", background: show ? "rgba(216,155,43,0.08)" : "rgba(7,26,47,0.04)", border: show ? "1px solid rgba(216,155,43,0.18)" : "1px solid rgba(7,26,47,0.08)", borderRadius: 10, color: show ? "var(--tekori-gold)" : "var(--color-text-soft)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}>
                    {show ? "Hide wizard" : "What documents do I need?"}
                </button>
            </div>

            {show && (
                <div style={{ padding: "0 16px 16px", display: "grid", gap: 16 }}>
                    <div style={{ borderRadius: 14, border: "1px solid rgba(7,26,47,0.06)", background: "rgba(7,26,47,0.018)", padding: 14 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                            <input value={needsEntityType} onChange={(event) => setNeedsEntityType(event.target.value)} placeholder="Business type / entity type" style={{ width: "100%", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.09)", borderRadius: 10, padding: "10px 12px", color: "var(--color-text)", fontSize: 12, fontFamily: "var(--tekori-font-ui)", boxSizing: "border-box" }} />
                            <input value={needsState} onChange={(event) => setNeedsState(event.target.value)} placeholder="State" style={{ width: "100%", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.09)", borderRadius: 10, padding: "10px 12px", color: "var(--color-text)", fontSize: 12, fontFamily: "var(--tekori-font-ui)", boxSizing: "border-box" }} />
                            <input value={`Stage ${currentStage}`} readOnly style={{ width: "100%", background: "rgba(7,26,47,0.03)", border: "1px solid rgba(7,26,47,0.07)", borderRadius: 10, padding: "10px 12px", color: "var(--color-text-muted)", fontSize: 12, fontFamily: "var(--tekori-font-ui)", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr minmax(220px, 1.4fr)", gap: 10 }}>
                            <select value={needsGoal} onChange={(event) => setNeedsGoal(event.target.value as DocumentNeedGoal)} style={{ width: "100%", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.09)", borderRadius: 10, padding: "10px 12px", color: "var(--color-text)", fontSize: 12, fontFamily: "var(--tekori-font-ui)", boxSizing: "border-box", colorScheme: "light" }}>
                                {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.label}</option>)}
                            </select>
                            <input value={needsNotes} onChange={(event) => setNeedsNotes(event.target.value)} placeholder="Optional notes: team size, launch timeline, funding target, client work, IP concerns..." style={{ width: "100%", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.09)", borderRadius: 10, padding: "10px 12px", color: "var(--color-text)", fontSize: 12, fontFamily: "var(--tekori-font-ui)", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>
                                Tekori will compare your goal, current stage, and vault contents against the document catalog.
                            </div>
                            <button onClick={onRun} disabled={needsLoading} style={{ padding: "10px 13px", background: needsLoading ? "rgba(7,26,47,0.06)" : "rgba(216,155,43,0.08)", border: needsLoading ? "1px solid rgba(7,26,47,0.08)" : "1px solid rgba(216,155,43,0.18)", borderRadius: 10, color: needsLoading ? "var(--color-text-muted)" : "var(--tekori-gold)", fontSize: 12, fontWeight: 600, cursor: needsLoading ? "wait" : "pointer", fontFamily: "var(--tekori-font-ui)" }}>
                                {needsLoading ? "Building recommendations..." : "Get Recommendations"}
                            </button>
                        </div>
                    </div>

                    {needsError && <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(216,155,43,0.06)", border: "1px solid rgba(216,155,43,0.18)", fontSize: 12, color: "var(--color-text-soft)", lineHeight: 1.6 }}>{needsError}</div>}
                    {needsLoading && <div style={{ padding: "18px 14px", borderRadius: 12, border: "1px solid rgba(7,26,47,0.06)", background: "rgba(7,26,47,0.018)", fontSize: 12, color: "var(--foundry-text-secondary)" }}>Navi is comparing your stage, goals, and vault contents...</div>}
                    {!needsLoading && !visibleNeedsResult && !needsError && <div style={{ padding: "18px 14px", borderRadius: 12, border: "1px solid rgba(7,26,47,0.06)", background: "rgba(7,26,47,0.018)", fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>Use the wizard when you want a fast founder checklist before generating, uploading, or preparing documents for signature.</div>}

                    {!needsLoading && visibleNeedsResult && (
                        <div style={{ display: "grid", gap: 14 }}>
                            <div style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(7,26,47,0.06)", background: "rgba(7,26,47,0.018)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                                    <div style={{ fontSize: 14, color: "var(--color-text)", fontWeight: 600 }}>Recommendation Summary</div>
                                    <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, color: visibleNeedsResult.generatedBy === "ai" ? "var(--color-pill-text)" : "var(--tekori-gold)", background: visibleNeedsResult.generatedBy === "ai" ? "rgba(48,70,95,0.10)" : "rgba(244,199,106,0.14)", border: visibleNeedsResult.generatedBy === "ai" ? "1px solid rgba(48,70,95,0.20)" : "1px solid rgba(244,199,106,0.24)" }}>
                                        {visibleNeedsResult.generatedBy === "ai" ? "Navi-assisted" : "Built-in fallback"}
                                    </span>
                                </div>
                                <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.7, marginBottom: 6 }}>{visibleNeedsResult.summary}</div>
                                <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>{visibleNeedsResult.disclaimer}</div>
                            </div>

                            {([
                                { key: "mustHave", label: "Must-have documents", items: visibleNeedsResult.mustHave },
                                { key: "shouldHave", label: "Should-have documents", items: visibleNeedsResult.shouldHave },
                                { key: "optionalFuture", label: "Optional / future documents", items: visibleNeedsResult.optionalFuture },
                            ] as const).map((section) => (
                                <div key={section.key} style={{ borderRadius: 14, border: "1px solid rgba(7,26,47,0.06)", borderLeft: sectionStyles[section.key].border, background: "rgba(7,26,47,0.018)", overflow: "hidden" }}>
                                    <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(7,26,47,0.05)" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                            <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>{section.label}</div>
                                            <span style={{ padding: "4px 7px", borderRadius: 4, fontFamily: "var(--tekori-font-ui)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: sectionStyles[section.key].badgeColor, background: sectionStyles[section.key].badgeBackground }}>
                                                {sectionStyles[section.key].badge}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ padding: 12 }}>
                                        {section.items.length === 0 ? (
                                            <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>No recommendations in this section right now. You may already have the main documents covered, or you can change the goal and run it again.</div>
                                        ) : section.items.map((item) => {
                                            const vaultMatch = findVaultMatch(item.documentName, item.existingDocumentId);
                                            const existsInVault = Boolean(vaultMatch);
                                            return (
                                            <div key={item.key} style={{ padding: "12px 12px 11px", borderRadius: 12, border: "1px solid rgba(7,26,47,0.06)", background: "rgba(7,26,47,0.018)", marginBottom: 8 }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 5 }}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>{item.documentName}</div>
                                                        <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", marginTop: 3 }}>{item.categoryName} · Suggested stage {item.suggestedStage}</div>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                                        <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, color: existsInVault ? "var(--color-success)" : "var(--tekori-gold)", background: existsInVault ? "rgba(115,135,123,0.12)" : "rgba(216,155,43,0.1)", border: existsInVault ? "1px solid rgba(115,135,123,0.22)" : "1px solid rgba(216,155,43,0.2)" }}>
                                                            {existsInVault ? "Already in vault" : "Missing"}
                                                        </span>
                                                        <NeutralBadge label={RECOMMENDATION_ACTION_LABELS[item.recommendedAction]} />
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", lineHeight: 1.65, marginBottom: 10 }}>{item.whyItMatters}</div>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                    {existsInVault && vaultMatch ? (
                                                        <>
                                                            <span style={{ display: "inline-flex", alignItems: "center", padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(115,135,123,0.22)", background: "rgba(115,135,123,0.12)", color: "var(--color-success)", fontSize: 11, fontWeight: 700 }}>✓ In your vault</span>
                                                            <button onClick={() => onReview(vaultMatch.id)} style={{ padding: "7px 4px", background: "transparent", border: "none", color: "var(--color-text-soft)", fontSize: 11, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}>Review →</button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => onGenerate(item.categoryId, item.documentId)} style={{ padding: "7px 10px", background: "rgba(216,155,43,0.08)", border: "1px solid rgba(216,155,43,0.18)", borderRadius: 8, color: "var(--tekori-gold)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}>Generate this document</button>
                                                    )}
                                                    {existsInVault && item.recommendedAction === "send_for_signature" && vaultMatch && <button onClick={() => onReview(vaultMatch.id)} style={{ padding: "7px 10px", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 8, color: "var(--color-text-muted)", fontSize: 11, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}>Prepare to sign</button>}
                                                    {!existsInVault && item.recommendedAction === "upload" && <span style={{ display: "inline-flex", alignItems: "center", padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(7,26,47,0.08)", background: "rgba(7,26,47,0.03)", color: "var(--color-pill-text)", fontSize: 11 }}>Upload if you already have it</span>}
                                                    <button onClick={() => onDismiss(item.key)} style={{ padding: "7px 10px", background: "rgba(7,26,47,0.03)", border: "1px solid rgba(7,26,47,0.07)", borderRadius: 8, color: "var(--foundry-text-secondary)", fontSize: 11, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}>Not needed</button>
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

import type { MarketIntelligenceChange } from "../../db";
import { StructuredEmptyState } from "./shared";

const changeLabels = {
    added: "New",
    removed: "Removed",
    changed: "Changed",
} as const;

const entityLabels = {
    competitor: "Competitor",
    trend: "Trend",
    benchmark: "Benchmark",
} as const;

const outcomeLabels: Record<string, string> = {
    success: "Success",
    partial: "Partial",
    failed: "Failed",
    unknown: "Unknown",
};

const changeColors = {
    added: "var(--color-success)",
    removed: "var(--color-text-muted)",
    changed: "var(--tekori-gold)",
} as const;

export default function WhatChangedPanel({ changes }: { changes: MarketIntelligenceChange[] }) {
    if (changes.length === 0) {
        return (
            <StructuredEmptyState
                title="No changes detected yet."
                body="Once Tekori has at least two structured reports, new competitors, trend shifts, and benchmark changes will appear here."
            />
        );
    }

    const visibleChanges = changes.slice(0, 8);

    return (
        <div style={{ background: "rgba(7,26,47,0.025)", border: "1px solid rgba(7,26,47,0.07)", borderRadius: 14, padding: 14, display: "grid", gap: 11 }}>
            <div>
                <div style={{ fontSize: 17, color: "var(--color-text)", fontWeight: 900, fontFamily: "var(--tekori-font-brand)" }}>
                    What changed since your last report
                </div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6, marginTop: 4, fontFamily: "var(--tekori-font-ui)" }}>
                    Tekori turns meaningful market changes into follow-up actions, then keeps the outcome attached when you complete them.
                </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
                {visibleChanges.map((change) => {
                    const color = changeColors[change.changeType];
                    const outcome = change.actionOutcomeType ? outcomeLabels[change.actionOutcomeType] ?? change.actionOutcomeType : null;
                    return (
                        <div key={change.id} style={{ border: "1px solid rgba(7,26,47,0.06)", background: "rgba(7,26,47,0.025)", borderRadius: 12, padding: 12, display: "grid", gap: 7 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7 }}>
                                <Badge label={changeLabels[change.changeType]} color={color} />
                                <Badge label={entityLabels[change.entityType]} color="var(--tekori-gold)" />
                                {change.actionStatus && <Badge label={`Action ${change.actionStatus.replace(/_/g, " ")}`} color="var(--tekori-slate-navy)" />}
                                {outcome && <Badge label={`Outcome: ${outcome}`} color={change.actionOutcomeType === "failed" ? "var(--color-danger)" : change.actionOutcomeType === "success" ? "var(--color-success)" : "var(--tekori-gold)"} />}
                            </div>
                            <div style={{ fontSize: 14, color: "var(--color-text)", fontWeight: 800 }}>
                                {change.entityName}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.65 }}>
                                {change.changeSummary}
                            </div>
                            {change.changeReason && (
                                <div style={{ fontSize: 12, color: "var(--tekori-gold)", lineHeight: 1.55, background: "rgba(200,169,110,0.08)", border: "1px solid rgba(200,169,110,0.16)", borderRadius: 10, padding: "8px 10px" }}>
                                    {change.changeReason}
                                </div>
                            )}
                            {change.actionOutcomeNotes && (
                                <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.55, borderLeft: "2px solid rgba(115,135,123,0.40)", paddingLeft: 9 }}>
                                    {change.actionOutcomeNotes}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Badge({ label, color }: { label: string; color: string }) {
    return (
        <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, border: `1px solid color-mix(in srgb, ${color} 34%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)`, color, padding: "4px 8px", fontSize: 10, lineHeight: 1.1, textTransform: "capitalize", fontWeight: 800, fontFamily: "var(--tekori-font-ui)" }}>
            {label}
        </span>
    );
}

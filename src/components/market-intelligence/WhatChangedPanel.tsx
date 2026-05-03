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
    added: "#4CAF8A",
    removed: "#8D857C",
    changed: "#E8622A",
} as const;

export default function WhatChangedPanel({ changes }: { changes: MarketIntelligenceChange[] }) {
    if (changes.length === 0) {
        return (
            <StructuredEmptyState
                title="No changes detected yet."
                body="Once Foundry has at least two structured reports, new competitors, trend shifts, and benchmark changes will appear here."
            />
        );
    }

    const visibleChanges = changes.slice(0, 8);

    return (
        <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 14, display: "grid", gap: 11 }}>
            <div>
                <div style={{ fontSize: 17, color: "#F0EDE8", fontWeight: 900, fontFamily: "'Playfair Display', Georgia, serif" }}>
                    What changed since your last report
                </div>
                <div style={{ fontSize: 12, color: "#8D857C", lineHeight: 1.6, marginTop: 4, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                    Foundry turns meaningful market changes into follow-up actions, then keeps the outcome attached when you complete them.
                </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
                {visibleChanges.map((change) => {
                    const color = changeColors[change.changeType];
                    const outcome = change.actionOutcomeType ? outcomeLabels[change.actionOutcomeType] ?? change.actionOutcomeType : null;
                    return (
                        <div key={change.id} style={{ border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)", borderRadius: 12, padding: 12, display: "grid", gap: 7 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7 }}>
                                <Badge label={changeLabels[change.changeType]} color={color} />
                                <Badge label={entityLabels[change.entityType]} color="#C8A96E" />
                                {change.actionStatus && <Badge label={`Action ${change.actionStatus.replace(/_/g, " ")}`} color="#8FC8F6" />}
                                {outcome && <Badge label={`Outcome: ${outcome}`} color={change.actionOutcomeType === "failed" ? "#F05D5E" : change.actionOutcomeType === "success" ? "#4CAF8A" : "#C8A96E"} />}
                            </div>
                            <div style={{ fontSize: 14, color: "#F0EDE8", fontWeight: 800 }}>
                                {change.entityName}
                            </div>
                            <div style={{ fontSize: 12, color: "#BDAFA2", lineHeight: 1.65 }}>
                                {change.changeSummary}
                            </div>
                            {change.changeReason && (
                                <div style={{ fontSize: 12, color: "#C8A96E", lineHeight: 1.55, background: "rgba(200,169,110,0.08)", border: "1px solid rgba(200,169,110,0.16)", borderRadius: 10, padding: "8px 10px" }}>
                                    {change.changeReason}
                                </div>
                            )}
                            {change.actionOutcomeNotes && (
                                <div style={{ fontSize: 12, color: "#9D978E", lineHeight: 1.55, borderLeft: "2px solid rgba(76,175,138,0.4)", paddingLeft: 9 }}>
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
        <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, border: `1px solid ${color}55`, background: `${color}18`, color, padding: "4px 8px", fontSize: 10, lineHeight: 1.1, textTransform: "capitalize", fontWeight: 800, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            {label}
        </span>
    );
}

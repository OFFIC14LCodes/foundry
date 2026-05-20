import { useState } from "react";
import type { MarketTrend } from "../../db";
import type { FoundryActionSuggestion } from "../../lib/foundryActions";
import { suggestActionFromMarketInsight } from "../../lib/foundryActions";
import ActionSuggestionCard from "../actions/ActionSuggestionCard";
import { StructuredEmptyState } from "./shared";

function getImpactDisplay(impactLevel: string) {
    const normalized = impactLevel.trim().toLowerCase();
    if (normalized === "high") {
        return {
            label: "High Impact",
            color: "var(--color-success)",
            border: "var(--color-success)",
            background: "rgba(76,175,138,0.15)",
            tooltip: "This trend is actively reshaping your market right now",
        };
    }
    if (normalized === "medium") {
        return {
            label: "Watch This",
            color: "var(--tekori-amber)",
            border: "var(--tekori-amber)",
            background: "rgba(217,177,93,0.13)",
            tooltip: "This trend is growing and will matter to your business soon",
        };
    }
    return {
        label: "On the Horizon",
        color: "rgba(16,32,51,0.58)",
        border: "rgba(102,112,133,0.45)",
        background: "rgba(7,26,47,0.05)",
        tooltip: "Early signal worth monitoring as you scale",
    };
}

function getTimeframeDisplay(timeframe: string) {
    const normalized = timeframe.trim().toLowerCase();
    if (normalized === "current") return { label: "Happening Now", color: "var(--color-success)" };
    if (normalized === "emerging") return { label: "Emerging", color: "var(--tekori-muted-text)" };
    if (normalized === "future") return { label: "Future Signal", color: "rgba(16,32,51,0.58)" };
    return { label: timeframe || "Unspecified", color: "rgba(16,32,51,0.58)" };
}

function formatFirstSeen(value?: string | null) {
    if (!value) return "First seen today";
    const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return "First seen today";
    return `First seen ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export default function StructuredTrendsPanel({
    trends,
    onCreateAction,
    onAskForgeAboutAction,
    onAskForgeAboutTrend,
}: {
    trends: MarketTrend[];
    onCreateAction?: (suggestion: FoundryActionSuggestion) => void | Promise<unknown>;
    onAskForgeAboutAction?: (suggestion: FoundryActionSuggestion) => void;
    onAskForgeAboutTrend?: (trend: MarketTrend) => void;
}) {
    const [hoveredTrendId, setHoveredTrendId] = useState<string | null>(null);

    if (trends.length === 0) {
        return <StructuredEmptyState title="No trends identified yet." body="Structured market trends will appear here once they are extracted from saved market reports." />;
    }

    return (
        <div>
            <div style={{ fontFamily: "var(--tekori-font-ui)", fontSize: 12, color: "rgba(16,32,51,0.58)", fontStyle: "italic", lineHeight: 1.6, marginBottom: 14 }}>
                These trends are shaping your market right now. High Impact trends deserve your attention today.
            </div>
            <div style={{ display: "grid", gap: 10 }}>
                {trends.map((trend) => {
                    const impact = getImpactDisplay(trend.impactLevel);
                    const timeframe = getTimeframeDisplay(trend.timeframe);
                    const suggestion = suggestActionFromMarketInsight({
                        kind: "trend",
                        id: trend.id,
                        name: trend.name,
                        description: trend.description,
                        impactLevel: trend.impactLevel,
                    });

                    return (
                        <div key={trend.id} style={{ background: "rgba(7,26,47,0.02)", border: "1px solid rgba(7,26,47,0.06)", borderRadius: 12, padding: "16px 16px 14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--tekori-muted-text)", fontFamily: "var(--tekori-font-ui)", lineHeight: 1.35, flex: 1, minWidth: 0 }}>{trend.name}</div>
                                <div
                                    onMouseEnter={() => setHoveredTrendId(trend.id)}
                                    onMouseLeave={() => setHoveredTrendId(null)}
                                    style={{
                                        position: "relative",
                                        flexShrink: 0,
                                        alignSelf: "flex-start",
                                        fontFamily: "var(--tekori-font-ui)",
                                        fontSize: 10,
                                        color: impact.color,
                                        background: impact.background,
                                        border: `1px solid ${impact.border}`,
                                        borderRadius: 999,
                                        padding: "5px 8px",
                                        lineHeight: 1.1,
                                        fontWeight: 700,
                                    }}
                                >
                                    {impact.label}
                                    {hoveredTrendId === trend.id && (
                                        <div style={{
                                            position: "absolute",
                                            bottom: "calc(100% + 6px)",
                                            right: 0,
                                            background: "rgba(20,20,20,0.95)",
                                            border: "1px solid rgba(7,26,47,0.1)",
                                            borderRadius: 8,
                                            padding: "8px 12px",
                                            fontSize: 12,
                                            color: "var(--color-text)",
                                            width: 220,
                                            zIndex: 100,
                                            lineHeight: 1.45,
                                            fontWeight: 400,
                                            whiteSpace: "normal",
                                        }}>
                                            {impact.tooltip}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.7, fontFamily: "var(--tekori-font-ui)" }}>{trend.description || "Tracked trend."}</div>
                            <div style={{ borderTop: "1px solid rgba(7,26,47,0.06)", marginTop: 12, paddingTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: timeframe.color, fontFamily: "var(--tekori-font-ui)", fontSize: 11, fontWeight: 700 }}>
                                    <span>•</span>
                                    <span>{timeframe.label}</span>
                                </span>
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--tekori-amber)", fontFamily: "var(--tekori-font-ui)", fontSize: 11, fontWeight: 700 }}>
                                    <span>Momentum:</span>
                                    <span>{trend.recurrenceCount ?? 0}x · {formatFirstSeen(trend.firstSeenAt)}</span>
                                </span>
                            </div>
                            {(onCreateAction || onAskForgeAboutAction || onAskForgeAboutTrend) && (
                                <div style={{ marginTop: 12 }}>
                                    <ActionSuggestionCard
                                        action={suggestion}
                                        compact
                                        acceptLabel="Create action"
                                        onAccept={onCreateAction ? () => void onCreateAction(suggestion) : undefined}
                                        onAskForge={onAskForgeAboutTrend
                                            ? () => onAskForgeAboutTrend(trend)
                                            : onAskForgeAboutAction
                                                ? () => onAskForgeAboutAction(suggestion)
                                                : undefined}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

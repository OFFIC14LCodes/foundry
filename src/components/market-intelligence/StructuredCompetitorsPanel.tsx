import { useState } from "react";
import type { Competitor } from "../../db";
import type { FoundryActionSuggestion } from "../../lib/foundryActions";
import { suggestActionFromMarketInsight } from "../../lib/foundryActions";
import ActionSuggestionCard from "../actions/ActionSuggestionCard";
import { StructuredEmptyState } from "./shared";

type RichCompetitor = Competitor & {
    summary?: string | null;
    strengths?: unknown[];
    weaknesses?: unknown[];
    pricingNotes?: string | null;
    positioning?: string | null;
    timesSpotted?: number;
};

function toTextList(value: unknown[] | undefined) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item).trim()).filter(Boolean);
}

export default function StructuredCompetitorsPanel({
    competitors,
    onCreateAction,
    onAskForgeAboutAction,
}: {
    competitors: RichCompetitor[];
    onCreateAction?: (suggestion: FoundryActionSuggestion) => void | Promise<unknown>;
    onAskForgeAboutAction?: (suggestion: FoundryActionSuggestion) => void;
}) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [hoveredWebsite, setHoveredWebsite] = useState<string | null>(null);

    if (competitors.length === 0) {
        return <StructuredEmptyState title="No competitors tracked yet." body="Structured competitor tracking will appear here once intelligence is extracted or saved." />;
    }

    const toggle = (competitorId: string) => {
        setExpandedIds((current) => {
            const next = new Set(current);
            if (next.has(competitorId)) {
                next.delete(competitorId);
            } else {
                next.add(competitorId);
            }
            return next;
        });
    };

    return (
        <div style={{ display: "grid", gap: 10 }}>
            {competitors.map((competitor) => {
                const expanded = expandedIds.has(competitor.id);
                const strengths = toTextList(competitor.strengths);
                const weaknesses = toTextList(competitor.weaknesses);
                const suggestion = suggestActionFromMarketInsight({
                    kind: "competitor",
                    id: competitor.id,
                    name: competitor.name,
                    description: competitor.summary || competitor.description,
                });

                return (
                    <div
                        key={competitor.id}
                        onClick={() => toggle(competitor.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                toggle(competitor.id);
                            }
                        }}
                        style={{
                            width: "100%",
                            textAlign: "left",
                            background: expanded ? "rgba(48,70,95,0.045)" : "rgba(7,26,47,0.02)",
                            border: expanded ? "1px solid rgba(48,70,95,0.18)" : "1px solid rgba(7,26,47,0.06)",
                            borderRadius: 12,
                            padding: "16px 16px 14px",
                            color: "var(--color-text)",
                            cursor: "pointer",
                            boxSizing: "border-box",
                            transition: "background 0.15s, border-color 0.15s",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--tekori-muted-text)", fontFamily: "var(--tekori-font-ui)", lineHeight: 1.35, minWidth: 0, flex: 1 }}>
                                {competitor.name}
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                {(competitor.timesSpotted ?? 0) > 0 && (
                                    <div style={{ fontFamily: "var(--tekori-font-ui)", fontSize: 10, color: "var(--tekori-gold)", background: "rgba(244,199,106,0.12)", border: "1px solid rgba(244,199,106,0.26)", borderRadius: 999, padding: "4px 7px", lineHeight: 1.2, fontWeight: 700 }}>
                                        {competitor.timesSpotted}x spotted
                                    </div>
                                )}
                                {competitor.positioning && (
                                    <div style={{ fontFamily: "var(--tekori-font-ui)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-pill-text)", background: "rgba(48,70,95,0.12)", border: "1px solid rgba(48,70,95,0.30)", borderRadius: 6, padding: "4px 7px", lineHeight: 1.2 }}>
                                        {competitor.positioning}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--color-text-muted)",
                                lineHeight: 1.7,
                                fontFamily: "var(--tekori-font-ui)",
                                overflow: expanded ? "visible" : "hidden",
                                textOverflow: expanded ? "clip" : "ellipsis",
                                whiteSpace: expanded ? "normal" : "nowrap",
                            }}
                        >
                            {competitor.description || "Tracked competitor."}
                        </div>

                        {expanded && (
                            <div style={{ marginTop: 14 }}>
                                {competitor.summary && competitor.summary.trim() !== (competitor.description ?? "").trim() && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 10, fontFamily: "var(--tekori-font-ui)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--tekori-muted-text)", marginBottom: 7 }}>
                                            What they offer
                                        </div>
                                        <div style={{ fontSize: 13, color: "rgba(16,32,51,0.8)", lineHeight: 1.75, fontFamily: "var(--tekori-font-ui)", paddingBottom: 14, borderBottom: "1px solid rgba(7,26,47,0.06)" }}>
                                            {competitor.summary}
                                        </div>
                                    </div>
                                )}

                                {(strengths.length > 0 || weaknesses.length > 0) && (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 2 }}>
                                        <div>
                                            <div style={{ color: "var(--color-success)", fontFamily: "var(--tekori-font-ui)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
                                                Strengths
                                            </div>
                                            {strengths.length > 0 ? strengths.map((strength) => (
                                                <div key={strength} style={{ display: "flex", gap: 7, color: "rgba(16,32,51,0.65)", fontFamily: "var(--tekori-font-ui)", fontSize: 12, lineHeight: 1.6, marginBottom: 4 }}>
                                                    <span style={{ color: "var(--color-success)" }}>•</span>
                                                    <span>{strength}</span>
                                                </div>
                                            )) : (
                                                <div style={{ color: "rgba(7,26,47,0.74)", fontFamily: "var(--tekori-font-ui)", fontSize: 12 }}>No strengths captured.</div>
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ color: "var(--tekori-muted-text)", fontFamily: "var(--tekori-font-ui)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
                                                Weaknesses
                                            </div>
                                            {weaknesses.length > 0 ? weaknesses.map((weakness) => (
                                                <div key={weakness} style={{ display: "flex", gap: 7, color: "rgba(16,32,51,0.65)", fontFamily: "var(--tekori-font-ui)", fontSize: 12, lineHeight: 1.6, marginBottom: 4 }}>
                                                    <span style={{ color: "var(--tekori-muted-text)" }}>•</span>
                                                    <span>{weakness}</span>
                                                </div>
                                            )) : (
                                                <div style={{ color: "rgba(7,26,47,0.74)", fontFamily: "var(--tekori-font-ui)", fontSize: 12 }}>No weaknesses captured.</div>
                                            )}
                                            {competitor.pricingNotes && (
                                                <div style={{ color: "var(--color-text-muted)", fontFamily: "var(--tekori-font-ui)", fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>
                                                    Pricing: {competitor.pricingNotes}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {competitor.website && (
                                    <div style={{ textAlign: "right", marginTop: 14 }}>
                                        <a
                                            href={competitor.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(event) => event.stopPropagation()}
                                            onMouseEnter={() => setHoveredWebsite(competitor.id)}
                                            onMouseLeave={() => setHoveredWebsite(null)}
                                            style={{ color: "var(--tekori-muted-text)", fontFamily: "var(--tekori-font-ui)", fontSize: 11, textDecoration: hoveredWebsite === competitor.id ? "underline" : "none", textUnderlineOffset: 3 }}
                                        >
                                            Visit website ↗
                                        </a>
                                    </div>
                                )}
                                {(onCreateAction || onAskForgeAboutAction) && (
                                    <div style={{ marginTop: 14 }} onClick={(event) => event.stopPropagation()}>
                                        <ActionSuggestionCard
                                            action={suggestion}
                                            compact
                                            acceptLabel="Create action"
                                            onAccept={onCreateAction ? () => void onCreateAction(suggestion) : undefined}
                                            onAskForge={onAskForgeAboutAction ? () => onAskForgeAboutAction(suggestion) : undefined}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ textAlign: "right", color: expanded ? "rgba(48,70,95,0.45)" : "rgba(7,26,47,0.45)", fontFamily: "var(--tekori-font-ui)", fontSize: 11, marginTop: 10 }}>
                            {expanded ? "See less ↑" : "See more ↓"}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

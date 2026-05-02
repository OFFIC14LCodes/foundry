import { useState } from "react";
import type { Competitor } from "../../db";
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

export default function StructuredCompetitorsPanel({ competitors }: { competitors: RichCompetitor[] }) {
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
                            background: expanded ? "rgba(232,98,42,0.04)" : "rgba(255,255,255,0.02)",
                            border: expanded ? "1px solid rgba(232,98,42,0.18)" : "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 12,
                            padding: "16px 16px 14px",
                            color: "#F0EDE8",
                            cursor: "pointer",
                            boxSizing: "border-box",
                            transition: "background 0.15s, border-color 0.15s",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#E8622A", fontFamily: "'Lora', Georgia, serif", lineHeight: 1.35 }}>
                                {competitor.name}
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", flexShrink: 0 }}>
                                {(competitor.timesSpotted ?? 0) > 0 && (
                                    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, color: "#F5A843", background: "rgba(245,168,67,0.1)", border: "1px solid rgba(245,168,67,0.25)", borderRadius: 999, padding: "4px 7px", lineHeight: 1.2, fontWeight: 700 }}>
                                        {competitor.timesSpotted}x spotted
                                    </div>
                                )}
                                {competitor.positioning && (
                                    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#E8622A", background: "rgba(232,98,42,0.15)", border: "1px solid rgba(232,98,42,0.6)", borderRadius: 6, padding: "4px 7px", lineHeight: 1.2 }}>
                                        {competitor.positioning}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div
                            style={{
                                fontSize: 12,
                                color: "#A8A4A0",
                                lineHeight: 1.7,
                                fontFamily: "'DM Sans', system-ui, sans-serif",
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
                                        <div style={{ fontSize: 10, fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#E8622A", marginBottom: 7 }}>
                                            What they offer
                                        </div>
                                        <div style={{ fontSize: 13, color: "rgba(240,237,232,0.8)", lineHeight: 1.75, fontFamily: "'DM Sans', system-ui, sans-serif", paddingBottom: 14, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                            {competitor.summary}
                                        </div>
                                    </div>
                                )}

                                {(strengths.length > 0 || weaknesses.length > 0) && (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 2 }}>
                                        <div>
                                            <div style={{ color: "#4CAF8A", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
                                                Strengths
                                            </div>
                                            {strengths.length > 0 ? strengths.map((strength) => (
                                                <div key={strength} style={{ display: "flex", gap: 7, color: "rgba(240,237,232,0.65)", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, lineHeight: 1.6, marginBottom: 4 }}>
                                                    <span style={{ color: "#4CAF8A" }}>•</span>
                                                    <span>{strength}</span>
                                                </div>
                                            )) : (
                                                <div style={{ color: "rgba(240,237,232,0.35)", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12 }}>No strengths captured.</div>
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ color: "#E8622A", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>
                                                Weaknesses
                                            </div>
                                            {weaknesses.length > 0 ? weaknesses.map((weakness) => (
                                                <div key={weakness} style={{ display: "flex", gap: 7, color: "rgba(240,237,232,0.65)", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, lineHeight: 1.6, marginBottom: 4 }}>
                                                    <span style={{ color: "#E8622A" }}>•</span>
                                                    <span>{weakness}</span>
                                                </div>
                                            )) : (
                                                <div style={{ color: "rgba(240,237,232,0.35)", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12 }}>No weaknesses captured.</div>
                                            )}
                                            {competitor.pricingNotes && (
                                                <div style={{ color: "rgba(240,237,232,0.45)", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>
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
                                            style={{ color: "#E8622A", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, textDecoration: hoveredWebsite === competitor.id ? "underline" : "none", textUnderlineOffset: 3 }}
                                        >
                                            Visit website ↗
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ textAlign: "right", color: expanded ? "rgba(232,98,42,0.5)" : "rgba(240,237,232,0.3)", fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, marginTop: 10 }}>
                            {expanded ? "See less ↑" : "See more ↓"}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

import { useState } from "react";
import type { MarketReportSource } from "../../db";
import { StructuredEmptyState } from "./shared";

export default function StructuredSourcesPanel({ sources }: { sources: MarketReportSource[] }) {
    const [hoveredUrl, setHoveredUrl] = useState<string | null>(null);

    if (sources.length === 0) {
        return <StructuredEmptyState title="No sources saved for this report yet." body="Saved sources will appear here when a structured extraction run stores source references for the selected report." />;
    }

    return (
        <div>
            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,232,0.4)", marginBottom: 14 }}>
                {sources.length} source{sources.length === 1 ? "" : "s"} referenced in this report
            </div>
            <div>
                {sources.map((source, index) => (
                    <div
                        key={source.id}
                        style={{
                            display: "grid",
                            gridTemplateColumns: "24px minmax(0, 1fr)",
                            columnGap: 10,
                            padding: "12px 0",
                            borderTop: index === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
                        }}
                    >
                        <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "rgba(240,237,232,0.4)", textAlign: "right", lineHeight: 1.7 }}>
                            {index + 1}.
                        </div>
                        <div>
                            <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onMouseEnter={() => setHoveredUrl(source.url)}
                                onMouseLeave={() => setHoveredUrl(null)}
                                style={{
                                    color: "#E8622A",
                                    fontFamily: "'DM Sans', system-ui, sans-serif",
                                    fontSize: 14,
                                    textDecoration: hoveredUrl === source.url ? "underline" : "none",
                                    textUnderlineOffset: 3,
                                    lineHeight: 1.45,
                                }}
                            >
                                {source.title}
                            </a>
                            <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "rgba(240,237,232,0.5)", lineHeight: 1.6, marginTop: 4 }}>
                                {source.snippet || "Saved source reference."}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

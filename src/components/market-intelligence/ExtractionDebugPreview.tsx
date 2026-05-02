import type { ExtractionDebugPreview as ExtractionDebugPreviewType } from "./shared";

export default function ExtractionDebugPreview({
    preview,
    hasStructuredInsightsForCurrentReport,
    analyzingReport,
    savingExtractedInsights,
    onSave,
}: {
    preview: ExtractionDebugPreviewType | null;
    hasStructuredInsightsForCurrentReport: boolean;
    analyzingReport: boolean;
    savingExtractedInsights: boolean;
    onSave: () => void;
}) {
    if (!preview) return null;

    const lowQuality = preview.quality.score < 70;
    const scoreColor = preview.quality.score >= 85 ? "#4CAF8A" : preview.quality.score >= 70 ? "#F5A843" : "#E8622A";

    return (
        <details style={{ marginBottom: 12, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 14px" }}>
            <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#C8C4BE" }}>
                Extraction Debug Preview
            </summary>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 999, padding: "8px 12px" }}>
                        <span style={{ fontSize: 10, color: "#77716A", textTransform: "uppercase", letterSpacing: "0.08em" }}>Quality Score</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: scoreColor }}>{preview.quality.score}/100</span>
                    </div>
                    {lowQuality && (
                        <div style={{ fontSize: 11, color: "#F5A843", lineHeight: 1.6 }}>
                            Low-confidence extraction. Review carefully before saving structured rows.
                        </div>
                    )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                    {[
                        { label: "Competitors", value: preview.parsed.competitors.length },
                        { label: "Trends", value: preview.parsed.trends.length },
                        { label: "Benchmarks", value: preview.parsed.benchmarks.length },
                        { label: "Sources", value: preview.parsed.sources.length },
                    ].map((item) => (
                        <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: "#E8622A", marginBottom: 2 }}>{item.value}</div>
                            <div style={{ fontSize: 10, color: "#77716A", textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.label}</div>
                        </div>
                    ))}
                </div>

                <div style={{ fontSize: 11, color: preview.rawJsonValid ? "#4CAF8A" : "#F5A843" }}>
                    {preview.rawJsonValid ? "Raw Forge output parsed as JSON." : "Raw Forge output did not parse as valid JSON."}
                </div>

                {preview.warnings.length > 0 && (
                    <div style={{ fontSize: 11, color: "#F5A843", lineHeight: 1.6 }}>
                        {preview.warnings.map((warning, index) => (
                            <div key={`${warning}-${index}`}>{warning}</div>
                        ))}
                    </div>
                )}

                {preview.quality.strengths.length > 0 && (
                    <div style={{ fontSize: 11, color: "#4CAF8A", lineHeight: 1.6 }}>
                        {preview.quality.strengths.map((strength, index) => (
                            <div key={`${strength}-${index}`}>{strength}</div>
                        ))}
                    </div>
                )}

                {preview.quality.issues.length > 0 && (
                    <div style={{ fontSize: 11, color: "#F5A843", lineHeight: 1.6 }}>
                        {preview.quality.issues.map((issue, index) => (
                            <div key={`${issue}-${index}`}>{issue}</div>
                        ))}
                    </div>
                )}

                <details>
                    <summary style={{ cursor: "pointer", fontSize: 11, color: "#A8A4A0" }}>Normalized preview</summary>
                    <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 10, color: "#C8C4BE", background: "rgba(0,0,0,0.18)", borderRadius: 8, padding: "10px 12px", overflowX: "auto" }}>
                        {JSON.stringify(preview.parsed, null, 2)}
                    </pre>
                </details>

                <details>
                    <summary style={{ cursor: "pointer", fontSize: 11, color: "#A8A4A0" }}>Raw Forge JSON</summary>
                    <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 10, color: "#C8C4BE", background: "rgba(0,0,0,0.18)", borderRadius: 8, padding: "10px 12px", overflowX: "auto" }}>
                        {preview.rawText}
                    </pre>
                </details>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <button
                        onClick={onSave}
                        disabled={savingExtractedInsights || analyzingReport}
                        style={{
                            background: (savingExtractedInsights || analyzingReport) ? "rgba(255,255,255,0.06)" : "rgba(76,175,138,0.12)",
                            border: (savingExtractedInsights || analyzingReport) ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(76,175,138,0.24)",
                            borderRadius: 10,
                            padding: "8px 14px",
                            color: (savingExtractedInsights || analyzingReport) ? "#77716A" : "#4CAF8A",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: (savingExtractedInsights || analyzingReport) ? "default" : "pointer",
                        }}
                    >
                        {savingExtractedInsights ? "Saving..." : hasStructuredInsightsForCurrentReport ? "Save Rerun Results" : "Save Extracted Insights"}
                    </button>
                    <div style={{ fontSize: 11, color: "#77716A", lineHeight: 1.6 }}>
                        {hasStructuredInsightsForCurrentReport
                            ? "Dev-only rerun save. Existing structured rows stay in place, and unchanged rows may be skipped by duplicate guards."
                            : lowQuality
                                ? "Dev-only second step. Quality score is low, so inspect the preview before saving."
                                : "Dev-only second step. Review the preview before saving structured rows."}
                    </div>
                </div>
            </div>
        </details>
    );
}

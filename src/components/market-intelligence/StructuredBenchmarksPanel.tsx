import type { IndustryBenchmark } from "../../db";
import type { FoundryActionSuggestion } from "../../lib/foundryActions";
import { suggestActionFromMarketInsight } from "../../lib/foundryActions";
import ActionSuggestionCard from "../actions/ActionSuggestionCard";
import { StructuredEmptyState } from "./shared";

function formatBenchmarkValue(value: string, unit: string | null) {
    const trimmedValue = value.trim();
    const numericValue = Number(trimmedValue.replace(/,/g, ""));
    const displayValue = Number.isFinite(numericValue) && Math.abs(numericValue) >= 1000
        ? numericValue.toLocaleString("en-US")
        : trimmedValue;

    if (!unit) return displayValue;
    const trimmedUnit = unit.trim();
    return trimmedUnit.startsWith("%") ? `${displayValue}${trimmedUnit}` : `${displayValue} ${trimmedUnit}`;
}

export default function StructuredBenchmarksPanel({
    benchmarks,
    onCreateAction,
    onAskForgeAboutAction,
}: {
    benchmarks: IndustryBenchmark[];
    onCreateAction?: (suggestion: FoundryActionSuggestion) => void | Promise<unknown>;
    onAskForgeAboutAction?: (suggestion: FoundryActionSuggestion) => void;
}) {
    if (benchmarks.length === 0) {
        return <StructuredEmptyState title="No benchmarks available yet." body="Industry benchmarks will appear here when structured intelligence has benchmark data to display." />;
    }

    return (
        <div>
            <div style={{ fontFamily: "var(--tekori-font-ui)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(16,32,51,0.58)", marginBottom: 6 }}>
                Industry benchmarks — know your numbers
            </div>
            <div style={{ fontFamily: "var(--tekori-font-ui)", fontSize: 12, color: "rgba(16,32,51,0.58)", fontStyle: "italic", lineHeight: 1.6, marginBottom: 14 }}>
                These numbers define what healthy looks like in your market. Use them to pressure-test your own projections.
            </div>
            <div style={{ display: "grid", gap: 10 }}>
                {benchmarks.map((benchmark) => {
                    const suggestion = suggestActionFromMarketInsight({
                        kind: "benchmark",
                        id: benchmark.id,
                        name: benchmark.metric,
                        description: benchmark.description,
                    });
                    return (
                    <div key={benchmark.id} style={{ background: "rgba(7,26,47,0.02)", border: "1px solid rgba(7,26,47,0.06)", borderLeft: "3px solid rgba(48,70,95,0.34)", borderRadius: 12, padding: "16px 16px 14px" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text)", fontFamily: "var(--tekori-font-ui)", lineHeight: 1.35, marginBottom: 8 }}>
                            {benchmark.metric}
                        </div>
                        <div style={{ color: "var(--tekori-muted-text)", fontFamily: "var(--tekori-font-brand)", fontSize: 24, fontWeight: 700, lineHeight: 1.1, marginBottom: 8 }}>
                            {formatBenchmarkValue(benchmark.value, benchmark.unit)}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(7,26,47,0.88)", lineHeight: 1.6, fontFamily: "var(--tekori-font-ui)" }}>
                            {benchmark.description || "Saved benchmark."}
                        </div>
                        {(onCreateAction || onAskForgeAboutAction) && (
                            <div style={{ marginTop: 12 }}>
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
                );})}
            </div>
        </div>
    );
}

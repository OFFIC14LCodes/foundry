import {
    formatActionModule,
    formatActionSourceType,
    formatActionType,
    type FoundryAction,
    type FoundryActionOutcomeType,
    type FoundryActionSuggestion,
} from "../../lib/foundryActions";

type Props = {
    action: FoundryAction | FoundryActionSuggestion;
    status?: string | null;
    compact?: boolean;
    acceptLabel?: string;
    dismissLabel?: string;
    onAccept?: () => void;
    onDismiss?: () => void;
    onAskForge?: () => void;
};

const priorityColors = {
    low: "var(--color-text-muted)",
    medium: "var(--tekori-gold)",
    high: "var(--tekori-gold)",
    critical: "var(--color-danger)",
} as const;

const outcomeColors: Record<FoundryActionOutcomeType, string> = {
    success: "var(--color-success)",
    partial: "var(--tekori-gold)",
    failed: "var(--color-danger)",
    unknown: "var(--color-text-muted)",
};

const outcomeLabels: Record<FoundryActionOutcomeType, string> = {
    success: "Success",
    partial: "Partial",
    failed: "Failed",
    unknown: "Unknown",
};

export default function ActionSuggestionCard({
    action,
    status,
    compact = false,
    acceptLabel = "Accept",
    dismissLabel = "Dismiss",
    onAccept,
    onDismiss,
    onAskForge,
}: Props) {
    const priority = action.priority ?? "medium";
    const priorityColor = priorityColors[priority];
    const outcomeType = "outcomeType" in action ? action.outcomeType : null;
    const outcomeNotes = "outcomeNotes" in action ? action.outcomeNotes : null;

    return (
        <div style={{
            background: "linear-gradient(180deg, var(--color-surface), var(--color-surface-elevated))",
            border: "1px solid var(--color-border)",
            borderRadius: compact ? 12 : 16,
            padding: compact ? 12 : 16,
            display: "grid",
            gap: 10,
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, display: "grid", gap: 5 }}>
                    <div style={{ fontSize: 11, color: "var(--tekori-slate-navy)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, fontFamily: "var(--tekori-font-ui)" }}>
                        Next action
                    </div>
                    <div style={{ fontSize: compact ? 15 : 18, color: "var(--color-text)", lineHeight: 1.25, fontWeight: 800 }}>
                        {action.title}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {status && <Badge label={status.replace(/_/g, " ")} color="var(--tekori-slate-navy)" />}
                    <Badge label={priority} color={priorityColor} />
                </div>
            </div>

            <div style={{ fontSize: 13, color: "var(--color-text-soft)", lineHeight: 1.65 }}>
                {action.description}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
                <Badge label={`From ${formatActionModule(action.sourceModule)}`} color="var(--tekori-gold)" />
                <Badge label={formatActionSourceType(action.sourceType)} color="var(--color-text-muted)" />
                <Badge label={formatActionType(action.actionType)} color="var(--color-text-muted)" />
                {action.dueDate && <Badge label={`Due ${action.dueDate}`} color="var(--color-success)" />}
                {outcomeType && <Badge label={`Outcome: ${outcomeLabels[outcomeType]}`} color={outcomeColors[outcomeType]} />}
            </div>

            {outcomeNotes && (
                <div style={{ borderLeft: "2px solid rgba(115,135,123,0.45)", paddingLeft: 10, color: "var(--color-text-muted)", fontSize: 12, lineHeight: 1.55 }}>
                    {outcomeNotes}
                </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {onAccept && (
                    <button type="button" onClick={onAccept} style={buttonStyle("gold")}>
                        {acceptLabel}
                    </button>
                )}
                {onAskForge && (
                    <button type="button" onClick={onAskForge} style={buttonStyle("blue")}>
                        Ask Navi
                    </button>
                )}
                {onDismiss && (
                    <button type="button" onClick={onDismiss} style={buttonStyle("muted")}>
                        {dismissLabel}
                    </button>
                )}
            </div>
        </div>
    );
}

function Badge({ label, color }: { label: string; color: string }) {
    return (
        <span style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            border: `1px solid color-mix(in srgb, ${color} 34%, transparent)`,
            background: `color-mix(in srgb, ${color} 10%, transparent)`,
            color,
            padding: "4px 8px",
            fontSize: 10,
            lineHeight: 1.1,
            textTransform: "capitalize",
            fontWeight: 800,
            fontFamily: "var(--tekori-font-ui)",
        }}>
            {label}
        </span>
    );
}

function buttonStyle(tone: "gold" | "blue" | "muted") {
    const styles = {
        gold: { background: "rgba(216,155,43,0.12)", border: "1px solid rgba(216,155,43,0.28)", color: "var(--tekori-gold)" },
        blue: { background: "rgba(48,70,95,0.10)", border: "1px solid rgba(48,70,95,0.22)", color: "var(--tekori-slate-navy)" },
        muted: { background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", color: "var(--color-pill-text)" },
    } as const;
    return {
        ...styles[tone],
        borderRadius: 999,
        padding: "8px 11px",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        fontFamily: "var(--tekori-font-ui)",
    };
}

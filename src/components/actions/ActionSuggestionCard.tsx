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
    low: "#8D857C",
    medium: "#C8A96E",
    high: "#E8622A",
    critical: "#F05D5E",
} as const;

const outcomeColors: Record<FoundryActionOutcomeType, string> = {
    success: "#4CAF8A",
    partial: "#C8A96E",
    failed: "#F05D5E",
    unknown: "#8D857C",
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
            background: "linear-gradient(180deg, rgba(232,98,42,0.07), rgba(255,255,255,0.025))",
            border: "1px solid rgba(232,98,42,0.16)",
            borderRadius: compact ? 12 : 16,
            padding: compact ? 12 : 16,
            display: "grid",
            gap: 10,
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, display: "grid", gap: 5 }}>
                    <div style={{ fontSize: 11, color: "#E8622A", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 800, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                        Next action
                    </div>
                    <div style={{ fontSize: compact ? 15 : 18, color: "#F0EDE8", lineHeight: 1.25, fontWeight: 800 }}>
                        {action.title}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    {status && <Badge label={status.replace(/_/g, " ")} color="#8FC8F6" />}
                    <Badge label={priority} color={priorityColor} />
                </div>
            </div>

            <div style={{ fontSize: 13, color: "#BDAFA2", lineHeight: 1.65 }}>
                {action.description}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
                <Badge label={`From ${formatActionModule(action.sourceModule)}`} color="#C8A96E" />
                <Badge label={formatActionSourceType(action.sourceType)} color="#A8A4A0" />
                <Badge label={formatActionType(action.actionType)} color="#A8A4A0" />
                {action.dueDate && <Badge label={`Due ${action.dueDate}`} color="#4CAF8A" />}
                {outcomeType && <Badge label={`Outcome: ${outcomeLabels[outcomeType]}`} color={outcomeColors[outcomeType]} />}
            </div>

            {outcomeNotes && (
                <div style={{ borderLeft: "2px solid rgba(76,175,138,0.45)", paddingLeft: 10, color: "#AFA79E", fontSize: 12, lineHeight: 1.55 }}>
                    {outcomeNotes}
                </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {onAccept && (
                    <button type="button" onClick={onAccept} style={buttonStyle("orange")}>
                        {acceptLabel}
                    </button>
                )}
                {onAskForge && (
                    <button type="button" onClick={onAskForge} style={buttonStyle("blue")}>
                        Ask Forge
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
            border: `1px solid ${color}55`,
            background: `${color}18`,
            color,
            padding: "4px 8px",
            fontSize: 10,
            lineHeight: 1.1,
            textTransform: "capitalize",
            fontWeight: 800,
            fontFamily: "'DM Sans', system-ui, sans-serif",
        }}>
            {label}
        </span>
    );
}

function buttonStyle(tone: "orange" | "blue" | "muted") {
    const styles = {
        orange: { background: "rgba(232,98,42,0.12)", border: "1px solid rgba(232,98,42,0.28)", color: "#E8622A" },
        blue: { background: "rgba(99,179,237,0.10)", border: "1px solid rgba(99,179,237,0.22)", color: "#8FC8F6" },
        muted: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9D978E" },
    } as const;
    return {
        ...styles[tone],
        borderRadius: 999,
        padding: "8px 11px",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        fontFamily: "'DM Sans', system-ui, sans-serif",
    };
}

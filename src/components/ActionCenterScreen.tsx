import { useCallback, useEffect, useMemo, useState } from "react";
import Logo from "./Logo";
import ActionSuggestionCard from "./actions/ActionSuggestionCard";
import HelpTooltip from "./HelpTooltip";
import {
    buildForgePromptForAction,
    completeFoundryAction,
    dismissFoundryAction,
    loadFoundryActionsByUser,
    recordActionOutcome,
    updateFoundryActionStatus,
    type FoundryAction,
    type FoundryActionOutcomeType,
    type FoundryActionPriority,
    type FoundryActionSourceModule,
    type FoundryActionStatus,
} from "../lib/foundryActions";

type Props = {
    userId: string;
    onBack: () => void;
    onOpenNav?: () => void;
    onAskForge: (prompt: string) => void;
};

const statusOptions: Array<FoundryActionStatus | "all"> = ["all", "suggested", "accepted", "in_progress", "completed", "dismissed"];
const priorityOptions: Array<FoundryActionPriority | "all"> = ["all", "critical", "high", "medium", "low"];
const moduleOptions: Array<FoundryActionSourceModule | "all"> = [
    "all",
    "forge",
    "academy",
    "market_intelligence",
    "weekly_intelligence",
    "finance",
    "strategy",
    "document_vault",
    "journal",
    "system",
];

const statusGroups: Array<{
    key: string;
    title: string;
    description: string;
    statuses: FoundryActionStatus[];
}> = [
    {
        key: "suggested",
        title: "Suggested next moves",
        description: "Worth considering, but not committed yet.",
        statuses: ["suggested"],
    },
    {
        key: "active",
        title: "In motion",
        description: "Accepted work that should move toward a visible outcome.",
        statuses: ["accepted", "in_progress"],
    },
    {
        key: "completed",
        title: "Completed",
        description: "Actions already closed out.",
        statuses: ["completed"],
    },
    {
        key: "dismissed",
        title: "Dismissed",
        description: "Suggestions intentionally skipped.",
        statuses: ["dismissed"],
    },
];

function getNextActionStatus(status: FoundryActionStatus): FoundryActionStatus | null {
    if (status === "suggested") return "accepted";
    if (status === "accepted") return "in_progress";
    if (status === "in_progress") return "completed";
    return null;
}

function getPrimaryActionLabel(status: FoundryActionStatus) {
    if (status === "suggested") return "Accept";
    if (status === "accepted") return "Start";
    if (status === "in_progress") return "Complete";
    return "Done";
}

export default function ActionCenterScreen({ userId, onBack, onOpenNav, onAskForge }: Props) {
    const [actions, setActions] = useState<FoundryAction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingOutcomeActionId, setPendingOutcomeActionId] = useState<string | null>(null);
    const [outcomeNotes, setOutcomeNotes] = useState("");
    const [statusFilter, setStatusFilter] = useState<FoundryActionStatus | "all">("all");
    const [priorityFilter, setPriorityFilter] = useState<FoundryActionPriority | "all">("all");
    const [moduleFilter, setModuleFilter] = useState<FoundryActionSourceModule | "all">("all");

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setActions(await loadFoundryActionsByUser(userId));
        } catch {
            setActions([]);
            setError("Action Center could not load actions. Check your connection and try again.");
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const filteredActions = useMemo(() => {
        return actions.filter((action) => {
            if (statusFilter !== "all" && action.status !== statusFilter) return false;
            if (priorityFilter !== "all" && action.priority !== priorityFilter) return false;
            if (moduleFilter !== "all" && action.sourceModule !== moduleFilter) return false;
            return true;
        });
    }, [actions, statusFilter, priorityFilter, moduleFilter]);

    const counts = useMemo(() => ({
        suggested: actions.filter((action) => action.status === "suggested").length,
        inProgress: actions.filter((action) => action.status === "accepted" || action.status === "in_progress").length,
        completed: actions.filter((action) => action.status === "completed").length,
        dismissed: actions.filter((action) => action.status === "dismissed").length,
    }), [actions]);

    const visibleSections = useMemo(() => {
        if (statusFilter !== "all") {
            return [{
                key: statusFilter,
                title: getStatusTitle(statusFilter),
                description: getStatusDescription(statusFilter),
                actions: filteredActions,
            }];
        }

        return statusGroups
            .map((group) => ({
                ...group,
                actions: filteredActions.filter((action) => group.statuses.includes(action.status)),
            }))
            .filter((section) => section.actions.length > 0);
    }, [filteredActions, statusFilter]);

    const updateLocal = (next: FoundryAction | null) => {
        if (!next) return;
        setActions((prev) => prev.map((action) => action.id === next.id ? next : action));
    };

    const completeAction = async (action: FoundryAction) => {
        const completed = await completeFoundryAction(userId, action.id);
        updateLocal(completed);
        if (completed) {
            setPendingOutcomeActionId(completed.id);
            setOutcomeNotes("");
        }
    };

    const saveOutcome = async (action: FoundryAction, outcomeType: FoundryActionOutcomeType) => {
        const score = outcomeType === "success" ? 5 : outcomeType === "partial" ? 3 : outcomeType === "failed" ? 1 : null;
        updateLocal(await recordActionOutcome(action.id, outcomeType, outcomeNotes, score));
        setPendingOutcomeActionId(null);
        setOutcomeNotes("");
    };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 130, background: "var(--foundry-bg-app)", color: "var(--foundry-text-primary)", fontFamily: "'Lora', Georgia, serif", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "max(12px, calc(7px + env(safe-area-inset-top))) 16px 12px", borderBottom: "1px solid var(--foundry-border-subtle)", display: "flex", alignItems: "center", gap: 12, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)" }}>
                <button className="foundry-btn foundry-btn--ghost" onClick={onOpenNav ?? onBack} style={{ padding: "8px 11px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3.5" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="11" width="14" height="1.5" rx="0.75" fill="currentColor"/></svg>
                </button>
                <Logo variant="flame" style={{ width: 34, height: 34, objectFit: "contain" }} />
                <div style={{ minWidth: 0 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 28, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 800, lineHeight: 1 }}>Action Center</div>
                        <HelpTooltip content="The bridge from insight to what happens next." side="bottom" />
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "18px 16px 60px" }}>
                <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                        <Metric label="Suggested" value={counts.suggested} />
                        <Metric label="In motion" value={counts.inProgress} />
                        <Metric label="Completed" value={counts.completed} />
                        <Metric label="Dismissed" value={counts.dismissed} />
                    </div>

                    <div className="foundry-module-card" style={{ padding: 12, display: "grid", gap: 10 }}>
                        <FilterRow label="Status" value={statusFilter} options={statusOptions} onChange={(value) => setStatusFilter(value as FoundryActionStatus | "all")} />
                        <FilterRow label="Priority" value={priorityFilter} options={priorityOptions} onChange={(value) => setPriorityFilter(value as FoundryActionPriority | "all")} />
                        <FilterRow label="Source" value={moduleFilter} options={moduleOptions} onChange={(value) => setModuleFilter(value as FoundryActionSourceModule | "all")} />
                    </div>

                    {loading ? (
                        <div style={{ color: "#77716A", fontSize: 13, padding: 24 }}>Loading actions...</div>
                    ) : error ? (
                        <div className="foundry-module-card" style={{ padding: 22 }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#F0EDE8", marginBottom: 8 }}>Actions did not load</div>
                            <div style={{ fontSize: 13, color: "#9D978E", lineHeight: 1.7, marginBottom: 14 }}>{error}</div>
                            <button className="foundry-btn foundry-btn--primary" type="button" onClick={reload} style={{ padding: "8px 12px", fontSize: 12 }}>
                                Retry
                            </button>
                        </div>
                    ) : filteredActions.length === 0 ? (
                        <div className="foundry-module-card" style={{ padding: 22 }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "#F0EDE8", marginBottom: 8 }}>{actions.length === 0 ? "No actions yet" : "No actions match these filters"}</div>
                            <HelpTooltip content={actions.length === 0
                                ? "Actions start inside Market Intelligence, Weekly Intelligence, Forge Academy, and the Business Model Canvas. Look for the next-action card when an insight needs a decision or follow-up."
                                : "Adjust the status, priority, or source filters to find the work you want to review."} />
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: 12 }}>
                            {visibleSections.map((section) => (
                                <div key={section.key} style={{ display: "grid", gap: 10 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "end", padding: "4px 2px 0" }}>
                                        <div>
                                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                                <div style={{ fontSize: 17, color: "#F0EDE8", fontWeight: 900 }}>{section.title}</div>
                                                <HelpTooltip content={section.description} />
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 11, color: "#8FC8F6", fontWeight: 900, fontFamily: "'DM Sans', system-ui, sans-serif" }}>{section.actions.length}</div>
                                    </div>
                                    {section.actions.map((action) => {
                                        const nextStatus = getNextActionStatus(action.status);
                                        const showOutcomePrompt = pendingOutcomeActionId === action.id && action.status === "completed" && !action.outcomeType;
                                        return (
                                            <div key={action.id} style={{ display: "grid", gap: 8 }}>
                                                <ActionSuggestionCard
                                                    action={action}
                                                    status={action.status}
                                                    acceptLabel={getPrimaryActionLabel(action.status)}
                                                    dismissLabel="Dismiss"
                                                    onAccept={nextStatus ? async () => {
                                                        if (nextStatus === "completed") {
                                                            await completeAction(action);
                                                        } else {
                                                            updateLocal(await updateFoundryActionStatus(userId, action.id, nextStatus));
                                                        }
                                                    } : undefined}
                                                    onDismiss={action.status === "dismissed" || action.status === "completed" ? undefined : async () => updateLocal(await dismissFoundryAction(userId, action.id))}
                                                    onAskForge={() => onAskForge(buildForgePromptForAction(action))}
                                                />
                                                {showOutcomePrompt && (
                                                    <div style={{ marginLeft: 10, borderLeft: "2px solid rgba(255,255,255,0.08)", padding: "10px 0 10px 12px", display: "grid", gap: 9 }}>
                                                        <div>
                                                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                                                <div style={{ fontSize: 14, fontWeight: 900, color: "#F0EDE8" }}>Did this work?</div>
                                                                <HelpTooltip content="Optional. Capture the result while it is still fresh." />
                                                            </div>
                                                        </div>
                                                        <textarea
                                                            value={outcomeNotes}
                                                            onChange={(event) => setOutcomeNotes(event.target.value)}
                                                            placeholder="Short note, optional"
                                                            rows={2}
                                                            style={{ width: "100%", boxSizing: "border-box", resize: "vertical", borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.035)", color: "#F0EDE8", padding: 10, fontSize: 12, fontFamily: "'DM Sans', system-ui, sans-serif", outline: "none" }}
                                                        />
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                            <OutcomeButton label="Yes" tone="success" onClick={() => saveOutcome(action, "success")} />
                                                            <OutcomeButton label="Partially" tone="partial" onClick={() => saveOutcome(action, "partial")} />
                                                            <OutcomeButton label="No" tone="failed" onClick={() => saveOutcome(action, "failed")} />
                                                            <button className="foundry-btn foundry-btn--ghost" type="button" onClick={() => { setPendingOutcomeActionId(null); setOutcomeNotes(""); }} style={{ padding: "7px 10px", fontSize: 12 }}>
                                                                Skip
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function OutcomeButton({ label, tone, onClick }: { label: string; tone: "success" | "partial" | "failed"; onClick: () => void }) {
    const styles = {
        success: { border: "1px solid rgba(76,175,138,0.32)", background: "rgba(76,175,138,0.12)", color: "#4CAF8A" },
        partial: { border: "1px solid rgba(200,169,110,0.32)", background: "rgba(200,169,110,0.12)", color: "#C8A96E" },
        failed: { border: "1px solid rgba(240,93,94,0.32)", background: "rgba(240,93,94,0.12)", color: "#F05D5E" },
    };
    return (
        <button className="foundry-interactive" type="button" onClick={onClick} style={{ ...styles[tone], borderRadius: 999, padding: "7px 10px", fontSize: 12, cursor: "pointer", fontWeight: 800 }}>
            {label}
        </button>
    );
}

function getStatusTitle(status: FoundryActionStatus) {
    if (status === "suggested") return "Suggested next moves";
    if (status === "accepted" || status === "in_progress") return status === "accepted" ? "Accepted" : "In progress";
    if (status === "completed") return "Completed";
    return "Dismissed";
}

function getStatusDescription(status: FoundryActionStatus) {
    if (status === "suggested") return "Review these before committing.";
    if (status === "accepted") return "Accepted actions waiting to start.";
    if (status === "in_progress") return "Actions currently being executed.";
    if (status === "completed") return "Actions already closed out.";
    return "Suggestions intentionally skipped.";
}

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="foundry-module-card foundry-panel-in" style={{ padding: "13px 14px" }}>
            <div style={{ fontSize: 11, color: "#8D857C", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5, fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 24, color: "#F0EDE8", fontWeight: 900 }}>{value}</div>
        </div>
    );
}

function FilterRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
    return (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ width: 58, color: "#77716A", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 800 }}>{label}</div>
            {options.map((option) => (
                <button
                    key={option}
                    type="button"
                    onClick={() => onChange(option)}
                    className="foundry-interactive"
                    style={{
                        borderRadius: 999,
                        border: value === option ? "1px solid rgba(99,179,237,0.24)" : "1px solid rgba(255,255,255,0.08)",
                        background: value === option ? "rgba(99,179,237,0.1)" : "rgba(255,255,255,0.03)",
                        color: value === option ? "#8FC8F6" : "#9D978E",
                        padding: "6px 9px",
                        fontSize: 11,
                        cursor: "pointer",
                        textTransform: "capitalize",
                    }}
                >
                    {option.replace(/_/g, " ")}
                </button>
            ))}
        </div>
    );
}

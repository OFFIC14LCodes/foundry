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
    type FoundryActionSuggestion,
    type FoundryActionType,
} from "../lib/foundryActions";

type Props = {
    userId: string;
    onBack: () => void;
    onOpenNav?: () => void;
    onAskForge: (prompt: string) => void;
    onCreateAction: (suggestion: FoundryActionSuggestion) => Promise<FoundryAction | null | unknown> | FoundryAction | null | unknown;
};

const statusOptions: Array<FoundryActionStatus | "all"> = ["all", "suggested", "accepted", "in_progress", "completed", "dismissed"];
const priorityOptions: Array<FoundryActionPriority | "all"> = ["all", "critical", "high", "medium", "low"];
const manualPriorityOptions: FoundryActionPriority[] = ["medium", "high", "critical", "low"];
const manualActionTypeOptions: Array<{ value: FoundryActionType; label: string }> = [
    { value: "task", label: "Task" },
    { value: "forge_followup", label: "Navi follow-up" },
    { value: "market_followup", label: "Market follow-up" },
    { value: "canvas_update", label: "Canvas update" },
    { value: "document_create", label: "Create document" },
    { value: "document_review", label: "Review document" },
    { value: "finance_review", label: "Finance review" },
    { value: "journal_reflection", label: "Journal reflection" },
    { value: "academy_apply", label: "Apply lesson" },
    { value: "stage_gate", label: "Stage gate" },
];
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

export default function ActionCenterScreen({ userId, onBack, onOpenNav, onAskForge, onCreateAction }: Props) {
    const [actions, setActions] = useState<FoundryAction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [manualTitle, setManualTitle] = useState("");
    const [manualDescription, setManualDescription] = useState("");
    const [manualPriority, setManualPriority] = useState<FoundryActionPriority>("medium");
    const [manualActionType, setManualActionType] = useState<FoundryActionType>("task");
    const [manualDueDate, setManualDueDate] = useState("");
    const [manualSaving, setManualSaving] = useState(false);
    const [manualNotice, setManualNotice] = useState<string | null>(null);
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

    const addLocal = (next: FoundryAction | null) => {
        if (!next) return;
        setActions((prev) => [next, ...prev.filter((action) => action.id !== next.id)]);
    };

    const saveManualAction = async () => {
        const title = manualTitle.trim();
        const description = manualDescription.trim();
        if (!title) {
            setManualNotice("Add a title before saving the action.");
            return;
        }
        setManualSaving(true);
        setManualNotice(null);
        try {
            const saved = await Promise.resolve(onCreateAction({
                title,
                description,
                sourceModule: "forge",
                sourceType: "manual",
                sourceId: null,
                actionType: manualActionType,
                priority: manualPriority,
                dueDate: manualDueDate || null,
                metadata: {
                    manuallyCreated: true,
                    createdFrom: "action_center",
                },
            }));
            if (saved && typeof saved === "object" && "id" in saved) {
                addLocal(saved as FoundryAction);
                setManualTitle("");
                setManualDescription("");
                setManualPriority("medium");
                setManualActionType("task");
                setManualDueDate("");
                setStatusFilter("all");
                setManualNotice("Action added.");
            } else {
                setManualNotice("Action could not be added. Try again.");
            }
        } catch {
            setManualNotice("Action could not be added. Try again.");
        } finally {
            setManualSaving(false);
        }
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
        <div style={{ position: "fixed", inset: 0, zIndex: 130, background: "var(--foundry-bg-app)", color: "var(--foundry-text-primary)", fontFamily: "var(--tekori-font-ui)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "max(12px, calc(7px + env(safe-area-inset-top))) 16px 12px", borderBottom: "1px solid var(--foundry-border-subtle)", display: "flex", alignItems: "center", gap: 12, background: "rgba(255,252,246,0.94)", backdropFilter: "blur(12px)" }}>
                <button className="foundry-btn foundry-btn--ghost" onClick={onOpenNav ?? onBack} style={{ padding: "8px 11px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3.5" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="11" width="14" height="1.5" rx="0.75" fill="currentColor"/></svg>
                </button>
                <Logo variant="flame" style={{ width: 34, height: 34, objectFit: "contain" }} />
                <div style={{ minWidth: 0 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 28, fontFamily: "var(--tekori-font-brand)", fontWeight: 800, lineHeight: 1 }}>Action Center</div>
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

                    <div className="foundry-module-card" style={{ padding: 16, display: "grid", gap: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                            <div>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ fontSize: 17, color: "var(--color-text)", fontWeight: 900 }}>Add action manually</div>
                                    <HelpTooltip content="Create an action directly when you already know what needs to happen." />
                                </div>
                            </div>
                            {manualNotice && <div style={{ color: manualNotice.includes("added") ? "var(--color-success)" : "var(--tekori-gold)", fontSize: 12, fontWeight: 800 }}>{manualNotice}</div>}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                            <TextField label="Action title" value={manualTitle} onChange={setManualTitle} placeholder="Follow up with three discovery leads" />
                            <SelectField label="Priority" value={manualPriority} options={manualPriorityOptions.map((value) => ({ value, label: value }))} onChange={(value) => setManualPriority(value as FoundryActionPriority)} />
                        </div>
                        <TextAreaField label="Description" value={manualDescription} onChange={setManualDescription} placeholder="What needs to happen, why it matters, and what done looks like." />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, alignItems: "end" }}>
                            <SelectField label="Type" value={manualActionType} options={manualActionTypeOptions} onChange={(value) => setManualActionType(value as FoundryActionType)} />
                            <TextField label="Due date" value={manualDueDate} onChange={setManualDueDate} type="date" />
                            <button className="foundry-btn foundry-btn--primary" type="button" onClick={saveManualAction} disabled={manualSaving} style={{ padding: "10px 14px", fontSize: 12, height: 40, opacity: manualSaving ? 0.7 : 1 }}>
                                {manualSaving ? "Adding..." : "Add action"}
                            </button>
                        </div>
                    </div>

                    <div className="foundry-module-card" style={{ padding: 12, display: "grid", gap: 10 }}>
                        <FilterRow label="Status" value={statusFilter} options={statusOptions} onChange={(value) => setStatusFilter(value as FoundryActionStatus | "all")} />
                        <FilterRow label="Priority" value={priorityFilter} options={priorityOptions} onChange={(value) => setPriorityFilter(value as FoundryActionPriority | "all")} />
                        <FilterRow label="Source" value={moduleFilter} options={moduleOptions} onChange={(value) => setModuleFilter(value as FoundryActionSourceModule | "all")} />
                    </div>

                    {loading ? (
                        <div style={{ color: "var(--color-text-muted)", fontSize: 13, padding: 24 }}>Loading actions...</div>
                    ) : error ? (
                        <div className="foundry-module-card" style={{ padding: 22 }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", marginBottom: 8 }}>Actions did not load</div>
                            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.7, marginBottom: 14 }}>{error}</div>
                            <button className="foundry-btn foundry-btn--primary" type="button" onClick={reload} style={{ padding: "8px 12px", fontSize: 12 }}>
                                Retry
                            </button>
                        </div>
                    ) : filteredActions.length === 0 ? (
                        <div className="foundry-module-card" style={{ padding: 22 }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text)", marginBottom: 8 }}>{actions.length === 0 ? "No actions yet" : "No actions match these filters"}</div>
                            <HelpTooltip content={actions.length === 0
                                ? "Actions start inside Market Intelligence, Weekly Intelligence, Navi Academy, and the Business Model Canvas. Look for the next-action card when an insight needs a decision or follow-up."
                                : "Adjust the status, priority, or source filters to find the work you want to review."} />
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: 12 }}>
                            {visibleSections.map((section) => (
                                <div key={section.key} style={{ display: "grid", gap: 10 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "end", padding: "4px 2px 0" }}>
                                        <div>
                                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                                <div style={{ fontSize: 17, color: "var(--color-text)", fontWeight: 900 }}>{section.title}</div>
                                                <HelpTooltip content={section.description} />
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--tekori-slate-navy)", fontWeight: 900, fontFamily: "var(--tekori-font-ui)" }}>{section.actions.length}</div>
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
                                                    <div style={{ marginLeft: 10, borderLeft: "2px solid rgba(7,26,47,0.08)", padding: "10px 0 10px 12px", display: "grid", gap: 9 }}>
                                                        <div>
                                                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                                                <div style={{ fontSize: 14, fontWeight: 900, color: "var(--color-text)" }}>Did this work?</div>
                                                                <HelpTooltip content="Optional. Capture the result while it is still fresh." />
                                                            </div>
                                                        </div>
                                                        <textarea
                                                            value={outcomeNotes}
                                                            onChange={(event) => setOutcomeNotes(event.target.value)}
                                                            placeholder="Short note, optional"
                                                            rows={2}
                                                            style={{ width: "100%", boxSizing: "border-box", resize: "vertical", borderRadius: 12, border: "1px solid rgba(7,26,47,0.08)", background: "rgba(7,26,47,0.035)", color: "var(--color-text)", padding: 10, fontSize: 12, fontFamily: "var(--tekori-font-ui)", outline: "none" }}
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
        success: { border: "1px solid rgba(115,135,123,0.32)", background: "rgba(115,135,123,0.14)", color: "var(--color-success)" },
        partial: { border: "1px solid rgba(200,169,110,0.32)", background: "rgba(200,169,110,0.12)", color: "var(--tekori-gold)" },
        failed: { border: "1px solid rgba(184,92,75,0.30)", background: "rgba(184,92,75,0.10)", color: "var(--color-danger)" },
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
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5, fontFamily: "var(--tekori-font-ui)", fontWeight: 800 }}>{label}</div>
            <div style={{ fontSize: 24, color: "var(--color-text)", fontWeight: 900 }}>{value}</div>
        </div>
    );
}

function TextField({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
            <span style={fieldLabelStyle}>{label}</span>
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                style={fieldInputStyle}
            />
        </label>
    );
}

function TextAreaField({
    label,
    value,
    onChange,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}) {
    return (
        <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
            <span style={fieldLabelStyle}>{label}</span>
            <textarea
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                rows={3}
                style={{ ...fieldInputStyle, minHeight: 78, resize: "vertical", lineHeight: 1.55 }}
            />
        </label>
    );
}

function SelectField({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
}) {
    return (
        <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
            <span style={fieldLabelStyle}>{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                style={fieldInputStyle}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

const fieldLabelStyle = {
    color: "var(--color-text-muted)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    fontFamily: "var(--tekori-font-ui)",
    fontWeight: 800,
} as const;

const fieldInputStyle = {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 10,
    border: "1px solid rgba(7,26,47,0.08)",
    background: "rgba(7,26,47,0.035)",
    color: "var(--color-text)",
    padding: "10px 11px",
    fontSize: 13,
    fontFamily: "var(--tekori-font-ui)",
    outline: "none",
} as const;

function FilterRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
    return (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ width: 58, color: "var(--color-text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "var(--tekori-font-ui)", fontWeight: 800 }}>{label}</div>
            {options.map((option) => (
                <button
                    key={option}
                    type="button"
                    onClick={() => onChange(option)}
                    className="foundry-interactive"
                    style={{
                        borderRadius: 999,
                        border: value === option ? "1px solid rgba(48,70,95,0.24)" : "1px solid rgba(7,26,47,0.08)",
                        background: value === option ? "rgba(48,70,95,0.10)" : "rgba(7,26,47,0.03)",
                        color: value === option ? "var(--tekori-slate-navy)" : "var(--color-text-muted)",
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

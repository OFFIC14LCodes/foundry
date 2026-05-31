import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icons } from "../icons";
import {
    createFounderAdminNote,
    createFounderNotification,
    createFounderChurnNote,
    fetchAdminAuditLog,
    fetchAdminFeedback,
    updateAdminFeedback,
    grantFounderCompAccess,
    loadAdminOperationFounderAcademyProgress,
    loadAdminOperationFounderDetail,
    loadAdminOperationFounders,
    reactivateFounderAccess,
    removeFounderCompAccess,
    repairFounderAcademyProgress,
    revokeFounderAccess,
    resetFounderAssessment,
    suspendFounderAccess,
    type AdminCompAccessType,
    type AdminAcademyRepairStatus,
    type AdminAcademyProgressLesson,
    type AdminAcademyProgressStage,
    type AdminAuditLogEntry,
    type AdminFounderAcademyProgressResponse,
    type AdminActionPreview,
    type AdminArchivePreview,
    type AdminAuditEntry,
    type AdminDocumentPreview,
    type AdminFounderDetailResponse,
    type AdminFounderListItem,
    type AdminFeedbackItem,
    type AdminFeedbackStatus,
    type AdminNotificationType,
    type AdminRetentionStatus,
    type AdminSupportNote,
    type AdminSupportNoteType,
    type AdminWinbackStatus,
    type UpdateAdminFeedbackPayload,
} from "../lib/adminOperationsApi";

interface Props {
    onBack: () => void;
}

const LIMIT_OPTIONS = [25, 50, 100];
const ACCESS_FILTERS = [
    { value: "", label: "All access" },
    { value: "active", label: "Active" },
    { value: "suspended", label: "Suspended" },
    { value: "revoked", label: "Revoked" },
];
const STAGE_FILTERS = [
    { value: "", label: "All stages" },
    { value: "1", label: "Stage 1" },
    { value: "2", label: "Stage 2" },
    { value: "3", label: "Stage 3" },
    { value: "4", label: "Stage 4" },
    { value: "5", label: "Stage 5" },
    { value: "6", label: "Stage 6" },
];
const SUPPORT_NOTE_TYPES: Array<{ value: AdminSupportNoteType; label: string }> = [
    { value: "general", label: "General" },
    { value: "support", label: "Support" },
    { value: "retention", label: "Retention" },
    { value: "billing", label: "Billing" },
    { value: "academy", label: "Academy" },
    { value: "technical", label: "Technical" },
];

const NOTIFICATION_TYPES: Array<{ value: AdminNotificationType; label: string; description: string }> = [
    { value: "admin_support", label: "Admin Support", description: "Support message from the Tekori team" },
    { value: "system", label: "System", description: "System or platform announcement" },
    { value: "milestone", label: "Milestone", description: "Achievement or milestone recognition" },
];

const FEEDBACK_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "", label: "All statuses" },
    { value: "new", label: "New" },
    { value: "reviewed", label: "Reviewed" },
    { value: "fixed", label: "Fixed" },
    { value: "ignored", label: "Ignored" },
];

const FEEDBACK_REACTION_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "", label: "All reactions" },
    { value: "down", label: "Thumbs down" },
    { value: "up", label: "Thumbs up" },
];

const AUDIT_ACTION_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "", label: "All actions" },
    { value: "academy.progress.repair", label: "Academy progress repair" },
    { value: "academy.assessment.reset", label: "Assessment reset" },
    { value: "admin.feedback.update", label: "Feedback update" },
    { value: "admin.access.grant_comp", label: "Grant comp access" },
    { value: "admin.access.remove_comp", label: "Remove comp access" },
    { value: "admin.access.suspend", label: "Suspend access" },
    { value: "admin.access.reactivate", label: "Reactivate access" },
    { value: "admin.access.revoke", label: "Revoke access" },
    { value: "admin.notification.create", label: "Notification create" },
    { value: "admin.note.create", label: "Support note create" },
    { value: "admin.access.churn_note", label: "Churn note" },
];

const AUDIT_ENTITY_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "", label: "All entities" },
    { value: "academy_content", label: "Academy content" },
    { value: "message_feedback", label: "Message feedback" },
    { value: "account_access", label: "Account access" },
    { value: "notifications", label: "Notifications" },
    { value: "admin_support_notes", label: "Support notes" },
];

type AccessAdminAction =
    | { kind: "grant_comp"; label: string; compType: AdminCompAccessType }
    | { kind: "remove_comp"; label: string }
    | { kind: "suspend"; label: string }
    | { kind: "reactivate"; label: string }
    | { kind: "revoke"; label: string }
    | { kind: "churn_note"; label: string };

type AcademyRepairAction =
    | { kind: "progress"; status: AdminAcademyRepairStatus; label: string }
    | { kind: "reset_assessment"; label: string };

type PendingAcademyRepair = {
    lesson: AdminAcademyProgressLesson;
    action: AcademyRepairAction;
};

export default function AdminOperationsScreen({ onBack }: Props) {
    const [founders, setFounders] = useState<AdminFounderListItem[]>([]);
    const [search, setSearch] = useState("");
    const [submittedSearch, setSubmittedSearch] = useState("");
    const [limit, setLimit] = useState(50);
    const [offset, setOffset] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [accessStatus, setAccessStatus] = useState("");
    const [stage, setStage] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedFounder, setSelectedFounder] = useState<AdminFounderListItem | null>(null);
    const [activeTab, setActiveTab] = useState<"founders" | "feedback" | "audit">("founders");

    const loadFounders = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await loadAdminOperationFounders({
                search: submittedSearch,
                limit,
                offset,
                accessStatus: accessStatus || undefined,
                stage: stage ? Number(stage) : null,
            });
            setFounders(response.founders);
            setTotalCount(response.pagination.count);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Unable to load founders.");
        } finally {
            setLoading(false);
        }
    }, [accessStatus, limit, offset, stage, submittedSearch]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setOffset(0);
            setSubmittedSearch(search.trim());
        }, 280);
        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        void loadFounders();
    }, [loadFounders]);

    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const hasPrevious = offset > 0;
    const hasNext = offset + limit < totalCount;

    const totals = useMemo(() => {
        return founders.reduce(
            (acc, founder) => {
                acc.actions += founder.action_count || 0;
                acc.documents += founder.document_count || 0;
                acc.archives += founder.archive_count || 0;
                acc.academy += founder.academy_progress_count || 0;
                return acc;
            },
            { actions: 0, documents: 0, archives: 0, academy: 0 }
        );
    }, [founders]);

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 180,
                background: "var(--foundry-bg-app)",
                color: "var(--foundry-text-primary)",
                display: "flex",
                flexDirection: "column",
                fontFamily: "var(--tekori-font-ui)",
            }}
        >
            <div
                style={{
                    padding: "max(14px, calc(10px + env(safe-area-inset-top))) 16px 12px",
                    borderBottom: "var(--foundry-border-subtle)",
                    background: "rgba(255,252,246,0.97)",
                    backdropFilter: "blur(12px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexShrink: 0,
                }}
            >
                <button className="foundry-btn foundry-btn--ghost" onClick={onBack} style={{ padding: "var(--foundry-app-header-button-padding)", fontSize: "var(--foundry-app-header-button-font)" }}>
                    Back
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Icons.sidebar.admin size={"var(--foundry-app-header-icon-size)"} />
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "var(--foundry-app-header-title-font)", fontWeight: 700 }}>Admin Operations</div>
                        <div style={{ fontSize: "var(--foundry-app-header-meta-font)", color: "var(--foundry-text-muted)" }}>Read-only founder console</div>
                    </div>
                </div>
            </div>

            <div style={{ display: "flex", gap: 2, padding: "0 16px", borderBottom: "1px solid rgba(7,26,47,0.06)", background: "rgba(255,252,246,0.97)", backdropFilter: "blur(12px)", flexShrink: 0 }}>
                <TabButton label="Founders" active={activeTab === "founders"} onClick={() => { setActiveTab("founders"); setSelectedFounder(null); }} />
                <TabButton label="Feedback Inbox" active={activeTab === "feedback"} onClick={() => { setActiveTab("feedback"); setSelectedFounder(null); }} />
                <TabButton label="Audit Log" active={activeTab === "audit"} onClick={() => { setActiveTab("audit"); setSelectedFounder(null); }} />
            </div>

            {activeTab === "founders" ? (
            <div className="foundry-app-page__content" style={{ flex: 1, overflowY: "auto", padding: "20px 16px 32px" }}>
                <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
                    <div className="foundry-command-panel foundry-panel-in" style={{ padding: 20 }}>
                        <div className="foundry-label" style={{ color: "var(--tekori-gold)", marginBottom: 9 }}>Observe</div>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
                            <div style={{ minWidth: 260, maxWidth: 700 }}>
                                <div style={{ fontSize: 30, lineHeight: 1.05, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, marginBottom: 10 }}>
                                    Founder Operations Console
                                </div>
                                <div style={{ fontSize: 13, color: "var(--foundry-text-muted)", lineHeight: 1.7 }}>
                                    Search founders, open a read-only account snapshot, and review operational metadata without exposing transcripts, document bodies, financial transactions, or bank data.
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(96px, 1fr))", gap: 8, minWidth: 360 }}>
                                <MetricCard label="Actions" value={formatNumber(totals.actions)} accent="var(--foundry-green)" />
                                <MetricCard label="Documents" value={formatNumber(totals.documents)} accent="var(--foundry-blue)" />
                                <MetricCard label="Archives" value={formatNumber(totals.archives)} accent="var(--tekori-amber-light)" />
                                <MetricCard label="Academy" value={formatNumber(totals.academy)} accent="var(--tekori-gold)" />
                            </div>
                        </div>
                    </div>

                    <div className="foundry-toolbar" style={{ padding: 12, display: "grid", gridTemplateColumns: "minmax(220px, 1fr) repeat(3, max-content)", gap: 10, alignItems: "center", overflowX: "auto" }}>
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search name, email, business, or idea"
                            style={inputStyle}
                        />
                        <select value={stage} onChange={(event) => { setStage(event.target.value); setOffset(0); }} style={selectStyle}>
                            {STAGE_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                        </select>
                        <select value={accessStatus} onChange={(event) => { setAccessStatus(event.target.value); setOffset(0); }} style={selectStyle}>
                            {ACCESS_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
                        </select>
                        <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setOffset(0); }} style={selectStyle}>
                            {LIMIT_OPTIONS.map((option) => <option key={option} value={option}>{option} rows</option>)}
                        </select>
                    </div>

                    <div className="foundry-module-card" style={{ padding: 0, overflow: "hidden" }}>
                        <FounderListState
                            loading={loading}
                            error={error}
                            hasSearch={Boolean(submittedSearch || stage || accessStatus)}
                            resultCount={founders.length}
                            onRetry={() => void loadFounders()}
                        >
                            <FounderTable founders={founders} onSelect={setSelectedFounder} />
                        </FounderListState>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 12, color: "var(--foundry-text-muted)" }}>
                            Page {currentPage} of {totalPages} - {formatNumber(totalCount)} founder{totalCount === 1 ? "" : "s"}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button className="foundry-btn foundry-btn--secondary" type="button" disabled={!hasPrevious || loading} onClick={() => setOffset(Math.max(0, offset - limit))} style={{ padding: "8px 12px", fontSize: 12 }}>
                                Previous
                            </button>
                            <button className="foundry-btn foundry-btn--secondary" type="button" disabled={!hasNext || loading} onClick={() => setOffset(offset + limit)} style={{ padding: "8px 12px", fontSize: 12 }}>
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            ) : activeTab === "feedback" ? (
                <FeedbackInboxPanel />
            ) : (
                <AuditLogPanel />
            )}

            {activeTab === "founders" && selectedFounder && (
                <FounderDetailDrawer
                    founder={selectedFounder}
                    onClose={() => setSelectedFounder(null)}
                />
            )}
        </div>
    );
}

function FounderListState({
    loading,
    error,
    hasSearch,
    resultCount,
    onRetry,
    children,
}: {
    loading: boolean;
    error: string | null;
    hasSearch: boolean;
    resultCount: number;
    onRetry: () => void;
    children: ReactNode;
}) {
    if (loading) {
        return <PanelState title="Loading founder list" body="Pulling safe account summaries from the Admin Operations API." />;
    }
    if (error) {
        const isAuthError = /401|403|admin access|required|authorization/i.test(error);
        return (
            <PanelState
                title={isAuthError ? "Admin access required" : "Founder list unavailable"}
                body={error}
                action={<button className="foundry-btn foundry-btn--secondary" onClick={onRetry} style={{ padding: "8px 12px", fontSize: 12 }}>Retry</button>}
            />
        );
    }
    if (resultCount === 0) {
        return <PanelState title={hasSearch ? "No matching founders" : "No founders yet"} body={hasSearch ? "Adjust search or filters to widen the result set." : "Founder accounts will appear here after profiles exist."} />;
    }
    return children;
}

function FounderTable({ founders, onSelect }: { founders: AdminFounderListItem[]; onSelect: (founder: AdminFounderListItem) => void }) {
    return (
        <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 980 }}>
                <div
                    className="foundry-font-ui"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(220px,1.15fr) minmax(220px,1.05fr) 82px 130px 130px 220px",
                        gap: 12,
                        padding: "12px 14px",
                        borderBottom: "var(--foundry-border-subtle)",
                        fontSize: 10,
                        color: "var(--foundry-text-muted)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontWeight: 800,
                    }}
                >
                    <div>Founder</div>
                    <div>Business</div>
                    <div>Stage</div>
                    <div>Access</div>
                    <div>Subscription</div>
                    <div>Activity</div>
                </div>
                {founders.map((founder) => (
                    <button
                        key={founder.user_id}
                        type="button"
                        className="foundry-interactive"
                        onClick={() => onSelect(founder)}
                        style={{
                            width: "100%",
                            display: "grid",
                            gridTemplateColumns: "minmax(220px,1.15fr) minmax(220px,1.05fr) 82px 130px 130px 220px",
                            gap: 12,
                            alignItems: "center",
                            padding: "13px 14px",
                            border: "none",
                            borderBottom: "1px solid rgba(7,26,47,0.045)",
                            background: "transparent",
                            color: "inherit",
                            textAlign: "left",
                            cursor: "pointer",
                        }}
                    >
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--foundry-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {founder.display_name || founder.name || "Unnamed founder"}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 3 }}>
                                {founder.email || "No email on profile"}
                            </div>
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {founder.business_name || founder.side_hustle_name || founder.idea || "Not set"}
                            </div>
                            <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", marginTop: 3 }}>
                                {formatVentureMode(founder.venture_mode)}
                            </div>
                        </div>
                        <StatusPill label={founder.current_stage ? `S${founder.current_stage}` : "None"} accent="var(--foundry-blue)" />
                        <StatusPill label={founder.account_access?.access_status || "unknown"} accent={accessAccent(founder.account_access?.access_status)} />
                        <StatusPill label={founder.account_access?.subscription_status || founder.billing_subscription?.stripe_status || "none"} accent={subscriptionAccent(founder.account_access?.subscription_status || founder.billing_subscription?.stripe_status)} />
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                            <TinyCount label="A" value={founder.action_count} />
                            <TinyCount label="D" value={founder.document_count} />
                            <TinyCount label="R" value={founder.archive_count} />
                            <TinyCount label="L" value={founder.academy_progress_count} />
                        </div>
                        <div style={{ gridColumn: "1 / -1", fontSize: 10, color: "var(--foundry-text-muted)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <span>Last active: {formatRelative(founder.last_active_at)}</span>
                            <span>Updated: {formatDateTime(founder.updated_at)}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

function FounderDetailDrawer({ founder, onClose }: { founder: AdminFounderListItem; onClose: () => void }) {
    const [detail, setDetail] = useState<AdminFounderDetailResponse | null>(null);
    const [academyProgress, setAcademyProgress] = useState<AdminFounderAcademyProgressResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [academyLoading, setAcademyLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [academyError, setAcademyError] = useState<string | null>(null);
    const [pendingRepair, setPendingRepair] = useState<PendingAcademyRepair | null>(null);
    const [repairReason, setRepairReason] = useState("");
    const [repairConfirmation, setRepairConfirmation] = useState("");
    const [repairLoading, setRepairLoading] = useState(false);
    const [repairError, setRepairError] = useState<string | null>(null);
    const [repairSuccess, setRepairSuccess] = useState<string | null>(null);
    const [noteText, setNoteText] = useState("");
    const [noteType, setNoteType] = useState<AdminSupportNoteType>("general");
    const [noteLoading, setNoteLoading] = useState(false);
    const [noteError, setNoteError] = useState<string | null>(null);
    const [noteSuccess, setNoteSuccess] = useState<string | null>(null);
    const [notifTitle, setNotifTitle] = useState("");
    const [notifMessage, setNotifMessage] = useState("");
    const [notifType, setNotifType] = useState<AdminNotificationType>("admin_support");
    const [notifConfirmed, setNotifConfirmed] = useState(false);
    const [notifLoading, setNotifLoading] = useState(false);
    const [notifError, setNotifError] = useState<string | null>(null);
    const [notifSuccess, setNotifSuccess] = useState<string | null>(null);
    const [pendingAccessAction, setPendingAccessAction] = useState<AccessAdminAction | null>(null);
    const [accessReason, setAccessReason] = useState("");
    const [accessConfirmation, setAccessConfirmation] = useState("");
    const [accessExpiresAt, setAccessExpiresAt] = useState("");
    const [churnNoteText, setChurnNoteText] = useState("");
    const [retentionStatus, setRetentionStatus] = useState<AdminRetentionStatus>("none");
    const [winbackStatus, setWinbackStatus] = useState<AdminWinbackStatus>("none");
    const [accessLoading, setAccessLoading] = useState(false);
    const [accessError, setAccessError] = useState<string | null>(null);
    const [accessSuccess, setAccessSuccess] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const loadDetail = useCallback(async (options: { showLoading?: boolean } = {}) => {
        const showLoading = options.showLoading !== false;
        if (showLoading) setLoading(true);
        setError(null);
        try {
            const response = await loadAdminOperationFounderDetail(founder.user_id);
            if (!mountedRef.current) return;
            setDetail(response);
        } catch (loadError) {
            if (!mountedRef.current) return;
            setError(loadError instanceof Error ? loadError.message : "Unable to load founder detail.");
        } finally {
            if (mountedRef.current && showLoading) setLoading(false);
        }
    }, [founder.user_id]);

    useEffect(() => {
        void loadDetail();
    }, [loadDetail]);

    const loadAcademyProgress = useCallback(async () => {
        setAcademyLoading(true);
        setAcademyError(null);
        try {
            const response = await loadAdminOperationFounderAcademyProgress(founder.user_id);
            if (!mountedRef.current) return;
            setAcademyProgress(response);
        } catch (loadError) {
            if (!mountedRef.current) return;
            setAcademyError(loadError instanceof Error ? loadError.message : "Unable to load Academy progress.");
        } finally {
            if (mountedRef.current) setAcademyLoading(false);
        }
    }, [founder.user_id]);

    useEffect(() => {
        void loadAcademyProgress();
    }, [loadAcademyProgress]);

    const beginRepair = useCallback((lesson: AdminAcademyProgressLesson, action: AcademyRepairAction) => {
        setPendingRepair({ lesson, action });
        setRepairReason("");
        setRepairConfirmation("");
        setRepairError(null);
        setRepairSuccess(null);
    }, []);

    const closeRepairModal = () => {
        if (repairLoading) return;
        setPendingRepair(null);
        setRepairReason("");
        setRepairConfirmation("");
        setRepairError(null);
    };

    const submitRepair = async () => {
        if (!pendingRepair) return;
        const reason = repairReason.trim();
        const action = pendingRepair.action;
        setRepairLoading(true);
        setRepairError(null);
        try {
            const metadata = {
                source: "admin_operations_academy_progress",
                lesson_title: pendingRepair.lesson.lesson_title,
                topic_title: pendingRepair.lesson.topic_title,
                stage_id: pendingRepair.lesson.stage_id,
                previous_normalized_status: pendingRepair.lesson.normalized_status,
                previous_current_progress_status: pendingRepair.lesson.current_progress_status,
                previous_legacy_progress_status: pendingRepair.lesson.legacy_progress_status,
            };

            if (action.kind === "reset_assessment") {
                await resetFounderAssessment(founder.user_id, pendingRepair.lesson.content_id, reason, repairConfirmation, metadata);
            } else {
                await repairFounderAcademyProgress(founder.user_id, pendingRepair.lesson.content_id, action.status, reason, metadata);
            }

            if (!mountedRef.current) return;
            setRepairSuccess(`${action.label} completed for ${pendingRepair.lesson.lesson_title}.`);
            setPendingRepair(null);
            setRepairReason("");
            setRepairConfirmation("");
            await Promise.all([loadAcademyProgress(), loadDetail({ showLoading: false })]);
        } catch (submitError) {
            if (!mountedRef.current) return;
            setRepairError(submitError instanceof Error ? submitError.message : "Unable to complete repair.");
        } finally {
            if (mountedRef.current) setRepairLoading(false);
        }
    };

    const submitSupportNote = async () => {
        const note = noteText.trim();
        if (note.length < 3 || noteLoading) return;

        setNoteLoading(true);
        setNoteError(null);
        setNoteSuccess(null);
        try {
            const response = await createFounderAdminNote(founder.user_id, note, noteType, {
                source: "admin_operations_founder_detail",
            });
            if (!mountedRef.current) return;
            setDetail((current) => current
                ? {
                    ...current,
                    recent_admin_support_notes: [response.note, ...current.recent_admin_support_notes.filter((item) => item.id !== response.note.id)].slice(0, 20),
                }
                : current);
            setNoteText("");
            setNoteType("general");
            setNoteSuccess("Internal note saved.");
            await loadDetail({ showLoading: false });
        } catch (submitError) {
            if (!mountedRef.current) return;
            setNoteError(submitError instanceof Error ? submitError.message : "Unable to save internal note.");
        } finally {
            if (mountedRef.current) setNoteLoading(false);
        }
    };

    const submitFounderNotification = async () => {
        const title = notifTitle.trim();
        const message = notifMessage.trim();
        if (title.length < 3 || message.length < 3 || !notifConfirmed || notifLoading) return;

        setNotifLoading(true);
        setNotifError(null);
        setNotifSuccess(null);
        try {
            const response = await createFounderNotification(founder.user_id, {
                title,
                message,
                type: notifType,
                metadata: { source: "admin_operations_founder_detail" },
            });
            if (!mountedRef.current) return;
            setNotifSuccess(`Notification "${response.notification.title}" delivered to founder.`);
            setNotifTitle("");
            setNotifMessage("");
            setNotifType("admin_support");
            setNotifConfirmed(false);
        } catch (submitError) {
            if (!mountedRef.current) return;
            setNotifError(submitError instanceof Error ? submitError.message : "Unable to send notification.");
        } finally {
            if (mountedRef.current) setNotifLoading(false);
        }
    };

    const beginAccessAction = useCallback((action: AccessAdminAction) => {
        setPendingAccessAction(action);
        setAccessReason("");
        setAccessConfirmation("");
        setAccessExpiresAt("");
        setChurnNoteText("");
        setRetentionStatus("none");
        setWinbackStatus("none");
        setAccessError(null);
        setAccessSuccess(null);
    }, []);

    const closeAccessModal = () => {
        if (accessLoading) return;
        setPendingAccessAction(null);
        setAccessReason("");
        setAccessConfirmation("");
        setAccessError(null);
    };

    const submitAccessAction = async () => {
        if (!pendingAccessAction) return;
        const reason = accessReason.trim();
        setAccessLoading(true);
        setAccessError(null);
        setAccessSuccess(null);
        try {
            const metadata = { source: "admin_operations_billing_access" };
            switch (pendingAccessAction.kind) {
                case "grant_comp":
                    await grantFounderCompAccess({
                        userId: founder.user_id,
                        compType: pendingAccessAction.compType,
                        reason,
                        expiresAt: accessExpiresAt || null,
                        metadata,
                    });
                    break;
                case "remove_comp":
                    await removeFounderCompAccess(founder.user_id, reason, metadata);
                    break;
                case "suspend":
                    await suspendFounderAccess(founder.user_id, reason, metadata);
                    break;
                case "reactivate":
                    await reactivateFounderAccess(founder.user_id, reason, metadata);
                    break;
                case "revoke":
                    await revokeFounderAccess(founder.user_id, reason, accessConfirmation, metadata);
                    break;
                case "churn_note":
                    await createFounderChurnNote({
                        userId: founder.user_id,
                        note: churnNoteText.trim(),
                        reason,
                        retentionStatus,
                        winbackStatus,
                        metadata,
                    });
                    break;
            }
            if (!mountedRef.current) return;
            setAccessSuccess(`${pendingAccessAction.label} completed and audit logged.`);
            setPendingAccessAction(null);
            setAccessReason("");
            setAccessConfirmation("");
            setAccessExpiresAt("");
            setChurnNoteText("");
            await loadDetail({ showLoading: false });
        } catch (submitError) {
            if (!mountedRef.current) return;
            setAccessError(submitError instanceof Error ? submitError.message : "Unable to update access controls.");
        } finally {
            if (mountedRef.current) setAccessLoading(false);
        }
    };

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(7,26,47,0.40)", display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
            <div
                className="foundry-modal-surface"
                style={{ width: "min(760px, 100vw)", height: "100%", borderRadius: 0, overflowY: "auto", padding: 18 }}
                onClick={(event) => event.stopPropagation()}
            >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                    <div style={{ minWidth: 0 }}>
                        <div className="foundry-label" style={{ color: "var(--tekori-gold)", marginBottom: 8 }}>Founder Detail</div>
                        <div style={{ fontSize: 25, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, lineHeight: 1.12 }}>
                            {founder.display_name || founder.name || "Unnamed founder"}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--foundry-text-muted)", marginTop: 5 }}>{founder.email || "No email on profile"}</div>
                    </div>
                    <button className="foundry-btn foundry-btn--ghost" type="button" onClick={onClose} style={{ padding: "7px 10px", fontSize: 12 }}>
                        Close
                    </button>
                </div>

                {loading ? (
                    <PanelState title="Loading founder detail" body="Fetching read-only profile, access, activity, and audit metadata." />
                ) : error ? (
                    <PanelState title={/401|403|admin access|required|authorization/i.test(error) ? "Admin access required" : "Founder detail unavailable"} body={error} action={<button className="foundry-btn foundry-btn--secondary" onClick={() => void loadDetail()} style={{ padding: "8px 12px", fontSize: 12 }}>Retry</button>} />
                ) : detail ? (
                    <div style={{ display: "grid", gap: 14 }}>
                        <ProfileSnapshot detail={detail} />
                        <BillingAccessOperations
                            detail={detail}
                            success={accessSuccess}
                            onAction={beginAccessAction}
                        />
                        <ActivityCounts counts={detail.counts} />
                        <AcademyProgressPanel
                            founderName={founder.display_name || founder.name || "Unnamed founder"}
                            repairSuccess={repairSuccess}
                            progress={academyProgress}
                            loading={academyLoading}
                            error={academyError}
                            onRepair={beginRepair}
                            onRetry={() => void loadAcademyProgress()}
                        />
                        <PreviewSection title="Recent Actions" empty="No recent actions." items={detail.recent_actions} renderItem={(item) => <ActionPreview item={item} />} />
                        <PreviewSection title="Recent Documents" empty="No recent documents." items={detail.recent_documents} renderItem={(item) => <DocumentPreview item={item} />} />
                        <PreviewSection title="Recent Archives" empty="No recent archives." items={detail.recent_archives} renderItem={(item) => <ArchivePreview item={item} />} />
                        <AdminSupportNotesSection
                            notes={detail.recent_admin_support_notes}
                            noteText={noteText}
                            noteType={noteType}
                            loading={noteLoading}
                            error={noteError}
                            success={noteSuccess}
                            onNoteTextChange={setNoteText}
                            onNoteTypeChange={setNoteType}
                            onSubmit={() => void submitSupportNote()}
                        />
                        <AdminSendNotificationSection
                            founderName={founder.display_name || founder.name || "this founder"}
                            title={notifTitle}
                            message={notifMessage}
                            type={notifType}
                            confirmed={notifConfirmed}
                            loading={notifLoading}
                            error={notifError}
                            success={notifSuccess}
                            onTitleChange={setNotifTitle}
                            onMessageChange={setNotifMessage}
                            onTypeChange={setNotifType}
                            onConfirmedChange={setNotifConfirmed}
                            onSubmit={() => void submitFounderNotification()}
                        />
                        <PreviewSection title="Recent Admin Actions" empty="No audit entries for this founder yet." items={detail.recent_admin_actions} renderItem={(item) => <AuditPreview item={item} />} />
                    </div>
                ) : null}
            </div>
            {pendingRepair && (
                <AcademyRepairModal
                    founderName={founder.display_name || founder.name || "Unnamed founder"}
                    founderEmail={founder.email}
                    pendingRepair={pendingRepair}
                    reason={repairReason}
                    confirmation={repairConfirmation}
                    loading={repairLoading}
                    error={repairError}
                    onReasonChange={setRepairReason}
                    onConfirmationChange={setRepairConfirmation}
                    onCancel={closeRepairModal}
                    onSubmit={() => void submitRepair()}
                />
            )}
            {pendingAccessAction && (
                <AccessActionModal
                    founderName={founder.display_name || founder.name || "Unnamed founder"}
                    founderEmail={founder.email}
                    action={pendingAccessAction}
                    reason={accessReason}
                    confirmation={accessConfirmation}
                    expiresAt={accessExpiresAt}
                    churnNote={churnNoteText}
                    retentionStatus={retentionStatus}
                    winbackStatus={winbackStatus}
                    loading={accessLoading}
                    error={accessError}
                    onReasonChange={setAccessReason}
                    onConfirmationChange={setAccessConfirmation}
                    onExpiresAtChange={setAccessExpiresAt}
                    onChurnNoteChange={setChurnNoteText}
                    onRetentionStatusChange={setRetentionStatus}
                    onWinbackStatusChange={setWinbackStatus}
                    onCancel={closeAccessModal}
                    onSubmit={() => void submitAccessAction()}
                />
            )}
        </div>
    );
}

function ProfileSnapshot({ detail }: { detail: AdminFounderDetailResponse }) {
    const profile = detail.profile;
    return (
        <Section title="Profile Snapshot">
            <InfoGrid
                items={[
                    ["Name", profile.display_name || profile.name || "Not set"],
                    ["Email", profile.email || "Not set"],
                    ["Business / idea", profile.business_name || profile.side_hustle_name || profile.idea || "Not set"],
                    ["Industry", profile.industry || "Not set"],
                    ["Stage", profile.current_stage ? `Stage ${profile.current_stage}` : "Not set"],
                    ["Venture mode", formatVentureMode(profile.venture_mode)],
                    ["Role", profile.role || "user"],
                    ["Last active", formatDateTime(profile.last_active_at)],
                ]}
            />
        </Section>
    );
}

function BillingAccessOperations({
    detail,
    success,
    onAction,
}: {
    detail: AdminFounderDetailResponse;
    success: string | null;
    onAction: (action: AccessAdminAction) => void;
}) {
    const access = detail.account_access;
    const billing = detail.billing_subscription;
    const isComped = Boolean(access?.is_family_comp || access?.subscription_status === "comped" || access?.subscription_status === "gifted" || access?.plan_type === "family_comp" || access?.plan_type === "gifted");
    const isSuspended = access?.access_status === "suspended";
    const isRevoked = access?.access_status === "revoked";
    const churnNotes = detail.recent_admin_support_notes.filter((note) => note.note_type === "retention" || note.note_type === "billing");

    return (
        <Section title="Billing & Access">
            <div style={{ display: "grid", gap: 12 }}>
                {success && (
                    <div className="foundry-control-surface" style={{ padding: 11, borderColor: "rgba(96, 195, 138, 0.35)" }}>
                        <div style={{ fontSize: 12, color: "var(--foundry-green)", lineHeight: 1.55 }}>{success}</div>
                    </div>
                )}

                <div className="foundry-control-surface" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                        <div>
                            <div style={{ fontSize: 14, color: "var(--foundry-text-primary)", fontWeight: 800 }}>Access state</div>
                            <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", marginTop: 3, lineHeight: 1.55 }}>
                                Tekori access controls are manual overrides. Stripe subscription state remains read-only here.
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <StatusPill label={access?.access_status || "unknown"} accent={accessAccent(access?.access_status)} />
                            <StatusPill label={access?.subscription_status || "none"} accent={subscriptionAccent(access?.subscription_status)} />
                            {isComped && <StatusPill label="manual override" accent="var(--tekori-amber-light)" />}
                        </div>
                    </div>
                    <InfoGrid
                        items={[
                            ["Access status", access?.access_status || "Unknown"],
                            ["Plan type", access?.plan_type || "Unknown"],
                            ["Subscription status", access?.subscription_status || "Unknown"],
                            ["Comp/family", access?.is_family_comp ? "Family comp" : isComped ? "Manual comp/gifted" : "No"],
                            ["Comp reason", access?.comp_reason || "Not set"],
                            ["Access ends", formatDateTime(access?.ends_at || null)],
                            ["Suspended", formatDateTime(access?.suspended_at || null)],
                            ["Suspension reason", access?.suspension_reason || "Not set"],
                        ]}
                    />
                </div>

                <div className="foundry-control-surface" style={{ padding: 12 }}>
                    <div style={{ fontSize: 14, color: "var(--foundry-text-primary)", fontWeight: 800, marginBottom: 10 }}>Stripe subscription truth</div>
                    <InfoGrid
                        items={[
                            ["Stripe status", billing?.stripe_status || "None"],
                            ["Stripe customer", billing?.has_stripe_customer ? "Linked" : "Not linked"],
                            ["Stripe subscription", billing?.has_stripe_subscription ? "Linked" : "Not linked"],
                            ["Current period end", formatDateTime(billing?.current_period_end || null)],
                            ["Cancel at period end", billing?.cancel_at_period_end ? "Yes" : "No"],
                            ["Trial end", formatDateTime(billing?.trial_end || null)],
                        ]}
                    />
                </div>

                <div className="foundry-control-surface" style={{ padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                        <div>
                            <div style={{ fontSize: 14, color: "var(--foundry-text-primary)", fontWeight: 800 }}>Controlled access actions</div>
                            <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", marginTop: 3 }}>Every action requires a reason and writes an audit log entry.</div>
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {!isComped && (
                            <>
                                <button className="foundry-btn foundry-btn--secondary" type="button" onClick={() => onAction({ kind: "grant_comp", label: "Grant Comp Access", compType: "gifted" })} style={{ padding: "8px 12px", fontSize: 12 }}>
                                    Grant Comp
                                </button>
                                <button className="foundry-btn foundry-btn--secondary" type="button" onClick={() => onAction({ kind: "grant_comp", label: "Grant Family Access", compType: "family_comp" })} style={{ padding: "8px 12px", fontSize: 12 }}>
                                    Family Access
                                </button>
                            </>
                        )}
                        {isComped && (
                            <button className="foundry-btn foundry-btn--secondary" type="button" onClick={() => onAction({ kind: "remove_comp", label: "Remove Comp Access" })} style={{ padding: "8px 12px", fontSize: 12 }}>
                                Remove Comp
                            </button>
                        )}
                        {!isSuspended && !isRevoked && (
                            <button className="foundry-btn foundry-btn--secondary" type="button" onClick={() => onAction({ kind: "suspend", label: "Suspend Account" })} style={{ padding: "8px 12px", fontSize: 12 }}>
                                Suspend
                            </button>
                        )}
                        {(isSuspended || isRevoked) && (
                            <button className="foundry-btn foundry-btn--secondary" type="button" onClick={() => onAction({ kind: "reactivate", label: "Reactivate Account" })} style={{ padding: "8px 12px", fontSize: 12 }}>
                                Reactivate
                            </button>
                        )}
                        {!isRevoked && (
                            <button className="foundry-btn foundry-btn--secondary" type="button" onClick={() => onAction({ kind: "revoke", label: "Revoke Access" })} style={{ padding: "8px 12px", fontSize: 12, color: "var(--foundry-red)", borderColor: "rgba(191,74,57,0.32)" }}>
                                Revoke
                            </button>
                        )}
                        <button className="foundry-btn foundry-btn--ghost" type="button" onClick={() => onAction({ kind: "churn_note", label: "Add Churn / Win-back Note" })} style={{ padding: "8px 12px", fontSize: 12 }}>
                            Churn Note
                        </button>
                    </div>
                </div>

                <div className="foundry-control-surface" style={{ padding: 12 }}>
                    <div style={{ fontSize: 14, color: "var(--foundry-text-primary)", fontWeight: 800, marginBottom: 9 }}>Recent churn / win-back notes</div>
                    {churnNotes.length === 0 ? (
                        <div style={{ fontSize: 12, color: "var(--foundry-text-muted)", lineHeight: 1.6 }}>No retention or billing notes captured yet.</div>
                    ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                            {churnNotes.slice(0, 3).map((note) => (
                                <PreviewRow
                                    key={note.id}
                                    title={note.note_type || "Retention note"}
                                    meta={`${String(note.metadata?.retention_status || "no retention status")} - ${String(note.metadata?.winback_status || "no win-back status")}`}
                                    date={note.created_at}
                                    body={note.note}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Section>
    );
}

function ActivityCounts({ counts }: { counts: AdminFounderDetailResponse["counts"] }) {
    return (
        <Section title="Activity Counts">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                <MetricCard label="Academy" value={formatNumber(counts.academy_progress)} accent="var(--tekori-gold)" />
                <MetricCard label="Actions" value={formatNumber(counts.actions)} accent="var(--foundry-green)" />
                <MetricCard label="Documents" value={formatNumber(counts.documents)} accent="var(--foundry-blue)" />
                <MetricCard label="Archives" value={formatNumber(counts.archives)} accent="var(--tekori-amber-light)" />
                <MetricCard label="Books" value={formatNumber(counts.books)} accent="var(--foundry-neutral-data)" />
                <MetricCard label="Market" value={formatNumber(counts.market_reports)} accent="var(--tekori-amber-light)" />
            </div>
        </Section>
    );
}

function AcademyProgressPanel({
    founderName,
    repairSuccess,
    progress,
    loading,
    error,
    onRepair,
    onRetry,
}: {
    founderName: string;
    repairSuccess: string | null;
    progress: AdminFounderAcademyProgressResponse | null;
    loading: boolean;
    error: string | null;
    onRepair: (lesson: AdminAcademyProgressLesson, action: AcademyRepairAction) => void;
    onRetry: () => void;
}) {
    return (
        <Section title="Academy Progress">
            {loading ? (
                <div style={{ fontSize: 12, color: "var(--foundry-text-muted)", lineHeight: 1.6 }}>Loading detailed Academy progress...</div>
            ) : error ? (
                <div className="foundry-control-surface" style={{ padding: 12 }}>
                    <div style={{ fontSize: 12, color: "var(--foundry-red)", lineHeight: 1.6, marginBottom: 10 }}>{error}</div>
                    <button className="foundry-btn foundry-btn--secondary" type="button" onClick={onRetry} style={{ padding: "8px 12px", fontSize: 12 }}>Retry Academy Progress</button>
                </div>
            ) : !progress || progress.stages.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--foundry-text-muted)", lineHeight: 1.6 }}>No Academy lessons are available for this founder.</div>
            ) : (
                <div style={{ display: "grid", gap: 12 }}>
                    {repairSuccess && (
                        <div className="foundry-control-surface" style={{ padding: 11, borderColor: "rgba(96, 195, 138, 0.35)" }}>
                            <div style={{ fontSize: 12, color: "var(--foundry-green)", lineHeight: 1.55 }}>
                                {repairSuccess} Academy progress for {founderName} has been refreshed.
                            </div>
                        </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 8 }}>
                        <MetricCard label="Lessons" value={formatNumber(progress.totals.total)} accent="var(--foundry-text-primary)" />
                        <MetricCard label="Complete" value={formatNumber(progress.totals.completed)} accent="var(--foundry-green)" />
                        <MetricCard label="Needs Check" value={formatNumber(progress.totals.completed_pending_assessment)} accent="var(--tekori-amber-light)" />
                        <MetricCard label="In Progress" value={formatNumber(progress.totals.in_progress)} accent="var(--foundry-blue)" />
                        <MetricCard label="Attempts" value={formatNumber(progress.totals.assessment_attempts)} accent="var(--tekori-gold)" />
                    </div>
                    {progress.stages.map((stage) => (
                        <AcademyStageCard key={stage.stage_id} stage={stage} onRepair={onRepair} />
                    ))}
                </div>
            )}
        </Section>
    );
}

function AcademyStageCard({
    stage,
    onRepair,
}: {
    stage: AdminAcademyProgressStage;
    onRepair: (lesson: AdminAcademyProgressLesson, action: AcademyRepairAction) => void;
}) {
    return (
        <div className="foundry-control-surface" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 14, color: "var(--foundry-text-primary)", fontWeight: 800 }}>Stage {stage.stage_id}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <StatusPill label={`${stage.totals.completed}/${stage.totals.total} complete`} accent="var(--foundry-green)" />
                    <StatusPill label={`${stage.totals.assessment_attempts} attempts`} accent="var(--tekori-gold)" />
                </div>
            </div>
            <div style={{ display: "grid", gap: 7 }}>
                {stage.lessons.map((lesson) => (
                    <AcademyLessonRow key={lesson.content_id} lesson={lesson} onRepair={onRepair} />
                ))}
            </div>
        </div>
    );
}

function AcademyLessonRow({
    lesson,
    onRepair,
}: {
    lesson: AdminAcademyProgressLesson;
    onRepair: (lesson: AdminAcademyProgressLesson, action: AcademyRepairAction) => void;
}) {
    const activityDate = lesson.completed_at || lesson.latest_assessment_attempted_at || lesson.last_opened_at || lesson.started_at || lesson.updated_at;
    const actions: AcademyRepairAction[] = [
        { kind: "progress", status: "completed", label: "Mark Complete" },
        { kind: "progress", status: "in_progress", label: "Mark In Progress" },
        { kind: "progress", status: "not_started", label: "Mark Not Started" },
        { kind: "reset_assessment", label: "Reset Assessment" },
    ];

    return (
        <div style={{ borderTop: "1px solid rgba(7,26,47,0.055)", paddingTop: 9 }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) 132px 118px 92px minmax(132px, max-content)", gap: 9, alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: "var(--foundry-text-primary)", fontWeight: 700, overflowWrap: "anywhere" }}>{lesson.lesson_title}</div>
                    <div style={{ marginTop: 4, fontSize: 10, color: "var(--foundry-text-muted)", lineHeight: 1.5 }}>
                        {[lesson.topic_title || lesson.category, lesson.lesson_type, lesson.is_core ? "Core" : null].filter(Boolean).join(" - ") || "Academy lesson"}
                    </div>
                </div>
                <StatusPill label={formatAcademyStatus(lesson.normalized_status)} accent={academyStatusAccent(lesson.normalized_status)} />
                <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", lineHeight: 1.45 }}>
                    {lesson.latest_assessment_score
                        ? `${lesson.latest_assessment_score.correct}/${lesson.latest_assessment_score.attempted} (${lesson.latest_assessment_score.percent}%)`
                        : "No score"}
                    <div style={{ color: "var(--foundry-text-muted)", fontSize: 10 }}>
                        {lesson.assessment_attempt_count} attempt{lesson.assessment_attempt_count === 1 ? "" : "s"}
                    </div>
                </div>
                <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", textAlign: "right" }}>{formatDateTime(activityDate)}</div>
                <div style={{ display: "flex", justifyContent: "flex-end", minWidth: 0 }}>
                    <div style={{ position: "relative", display: "inline-block" }}>
                        <details>
                            <summary
                                className="foundry-font-ui"
                                style={{
                                    listStyle: "none",
                                    cursor: lesson.content_id ? "pointer" : "not-allowed",
                                    pointerEvents: lesson.content_id ? "auto" : "none",
                                    border: "1px solid rgba(7,26,47,0.09)",
                                    background: "rgba(7,26,47,0.045)",
                                    color: "var(--foundry-text-secondary)",
                                    borderRadius: 9,
                                    padding: "7px 10px",
                                    fontSize: 10,
                                    fontWeight: 800,
                                    textTransform: "uppercase",
                                }}
                            >
                                Repair
                            </summary>
                            <div
                                className="foundry-control-surface"
                                style={{
                                    position: "absolute",
                                    right: 0,
                                    top: "calc(100% + 6px)",
                                    zIndex: 260,
                                    width: 174,
                                    padding: 6,
                                    display: "grid",
                                    gap: 4,
                                    boxShadow: "var(--shadow-premium)",
                                }}
                            >
                                {actions.map((action) => {
                                    const disabledReason = getAcademyRepairDisabledReason(lesson, action);
                                    const isDanger = action.kind === "reset_assessment";
                                    return (
                                        <button
                                            key={action.kind === "progress" ? action.status : action.kind}
                                            type="button"
                                            disabled={Boolean(disabledReason)}
                                            title={disabledReason || `${action.label} with an audit reason`}
                                            onClick={(event) => {
                                                event.currentTarget.closest("details")?.removeAttribute("open");
                                                onRepair(lesson, action);
                                            }}
                                            style={{
                                                border: "1px solid rgba(7,26,47,0.075)",
                                                background: isDanger ? "rgba(191, 74, 57, 0.12)" : "rgba(7,26,47,0.035)",
                                                color: disabledReason ? "var(--foundry-text-muted)" : isDanger ? "var(--foundry-red)" : "var(--foundry-text-primary)",
                                                borderRadius: 7,
                                                padding: "8px 9px",
                                                textAlign: "left",
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: disabledReason ? "not-allowed" : "pointer",
                                                opacity: disabledReason ? 0.55 : 1,
                                            }}
                                        >
                                            {action.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </details>
                    </div>
                </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
                <MiniMeta label="Current" value={lesson.current_progress_status || "none"} />
                <MiniMeta label="Legacy" value={lesson.legacy_progress_status || "none"} />
                <MiniMeta label="Assess" value={formatAcademyAssessmentStatus(lesson.latest_assessment_status)} />
                {lesson.archive_references.length > 0 && <MiniMeta label="Archives" value={String(lesson.archive_references.length)} />}
            </div>
        </div>
    );
}

function AcademyRepairModal({
    founderName,
    founderEmail,
    pendingRepair,
    reason,
    confirmation,
    loading,
    error,
    onReasonChange,
    onConfirmationChange,
    onCancel,
    onSubmit,
}: {
    founderName: string;
    founderEmail: string | null;
    pendingRepair: PendingAcademyRepair;
    reason: string;
    confirmation: string;
    loading: boolean;
    error: string | null;
    onReasonChange: (value: string) => void;
    onConfirmationChange: (value: string) => void;
    onCancel: () => void;
    onSubmit: () => void;
}) {
    const isReset = pendingRepair.action.kind === "reset_assessment";
    const reasonValid = reason.trim().length > 0;
    const confirmationValid = !isReset || confirmation === "RESET ASSESSMENT";
    const hasContentId = Boolean(pendingRepair.lesson.content_id);
    const disabledReason = getAcademyRepairDisabledReason(pendingRepair.lesson, pendingRepair.action);
    const canSubmit = hasContentId && !disabledReason && reasonValid && confirmationValid && !loading;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 320,
                background: "rgba(7,26,47,0.62)",
                display: "grid",
                placeItems: "center",
                padding: 18,
            }}
            onClick={onCancel}
        >
            <div
                className="foundry-modal-surface"
                style={{ width: "min(520px, 100%)", padding: 18, borderColor: isReset ? "rgba(191, 74, 57, 0.35)" : undefined }}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="foundry-label" style={{ color: isReset ? "var(--foundry-red)" : "var(--tekori-gold)", marginBottom: 10 }}>
                    Admin Override
                </div>
                <div style={{ fontSize: 22, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, lineHeight: 1.15 }}>
                    {pendingRepair.action.label}
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <InfoLine label="Founder" value={`${founderName}${founderEmail ? ` (${founderEmail})` : ""}`} />
                    <InfoLine label="Lesson" value={pendingRepair.lesson.lesson_title || "Untitled lesson"} />
                    <InfoLine label="Stage" value={`Stage ${pendingRepair.lesson.stage_id}`} />
                    <InfoLine label="Current status" value={formatAcademyStatus(pendingRepair.lesson.normalized_status)} />
                </div>

                <div className="foundry-control-surface" style={{ padding: 11, marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>
                        This admin action will be written to the audit log with your account, reason, selected lesson, and before/after progress metadata.
                    </div>
                </div>

                {!hasContentId && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--foundry-red)", lineHeight: 1.55 }}>
                        This lesson is missing a content id, so it cannot be repaired safely.
                    </div>
                )}
                {disabledReason && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--tekori-amber-light)", lineHeight: 1.55 }}>
                        {disabledReason}
                    </div>
                )}

                <label style={{ display: "grid", gap: 6, marginTop: 14 }}>
                    <span className="foundry-font-ui" style={{ fontSize: 10, color: "var(--foundry-text-muted)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        Reason
                    </span>
                    <textarea
                        value={reason}
                        onChange={(event) => onReasonChange(event.target.value)}
                        placeholder="Explain why this repair is needed"
                        rows={3}
                        style={{ ...inputStyle, minWidth: 0, resize: "vertical", lineHeight: 1.45 }}
                    />
                    <span style={{ fontSize: 10, color: reasonValid ? "var(--foundry-text-muted)" : "var(--tekori-amber-light)" }}>
                        Minimum 8 characters.
                    </span>
                </label>

                {isReset && (
                    <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
                        <span className="foundry-font-ui" style={{ fontSize: 10, color: "var(--foundry-red)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            Type RESET ASSESSMENT
                        </span>
                        <input
                            value={confirmation}
                            onChange={(event) => onConfirmationChange(event.target.value)}
                            placeholder="RESET ASSESSMENT"
                            style={{ ...inputStyle, minWidth: 0, borderColor: "rgba(191, 74, 57, 0.28)" }}
                        />
                    </label>
                )}

                {error && (
                    <div style={{ marginTop: 12, fontSize: 12, color: "var(--foundry-red)", lineHeight: 1.55 }}>
                        {error}
                    </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                    <button className="foundry-btn foundry-btn--secondary" type="button" disabled={loading} onClick={onCancel} style={{ padding: "8px 12px", fontSize: 12 }}>
                        Cancel
                    </button>
                    <button
                        className="foundry-btn foundry-btn--primary"
                        type="button"
                        disabled={!canSubmit}
                        onClick={onSubmit}
                        style={{
                            padding: "8px 12px",
                            fontSize: 12,
                            background: isReset ? "linear-gradient(135deg, rgba(191,74,57,0.95), rgba(118,42,31,0.95))" : undefined,
                            opacity: canSubmit ? 1 : 0.55,
                            cursor: canSubmit ? "pointer" : "not-allowed",
                        }}
                    >
                        {loading ? "Saving..." : "Confirm Repair"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function InfoLine({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "96px minmax(0, 1fr)", gap: 8, fontSize: 12, lineHeight: 1.45 }}>
            <span className="foundry-font-ui" style={{ color: "var(--foundry-text-muted)", fontWeight: 800, textTransform: "uppercase", fontSize: 10 }}>{label}</span>
            <span style={{ color: "var(--foundry-text-primary)", overflowWrap: "anywhere" }}>{value}</span>
        </div>
    );
}

function AccessActionModal({
    founderName,
    founderEmail,
    action,
    reason,
    confirmation,
    expiresAt,
    churnNote,
    retentionStatus,
    winbackStatus,
    loading,
    error,
    onReasonChange,
    onConfirmationChange,
    onExpiresAtChange,
    onChurnNoteChange,
    onRetentionStatusChange,
    onWinbackStatusChange,
    onCancel,
    onSubmit,
}: {
    founderName: string;
    founderEmail: string | null;
    action: AccessAdminAction;
    reason: string;
    confirmation: string;
    expiresAt: string;
    churnNote: string;
    retentionStatus: AdminRetentionStatus;
    winbackStatus: AdminWinbackStatus;
    loading: boolean;
    error: string | null;
    onReasonChange: (value: string) => void;
    onConfirmationChange: (value: string) => void;
    onExpiresAtChange: (value: string) => void;
    onChurnNoteChange: (value: string) => void;
    onRetentionStatusChange: (value: AdminRetentionStatus) => void;
    onWinbackStatusChange: (value: AdminWinbackStatus) => void;
    onCancel: () => void;
    onSubmit: () => void;
}) {
    const isDanger = action.kind === "revoke" || action.kind === "suspend";
    const isRevoke = action.kind === "revoke";
    const isGrant = action.kind === "grant_comp";
    const isChurn = action.kind === "churn_note";
    const reasonValid = reason.trim().length >= 8;
    const churnValid = !isChurn || churnNote.trim().length >= 3;
    const confirmationValid = !isRevoke || confirmation === "REVOKE ACCESS";
    const canSubmit = reasonValid && churnValid && confirmationValid && !loading;

    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 330, background: "rgba(7,26,47,0.62)", display: "grid", placeItems: "center", padding: 18 }}
            onClick={onCancel}
        >
            <div
                className="foundry-modal-surface"
                style={{ width: "min(560px, 100%)", padding: 18, borderColor: isDanger ? "rgba(191,74,57,0.35)" : undefined }}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="foundry-label" style={{ color: isDanger ? "var(--foundry-red)" : "var(--tekori-gold)", marginBottom: 10 }}>
                    Audited Access Control
                </div>
                <div style={{ fontSize: 22, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, lineHeight: 1.15 }}>
                    {action.label}
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <InfoLine label="Founder" value={`${founderName}${founderEmail ? ` (${founderEmail})` : ""}`} />
                    <InfoLine label="Scope" value={isChurn ? "Internal retention note" : "Tekori account_access manual override"} />
                    <InfoLine label="Stripe" value="Read-only. This action will not mutate Stripe subscriptions." />
                </div>

                <div className="foundry-control-surface" style={{ padding: 11, marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>
                        This action will be audit logged with your admin account, reason, target founder, and before/after state when access changes.
                    </div>
                </div>

                {isGrant && (
                    <label style={{ display: "grid", gap: 6, marginTop: 14 }}>
                        <span className="foundry-font-ui" style={{ fontSize: 10, color: "var(--foundry-text-muted)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            Optional expiration
                        </span>
                        <input
                            type="date"
                            value={expiresAt}
                            disabled={loading}
                            onChange={(event) => onExpiresAtChange(event.target.value)}
                            style={{ ...inputStyle, minWidth: 0 }}
                        />
                    </label>
                )}

                {isChurn && (
                    <>
                        <label style={{ display: "grid", gap: 6, marginTop: 14 }}>
                            <span className="foundry-font-ui" style={{ fontSize: 10, color: "var(--foundry-text-muted)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                Churn / win-back note
                            </span>
                            <textarea
                                value={churnNote}
                                disabled={loading}
                                onChange={(event) => onChurnNoteChange(event.target.value)}
                                placeholder="What happened, what was offered, and what should the admin team know next?"
                                rows={3}
                                style={{ ...inputStyle, minWidth: 0, resize: "vertical", lineHeight: 1.45 }}
                            />
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                            <select value={retentionStatus} disabled={loading} onChange={(event) => onRetentionStatusChange(event.target.value as AdminRetentionStatus)} style={selectStyle}>
                                <option value="none">No retention status</option>
                                <option value="at_risk">At risk</option>
                                <option value="win_back_candidate">Win-back candidate</option>
                                <option value="do_not_contact">Do not contact</option>
                                <option value="converted">Converted</option>
                            </select>
                            <select value={winbackStatus} disabled={loading} onChange={(event) => onWinbackStatusChange(event.target.value as AdminWinbackStatus)} style={selectStyle}>
                                <option value="none">No win-back status</option>
                                <option value="pending">Pending</option>
                                <option value="contacted">Contacted</option>
                                <option value="offered_discount">Offered discount</option>
                                <option value="returned">Returned</option>
                                <option value="declined">Declined</option>
                            </select>
                        </div>
                    </>
                )}

                <label style={{ display: "grid", gap: 6, marginTop: 14 }}>
                    <span className="foundry-font-ui" style={{ fontSize: 10, color: "var(--foundry-text-muted)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        Admin reason
                    </span>
                    <textarea
                        value={reason}
                        disabled={loading}
                        onChange={(event) => onReasonChange(event.target.value)}
                        placeholder="Required reason for the audit log"
                        rows={3}
                        style={{ ...inputStyle, minWidth: 0, resize: "vertical", lineHeight: 1.45 }}
                    />
                    <span style={{ fontSize: 10, color: reasonValid ? "var(--foundry-text-muted)" : "var(--tekori-amber-light)" }}>Reason required.</span>
                </label>

                {isRevoke && (
                    <label style={{ display: "grid", gap: 6, marginTop: 12 }}>
                        <span className="foundry-font-ui" style={{ fontSize: 10, color: "var(--foundry-red)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            Type REVOKE ACCESS
                        </span>
                        <input
                            value={confirmation}
                            disabled={loading}
                            onChange={(event) => onConfirmationChange(event.target.value)}
                            placeholder="REVOKE ACCESS"
                            style={{ ...inputStyle, minWidth: 0, borderColor: "rgba(191,74,57,0.28)" }}
                        />
                    </label>
                )}

                {error && <div style={{ marginTop: 12, fontSize: 12, color: "var(--foundry-red)", lineHeight: 1.55 }}>{error}</div>}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                    <button className="foundry-btn foundry-btn--secondary" type="button" disabled={loading} onClick={onCancel} style={{ padding: "8px 12px", fontSize: 12 }}>
                        Cancel
                    </button>
                    <button
                        className="foundry-btn foundry-btn--primary"
                        type="button"
                        disabled={!canSubmit}
                        onClick={onSubmit}
                        style={{
                            padding: "8px 12px",
                            fontSize: 12,
                            background: isDanger ? "linear-gradient(135deg, rgba(191,74,57,0.95), rgba(118,42,31,0.95))" : undefined,
                            opacity: canSubmit ? 1 : 0.55,
                            cursor: canSubmit ? "pointer" : "not-allowed",
                        }}
                    >
                        {loading ? "Saving..." : "Confirm"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
    return (
        <span className="foundry-font-ui" style={{ fontSize: 10, color: "var(--color-pill-text)", background: "rgba(7,26,47,0.03)", border: "1px solid rgba(7,26,47,0.06)", borderRadius: 999, padding: "4px 7px" }}>
            {label}: <span style={{ color: "var(--foundry-text-secondary)" }}>{value}</span>
        </span>
    );
}

function AdminSendNotificationSection({
    founderName,
    title,
    message,
    type,
    confirmed,
    loading,
    error,
    success,
    onTitleChange,
    onMessageChange,
    onTypeChange,
    onConfirmedChange,
    onSubmit,
}: {
    founderName: string;
    title: string;
    message: string;
    type: AdminNotificationType;
    confirmed: boolean;
    loading: boolean;
    error: string | null;
    success: string | null;
    onTitleChange: (value: string) => void;
    onMessageChange: (value: string) => void;
    onTypeChange: (value: AdminNotificationType) => void;
    onConfirmedChange: (value: boolean) => void;
    onSubmit: () => void;
}) {
    const titleValid = title.trim().length >= 3;
    const messageValid = message.trim().length >= 3;
    const canSubmit = titleValid && messageValid && confirmed && !loading;

    return (
        <Section title="Send In-App Notification">
            <div style={{
                padding: 12,
                background: "rgba(212, 148, 24, 0.05)",
                border: "1px solid rgba(212, 148, 24, 0.22)",
                borderLeft: "3px solid rgba(212, 148, 24, 0.6)",
                borderRadius: 8,
                marginBottom: 10,
            }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                            <span style={{
                                fontSize: 9,
                                fontFamily: "var(--tekori-font-ui)",
                                fontWeight: 800,
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                                color: "rgba(212,148,24,0.9)",
                                background: "rgba(212,148,24,0.12)",
                                border: "1px solid rgba(212,148,24,0.25)",
                                borderRadius: 4,
                                padding: "2px 6px",
                            }}>
                                Founder-Facing
                            </span>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--foundry-text-primary)", fontWeight: 800 }}>Send in-app notification</div>
                        <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", marginTop: 3, lineHeight: 1.45 }}>
                            This will appear in <strong style={{ color: "var(--foundry-text-secondary)" }}>{founderName}</strong>'s notification feed. No email will be sent.
                        </div>
                    </div>
                    <select
                        value={type}
                        disabled={loading}
                        onChange={(event) => onTypeChange(event.target.value as AdminNotificationType)}
                        style={{ ...selectStyle, minWidth: 140 }}
                    >
                        {NOTIFICATION_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>
                <input
                    type="text"
                    value={title}
                    disabled={loading}
                    onChange={(event) => onTitleChange(event.target.value)}
                    placeholder="Notification title (required)"
                    maxLength={512}
                    style={{ ...inputStyle, marginBottom: 8 }}
                />
                <textarea
                    value={message}
                    disabled={loading}
                    onChange={(event) => onMessageChange(event.target.value)}
                    placeholder="Notification message visible to the founder (required)"
                    rows={3}
                    style={{ ...inputStyle, minWidth: 0, resize: "vertical", lineHeight: 1.45 }}
                />
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 10, cursor: loading ? "not-allowed" : "pointer" }}>
                    <input
                        type="checkbox"
                        checked={confirmed}
                        disabled={loading}
                        onChange={(event) => onConfirmedChange(event.target.checked)}
                        style={{ marginTop: 2, accentColor: "rgba(212,148,24,0.9)", flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 11, color: "var(--foundry-text-secondary)", lineHeight: 1.5 }}>
                        I understand this will create a <strong>founder-facing notification</strong> visible immediately to {founderName}.
                    </span>
                </label>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                    <button
                        className="foundry-btn foundry-btn--primary"
                        type="button"
                        disabled={!canSubmit}
                        onClick={onSubmit}
                        style={{
                            padding: "8px 14px",
                            fontSize: 12,
                            opacity: canSubmit ? 1 : 0.5,
                            cursor: canSubmit ? "pointer" : "not-allowed",
                            background: canSubmit ? "linear-gradient(135deg, rgba(212,148,24,0.9), rgba(180,110,12,0.9))" : undefined,
                        }}
                    >
                        {loading ? "Sending..." : "Send Notification"}
                    </button>
                </div>
                {success && <div style={{ marginTop: 9, fontSize: 12, color: "var(--foundry-green)", lineHeight: 1.55 }}>{success}</div>}
                {error && <div style={{ marginTop: 9, fontSize: 12, color: "var(--foundry-red)", lineHeight: 1.55 }}>{error}</div>}
            </div>
        </Section>
    );
}

function AdminSupportNotesSection({
    notes,
    noteText,
    noteType,
    loading,
    error,
    success,
    onNoteTextChange,
    onNoteTypeChange,
    onSubmit,
}: {
    notes: AdminSupportNote[];
    noteText: string;
    noteType: AdminSupportNoteType;
    loading: boolean;
    error: string | null;
    success: string | null;
    onNoteTextChange: (value: string) => void;
    onNoteTypeChange: (value: AdminSupportNoteType) => void;
    onSubmit: () => void;
}) {
    const noteValid = noteText.trim().length >= 3;

    return (
        <Section title="Recent Admin Notes">
            <div className="foundry-control-surface" style={{ padding: 12, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 9 }}>
                    <div>
                        <div style={{ fontSize: 13, color: "var(--foundry-text-primary)", fontWeight: 800 }}>Add internal note</div>
                        <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", marginTop: 3 }}>
                            Internal admin-only timeline. This does not email or notify the founder.
                        </div>
                    </div>
                    <select
                        value={noteType}
                        disabled={loading}
                        onChange={(event) => onNoteTypeChange(event.target.value as AdminSupportNoteType)}
                        style={{ ...selectStyle, minWidth: 132 }}
                    >
                        {SUPPORT_NOTE_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                    </select>
                </div>
                <textarea
                    value={noteText}
                    disabled={loading}
                    onChange={(event) => onNoteTextChange(event.target.value)}
                    placeholder="Add context, decision notes, or support follow-up for admins"
                    rows={3}
                    style={{ ...inputStyle, minWidth: 0, resize: "vertical", lineHeight: 1.45 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 9, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 10, color: noteValid || !noteText ? "var(--foundry-text-muted)" : "var(--tekori-amber-light)" }}>
                        Minimum 3 characters. Saved notes are audit logged.
                    </div>
                    <button
                        className="foundry-btn foundry-btn--primary"
                        type="button"
                        disabled={!noteValid || loading}
                        onClick={onSubmit}
                        style={{ padding: "8px 12px", fontSize: 12, opacity: noteValid && !loading ? 1 : 0.55 }}
                    >
                        {loading ? "Saving..." : "Save Note"}
                    </button>
                </div>
                {success && <div style={{ marginTop: 9, fontSize: 12, color: "var(--foundry-green)", lineHeight: 1.55 }}>{success}</div>}
                {error && <div style={{ marginTop: 9, fontSize: 12, color: "var(--foundry-red)", lineHeight: 1.55 }}>{error}</div>}
            </div>

            {notes.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--foundry-text-muted)", lineHeight: 1.6 }}>No internal support notes yet.</div>
            ) : (
                <div style={{ display: "grid", gap: 8 }}>
                    {notes.map((item) => <SupportNotePreview key={item.id} item={item} />)}
                </div>
            )}
        </Section>
    );
}

function PreviewSection<T extends { id: string }>({ title, empty, items, renderItem }: { title: string; empty: string; items: T[]; renderItem: (item: T) => ReactNode }) {
    return (
        <Section title={title}>
            {items.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--foundry-text-muted)", lineHeight: 1.6 }}>{empty}</div>
            ) : (
                <div style={{ display: "grid", gap: 8 }}>{items.map((item) => <div key={item.id}>{renderItem(item)}</div>)}</div>
            )}
        </Section>
    );
}

function ActionPreview({ item }: { item: AdminActionPreview }) {
    return (
        <PreviewRow
            title={item.title || "Untitled action"}
            meta={`${item.status || "unknown"} - ${item.priority || "normal"} - ${item.source_module || "source unknown"}`}
            date={item.updated_at || item.created_at}
        />
    );
}

function DocumentPreview({ item }: { item: AdminDocumentPreview }) {
    return (
        <PreviewRow
            title={item.title || "Untitled document"}
            meta={`${item.status || "unknown"} - ${item.doc_type || "document"}${item.stage_id ? ` - Stage ${item.stage_id}` : ""}`}
            date={item.updated_at || item.created_at}
        />
    );
}

function ArchivePreview({ item }: { item: AdminArchivePreview }) {
    return (
        <PreviewRow
            title={item.title || item.archive_source_title || "Untitled archive"}
            meta={`${item.archive_source_type || "archive"}${item.stage_id ? ` - Stage ${item.stage_id}` : ""} - ${item.message_count || 0} messages`}
            date={item.created_at || item.summary_date}
            body={item.summary_preview || null}
        />
    );
}

function SupportNotePreview({ item }: { item: AdminSupportNote }) {
    return (
        <PreviewRow
            title={item.note_type || "General note"}
            meta={`${item.visibility || "internal"}${item.linked_entity_type ? ` - ${item.linked_entity_type}` : ""}`}
            date={item.created_at}
            body={item.note}
        />
    );
}

function AuditPreview({ item }: { item: AdminAuditEntry }) {
    return (
        <PreviewRow
            title={item.action_type}
            meta={`${item.entity_type || "entity"}${item.entity_id ? ` - ${item.entity_id}` : ""}${item.reason ? ` - ${item.reason}` : ""}`}
            date={item.created_at}
        />
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="foundry-module-card" style={{ padding: 14 }}>
            <div className="foundry-label" style={{ marginBottom: 12 }}>{title}</div>
            {children}
        </div>
    );
}

function PreviewRow({ title, meta, date, body }: { title: string; meta: string; date: string | null; body?: string | null }) {
    return (
        <div className="foundry-control-surface" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--foundry-text-primary)", fontWeight: 700, overflowWrap: "anywhere" }}>{title}</div>
                    <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", marginTop: 4, lineHeight: 1.5, overflowWrap: "anywhere" }}>{meta}</div>
                </div>
                <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", whiteSpace: "nowrap" }}>{formatDateTime(date)}</div>
            </div>
            {body && <div style={{ marginTop: 9, fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>{body}</div>}
        </div>
    );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
            {items.map(([label, value]) => (
                <div key={label} className="foundry-control-surface" style={{ padding: 11 }}>
                    <div className="foundry-font-ui" style={{ fontSize: 10, color: "var(--foundry-text-muted)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>
                        {label}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--foundry-text-primary)", lineHeight: 1.45, overflowWrap: "anywhere" }}>{value}</div>
                </div>
            ))}
        </div>
    );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
    return (
        <div className="foundry-control-surface" style={{ padding: 11, minHeight: 64 }}>
            <div style={{ fontSize: 19, color: accent, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
            <div className="foundry-font-ui" style={{ fontSize: 10, color: "var(--foundry-text-muted)", marginTop: 5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {label}
            </div>
        </div>
    );
}

function TinyCount({ label, value }: { label: string; value: number }) {
    return (
        <div className="foundry-control-surface" style={{ padding: "5px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--foundry-text-primary)", fontWeight: 800 }}>{formatNumber(value || 0)}</div>
            <div className="foundry-font-ui" style={{ fontSize: 9, color: "var(--foundry-text-muted)", fontWeight: 800 }}>{label}</div>
        </div>
    );
}

function StatusPill({ label, accent }: { label: string; accent: string }) {
    return (
        <span
            className="foundry-font-ui"
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "5px 8px",
                borderRadius: 999,
                background: "rgba(7,26,47,0.035)",
                border: "1px solid rgba(7,26,47,0.07)",
                color: accent,
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                whiteSpace: "nowrap",
            }}
        >
            {label}
        </span>
    );
}

function PanelState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
    return (
        <div style={{ padding: 30, textAlign: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--foundry-text-primary)", marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 13, color: "var(--foundry-text-muted)", lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>{body}</div>
            {action && <div style={{ marginTop: 14 }}>{action}</div>}
        </div>
    );
}

function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(value || 0);
}

function formatDateTime(value: string | null | undefined) {
    if (!value) return "Not available";
    return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelative(value: string | null | undefined) {
    if (!value) return "Never";
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return "Not available";
    const days = Math.floor((Date.now() - time) / 86_400_000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 14) return `${days} days ago`;
    if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
    return formatDateTime(value);
}

function formatVentureMode(value: string | null | undefined) {
    if (value === "side_hustle") return "Side hustle";
    if (value === "side_hustle_to_full_time") return "Side hustle to full-time";
    if (value === "exploring") return "Exploring";
    if (value === "business") return "Business";
    return "Not set";
}

function accessAccent(value: string | null | undefined) {
    if (value === "active") return "var(--foundry-green)";
    if (value === "suspended") return "var(--tekori-amber-light)";
    if (value === "revoked") return "var(--foundry-red)";
    return "var(--foundry-text-muted)";
}

function subscriptionAccent(value: string | null | undefined) {
    if (value === "active" || value === "trialing" || value === "comped" || value === "gifted") return "var(--foundry-green)";
    if (value === "trial") return "var(--foundry-blue)";
    if (value === "past_due" || value === "unpaid") return "var(--tekori-amber-light)";
    if (value === "canceled" || value === "incomplete_expired") return "var(--foundry-red)";
    return "var(--foundry-text-muted)";
}

function formatAcademyStatus(value: AdminAcademyProgressLesson["normalized_status"]) {
    if (value === "completed_pending_assessment") return "Needs check";
    if (value === "in_progress") return "In progress";
    if (value === "completed") return "Complete";
    return "Not started";
}

function formatAcademyAssessmentStatus(value: AdminAcademyProgressLesson["latest_assessment_status"]) {
    if (value === "passed") return "Passed";
    if (value === "in_progress") return "In progress";
    return "Not started";
}

function academyStatusAccent(value: AdminAcademyProgressLesson["normalized_status"]) {
    if (value === "completed") return "var(--foundry-green)";
    if (value === "completed_pending_assessment") return "var(--tekori-amber-light)";
    if (value === "in_progress") return "var(--foundry-blue)";
    return "var(--foundry-text-muted)";
}

function getAcademyRepairDisabledReason(lesson: AdminAcademyProgressLesson, action: AcademyRepairAction) {
    if (!lesson.content_id) return "Missing content id.";
    if (action.kind === "reset_assessment") {
        return lesson.assessment_attempt_count > 0 ? null : "No assessment attempts to reset.";
    }
    if (action.status === "completed" && lesson.normalized_status === "completed") return "Lesson is already complete.";
    if (action.status === "in_progress" && lesson.normalized_status === "in_progress") return "Lesson is already in progress.";
    if (action.status === "not_started" && lesson.normalized_status === "not_started") return "Lesson is already not started.";
    return null;
}

// ─── Tab button ────────────────────────────────────────────────────────────

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                padding: "10px 14px",
                fontSize: 12,
                fontFamily: "var(--tekori-font-ui)",
                fontWeight: 700,
                color: active ? "var(--foundry-text-primary)" : "var(--foundry-text-muted)",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid var(--tekori-gold)" : "2px solid transparent",
                cursor: "pointer",
                transition: "color 0.15s",
                flexShrink: 0,
            }}
        >
            {label}
        </button>
    );
}

// ─── Audit Log ─────────────────────────────────────────────────────────────

function AuditLogPanel() {
    const [items, setItems] = useState<AdminAuditLogEntry[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionType, setActionType] = useState("");
    const [entityType, setEntityType] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [submittedSearch, setSubmittedSearch] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const mountedRef = useRef(true);
    const limit = 50;

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setPage(1);
            setSubmittedSearch(searchInput.trim());
        }, 280);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const totalPages = Math.max(1, Math.ceil(count / limit));

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchAdminAuditLog({
                action_type: actionType || undefined,
                entity_type: entityType || undefined,
                search: submittedSearch || undefined,
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                page,
                limit,
            });
            if (!mountedRef.current) return;
            setItems(res.items);
            setCount(res.pagination.count);
        } catch (e) {
            if (!mountedRef.current) return;
            setError(e instanceof Error ? e.message : "Unable to load audit log.");
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [actionType, dateFrom, dateTo, entityType, page, submittedSearch]);

    useEffect(() => { void load(); }, [load]);

    const resetFilters = () => {
        setActionType("");
        setEntityType("");
        setSearchInput("");
        setSubmittedSearch("");
        setDateFrom("");
        setDateTo("");
        setPage(1);
    };

    return (
        <div className="foundry-app-page__content" style={{ flex: 1, overflowY: "auto", padding: "20px 16px 32px" }}>
            <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
                <div className="foundry-command-panel foundry-panel-in" style={{ padding: 20 }}>
                    <div className="foundry-label" style={{ color: "var(--tekori-gold)", marginBottom: 9 }}>Forensics</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ minWidth: 260, maxWidth: 720 }}>
                            <div style={{ fontSize: 26, lineHeight: 1.1, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, marginBottom: 8 }}>
                                Admin Audit Log
                            </div>
                            <div style={{ fontSize: 13, color: "var(--foundry-text-muted)", lineHeight: 1.65 }}>
                                Immutable admin action records with actor, founder, context, before/after state, and request metadata.
                            </div>
                        </div>
                        <div className="foundry-control-surface" style={{ padding: "10px 12px", minWidth: 150 }}>
                            <div style={{ fontSize: 19, fontWeight: 800, color: "var(--foundry-blue)", lineHeight: 1.1 }}>{formatNumber(count)}</div>
                            <div className="foundry-font-ui" style={{ fontSize: 10, color: "var(--foundry-text-muted)", marginTop: 5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>Matching events</div>
                        </div>
                    </div>
                </div>

                <div className="foundry-toolbar" style={{ padding: 12, display: "grid", gridTemplateColumns: "minmax(220px, 1fr) repeat(5, max-content)", gap: 10, alignItems: "center", overflowX: "auto" }}>
                    <input
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Search founder, admin, reason, action, or entity"
                        style={inputStyle}
                    />
                    <select value={actionType} onChange={(e) => { setActionType(e.target.value); setPage(1); }} style={selectStyle}>
                        {AUDIT_ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} style={selectStyle}>
                        {AUDIT_ENTITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} style={{ ...inputStyle, minWidth: 150 }} />
                    <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} style={{ ...inputStyle, minWidth: 150 }} />
                    <button className="foundry-btn foundry-btn--ghost" type="button" onClick={resetFilters} disabled={loading} style={{ padding: "7px 10px", fontSize: 12 }}>
                        Reset
                    </button>
                </div>

                <div className="foundry-module-card" style={{ padding: 0, overflow: "hidden" }}>
                    {loading ? (
                        <PanelState title="Loading audit log" body="Fetching immutable admin action records." />
                    ) : error ? (
                        <PanelState
                            title="Unable to load audit log"
                            body={error}
                            action={<button className="foundry-btn foundry-btn--secondary" onClick={() => void load()} style={{ padding: "8px 12px", fontSize: 12 }}>Retry</button>}
                        />
                    ) : items.length === 0 ? (
                        <PanelState
                            title="No audit events found"
                            body={actionType || entityType || submittedSearch || dateFrom || dateTo ? "No records match the current filters." : "Admin actions will appear here after audited operations run."}
                        />
                    ) : (
                        <AuditLogTable items={items} expandedId={expandedId} onToggle={(id) => setExpandedId((current) => current === id ? null : id)} />
                    )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, color: "var(--foundry-text-muted)" }}>
                        Page {page} of {totalPages} - {formatNumber(count)} event{count === 1 ? "" : "s"}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button className="foundry-btn foundry-btn--secondary" type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} style={{ padding: "8px 12px", fontSize: 12 }}>Previous</button>
                        <button className="foundry-btn foundry-btn--secondary" type="button" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)} style={{ padding: "8px 12px", fontSize: 12 }}>Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AuditLogTable({ items, expandedId, onToggle }: { items: AdminAuditLogEntry[]; expandedId: string | null; onToggle: (id: string) => void }) {
    return (
        <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 1060 }}>
                <div
                    className="foundry-font-ui"
                    style={{ display: "grid", gridTemplateColumns: "148px 132px minmax(180px,1fr) minmax(180px,1fr) 132px 140px", gap: 10, padding: "10px 14px", borderBottom: "var(--foundry-border-subtle)", fontSize: 10, color: "var(--foundry-text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800 }}
                >
                    <span>Time</span>
                    <span>Category</span>
                    <span>Action</span>
                    <span>Founder</span>
                    <span>Entity</span>
                    <span>Actor</span>
                </div>
                {items.map((item) => (
                    <div key={item.id} style={{ borderBottom: "1px solid rgba(7,26,47,0.045)" }}>
                        <button
                            type="button"
                            onClick={() => onToggle(item.id)}
                            className="foundry-interactive"
                            style={{
                                width: "100%",
                                display: "grid",
                                gridTemplateColumns: "148px 132px minmax(180px,1fr) minmax(180px,1fr) 132px 140px",
                                gap: 10,
                                alignItems: "center",
                                padding: "12px 14px",
                                border: "none",
                                background: expandedId === item.id ? "rgba(7,26,47,0.035)" : "transparent",
                                color: "inherit",
                                textAlign: "left",
                                cursor: "pointer",
                            }}
                        >
                            <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", whiteSpace: "nowrap" }}>{formatDateTime(item.created_at)}</div>
                            <AuditCategoryBadge category={auditCategory(item)} />
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, color: "var(--foundry-text-primary)", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.action_type}</div>
                                <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.reason || "No reason captured"}</div>
                            </div>
                            <AuditPersonSummary profile={item.target_profile} fallback={item.target_user_id} />
                            <div style={{ minWidth: 0, fontSize: 11, color: "var(--foundry-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.entity_type || "entity"}{item.entity_id ? ` / ${item.entity_id}` : ""}
                            </div>
                            <AuditPersonSummary profile={item.admin_profile} fallback={item.admin_id} compact />
                        </button>
                        {expandedId === item.id && <AuditDetail item={item} />}
                    </div>
                ))}
            </div>
        </div>
    );
}

function AuditPersonSummary({ profile, fallback, compact = false }: { profile: AdminAuditLogEntry["admin_profile"]; fallback: string | null; compact?: boolean }) {
    const name = profile?.name || profile?.email || fallback || "Unknown";
    const meta = profile?.email && profile.name ? profile.email : profile?.business_name || profile?.role || fallback || "";
    return (
        <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: compact ? 11 : 12, color: "var(--foundry-text-primary)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
            {meta && <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</div>}
        </div>
    );
}

function AuditDetail({ item }: { item: AdminAuditLogEntry }) {
    return (
        <div style={{ padding: "0 14px 14px" }}>
            <div className="foundry-control-surface" style={{ padding: 14, display: "grid", gap: 14 }}>
                <InfoGrid items={[
                    ["Audit ID", item.id],
                    ["Admin actor", formatAuditPerson(item.admin_profile, item.admin_id)],
                    ["Target founder", formatAuditPerson(item.target_profile, item.target_user_id)],
                    ["Action", item.action_type],
                    ["Entity", `${item.entity_type || "Not set"}${item.entity_id ? ` / ${item.entity_id}` : ""}`],
                    ["IP address", item.ip_address || "Not captured"],
                    ["User agent", item.user_agent || "Not captured"],
                    ["Created", item.created_at ? new Date(item.created_at).toLocaleString("en-US") : "Not available"],
                ]} />
                <div>
                    <div className="foundry-label" style={{ marginBottom: 8 }}>Reason</div>
                    <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6, background: "rgba(7,26,47,0.025)", border: "1px solid rgba(7,26,47,0.06)", borderRadius: 8, padding: "10px 12px", overflowWrap: "anywhere" }}>
                        {item.reason || "No reason captured."}
                    </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                    <JsonBlock title="Before State" value={item.before_state} />
                    <JsonBlock title="After State" value={item.after_state} />
                    <JsonBlock title="Metadata" value={item.metadata} />
                </div>
            </div>
        </div>
    );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
    return (
        <div>
            <div className="foundry-label" style={{ marginBottom: 8 }}>{title}</div>
            <pre style={{ margin: 0, maxHeight: 280, overflow: "auto", background: "rgba(7,26,47,0.045)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 8, padding: 12, color: "var(--foundry-text-secondary)", fontSize: 11, lineHeight: 1.55, fontFamily: "'DM Mono', 'SFMono-Regular', Consolas, monospace", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {JSON.stringify(value ?? null, null, 2)}
            </pre>
        </div>
    );
}

function AuditCategoryBadge({ category }: { category: string }) {
    const accent = auditCategoryAccent(category);
    return (
        <span className="foundry-font-ui" style={{ justifySelf: "flex-start", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: accent, background: "rgba(7,26,47,0.035)", border: `1px solid ${accent}`, borderRadius: 4, padding: "4px 7px" }}>
            {category}
        </span>
    );
}

function auditCategory(item: AdminAuditLogEntry) {
    const action = item.action_type || "";
    const entity = item.entity_type || "";
    if (action.includes("academy") || entity.includes("academy")) return "academy";
    if (action.includes("feedback") || entity.includes("feedback")) return "feedback";
    if (action.includes("access") || entity.includes("account_access")) return "access";
    if (action.includes("notification") || entity.includes("notification")) return "notification";
    if (action.includes("note") || entity.includes("support_notes")) return "notes";
    return "admin";
}

function auditCategoryAccent(category: string) {
    if (category === "academy") return "var(--tekori-gold)";
    if (category === "feedback") return "var(--foundry-blue)";
    if (category === "access") return "var(--foundry-red)";
    if (category === "notification") return "var(--foundry-green)";
    if (category === "notes") return "var(--tekori-amber-light)";
    return "var(--foundry-text-muted)";
}

function formatAuditPerson(profile: AdminAuditLogEntry["admin_profile"], fallback: string | null) {
    if (!profile) return fallback || "Unknown";
    const parts = [profile.name || profile.email || profile.user_id];
    if (profile.email && profile.name) parts.push(profile.email);
    if (profile.business_name) parts.push(profile.business_name);
    return parts.filter(Boolean).join(" / ");
}

// ─── Feedback Inbox ─────────────────────────────────────────────────────────

function FeedbackInboxPanel() {
    const [items, setItems] = useState<AdminFeedbackItem[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState("new");
    const [reactionFilter, setReactionFilter] = useState("");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<AdminFeedbackItem | null>(null);
    const mountedRef = useRef(true);
    const limit = 25;

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const totalPages = Math.max(1, Math.ceil(count / limit));

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchAdminFeedback({ status: statusFilter, reaction: reactionFilter, page, limit });
            if (!mountedRef.current) return;
            setItems(res.items);
            setCount(res.pagination.count);
        } catch (e) {
            if (!mountedRef.current) return;
            setError(e instanceof Error ? e.message : "Unable to load feedback.");
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [statusFilter, reactionFilter, page]);

    useEffect(() => { void load(); }, [load]);

    const handleUpdate = useCallback((updated: AdminFeedbackItem) => {
        setItems((prev) => prev.map((item) => item.id === updated.id ? updated : item));
        setSelected((prev) => prev?.id === updated.id ? updated : prev);
    }, []);

    return (
        <>
            <div className="foundry-app-page__content" style={{ flex: 1, overflowY: "auto", padding: "20px 16px 32px" }}>
                <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
                    <div className="foundry-command-panel foundry-panel-in" style={{ padding: 20 }}>
                        <div className="foundry-label" style={{ color: "var(--tekori-gold)", marginBottom: 9 }}>Review</div>
                        <div style={{ fontSize: 26, lineHeight: 1.1, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, marginBottom: 8 }}>
                            Message Feedback Inbox
                        </div>
                        <div style={{ fontSize: 13, color: "var(--foundry-text-muted)", lineHeight: 1.65 }}>
                            Thumbs up/down reactions from founders. Use status controls to track review progress. Click a row to open the full message and review panel.
                        </div>
                    </div>

                    <div className="foundry-toolbar" style={{ padding: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={selectStyle}>
                            {FEEDBACK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <select value={reactionFilter} onChange={(e) => { setReactionFilter(e.target.value); setPage(1); }} style={selectStyle}>
                            {FEEDBACK_REACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <button className="foundry-btn foundry-btn--ghost" type="button" onClick={() => void load()} disabled={loading} style={{ padding: "7px 10px", fontSize: 12 }}>
                            {loading ? "Loading…" : "Refresh"}
                        </button>
                        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--foundry-text-muted)" }}>
                            {formatNumber(count)} item{count === 1 ? "" : "s"}
                        </div>
                    </div>

                    <div className="foundry-module-card" style={{ padding: 0, overflow: "hidden" }}>
                        {loading ? (
                            <PanelState title="Loading feedback" body="Fetching message feedback from the database." />
                        ) : error ? (
                            <PanelState
                                title="Unable to load feedback"
                                body={error}
                                action={<button className="foundry-btn foundry-btn--secondary" onClick={() => void load()} style={{ padding: "8px 12px", fontSize: 12 }}>Retry</button>}
                            />
                        ) : items.length === 0 ? (
                            <PanelState
                                title="No feedback found"
                                body={statusFilter || reactionFilter ? "No items match the current filters." : "No message feedback has been submitted yet."}
                            />
                        ) : (
                            <div>
                                <div
                                    className="foundry-font-ui"
                                    style={{ display: "grid", gridTemplateColumns: "48px minmax(160px,1fr) minmax(220px,2fr) 110px 100px 120px", gap: 10, padding: "10px 14px", borderBottom: "var(--foundry-border-subtle)", fontSize: 10, color: "var(--foundry-text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}
                                >
                                    <span>React</span>
                                    <span>Founder</span>
                                    <span>Message preview</span>
                                    <span>Surface</span>
                                    <span>Status</span>
                                    <span>Date</span>
                                </div>
                                {items.map((item) => (
                                    <FeedbackListItem key={item.id} item={item} onSelect={setSelected} />
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 12, color: "var(--foundry-text-muted)" }}>
                            Page {page} of {totalPages} — {formatNumber(count)} item{count === 1 ? "" : "s"}
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button className="foundry-btn foundry-btn--secondary" type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} style={{ padding: "8px 12px", fontSize: 12 }}>Previous</button>
                            <button className="foundry-btn foundry-btn--secondary" type="button" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)} style={{ padding: "8px 12px", fontSize: 12 }}>Next</button>
                        </div>
                    </div>
                </div>
            </div>

            {selected && (
                <FeedbackDetailDrawer
                    item={selected}
                    onClose={() => setSelected(null)}
                    onUpdate={handleUpdate}
                />
            )}
        </>
    );
}

function FeedbackListItem({ item, onSelect }: { item: AdminFeedbackItem; onSelect: (item: AdminFeedbackItem) => void }) {
    return (
        <div
            onClick={() => onSelect(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") onSelect(item); }}
            style={{ display: "grid", gridTemplateColumns: "48px minmax(160px,1fr) minmax(220px,2fr) 110px 100px 120px", gap: 10, padding: "12px 14px", borderBottom: "1px solid rgba(7,26,47,0.04)", cursor: "pointer", transition: "background 0.12s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(7,26,47,0.03)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
            <div style={{ display: "flex", alignItems: "center" }}>
                <FeedbackReactionBadge reaction={item.reaction} />
            </div>
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ fontSize: 12, color: "var(--foundry-text-primary)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.profile?.name || item.profile?.email || "Unknown founder"}
                </div>
                {item.profile?.email && item.profile.name && (
                    <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{item.profile.email}</div>
                )}
            </div>
            <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center" }}>
                {item.message_text ? item.message_text.slice(0, 120) : "—"}
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--color-pill-text)", background: "rgba(7,26,47,0.05)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 4, padding: "3px 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                    {item.surface || "—"}
                </span>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
                <FeedbackStatusBadge status={item.status} />
            </div>
            <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", display: "flex", alignItems: "center" }}>
                {formatDateTime(item.created_at)}
            </div>
        </div>
    );
}

function FeedbackReactionBadge({ reaction }: { reaction: "up" | "down" }) {
    const isDown = reaction === "down";
    return (
        <span style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 999,
            background: isDown ? "rgba(191,74,57,0.14)" : "rgba(96,195,138,0.12)",
            border: `1px solid ${isDown ? "rgba(191,74,57,0.3)" : "rgba(96,195,138,0.25)"}`,
            fontSize: 13,
        }}>
            {isDown ? "👎" : "👍"}
        </span>
    );
}

function FeedbackStatusBadge({ status }: { status: string }) {
    const config: Record<string, { color: string; bg: string; label: string }> = {
        new: { color: "rgba(212,148,24,0.95)", bg: "rgba(212,148,24,0.13)", label: "New" },
        reviewed: { color: "rgba(100,149,237,0.9)", bg: "rgba(100,149,237,0.12)", label: "Reviewed" },
        fixed: { color: "rgba(96,195,138,0.9)", bg: "rgba(96,195,138,0.12)", label: "Fixed" },
        ignored: { color: "rgba(168,164,160,0.7)", bg: "rgba(168,164,160,0.07)", label: "Ignored" },
    };
    const c = config[status] ?? config.new;
    return (
        <span style={{ fontSize: 10, fontFamily: "var(--tekori-font-ui)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: c.color, background: c.bg, border: `1px solid ${c.color}`, borderRadius: 4, padding: "3px 6px" }}>
            {c.label}
        </span>
    );
}

function FeedbackDetailDrawer({
    item,
    onClose,
    onUpdate,
}: {
    item: AdminFeedbackItem;
    onClose: () => void;
    onUpdate: (updated: AdminFeedbackItem) => void;
}) {
    const [status, setStatus] = useState<string>(item.status);
    const [adminNote, setAdminNote] = useState<string>(item.admin_note || "");
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

    const isDirty = status !== item.status || adminNote.trim() !== (item.admin_note || "");
    const canSave = isDirty && !saving;

    const save = async () => {
        setSaving(true);
        setSaveError(null);
        setSaveSuccess(null);
        try {
            const payload: UpdateAdminFeedbackPayload = {};
            if (status !== item.status) payload.status = status as AdminFeedbackStatus;
            const currentNote = adminNote.trim() || null;
            if (currentNote !== (item.admin_note || null)) payload.admin_note = currentNote;
            const result = await updateAdminFeedback(item.id, payload);
            setSaveSuccess("Feedback updated.");
            onUpdate(result.feedback);
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : "Unable to save.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(7,26,47,0.40)", display: "flex", justifyContent: "flex-end" }}
            onClick={onClose}
        >
            <div
                className="foundry-modal-surface"
                style={{ width: "min(640px, 100vw)", height: "100%", borderRadius: 0, overflowY: "auto", padding: 18 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                    <div style={{ minWidth: 0 }}>
                        <div className="foundry-label" style={{ color: item.reaction === "down" ? "var(--foundry-red)" : "var(--foundry-green)", marginBottom: 8 }}>
                            {item.reaction === "down" ? "👎 Thumbs Down" : "👍 Thumbs Up"} Feedback
                        </div>
                        <div style={{ fontSize: 20, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, lineHeight: 1.15 }}>
                            {item.conversation_title || item.surface || "Feedback Detail"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", marginTop: 4 }}>
                            {item.profile?.name || item.profile?.email || item.user_id || "Unknown founder"} · {item.surface || "Unknown surface"} · {formatDateTime(item.created_at)}
                        </div>
                    </div>
                    <button className="foundry-btn foundry-btn--ghost" type="button" onClick={onClose} style={{ padding: "7px 10px", fontSize: 12 }}>Close</button>
                </div>

                <div style={{ display: "grid", gap: 14 }}>
                    {item.profile && (
                        <Section title="Founder">
                            <InfoGrid items={[
                                ["Name", item.profile.name || "Not set"],
                                ["Email", item.profile.email || "Not set"],
                                ["Business", item.profile.business_name || "Not set"],
                            ]} />
                        </Section>
                    )}

                    <Section title="Message">
                        <div style={{ fontSize: 13, color: "var(--foundry-text-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap", background: "rgba(7,26,47,0.03)", border: "1px solid rgba(7,26,47,0.07)", borderRadius: 8, padding: "12px 14px" }}>
                            {item.message_text || "(No message text captured)"}
                        </div>
                    </Section>

                    <Section title="Context">
                        <InfoGrid items={[
                            ["Surface", item.surface || "Unknown"],
                            ["Stage", item.stage_id ? `Stage ${item.stage_id}` : "Unknown"],
                            ["Conversation", item.conversation_title || "Unknown"],
                            ["Message ID", item.message_id || "Not captured"],
                        ]} />
                    </Section>

                    <Section title="Admin Review">
                        <div className="foundry-control-surface" style={{ padding: 12 }}>
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", marginBottom: 6, fontWeight: 700 }}>Status</div>
                                <select
                                    value={status}
                                    disabled={saving}
                                    onChange={(e) => setStatus(e.target.value)}
                                    style={selectStyle}
                                >
                                    {FEEDBACK_STATUS_OPTIONS.filter((o) => o.value).map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", marginBottom: 6, fontWeight: 700 }}>Admin note</div>
                                <textarea
                                    value={adminNote}
                                    disabled={saving}
                                    onChange={(e) => setAdminNote(e.target.value)}
                                    placeholder="Internal note about this feedback (optional)"
                                    rows={3}
                                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.45 }}
                                />
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button
                                    className="foundry-btn foundry-btn--primary"
                                    type="button"
                                    disabled={!canSave}
                                    onClick={() => void save()}
                                    style={{ padding: "8px 14px", fontSize: 12, opacity: canSave ? 1 : 0.5, cursor: canSave ? "pointer" : "not-allowed" }}
                                >
                                    {saving ? "Saving…" : "Save Review"}
                                </button>
                            </div>
                            {saveSuccess && <div style={{ marginTop: 8, fontSize: 12, color: "var(--foundry-green)", lineHeight: 1.55 }}>{saveSuccess}</div>}
                            {saveError && <div style={{ marginTop: 8, fontSize: 12, color: "var(--foundry-red)", lineHeight: 1.55 }}>{saveError}</div>}
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    );
}

const inputStyle = {
    width: "100%",
    minWidth: 220,
    background: "rgba(7,26,47,0.045)",
    border: "1px solid rgba(7,26,47,0.09)",
    borderRadius: 10,
    padding: "10px 12px",
    color: "var(--foundry-text-primary)",
    fontSize: 13,
    outline: "none",
} as const;

const selectStyle = {
    background: "rgba(7,26,47,0.045)",
    border: "1px solid rgba(7,26,47,0.09)",
    borderRadius: 10,
    padding: "10px 12px",
    color: "var(--foundry-text-primary)",
    fontSize: 12,
    outline: "none",
} as const;

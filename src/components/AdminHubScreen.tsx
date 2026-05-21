import { useEffect, useState, type ReactNode } from "react";
import { Icons } from "../icons";
import type { AdminNotificationSettings } from "../lib/notifications";
import { loadAdminTtsUsage, type TtsUsageSnapshot } from "../lib/ttsUsage";
import {
    formatEstimatedCost,
    formatTokenCount,
    loadAdminTokenUsageSummary,
    tokenUsageEstimateNote,
    type AdminTokenUsageSummary,
} from "../lib/adminTokenUsage";
import AdminDashboard from "./AdminDashboard";
import AdminAcademyManager from "./AdminAcademyManager";
import AdminFounderAccounts from "./AdminFounderAccounts";
import AdminOperationsScreen from "./AdminOperationsScreen";

interface Props {
    userId: string;
    onBack: () => void;
    notificationSettings: AdminNotificationSettings;
    onNotificationSettingsChange: (next: AdminNotificationSettings) => void;
}

type AdminView = "overview" | "dashboard" | "accounts" | "academy" | "operations";

const PRIMARY_TOOLS: Array<{
    title: string;
    eyebrow: string;
    description: string;
    accent: string;
    view: Exclude<AdminView, "overview">;
}> = [
    {
        title: "Admin Operations",
        eyebrow: "Primary Console",
        description: "Founder search, account snapshots, support notes, access controls, feedback, and audit log.",
        accent: "var(--foundry-green)",
        view: "operations",
    },
    {
        title: "Founder Accounts",
        eyebrow: "Account Review",
        description: "Registered founders, stage progress, archive summaries, subscription state, and AI account summaries.",
        accent: "var(--tekori-gold)",
        view: "accounts",
    },
    {
        title: "Navi Academy",
        eyebrow: "Content Ops",
        description: "Academy categories, topic conversations, lesson series, and learning content.",
        accent: "var(--tekori-amber-light)",
        view: "academy",
    },
    {
        title: "User Management",
        eyebrow: "Legacy Surface",
        description: "Older account controls retained for operational continuity while Admin Operations becomes the main console.",
        accent: "var(--foundry-blue)",
        view: "dashboard",
    },
];

const PLANNED_SURFACES = [
    "Subscription Status",
    "Comped / Family Access",
    "Suspend / Reactivate",
    "Churn Tracking",
    "Stripe / Webhooks",
    "Founding Member Controls",
];

const OPERATING_PATHS: Array<{
    label: string;
    detail: string;
    target: Exclude<AdminView, "overview">;
    accent: string;
}> = [
    {
        label: "Support a founder",
        detail: "Search accounts, open the founder drawer, inspect access, progress, notes, and recent activity.",
        target: "operations",
        accent: "var(--foundry-green)",
    },
    {
        label: "Review feedback",
        detail: "Triage message feedback, update status, and leave an internal review note.",
        target: "operations",
        accent: "var(--foundry-blue)",
    },
    {
        label: "Audit admin actions",
        detail: "Search immutable admin actions by actor, founder, action, entity, and date.",
        target: "operations",
        accent: "var(--tekori-amber-light)",
    },
    {
        label: "Manage Academy content",
        detail: "Edit learning structure and content without entering account support workflows.",
        target: "academy",
        accent: "var(--tekori-gold)",
    },
    {
        label: "Generate account summaries",
        detail: "Use the Founder Accounts view for broader account review and AI summaries.",
        target: "accounts",
        accent: "var(--foundry-red)",
    },
];

export default function AdminHubScreen({
    userId,
    onBack,
    notificationSettings,
    onNotificationSettingsChange,
}: Props) {
    const [activeView, setActiveView] = useState<AdminView>("overview");
    const [ttsUsage, setTtsUsage] = useState<TtsUsageSnapshot | null>(null);
    const [ttsUsageLoading, setTtsUsageLoading] = useState(true);
    const [ttsUsageError, setTtsUsageError] = useState<string | null>(null);
    const [tokenUsage30d, setTokenUsage30d] = useState<AdminTokenUsageSummary | null>(null);
    const [tokenUsageAllTime, setTokenUsageAllTime] = useState<AdminTokenUsageSummary | null>(null);
    const [tokenUsageLoading, setTokenUsageLoading] = useState(true);
    const [tokenUsageError, setTokenUsageError] = useState<string | null>(null);

    const refreshTtsUsage = async () => {
        setTtsUsageLoading(true);
        setTtsUsageError(null);
        try {
            const usage = await loadAdminTtsUsage();
            setTtsUsage(usage);
        } catch (error) {
            setTtsUsageError(error instanceof Error ? error.message : "Unable to load ElevenLabs usage.");
        } finally {
            setTtsUsageLoading(false);
        }
    };

    useEffect(() => {
        void refreshTtsUsage();
    }, []);

    const refreshTokenUsage = async () => {
        setTokenUsageLoading(true);
        setTokenUsageError(null);
        try {
            const [last30, allTime] = await Promise.all([
                loadAdminTokenUsageSummary({ windowDays: 30 }),
                loadAdminTokenUsageSummary(),
            ]);
            setTokenUsage30d(last30);
            setTokenUsageAllTime(allTime);
        } catch (error) {
            setTokenUsageError(error instanceof Error ? error.message : "Unable to load token usage.");
        } finally {
            setTokenUsageLoading(false);
        }
    };

    useEffect(() => {
        void refreshTokenUsage();
    }, []);

    if (activeView === "dashboard") {
        return <AdminDashboard userId={userId} onBack={() => setActiveView("overview")} />;
    }

    if (activeView === "operations") {
        return <AdminOperationsScreen onBack={() => setActiveView("overview")} />;
    }

    if (activeView === "accounts") {
        return <AdminFounderAccounts onBack={() => setActiveView("overview")} />;
    }

    if (activeView === "academy") {
        return <AdminAcademyManager userId={userId} onBack={() => setActiveView("overview")} />;
    }

    const usagePercent = ttsUsage?.totalCredits
        ? Math.min(100, Math.round((ttsUsage.usedCredits / ttsUsage.totalCredits) * 100))
        : 0;
    const ttsUsageLimited = Boolean(ttsUsage?.usageAccessLimited);

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 180,
                background: "var(--foundry-bg-app)",
                color: "var(--foundry-text-primary)",
                fontFamily: "var(--tekori-font-ui)",
                display: "flex",
                flexDirection: "column",
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
                    justifyContent: "space-between",
                    gap: 12,
                    flexShrink: 0,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <button className="foundry-btn foundry-btn--ghost" onClick={onBack} style={{ padding: "var(--foundry-app-header-button-padding)", fontSize: "var(--foundry-app-header-button-font)" }}>
                        Back
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <Icons.sidebar.admin size={"var(--foundry-app-header-icon-size)"} />
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "var(--foundry-app-header-title-font)", fontWeight: 700 }}>Admin Hub</div>
                            <div style={{ fontSize: "var(--foundry-app-header-meta-font)", color: "var(--foundry-text-muted)" }}>Operations command center</div>
                        </div>
                    </div>
                </div>
                <button className="foundry-btn foundry-btn--secondary" onClick={() => setActiveView("operations")} style={{ padding: "8px 12px", fontSize: 12 }}>
                    Open Operations
                </button>
            </div>

            <div className="foundry-app-page__content" style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <aside style={{ flex: "0 0 280px", display: "grid", gap: 12, minWidth: 260 }}>
                        <SectionPanel title="Navigate">
                            <div style={{ display: "grid", gap: 8 }}>
                                {PRIMARY_TOOLS.map((tool) => (
                                    <NavButton
                                        key={tool.view}
                                        title={tool.title}
                                        eyebrow={tool.eyebrow}
                                        accent={tool.accent}
                                        onClick={() => setActiveView(tool.view)}
                                    />
                                ))}
                            </div>
                        </SectionPanel>

                        <SectionPanel title="System State">
                            <div style={{ display: "grid", gap: 8 }}>
                                <SystemRow label="Admin Operations" value="Active" accent="var(--foundry-green)" />
                                <SystemRow label="Audit Log" value="Read-only" accent="var(--foundry-blue)" />
                                <SystemRow label="Mutations" value="Server audited" accent="var(--tekori-amber-light)" />
                            </div>
                        </SectionPanel>

                        <SectionPanel title="Planned Surfaces">
                            <div style={{ display: "grid", gap: 6 }}>
                                {PLANNED_SURFACES.map((surface) => (
                                    <div key={surface} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", fontSize: 12, color: "var(--foundry-text-secondary)" }}>
                                        <span>{surface}</span>
                                        <span className="foundry-font-ui" style={{ fontSize: 9, color: "var(--foundry-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Queued</span>
                                    </div>
                                ))}
                            </div>
                        </SectionPanel>
                    </aside>

                    <main style={{ flex: "1 1 680px", minWidth: 0, display: "grid", gap: 14 }}>
                        <section className="foundry-command-panel foundry-panel-in" style={{ padding: 18, borderRadius: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                                <div style={{ minWidth: 260, maxWidth: 760 }}>
                                    <div className="foundry-label" style={{ color: "var(--tekori-gold)", marginBottom: 8 }}>Internal Control Panel</div>
                                    <div style={{ fontSize: 28, lineHeight: 1.08, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, marginBottom: 8 }}>
                                        Tekori Admin Hub
                                    </div>
                                    <div style={{ fontSize: 13, color: "var(--foundry-text-muted)", lineHeight: 1.65 }}>
                                        Start with Admin Operations for support, access, feedback, and audit work. Use the other surfaces for specialized account and content review.
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <MiniAction label="Founder Ops" onClick={() => setActiveView("operations")} accent="var(--foundry-green)" />
                                    <MiniAction label="Academy" onClick={() => setActiveView("academy")} accent="var(--tekori-amber-light)" />
                                    <MiniAction label="Accounts" onClick={() => setActiveView("accounts")} accent="var(--tekori-gold)" />
                                </div>
                            </div>
                        </section>

                        <SectionPanel title="Operating Paths">
                            <div style={{ display: "grid", gap: 8 }}>
                                {OPERATING_PATHS.map((path) => (
                                    <WorkflowRow
                                        key={path.label}
                                        label={path.label}
                                        detail={path.detail}
                                        accent={path.accent}
                                        onClick={() => setActiveView(path.target)}
                                    />
                                ))}
                            </div>
                        </SectionPanel>

                        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
                            <SectionPanel title="Navi Token Usage" action={<TextButton label="Refresh" onClick={() => void refreshTokenUsage()} />}>
                                {tokenUsageLoading ? (
                                    <InlineState>Loading token usage...</InlineState>
                                ) : tokenUsageError ? (
                                    <InlineState tone="error">{tokenUsageError}</InlineState>
                                ) : tokenUsage30d && tokenUsageAllTime ? (
                                    <div style={{ display: "grid", gap: 10 }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                                            <MetricTile label="30d Cost" value={formatEstimatedCost(tokenUsage30d.estimatedCostUsd)} accent="var(--foundry-green)" />
                                            <MetricTile label="30d Tokens" value={formatTokenCount(tokenUsage30d.totalTokens)} accent="var(--foundry-blue)" />
                                            <MetricTile label="All-Time Cost" value={formatEstimatedCost(tokenUsageAllTime.estimatedCostUsd)} accent="var(--tekori-gold)" />
                                            <MetricTile label="Messages" value={formatNumber(tokenUsage30d.messageCount)} accent="var(--tekori-amber-light)" />
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", lineHeight: 1.6 }}>
                                            {tokenUsageEstimateNote()}
                                        </div>
                                    </div>
                                ) : (
                                    <InlineState>No token usage returned.</InlineState>
                                )}
                            </SectionPanel>

                            <SectionPanel title="Voice Usage" action={<TextButton label="Refresh" onClick={() => void refreshTtsUsage()} />}>
                                {ttsUsageLoading ? (
                                    <InlineState>Loading ElevenLabs usage...</InlineState>
                                ) : ttsUsageError ? (
                                    <InlineState tone="error">{ttsUsageError}</InlineState>
                                ) : ttsUsage ? (
                                    <div style={{ display: "grid", gap: 10 }}>
                                        {ttsUsageLimited ? (
                                            <InlineState tone="warn">{ttsUsage.usageAccessMessage || "Voice is configured. Usage metrics are unavailable."}</InlineState>
                                        ) : (
                                            <div>
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, color: "var(--foundry-text-muted)", marginBottom: 7 }}>
                                                    <span>Cycle usage</span>
                                                    <span>{usagePercent}% · reset {formatResetDate(ttsUsage.resetAtUnix)}</span>
                                                </div>
                                                <div style={{ height: 8, borderRadius: 999, background: "rgba(7,26,47,0.05)", overflow: "hidden" }}>
                                                    <div style={{ width: `${usagePercent}%`, height: "100%", background: "linear-gradient(90deg, var(--tekori-gold), var(--tekori-amber-light))" }} />
                                                </div>
                                            </div>
                                        )}
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                                            <MetricTile label="Voice" value={ttsUsage.currentVoiceName || "Not set"} accent="var(--tekori-amber-light)" />
                                            <MetricTile label={ttsUsageLimited ? "Connection" : "Status"} value={ttsUsageLimited ? ttsUsage.status : `${ttsUsage.tier} · ${ttsUsage.status}`} accent="var(--foundry-blue)" />
                                            <MetricTile label="Remaining" value={ttsUsageLimited ? "Unavailable" : formatNumber(ttsUsage.remainingCredits)} accent="var(--foundry-green)" />
                                            <MetricTile label="Used" value={ttsUsageLimited ? "Unavailable" : `${formatNumber(ttsUsage.usedCredits)} / ${formatNumber(ttsUsage.totalCredits)}`} accent="var(--tekori-gold)" />
                                        </div>
                                    </div>
                                ) : (
                                    <InlineState>No voice usage returned.</InlineState>
                                )}
                            </SectionPanel>
                        </section>

                        <SectionPanel title="Notification Controls">
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
                                <ControlCard
                                    label="Re-engagement"
                                    control={
                                        <ToggleButton
                                            enabled={notificationSettings.reengagementEnabled}
                                            onClick={() => onNotificationSettingsChange({
                                                ...notificationSettings,
                                                reengagementEnabled: !notificationSettings.reengagementEnabled,
                                            })}
                                        />
                                    }
                                />
                                <ControlCard
                                    label="Inactive Days"
                                    control={
                                        <NumberInput
                                            value={notificationSettings.reengagementDelayDays}
                                            min={1}
                                            onChange={(value) => onNotificationSettingsChange({
                                                ...notificationSettings,
                                                reengagementDelayDays: value,
                                            })}
                                        />
                                    }
                                />
                                <ControlCard
                                    label="Max Reminders"
                                    control={
                                        <NumberInput
                                            value={notificationSettings.maxRemindersPerUser}
                                            min={1}
                                            onChange={(value) => onNotificationSettingsChange({
                                                ...notificationSettings,
                                                maxRemindersPerUser: value,
                                            })}
                                        />
                                    }
                                />
                            </div>
                        </SectionPanel>
                    </main>
                </div>
            </div>
        </div>
    );
}

function NavButton({
    title,
    eyebrow,
    accent,
    onClick,
}: {
    title: string;
    eyebrow: string;
    accent: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                border: "1px solid rgba(7,26,47,0.075)",
                background: "rgba(7,26,47,0.025)",
                borderRadius: 8,
                padding: "10px 11px",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
            }}
        >
            <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12, color: "var(--foundry-text-primary)", fontWeight: 700, marginBottom: 2 }}>{title}</span>
                <span className="foundry-font-ui" style={{ display: "block", fontSize: 9, color: "var(--foundry-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{eyebrow}</span>
            </span>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: accent, flexShrink: 0 }} />
        </button>
    );
}

function WorkflowRow({
    label,
    detail,
    accent,
    onClick,
}: {
    label: string;
    detail: string;
    accent: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "grid",
                gridTemplateColumns: "10px minmax(0, 1fr) max-content",
                gap: 10,
                alignItems: "center",
                border: "1px solid rgba(7,26,47,0.07)",
                background: "rgba(7,26,47,0.025)",
                borderRadius: 8,
                padding: "10px 11px",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
            }}
        >
            <span style={{ width: 8, height: 8, borderRadius: 99, background: accent }} />
            <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, color: "var(--foundry-text-primary)", fontWeight: 800, marginBottom: 3 }}>{label}</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--foundry-text-muted)", lineHeight: 1.45 }}>{detail}</span>
            </span>
            <span className="foundry-font-ui" style={{ color: accent, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Open
            </span>
        </button>
    );
}

function SectionPanel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
    return (
        <section style={{ background: "rgba(7,26,47,0.02)", border: "1px solid rgba(7,26,47,0.07)", borderRadius: 8, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div className="foundry-label">{title}</div>
                {action}
            </div>
            {children}
        </section>
    );
}

function SystemRow({ label, value, accent }: { label: string; value: string; accent: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontSize: 12 }}>
            <span style={{ color: "var(--foundry-text-secondary)" }}>{label}</span>
            <span className="foundry-font-ui" style={{ color: accent, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>{value}</span>
        </div>
    );
}

function MiniAction({ label, accent, onClick }: { label: string; accent: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="foundry-btn foundry-btn--secondary"
            style={{ padding: "8px 11px", fontSize: 12, color: accent }}
        >
            {label}
        </button>
    );
}

function TextButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="foundry-font-ui"
            style={{
                background: "transparent",
                border: "none",
                color: "var(--foundry-text-muted)",
                cursor: "pointer",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: 0,
            }}
        >
            {label}
        </button>
    );
}

function MetricTile({ label, value, accent }: { label: string; value: string; accent: string }) {
    return (
        <div style={{ border: "1px solid rgba(7,26,47,0.07)", background: "rgba(7,26,47,0.025)", borderRadius: 8, padding: 10, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: accent, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
            <div className="foundry-font-ui" style={{ fontSize: 9, color: "var(--foundry-text-muted)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 5 }}>{label}</div>
        </div>
    );
}

function InlineState({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" | "warn" }) {
    const color = tone === "error" ? "var(--foundry-red)" : tone === "warn" ? "var(--tekori-amber-light)" : "var(--foundry-text-muted)";
    return <div style={{ fontSize: 12, color, lineHeight: 1.6 }}>{children}</div>;
}

function ControlCard({ label, control }: { label: string; control: ReactNode }) {
    return (
        <div style={{ background: "rgba(7,26,47,0.025)", border: "1px solid rgba(7,26,47,0.07)", borderRadius: 8, padding: 12 }}>
            <div className="foundry-font-ui" style={{ fontSize: 10, color: "var(--foundry-text-muted)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                {label}
            </div>
            {control}
        </div>
    );
}

function ToggleButton({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                minWidth: 82,
                padding: "9px 12px",
                borderRadius: 999,
                border: enabled ? "1px solid rgba(115,135,123,0.34)" : "1px solid rgba(7,26,47,0.08)",
                background: enabled ? "rgba(115,135,123,0.16)" : "rgba(7,26,47,0.03)",
                color: enabled ? "var(--foundry-green)" : "var(--foundry-text-muted)",
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
            }}
        >
            {enabled ? "Enabled" : "Disabled"}
        </button>
    );
}

function NumberInput({
    value,
    min,
    onChange,
}: {
    value: number;
    min: number;
    onChange: (value: number) => void;
}) {
    return (
        <input
            type="number"
            min={min}
            value={value}
            onChange={(event) => onChange(Math.max(min, Number(event.target.value) || min))}
            style={{
                width: 100,
                background: "rgba(7,26,47,0.04)",
                border: "1px solid rgba(7,26,47,0.1)",
                borderRadius: 8,
                padding: "9px 11px",
                color: "var(--foundry-text-primary)",
                fontSize: 12,
                outline: "none",
            }}
        />
    );
}

function formatNumber(value: number) {
    return new Intl.NumberFormat("en-US").format(value);
}

function formatResetDate(unix: number | null) {
    if (!unix) return "Not available";
    return new Date(unix * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import { loadAdminUsers, type AdminUser } from "../lib/adminDb";
import { callForgeAPI } from "../lib/forgeApi";
import { STAGE_COLORS } from "../constants/glossary";
import {
    formatEstimatedCost,
    formatTokenCount,
    loadAdminTokenUsageByUser,
    loadAdminTokenUsageSummary,
    tokenUsageEstimateNote,
    type AdminTokenUsageSummary,
} from "../lib/adminTokenUsage";

// ── Constants ──────────────────────────────────────────────────

const STAGE_LABELS: Record<number, string> = {
    1: "Idea",
    2: "Plan",
    3: "Legal",
    4: "Finance",
    5: "Launch",
    6: "Grow",
};

// ── Types ──────────────────────────────────────────────────────

interface StageProgressRow {
    stage_id: number;
    completed_milestones: string[];
    updated_at: string | null;
}

interface ArchiveSummary {
    id: string;
    stage_id: number;
    title: string | null;
    summary: string | null;
    message_count: number;
    created_at: string;
}

interface UserDetail {
    stageProgress: StageProgressRow[];
    recentSummaries: ArchiveSummary[];
    messageCount: number;
    tokenUsage30d: AdminTokenUsageSummary;
    tokenUsageAllTime: AdminTokenUsageSummary;
}

interface GeneratedSummary {
    text: string;
    generatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────

function formatDate(iso: string | null) {
    if (!iso) return "Never";
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatRelative(iso: string | null) {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

function isPaid(user: AdminUser): boolean {
    if (user.billing?.stripe_status === "active") return true;
    const pt = user.access?.plan_type;
    return pt === "paid" || pt === "family_comp" || pt === "gifted";
}

function currentStage(stageProgress: StageProgressRow[]): number {
    let max = 1;
    for (const row of stageProgress) {
        if (row.completed_milestones?.length > 0 && row.stage_id > max) {
            max = row.stage_id;
        }
    }
    return max;
}

// ── Sub-components ─────────────────────────────────────────────

function StageBadge({ stage }: { stage: number }) {
    const color = (STAGE_COLORS as Record<number, string>)[stage] ?? "var(--color-text-muted)";
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 9px",
                borderRadius: 999,
                background: `color-mix(in srgb, ${color} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${color} 18%, transparent)`,
                color,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
            }}
        >
            S{stage} · {STAGE_LABELS[stage] ?? "—"}
        </span>
    );
}

function PaidPill({ paid }: { paid: boolean }) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 9px",
                borderRadius: 999,
                background: paid ? "rgba(115,135,123,0.16)" : "rgba(7,26,47,0.05)",
                border: paid ? "1px solid rgba(115,135,123,0.34)" : "1px solid rgba(7,26,47,0.1)",
                color: paid ? "var(--color-success)" : "var(--color-text-muted)",
                fontSize: 10,
                fontWeight: 700,
                whiteSpace: "nowrap",
            }}
        >
            {paid ? "PAID" : "FREE"}
        </span>
    );
}

// ── User Detail Panel ──────────────────────────────────────────

function UserDetailPanel({
    user,
    onClose,
}: {
    user: AdminUser;
    onClose: () => void;
}) {
    const [detail, setDetail] = useState<UserDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(true);
    const [summary, setSummary] = useState<GeneratedSummary | null>(null);
    const [generatingSummary, setGeneratingSummary] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        setLoadingDetail(true);
        void (async () => {
            const [progressRes, summariesRes, msgRes, tokenUsage30d, tokenUsageAllTime] = await Promise.all([
                supabase
                    .from("stage_progress")
                    .select("stage_id, completed_milestones, updated_at")
                    .eq("user_id", user.id),
                supabase
                    .from("daily_chat_summaries")
                    .select("id, stage_id, title, summary, message_count, created_at")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(5),
                supabase
                    .from("messages")
                    .select("id", { count: "exact", head: true })
                    .eq("user_id", user.id),
                loadAdminTokenUsageSummary({ userId: user.id, windowDays: 30 }),
                loadAdminTokenUsageSummary({ userId: user.id }),
            ]);
            if (!mounted) return;
            setDetail({
                stageProgress: (progressRes.data ?? []) as StageProgressRow[],
                recentSummaries: (summariesRes.data ?? []) as ArchiveSummary[],
                messageCount: tokenUsageAllTime.messageCount || msgRes.count || 0,
                tokenUsage30d,
                tokenUsageAllTime,
            });
            setLoadingDetail(false);
        })();
        return () => { mounted = false; };
    }, [user.id]);

    const generateSummary = useCallback(async () => {
        if (!detail) return;
        setGeneratingSummary(true);
        setSummaryError(null);
        try {
            const stage = currentStage(detail.stageProgress);
            const stagesText = detail.stageProgress
                .sort((a, b) => a.stage_id - b.stage_id)
                .map(row => `Stage ${row.stage_id} (${STAGE_LABELS[row.stage_id] ?? ""}): ${row.completed_milestones?.length ?? 0} milestones completed`)
                .join("\n");

            const summariesText = detail.recentSummaries.length
                ? detail.recentSummaries.map(s => `[${formatDate(s.created_at)}] ${s.title ?? "Untitled"}: ${s.summary ?? "—"}`).join("\n\n")
                : "No archive summaries available.";

            const prompt = `Generate a concise founder account summary for the Tekori admin team based on the following data. Focus on engagement level, progress milestones reached, and any notable patterns. Be specific and factual. 3–5 paragraphs.

FOUNDER PROFILE:
- Name: ${user.name ?? "Unknown"}
- Business: ${user.business_name ?? "Not set"}
- Email: ${user.email ?? "Unknown"}
- Joined: ${formatDate(user.created_at)}
- Last Active: ${formatRelative(user.last_active_at)}
- Subscription: ${isPaid(user) ? "PAID" : "FREE"} (${user.access?.subscription_status ?? "unknown"})
- Stripe Status: ${user.billing?.stripe_status ?? "None"}
- Cancel at period end: ${user.billing?.cancel_at_period_end ? "Yes" : "No"}
- Total messages: ${detail.messageCount}
- Estimated Navi tokens last 30 days: ${formatTokenCount(detail.tokenUsage30d.totalTokens)}
- Estimated Navi model cost last 30 days: ${formatEstimatedCost(detail.tokenUsage30d.estimatedCostUsd)}

CURRENT STAGE: Stage ${stage} — ${STAGE_LABELS[stage] ?? ""}

STAGE PROGRESS:
${stagesText}

RECENT ARCHIVE SUMMARIES (last 5):
${summariesText}`;

            const result = await callForgeAPI(
                [{ role: "user", content: prompt }],
                "You are Tekori's internal AI analyst. You help the admin team understand founder engagement, progress, and health at a glance. Generate clear, professional account summaries.",
                1200,
            );
            setSummary({ text: result, generatedAt: new Date().toISOString() });
        } catch (err) {
            setSummaryError(err instanceof Error ? err.message : "Failed to generate summary.");
        } finally {
            setGeneratingSummary(false);
        }
    }, [detail, user]);

    const stage = detail ? currentStage(detail.stageProgress) : 1;
    const paid = isPaid(user);

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 200,
                background: "rgba(7,26,47,0.42)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                padding: "20px 12px",
                overflowY: "auto",
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: "var(--foundry-surface-primary)",
                    border: "1px solid rgba(7,26,47,0.1)",
                    borderRadius: 22,
                    padding: 24,
                    width: "100%",
                    maxWidth: 680,
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 22, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, color: "var(--color-text)", marginBottom: 4 }}>
                            {user.name ?? "Unnamed Founder"}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginBottom: 8 }}>{user.email ?? "—"}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <StageBadge stage={stage} />
                            <PaidPill paid={paid} />
                            {user.business_name && (
                                <span style={{ fontSize: 10, color: "var(--color-pill-text)", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 999, padding: "3px 9px" }}>
                                    {user.business_name}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "rgba(7,26,47,0.05)",
                            border: "1px solid rgba(7,26,47,0.1)",
                            borderRadius: 8,
                            padding: "7px 12px",
                            color: "var(--color-text-muted)",
                            fontSize: 12,
                            cursor: "pointer",
                            flexShrink: 0,
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Quick stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                    {[
                        { label: "Joined", value: formatDate(user.created_at) },
                        { label: "Last Active", value: formatRelative(user.last_active_at) },
                        { label: "Messages", value: loadingDetail ? "…" : String(detail?.messageCount ?? 0) },
                        { label: "Stripe", value: user.billing?.stripe_status ?? "None" },
                        { label: "Tokens 30d", value: loadingDetail ? "…" : formatTokenCount(detail?.tokenUsage30d.totalTokens ?? 0) },
                        { label: "Cost 30d", value: loadingDetail ? "…" : formatEstimatedCost(detail?.tokenUsage30d.estimatedCostUsd ?? 0) },
                    ].map(item => (
                        <div key={item.label} style={{ background: "rgba(7,26,47,0.03)", border: "1px solid rgba(7,26,47,0.07)", borderRadius: 12, padding: "12px 14px" }}>
                            <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{item.label}</div>
                            <div style={{ fontSize: 14, color: "var(--color-text)", fontWeight: 600 }}>{item.value}</div>
                        </div>
                    ))}
                </div>

                {loadingDetail ? (
                    <div style={{ fontSize: 13, color: "var(--foundry-text-secondary)", padding: "8px 0" }}>Loading account data…</div>
                ) : detail && (
                    <>
                        <div style={{ background: "rgba(115,135,123,0.06)", border: "1px solid rgba(115,135,123,0.16)", borderRadius: 16, padding: 16 }}>
                            <div style={{ fontSize: 10, color: "var(--color-success)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Navi Token Usage Estimate</div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 10 }}>
                                {[
                                    { label: "Cost · 30d", value: formatEstimatedCost(detail.tokenUsage30d.estimatedCostUsd) },
                                    { label: "Tokens · 30d", value: formatTokenCount(detail.tokenUsage30d.totalTokens) },
                                    { label: "Cost · All time", value: formatEstimatedCost(detail.tokenUsageAllTime.estimatedCostUsd) },
                                    { label: "Messages · 30d", value: String(detail.tokenUsage30d.messageCount) },
                                ].map(item => (
                                    <div key={item.label} style={{ background: "rgba(7,26,47,0.03)", border: "1px solid rgba(7,26,47,0.07)", borderRadius: 12, padding: "11px 12px" }}>
                                        <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{item.label}</div>
                                        <div style={{ fontSize: 14, color: "var(--color-text)", fontWeight: 700 }}>{item.value}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", lineHeight: 1.6 }}>{tokenUsageEstimateNote()}</div>
                        </div>

                        {/* Stage Progress */}
                        <div style={{ background: "rgba(7,26,47,0.02)", border: "1px solid rgba(7,26,47,0.07)", borderRadius: 16, padding: 16 }}>
                            <div style={{ fontSize: 10, color: "var(--color-text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Stage Progress</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {[1, 2, 3, 4, 5, 6].map(stageId => {
                                    const row = detail.stageProgress.find(r => r.stage_id === stageId);
                                    const count = row?.completed_milestones?.length ?? 0;
                                    const color = (STAGE_COLORS as Record<number, string>)[stageId] ?? "var(--color-text-muted)";
                                    return (
                                        <div key={stageId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <div style={{ width: 70, fontSize: 12, color: count > 0 ? color : "var(--color-text-muted)", fontWeight: count > 0 ? 600 : 400, flexShrink: 0 }}>
                                                S{stageId} · {STAGE_LABELS[stageId]}
                                            </div>
                                            <div style={{ flex: 1, height: 6, borderRadius: 999, background: "rgba(7,26,47,0.05)", overflow: "hidden" }}>
                                                <div style={{ width: `${Math.min(100, count * 20)}%`, height: "100%", background: color, opacity: count > 0 ? 1 : 0, transition: "width 0.3s ease" }} />
                                            </div>
                                            <div style={{ width: 24, fontSize: 11, color: count > 0 ? color : "var(--color-text-muted)", textAlign: "right", flexShrink: 0 }}>
                                                {count}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Archive Summaries */}
                        {detail.recentSummaries.length > 0 && (
                            <div style={{ background: "rgba(7,26,47,0.02)", border: "1px solid rgba(7,26,47,0.07)", borderRadius: 16, padding: 16 }}>
                                <div style={{ fontSize: 10, color: "var(--color-text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Recent Archive (last 5)</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {detail.recentSummaries.map(s => (
                                        <div key={s.id} style={{ borderLeft: `2px solid ${(STAGE_COLORS as Record<number, string>)[s.stage_id] ?? "var(--color-text-muted)"}`, paddingLeft: 12 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text)" }}>{s.title ?? "Untitled"}</span>
                                                <span style={{ fontSize: 10, color: "var(--foundry-text-muted)" }}>{formatDate(s.created_at)}</span>
                                            </div>
                                            {s.summary && (
                                                <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                                                    {s.summary.length > 160 ? s.summary.slice(0, 160) + "…" : s.summary}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Account Summary */}
                <div style={{ background: "rgba(216,155,43,0.06)", border: "1px solid rgba(216,155,43,0.16)", borderRadius: 16, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: summary ? 14 : 0 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", marginBottom: 2 }}>Navi Account Summary</div>
                            {summary && <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)" }}>Generated {formatRelative(summary.generatedAt)}</div>}
                        </div>
                        <button
                            onClick={() => void generateSummary()}
                            disabled={generatingSummary || loadingDetail}
                            style={{
                                padding: "9px 14px",
                                borderRadius: 10,
                                border: "1px solid rgba(216,155,43,0.32)",
                                background: generatingSummary ? "rgba(216,155,43,0.06)" : "rgba(216,155,43,0.14)",
                                color: generatingSummary ? "var(--color-text-muted)" : "var(--tekori-gold)",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: generatingSummary || loadingDetail ? "default" : "pointer",
                                flexShrink: 0,
                            }}
                        >
                            {generatingSummary ? "Generating…" : summary ? "Regenerate" : "Generate Account Summary"}
                        </button>
                    </div>
                    {summaryError && (
                        <div style={{ fontSize: 12, color: "var(--color-danger)", lineHeight: 1.6, marginTop: 8 }}>{summaryError}</div>
                    )}
                    {summary && (
                        <div style={{ fontSize: 13, color: "var(--color-text-soft)", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
                            {summary.text}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────

interface Props {
    onBack: () => void;
}

export default function AdminFounderAccounts({ onBack }: Props) {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [allStageProgress, setAllStageProgress] = useState<Map<string, number>>(new Map());
    const [tokenUsageByUser, setTokenUsageByUser] = useState<Map<string, AdminTokenUsageSummary>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [loaded, progressRes, usageMap] = await Promise.all([
                loadAdminUsers(),
                supabase.from("stage_progress").select("user_id, stage_id, completed_milestones"),
                loadAdminTokenUsageByUser(30),
            ]);

            // Build a map of userId -> highest stage with milestones
            const stageMap = new Map<string, number>();
            for (const row of progressRes.data ?? []) {
                if (row.completed_milestones?.length > 0) {
                    const cur = stageMap.get(row.user_id) ?? 1;
                    if (row.stage_id > cur) stageMap.set(row.user_id, row.stage_id);
                }
            }

            setUsers(loaded);
            setAllStageProgress(stageMap);
            setTokenUsageByUser(usageMap);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load accounts.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const filtered = users.filter(u => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (u.name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    });

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 180,
                background: "var(--color-bg-soft)",
                color: "var(--color-text)",
                fontFamily: "var(--tekori-font-ui)",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: "max(14px, calc(10px + env(safe-area-inset-top))) 16px 12px",
                    borderBottom: "1px solid rgba(7,26,47,0.07)",
                    background: "rgba(255,252,246,0.97)",
                    backdropFilter: "blur(12px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexShrink: 0,
                }}
            >
                <button
                    onClick={onBack}
                    style={{
                        background: "rgba(7,26,47,0.05)",
                        border: "1px solid rgba(7,26,47,0.1)",
                        borderRadius: 8,
                        padding: "7px 12px",
                        color: "var(--color-text-soft)",
                        fontSize: 12,
                        cursor: "pointer",
                    }}
                >
                    ←
                </button>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>Founder Accounts</span>
                {!loading && (
                    <span style={{ fontSize: 12, color: "var(--foundry-text-muted)", marginLeft: 4 }}>
                        {filtered.length} founder{filtered.length !== 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {/* Search */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(7,26,47,0.05)", flexShrink: 0 }}>
                <input
                    type="text"
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        width: "100%",
                        maxWidth: 480,
                        background: "rgba(7,26,47,0.04)",
                        border: "1px solid rgba(7,26,47,0.09)",
                        borderRadius: 10,
                        padding: "10px 14px",
                        color: "var(--color-text)",
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                    }}
                />
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 32px" }}>
                <div style={{ maxWidth: 900, margin: "0 auto" }}>
                    {loading ? (
                        <div style={{ fontSize: 13, color: "var(--foundry-text-secondary)", padding: "24px 0" }}>Loading founders…</div>
                    ) : error ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "24px 0" }}>
                            <div style={{ fontSize: 13, color: "var(--color-danger)" }}>{error}</div>
                            <button
                                onClick={() => void load()}
                                style={{
                                    alignSelf: "flex-start",
                                    padding: "9px 14px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(7,26,47,0.08)",
                                    background: "rgba(7,26,47,0.03)",
                                    color: "var(--color-text-soft)",
                                    fontSize: 12,
                                    cursor: "pointer",
                                }}
                            >
                                Retry
                            </button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ fontSize: 13, color: "var(--foundry-text-secondary)", padding: "24px 0" }}>
                            {search ? "No founders match that search." : "No founders registered yet."}
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {/* Column headers */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr auto auto auto auto auto",
                                    gap: "0 12px",
                                    padding: "0 14px 6px",
                                    fontSize: 10,
                                    color: "var(--foundry-text-muted)",
                                    letterSpacing: "0.1em",
                                    textTransform: "uppercase",
                                }}
                            >
                                <span>Name</span>
                                <span>Email</span>
                                <span>Stage</span>
                                <span>Plan</span>
                                <span>Cost 30d</span>
                                <span>Joined</span>
                                <span>Last Active</span>
                            </div>

                            {filtered.map(user => {
                                const stage = allStageProgress.get(user.id) ?? 1;
                                const paid = isPaid(user);
                                const usage = tokenUsageByUser.get(user.id);
                                return (
                                    <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => setSelectedUser(user)}
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "1fr 1fr auto auto auto auto auto",
                                            gap: "0 12px",
                                            alignItems: "center",
                                            padding: "12px 14px",
                                            background: "rgba(7,26,47,0.02)",
                                            border: "1px solid rgba(7,26,47,0.07)",
                                            borderRadius: 12,
                                            textAlign: "left",
                                            cursor: "pointer",
                                            transition: "background 0.12s ease, border-color 0.12s ease",
                                            width: "100%",
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = "rgba(7,26,47,0.04)";
                                            e.currentTarget.style.borderColor = "rgba(7,26,47,0.12)";
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = "rgba(7,26,47,0.02)";
                                            e.currentTarget.style.borderColor = "rgba(7,26,47,0.07)";
                                        }}
                                    >
                                        <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {user.name ?? <span style={{ color: "var(--foundry-text-muted)" }}>Unnamed</span>}
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {user.email ?? "—"}
                                        </div>
                                        <StageBadge stage={stage} />
                                        <PaidPill paid={paid} />
                                        <div style={{ fontSize: 11, color: usage && usage.estimatedCostUsd > 0 ? "var(--color-success)" : "var(--color-text-muted)", whiteSpace: "nowrap", fontWeight: 700 }}>
                                            {formatEstimatedCost(usage?.estimatedCostUsd ?? 0)}
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", whiteSpace: "nowrap" }}>{formatDate(user.created_at)}</div>
                                        <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", whiteSpace: "nowrap" }}>{formatRelative(user.last_active_at)}</div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail overlay */}
            {selectedUser && (
                <UserDetailPanel
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                />
            )}
        </div>
    );
}

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import { loadAdminUsers, type AdminUser } from "../lib/adminDb";
import { callForgeAPI } from "../lib/forgeApi";
import { STAGE_COLORS } from "../constants/glossary";

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
    const color = (STAGE_COLORS as Record<number, string>)[stage] ?? "#888";
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 9px",
                borderRadius: 999,
                background: `${color}18`,
                border: `1px solid ${color}30`,
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
                background: paid ? "rgba(76,175,138,0.14)" : "rgba(255,255,255,0.05)",
                border: paid ? "1px solid rgba(76,175,138,0.32)" : "1px solid rgba(255,255,255,0.1)",
                color: paid ? "#4CAF8A" : "#666",
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
            const [progressRes, summariesRes, msgRes] = await Promise.all([
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
            ]);
            if (!mounted) return;
            setDetail({
                stageProgress: (progressRes.data ?? []) as StageProgressRow[],
                recentSummaries: (summariesRes.data ?? []) as ArchiveSummary[],
                messageCount: msgRes.count ?? 0,
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

            const prompt = `Generate a concise founder account summary for the Foundry admin team based on the following data. Focus on engagement level, progress milestones reached, and any notable patterns. Be specific and factual. 3–5 paragraphs.

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

CURRENT STAGE: Stage ${stage} — ${STAGE_LABELS[stage] ?? ""}

STAGE PROGRESS:
${stagesText}

RECENT ARCHIVE SUMMARIES (last 5):
${summariesText}`;

            const result = await callForgeAPI(
                [{ role: "user", content: prompt }],
                "You are Foundry's internal AI analyst. You help the admin team understand founder engagement, progress, and health at a glance. Generate clear, professional account summaries.",
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
                background: "rgba(0,0,0,0.7)",
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
                    background: "#0d0d0e",
                    border: "1px solid rgba(255,255,255,0.1)",
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
                        <div style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 4 }}>
                            {user.name ?? "Unnamed Founder"}
                        </div>
                        <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>{user.email ?? "—"}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <StageBadge stage={stage} />
                            <PaidPill paid={paid} />
                            {user.business_name && (
                                <span style={{ fontSize: 10, color: "#A8A4A0", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: "3px 9px" }}>
                                    {user.business_name}
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 8,
                            padding: "7px 12px",
                            color: "#888",
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
                    ].map(item => (
                        <div key={item.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "12px 14px" }}>
                            <div style={{ fontSize: 10, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{item.label}</div>
                            <div style={{ fontSize: 14, color: "#F0EDE8", fontWeight: 600 }}>{item.value}</div>
                        </div>
                    ))}
                </div>

                {loadingDetail ? (
                    <div style={{ fontSize: 13, color: "#666", padding: "8px 0" }}>Loading account data…</div>
                ) : detail && (
                    <>
                        {/* Stage Progress */}
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 16 }}>
                            <div style={{ fontSize: 10, color: "#888", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Stage Progress</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {[1, 2, 3, 4, 5, 6].map(stageId => {
                                    const row = detail.stageProgress.find(r => r.stage_id === stageId);
                                    const count = row?.completed_milestones?.length ?? 0;
                                    const color = (STAGE_COLORS as Record<number, string>)[stageId] ?? "#888";
                                    return (
                                        <div key={stageId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <div style={{ width: 70, fontSize: 12, color: count > 0 ? color : "#444", fontWeight: count > 0 ? 600 : 400, flexShrink: 0 }}>
                                                S{stageId} · {STAGE_LABELS[stageId]}
                                            </div>
                                            <div style={{ flex: 1, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                                                <div style={{ width: `${Math.min(100, count * 20)}%`, height: "100%", background: color, opacity: count > 0 ? 1 : 0, transition: "width 0.3s ease" }} />
                                            </div>
                                            <div style={{ width: 24, fontSize: 11, color: count > 0 ? color : "#444", textAlign: "right", flexShrink: 0 }}>
                                                {count}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Archive Summaries */}
                        {detail.recentSummaries.length > 0 && (
                            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 16 }}>
                                <div style={{ fontSize: 10, color: "#888", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Recent Archive (last 5)</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {detail.recentSummaries.map(s => (
                                        <div key={s.id} style={{ borderLeft: `2px solid ${(STAGE_COLORS as Record<number, string>)[s.stage_id] ?? "#444"}`, paddingLeft: 12 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: "#F0EDE8" }}>{s.title ?? "Untitled"}</span>
                                                <span style={{ fontSize: 10, color: "#555" }}>{formatDate(s.created_at)}</span>
                                            </div>
                                            {s.summary && (
                                                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>
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
                <div style={{ background: "rgba(232,98,42,0.06)", border: "1px solid rgba(232,98,42,0.16)", borderRadius: 16, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: summary ? 14 : 0 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#F0EDE8", marginBottom: 2 }}>Forge Account Summary</div>
                            {summary && <div style={{ fontSize: 10, color: "#666" }}>Generated {formatRelative(summary.generatedAt)}</div>}
                        </div>
                        <button
                            onClick={() => void generateSummary()}
                            disabled={generatingSummary || loadingDetail}
                            style={{
                                padding: "9px 14px",
                                borderRadius: 10,
                                border: "1px solid rgba(232,98,42,0.32)",
                                background: generatingSummary ? "rgba(232,98,42,0.06)" : "rgba(232,98,42,0.14)",
                                color: generatingSummary ? "#888" : "#E8622A",
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
                        <div style={{ fontSize: 12, color: "#D28B76", lineHeight: 1.6, marginTop: 8 }}>{summaryError}</div>
                    )}
                    {summary && (
                        <div style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [loaded, progressRes] = await Promise.all([
                loadAdminUsers(),
                supabase.from("stage_progress").select("user_id, stage_id, completed_milestones"),
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
                background: "#080809",
                color: "#F0EDE8",
                fontFamily: "'Lora', Georgia, serif",
                display: "flex",
                flexDirection: "column",
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: "max(14px, calc(10px + env(safe-area-inset-top))) 16px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(8,8,9,0.97)",
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
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        padding: "7px 12px",
                        color: "#C8C4BE",
                        fontSize: 12,
                        cursor: "pointer",
                    }}
                >
                    ←
                </button>
                <span style={{ fontSize: 15, fontWeight: 600, color: "#F0EDE8" }}>Founder Accounts</span>
                {!loading && (
                    <span style={{ fontSize: 12, color: "#555", marginLeft: 4 }}>
                        {filtered.length} founder{filtered.length !== 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {/* Search */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
                <input
                    type="text"
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        width: "100%",
                        maxWidth: 480,
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.09)",
                        borderRadius: 10,
                        padding: "10px 14px",
                        color: "#F0EDE8",
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
                        <div style={{ fontSize: 13, color: "#666", padding: "24px 0" }}>Loading founders…</div>
                    ) : error ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "24px 0" }}>
                            <div style={{ fontSize: 13, color: "#D28B76" }}>{error}</div>
                            <button
                                onClick={() => void load()}
                                style={{
                                    alignSelf: "flex-start",
                                    padding: "9px 14px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    background: "rgba(255,255,255,0.03)",
                                    color: "#C8C4BE",
                                    fontSize: 12,
                                    cursor: "pointer",
                                }}
                            >
                                Retry
                            </button>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ fontSize: 13, color: "#666", padding: "24px 0" }}>
                            {search ? "No founders match that search." : "No founders registered yet."}
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {/* Column headers */}
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 1fr auto auto auto auto",
                                    gap: "0 12px",
                                    padding: "0 14px 6px",
                                    fontSize: 10,
                                    color: "#555",
                                    letterSpacing: "0.1em",
                                    textTransform: "uppercase",
                                }}
                            >
                                <span>Name</span>
                                <span>Email</span>
                                <span>Stage</span>
                                <span>Plan</span>
                                <span>Joined</span>
                                <span>Last Active</span>
                            </div>

                            {filtered.map(user => {
                                const stage = allStageProgress.get(user.id) ?? 1;
                                const paid = isPaid(user);
                                return (
                                    <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => setSelectedUser(user)}
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "1fr 1fr auto auto auto auto",
                                            gap: "0 12px",
                                            alignItems: "center",
                                            padding: "12px 14px",
                                            background: "rgba(255,255,255,0.02)",
                                            border: "1px solid rgba(255,255,255,0.07)",
                                            borderRadius: 12,
                                            textAlign: "left",
                                            cursor: "pointer",
                                            transition: "background 0.12s ease, border-color 0.12s ease",
                                            width: "100%",
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                                        }}
                                    >
                                        <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {user.name ?? <span style={{ color: "#555" }}>Unnamed</span>}
                                        </div>
                                        <div style={{ fontSize: 12, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {user.email ?? "—"}
                                        </div>
                                        <StageBadge stage={stage} />
                                        <PaidPill paid={paid} />
                                        <div style={{ fontSize: 11, color: "#666", whiteSpace: "nowrap" }}>{formatDate(user.created_at)}</div>
                                        <div style={{ fontSize: 11, color: "#666", whiteSpace: "nowrap" }}>{formatRelative(user.last_active_at)}</div>
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

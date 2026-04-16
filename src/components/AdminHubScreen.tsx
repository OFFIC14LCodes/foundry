import { useEffect, useState, type ReactNode } from "react";
import { Icons } from "../icons";
import type { AdminNotificationSettings } from "../lib/notifications";
import { loadAdminTtsUsage, type TtsUsageSnapshot } from "../lib/ttsUsage";
import AdminDashboard from "./AdminDashboard";

interface Props {
    userId: string;
    onBack: () => void;
    notificationSettings: AdminNotificationSettings;
    onNotificationSettingsChange: (next: AdminNotificationSettings) => void;
}

const ADMIN_SECTIONS = [
    {
        title: "User Management",
        description: "Review accounts, inspect workspace history, and manage user operations directly from the Admin Hub as this control surface expands.",
        accent: "#E8622A",
        cta: "Open account controls",
        action: "dashboard",
    },
    {
        title: "Subscription Status",
        description: "Track active, canceled, trial, and past-due states across the Foundry customer base.",
        accent: "#63B3ED",
        cta: "Billing visibility placeholder",
    },
    {
        title: "Comped / Family Access",
        description: "Manage manually granted accounts, family access, and gifted access rules in one place.",
        accent: "#9B7FE8",
        cta: "Grant free access",
        action: "dashboard",
    },
    {
        title: "Suspend / Reactivate",
        description: "Handle restricted accounts safely with clear escalation and reactivation controls.",
        accent: "#F5A843",
        cta: "Open access controls",
        action: "dashboard",
    },
    {
        title: "Churn Tracking",
        description: "Track win-back notes, retention state, and account health signals for founder support.",
        accent: "#48BB78",
        cta: "Retention workspace placeholder",
    },
    {
        title: "Stripe / Webhooks",
        description: "Monitor billing sync, Stripe lifecycle events, and webhook health as that layer expands.",
        accent: "#38BDF8",
        cta: "Payments ops placeholder",
    },
    {
        title: "Founding Member Controls",
        description: "Manage founding pricing, OG Founder status, and future early-access entitlements cleanly.",
        accent: "#C8A96E",
        cta: "Founding controls placeholder",
    },
];

function AdminCard({
    title,
    description,
    accent,
    cta,
    onClick,
}: {
    title: string;
    description: string;
    accent: string;
    cta: string;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 18,
                padding: 18,
                minHeight: 170,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                width: "100%",
                textAlign: "left",
                cursor: onClick ? "pointer" : "default",
                transition: "background 0.15s ease, border-color 0.15s ease",
            }}
            onMouseEnter={event => {
                if (!onClick) return;
                event.currentTarget.style.background = "rgba(255,255,255,0.04)";
                event.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            }}
            onMouseLeave={event => {
                event.currentTarget.style.background = "rgba(255,255,255,0.02)";
                event.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
            }}
        >
            <div>
                <div
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        marginBottom: 14,
                        background: `${accent}16`,
                        border: `1px solid ${accent}28`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: accent,
                        fontSize: 18,
                        fontWeight: 700,
                        fontFamily: "'Lora', Georgia, serif",
                    }}
                >
                    •
                </div>
                <div style={{ fontSize: 18, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 8 }}>
                    {title}
                </div>
                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.7 }}>
                    {description}
                </div>
            </div>

            <div
                style={{
                    marginTop: 18,
                    alignSelf: "flex-start",
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(255,255,255,0.03)",
                    color: "#555",
                    fontSize: 11,
                    fontWeight: 600,
                }}
            >
                {cta}
            </div>
        </button>
    );
}

export default function AdminHubScreen({
    userId,
    onBack,
    notificationSettings,
    onNotificationSettingsChange,
}: Props) {
    const [activeView, setActiveView] = useState<"overview" | "dashboard">("overview");
    const [ttsUsage, setTtsUsage] = useState<TtsUsageSnapshot | null>(null);
    const [ttsUsageLoading, setTtsUsageLoading] = useState(true);
    const [ttsUsageError, setTtsUsageError] = useState<string | null>(null);

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

    const usagePercent = ttsUsage?.totalCredits
        ? Math.min(100, Math.round((ttsUsage.usedCredits / ttsUsage.totalCredits) * 100))
        : 0;

    if (activeView === "dashboard") {
        return <AdminDashboard userId={userId} onBack={() => setActiveView("overview")} />;
    }

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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icons.sidebar.admin size={16} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#F0EDE8" }}>Admin Hub</span>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 32px" }}>
                <div style={{ maxWidth: 1080, margin: "0 auto" }}>
                    <div
                        style={{
                            background: "linear-gradient(180deg, rgba(232,98,42,0.08), rgba(255,255,255,0.02))",
                            border: "1px solid rgba(232,98,42,0.16)",
                            borderRadius: 22,
                            padding: "22px 22px 20px",
                            marginBottom: 18,
                        }}
                    >
                        <div style={{ fontSize: 10, color: "#E8622A", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>
                            Internal Control Panel
                        </div>
                        <div style={{ fontSize: "clamp(30px, 5vw, 42px)", lineHeight: 1, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 12 }}>
                            Foundry Admin Hub
                        </div>
                        <div style={{ fontSize: 14, color: "#A8A4A0", lineHeight: 1.75, maxWidth: 760 }}>
                            This is the internal workspace for account operations, retention oversight, subscription handling, founding-member controls, and notification policy.
                        </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 20, marginBottom: 18 }}>
                        <div style={{ fontSize: 10, color: "#F5A843", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>
                            Voice Usage
                        </div>
                        <div style={{ fontSize: 24, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 10 }}>
                            ElevenLabs credits
                        </div>
                        <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.75, maxWidth: 720, marginBottom: 18 }}>
                            Internal visibility for the owner account only. Voice generation charges route through the configured ElevenLabs workspace and the active voice is shown here.
                        </div>

                        {ttsUsageLoading ? (
                            <div style={{ fontSize: 13, color: "#888" }}>Loading ElevenLabs usage...</div>
                        ) : ttsUsageError ? (
                            <div style={{ display: "grid", gap: 12 }}>
                                <div style={{ fontSize: 13, color: "#D28B76", lineHeight: 1.7 }}>{ttsUsageError}</div>
                                <div>
                                    <button
                                        onClick={() => void refreshTtsUsage()}
                                        style={{
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
                            </div>
                        ) : ttsUsage ? (
                            <div style={{ display: "grid", gap: 14 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                                    <ControlCard label="Current voice" hint="Resolved server-side for TTS playback." control={<ValuePill value={ttsUsage.currentVoiceName || "Not set"} accent="#F5A843" />} />
                                    <ControlCard label="Plan / status" hint="Current ElevenLabs subscription state." control={<ValuePill value={`${ttsUsage.tier} · ${ttsUsage.status}`} accent="#63B3ED" />} />
                                    <ControlCard label="Credits remaining" hint="Remaining monthly credits in the active cycle." control={<ValuePill value={formatNumber(ttsUsage.remainingCredits)} accent="#4CAF8A" />} />
                                    <ControlCard label="Credits used" hint="Credits consumed this billing cycle." control={<ValuePill value={`${formatNumber(ttsUsage.usedCredits)} / ${formatNumber(ttsUsage.totalCredits)}`} accent="#E8622A" />} />
                                </div>

                                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 16 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                                        <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 600 }}>Usage this cycle</div>
                                        <div style={{ fontSize: 11, color: "#888" }}>
                                            Reset: {formatResetDate(ttsUsage.resetAtUnix)}
                                        </div>
                                    </div>
                                    <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.05)", overflow: "hidden", marginBottom: 8 }}>
                                        <div style={{ width: `${usagePercent}%`, height: "100%", background: "linear-gradient(90deg, #E8622A, #F5A843)" }} />
                                    </div>
                                    <div style={{ fontSize: 11, color: "#888", lineHeight: 1.7 }}>
                                        {usagePercent}% of the current credit allocation has been used. Voice slots: {ttsUsage.voiceSlotsUsed ?? 0}/{ttsUsage.voiceLimit ?? 0}.
                                    </div>
                                </div>

                                <div>
                                    <button
                                        onClick={() => void refreshTtsUsage()}
                                        style={{
                                            padding: "9px 14px",
                                            borderRadius: 10,
                                            border: "1px solid rgba(255,255,255,0.08)",
                                            background: "rgba(255,255,255,0.03)",
                                            color: "#C8C4BE",
                                            fontSize: 12,
                                            cursor: "pointer",
                                        }}
                                    >
                                        Refresh Usage
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 20, marginBottom: 18 }}>
                        <div style={{ fontSize: 10, color: "#63B3ED", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>
                            Notification Controls
                        </div>
                        <div style={{ fontSize: 24, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 10 }}>
                            Global notification behavior
                        </div>
                        <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.75, maxWidth: 720, marginBottom: 18 }}>
                            These controls govern when Foundry can trigger re-engagement reminders across the product. User-level preferences are still respected before anything is sent.
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                            <ControlCard
                                label="Re-engagement system"
                                hint="Master switch for inactivity reminders."
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
                                label="Inactivity threshold"
                                hint="Number of inactive days before a user becomes eligible."
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
                                label="Max reminders per user"
                                hint="Maximum reminders in the active cooldown window."
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
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14 }}>
                        {ADMIN_SECTIONS.map((section) => (
                            <AdminCard
                                key={section.title}
                                title={section.title}
                                description={section.description}
                                accent={section.accent}
                                cta={section.cta}
                                onClick={section.action === "dashboard" ? () => setActiveView("dashboard") : undefined}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ValuePill({ value, accent }: { value: string; accent: string }) {
    return (
        <div
            style={{
                alignSelf: "flex-start",
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${accent}28`,
                background: `${accent}14`,
                color: accent,
                fontSize: 12,
                fontWeight: 700,
            }}
        >
            {value}
        </div>
    );
}

function ControlCard({
    label,
    hint,
    control,
}: {
    label: string;
    hint: string;
    control: ReactNode;
}) {
    return (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 16 }}>
            <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 12, color: "#888", lineHeight: 1.7, marginBottom: 12 }}>{hint}</div>
            {control}
        </div>
    );
}

function ToggleButton({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                minWidth: 72,
                padding: "10px 14px",
                borderRadius: 999,
                border: enabled ? "1px solid rgba(76,175,138,0.32)" : "1px solid rgba(255,255,255,0.08)",
                background: enabled ? "rgba(76,175,138,0.14)" : "rgba(255,255,255,0.03)",
                color: enabled ? "#4CAF8A" : "#888",
                fontSize: 11,
                fontWeight: 700,
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
                width: 110,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: "10px 12px",
                color: "#F0EDE8",
                fontSize: 12,
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

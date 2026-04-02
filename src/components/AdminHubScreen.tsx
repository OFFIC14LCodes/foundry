import { Icons } from "../icons";

interface Props {
    onBack: () => void;
    onOpenUserManagement: () => void;
}

const ADMIN_SECTIONS = [
    {
        title: "User Management",
        description: "Review accounts, inspect workspace history, and move into detailed user operations.",
        accent: "#E8622A",
        cta: "Open user controls",
        action: "user-management",
    },
    {
        title: "Subscription Status",
        description: "Track active, canceled, trial, and past-due states across the Foundry customer base.",
        accent: "#63B3ED",
        cta: "Billing visibility placeholder",
        action: null,
    },
    {
        title: "Comped / Family Access",
        description: "Manage manually granted accounts, family access, and gifted access rules in one place.",
        accent: "#9B7FE8",
        cta: "Comp controls placeholder",
        action: null,
    },
    {
        title: "Suspend / Reactivate",
        description: "Handle restricted accounts safely with clear escalation and reactivation controls.",
        accent: "#F5A843",
        cta: "Access actions placeholder",
        action: null,
    },
    {
        title: "Churn Tracking",
        description: "Track win-back notes, retention state, and account health signals for founder support.",
        accent: "#48BB78",
        cta: "Retention workspace placeholder",
        action: null,
    },
    {
        title: "Stripe / Webhooks",
        description: "Monitor billing sync, Stripe lifecycle events, and webhook health as that layer expands.",
        accent: "#38BDF8",
        cta: "Payments ops placeholder",
        action: null,
    },
    {
        title: "Founding Member Controls",
        description: "Manage founding pricing, OG Founder status, and future early-access entitlements cleanly.",
        accent: "#C8A96E",
        cta: "Founding controls placeholder",
        action: null,
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
        <div
            style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 18,
                padding: 18,
                minHeight: 170,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
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
                <div style={{ fontSize: 18, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 8 }}>
                    {title}
                </div>
                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.7 }}>
                    {description}
                </div>
            </div>

            <button
                onClick={onClick}
                disabled={!onClick}
                style={{
                    marginTop: 18,
                    alignSelf: "flex-start",
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: onClick ? `1px solid ${accent}30` : "1px solid rgba(255,255,255,0.07)",
                    background: onClick ? `${accent}14` : "rgba(255,255,255,0.03)",
                    color: onClick ? accent : "#555",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: onClick ? "pointer" : "default",
                }}
            >
                {cta}
            </button>
        </div>
    );
}

export default function AdminHubScreen({ onBack, onOpenUserManagement }: Props) {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 180,
                background: "#080809",
                color: "#F0EDE8",
                fontFamily: "'DM Sans', sans-serif",
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
                        <div style={{ fontSize: "clamp(30px, 5vw, 42px)", lineHeight: 1, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 12 }}>
                            Foundry Admin Hub
                        </div>
                        <div style={{ fontSize: 14, color: "#A8A4A0", lineHeight: 1.75, maxWidth: 760 }}>
                            This is the internal workspace for account operations, retention oversight, subscription handling, and founding-member controls. It is structured as the central home for current and future admin systems.
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
                                onClick={section.action === "user-management" ? onOpenUserManagement : undefined}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

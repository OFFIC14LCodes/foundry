import { House, Archive, Zap, Map, BarChart3 } from "lucide-react";
import { Icons } from "../icons";
import Logo from "./Logo";
import type { ReactNode } from "react";

interface NavSidebarProps {
    open: boolean;
    onClose: () => void;
    profile: any;
    isAdmin?: boolean;
    cofounderUnreadCount?: number;
    onOpenHub: () => void;
    onOpenForge: () => void;
    onOpenAcademy: () => void;
    onOpenJournal: () => void;
    onOpenBriefings: () => void;
    onOpenPitchPractice: () => void;
    onOpenMarketIntel: () => void;
    onOpenDocuments: () => void;
    onOpenBusinessModelCanvas: () => void;
    onOpenActionCenter: () => void;
    onOpenFinancialDashboard: () => void;
    onOpenArchive: () => void;
    onOpenCofounder: () => void;
    onOpenSettings: () => void;
    onOpenAdminHub?: () => void;
}

function NavItem({
    icon,
    label,
    onClick,
    badge,
    description,
    emphasis = "normal",
}: {
    icon: ReactNode;
    label: string;
    onClick: () => void;
    badge?: number;
    description?: string;
    emphasis?: "primary" | "normal" | "muted";
}) {
    const isPrimary = emphasis === "primary";
    return (
        <button
            onClick={onClick}
            className="foundry-interactive"
            style={{
                width: "100%",
                display: "flex",
                alignItems: description ? "flex-start" : "center",
                gap: 11,
                padding: isPrimary ? "12px 14px" : "9px 16px",
                background: isPrimary ? "rgba(232,98,42,0.075)" : "transparent",
                border: isPrimary ? "1px solid rgba(232,98,42,0.14)" : "none",
                borderLeft: isPrimary ? "2px solid rgba(232,98,42,0.55)" : "2px solid transparent",
                borderRadius: isPrimary ? 12 : 0,
                color: isPrimary ? "var(--foundry-text-primary)" : emphasis === "muted" ? "rgba(168,164,160,0.72)" : "var(--foundry-text-secondary)",
                fontSize: isPrimary ? 13 : 12,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontWeight: isPrimary ? 750 : 650,
                transition: "color 0.15s, background 0.15s",
                position: "relative",
                boxSizing: "border-box",
                margin: isPrimary ? "0 10px 8px" : 0,
            }}
            onMouseEnter={e => {
                e.currentTarget.style.color = "#F0EDE8";
                e.currentTarget.style.background = isPrimary ? "rgba(232,98,42,0.11)" : "rgba(255,255,255,0.04)";
            }}
            onMouseLeave={e => {
                e.currentTarget.style.color = isPrimary ? "var(--foundry-text-primary)" : emphasis === "muted" ? "rgba(168,164,160,0.72)" : "var(--foundry-text-secondary)";
                e.currentTarget.style.background = isPrimary ? "rgba(232,98,42,0.075)" : "transparent";
            }}
        >
            <span style={{ width: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: isPrimary ? 0.95 : 0.68, marginTop: description ? 1 : 0 }}>
                {icon}
            </span>
            <span style={{ flex: 1, display: "grid", gap: 2 }}>
                <span>{label}</span>
                {description && (
                    <span style={{ color: "rgba(189,175,162,0.68)", fontSize: 10, lineHeight: 1.45, fontWeight: 500 }}>
                        {description}
                    </span>
                )}
            </span>
            {badge ? (
                <span style={{
                    background: "#E8622A",
                    color: "#fff",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    fontFamily: "'DM Sans', sans-serif",
                    lineHeight: 1.5,
                }}>
                    {badge}
                </span>
            ) : null}
        </button>
    );
}

function NavSection({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div style={{ padding: "8px 0" }}>
            <div style={{
                padding: "0 16px 7px",
                color: "rgba(255,255,255,0.36)",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontWeight: 800,
            }}>
                {label}
            </div>
            {children}
        </div>
    );
}

export default function NavSidebar({
    open,
    onClose,
    profile,
    isAdmin,
    cofounderUnreadCount = 0,
    onOpenHub,
    onOpenForge,
    onOpenAcademy,
    onOpenJournal,
    onOpenBriefings,
    onOpenPitchPractice,
    onOpenMarketIntel,
    onOpenDocuments,
    onOpenBusinessModelCanvas,
    onOpenActionCenter,
    onOpenFinancialDashboard,
    onOpenArchive,
    onOpenCofounder,
    onOpenSettings,
    onOpenAdminHub,
}: NavSidebarProps) {
    const ChatIcon = Icons.sidebar.chatRoom;
    const AcademyIcon = Icons.sidebar.academy;
    const JournalIcon = Icons.sidebar.journal;
    const BriefingsIcon = Icons.sidebar.briefings;
    const PitchIcon = Icons.sidebar.pitchPractice;
    const MarketIcon = Icons.sidebar.marketIntel;
    const DocsIcon = Icons.sidebar.documents;
    const CofounderIcon = Icons.sidebar.cofounder;
    const SettingsIcon = Icons.sidebar.settings;
    const AdminIcon = Icons.sidebar.admin;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 300,
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(4px)",
                    opacity: open ? 1 : 0,
                    pointerEvents: open ? "auto" : "none",
                    transition: "opacity 0.25s ease",
                }}
            />

            {/* Panel */}
            <div style={{
                position: "fixed",
                top: 0,
                left: 0,
                bottom: 0,
                width: 272,
                zIndex: 301,
                    background: "var(--foundry-surface-primary)",
                borderRight: "1px solid rgba(255,255,255,0.08)",
                transform: open ? "translateX(0)" : "translateX(-100%)",
                transition: "transform 0.32s cubic-bezier(0.16,1,0.3,1)",
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
            }}>
                {/* Header */}
                <div style={{
                    padding: "max(16px, calc(12px + env(safe-area-inset-top))) 16px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexShrink: 0,
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Logo variant="flame" style={{ width: 16, height: 16, objectFit: "contain" }} />
                        <span style={{ fontSize: 15, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "var(--foundry-text-primary)" }}>Foundry</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="foundry-btn foundry-btn--ghost"
                        style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 6,
                            padding: "5px 10px",
                            color: "#666",
                            fontSize: 11,
                            cursor: "pointer",
                            fontFamily: "'DM Sans', sans-serif",
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Business info */}
                {profile && (
                    <div style={{ padding: "12px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "var(--foundry-text-primary)", lineHeight: 1.2, marginBottom: 2 }}>
                            {profile.businessName || (profile.idea ? profile.idea.slice(0, 32) + (profile.idea.length > 32 ? "…" : "") : "Your Business")}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", fontFamily: "'DM Sans', sans-serif" }}>
                            {profile.strategyLabel || `Stage ${profile.currentStage}`}
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
                    <NavSection label="Primary">
                        <NavItem
                            icon={<House size={16} />}
                            label="Hub"
                            description="Your daily direction"
                            onClick={onOpenHub}
                            emphasis="primary"
                        />
                        <NavItem
                            icon={<ChatIcon size={16} />}
                            label="Forge"
                            description="Think, decide, execute"
                            onClick={onOpenForge}
                            emphasis="primary"
                        />
                        <NavItem
                            icon={<AcademyIcon size={16} />}
                            label="Academy"
                            description="Learn the next founder skill"
                            onClick={onOpenAcademy}
                            emphasis="primary"
                        />
                    </NavSection>

                    <NavSection label="Execution">
                        <NavItem
                            icon={<Zap size={16} />}
                            label="Actions"
                            onClick={onOpenActionCenter}
                        />
                        <NavItem
                            icon={<Map size={16} />}
                            label="Business Model Canvas"
                            onClick={onOpenBusinessModelCanvas}
                        />
                        <NavItem
                            icon={<MarketIcon size={16} />}
                            label="Market Research"
                            onClick={onOpenMarketIntel}
                        />
                        <NavItem
                            icon={<BriefingsIcon size={16} />}
                            label="Briefings"
                            onClick={onOpenBriefings}
                        />
                        <NavItem
                            icon={<BarChart3 size={16} />}
                            label="Financials"
                            onClick={onOpenFinancialDashboard}
                        />
                        <NavItem
                            icon={<CofounderIcon size={16} />}
                            label="Cofounder Mode"
                            onClick={onOpenCofounder}
                            badge={cofounderUnreadCount > 0 ? cofounderUnreadCount : undefined}
                        />
                    </NavSection>

                    <NavSection label="Support">
                        <NavItem
                            icon={<DocsIcon size={16} />}
                            label="Documents"
                            onClick={onOpenDocuments}
                            emphasis="muted"
                        />
                        <NavItem
                            icon={<PitchIcon size={16} />}
                            label="Pitch Practice"
                            onClick={onOpenPitchPractice}
                            emphasis="muted"
                        />
                        <NavItem
                            icon={<JournalIcon size={16} />}
                            label="Journal"
                            onClick={onOpenJournal}
                            emphasis="muted"
                        />
                        <NavItem
                            icon={<Archive size={16} />}
                            label="Archive"
                            onClick={onOpenArchive}
                            emphasis="muted"
                        />
                    </NavSection>
                </div>

                {/* Footer */}
                <div style={{ padding: "8px 0 max(16px, calc(12px + env(safe-area-inset-bottom)))", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                    {isAdmin && onOpenAdminHub && (
                        <NavItem
                            icon={<AdminIcon size={16} />}
                            label="Admin Hub"
                            onClick={onOpenAdminHub}
                        />
                    )}
                    <NavItem
                        icon={<SettingsIcon size={16} />}
                        label="Settings"
                        onClick={onOpenSettings}
                    />
                </div>
            </div>
        </>
    );
}

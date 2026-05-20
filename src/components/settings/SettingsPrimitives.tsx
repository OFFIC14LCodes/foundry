import type { ReactNode } from "react";
import HelpTooltip from "../HelpTooltip";

type SettingsScreenShellProps = {
    title: string;
    subtitle?: string;
    onBack: () => void;
    children: ReactNode;
    footer?: ReactNode;
};

export function SettingsScreenShell({
    title,
    subtitle,
    onBack,
    children,
    footer,
}: SettingsScreenShellProps) {
    return (
        <div style={{ minHeight: "100vh", background: "var(--foundry-bg-app)", color: "var(--foundry-text-primary)", fontFamily: "var(--tekori-font-ui)" }}>
            <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(255,252,246,0.94)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--foundry-border-subtle)" }}>
                <div className="foundry-page settings-shell__header" style={{ paddingTop: "max(18px, calc(10px + env(safe-area-inset-top)))", paddingBottom: 18 }}>
                    <div className="settings-shell__title">
                        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                            <div style={{ fontSize: 24, fontFamily: "var(--tekori-font-ui)", fontWeight: 600, color: "var(--color-text)" }}>{title}</div>
                            {subtitle && <HelpTooltip content={subtitle} side="bottom" />}
                        </div>
                    </div>
                    <button
                        className="settings-shell__back foundry-btn foundry-btn--ghost"
                        onClick={onBack}
                        style={{ padding: "9px 14px", fontSize: 12 }}
                    >
                        Back
                    </button>
                </div>
            </div>

            <div className="foundry-page" style={{ paddingTop: 28, paddingBottom: 48 }}>
                {children}
                {footer && <div style={{ marginTop: 26 }}>{footer}</div>}
            </div>
        </div>
    );
}

type SettingsSectionProps = {
    title: string;
    description?: string;
    children: ReactNode;
};

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
    return (
        <section style={{ marginBottom: 18 }}>
            <div className="settings-section-heading">
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 16, fontFamily: "var(--tekori-font-ui)", fontWeight: 600, color: "var(--color-text)" }}>{title}</div>
                    {description && <HelpTooltip content={description} />}
                </div>
            </div>
            {children}
        </section>
    );
}

type SettingsCardProps = {
    children: ReactNode;
};

export function SettingsCard({ children }: SettingsCardProps) {
    return (
        <div className="settings-card foundry-module-card" style={{ padding: 18 }}>
            {children}
        </div>
    );
}

type SettingsRowProps = {
    label: string;
    value?: ReactNode;
    hint?: string;
    action?: ReactNode;
};

export function SettingsRow({ label, value, hint, action }: SettingsRowProps) {
    return (
        <div className="settings-row">
            <div className="settings-row__copy">
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 500 }}>{label}</div>
                    {hint && <HelpTooltip content={hint} />}
                </div>
            </div>
            <div className="settings-row__value">
                {action ?? <div style={{ fontSize: 13, color: "var(--color-text-soft)" }}>{value ?? "Not set"}</div>}
            </div>
        </div>
    );
}

export function SettingsButton({
    children,
    onClick,
    tone = "default",
    disabled = false,
}: {
    children: ReactNode;
    onClick?: () => void;
    tone?: "default" | "primary" | "danger";
    disabled?: boolean;
}) {
    const className = tone === "primary"
        ? "foundry-btn foundry-btn--primary"
        : tone === "danger"
            ? "foundry-btn foundry-btn--danger"
            : "foundry-btn foundry-btn--secondary";

    return (
        <button
            className={className}
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: "10px 14px",
                fontSize: 12,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1,
            }}
        >
            {children}
        </button>
    );
}

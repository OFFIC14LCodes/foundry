import type { ReactNode } from "react";

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
        <div style={{ minHeight: "100vh", background: "#080809", color: "#F0EDE8", fontFamily: "'Lora', Georgia, serif" }}>
            <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(8,8,9,0.94)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="foundry-page settings-shell__header" style={{ paddingTop: "max(18px, calc(10px + env(safe-area-inset-top)))", paddingBottom: 18 }}>
                    <div className="settings-shell__title">
                        <div style={{ fontSize: 24, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>{title}</div>
                        {subtitle && <div style={{ margin: "4px auto 0", fontSize: 13, color: "#7C7770", maxWidth: 680 }}>{subtitle}</div>}
                    </div>
                    <button
                        className="settings-shell__back"
                        onClick={onBack}
                        style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#C8C4BE", fontSize: 12, cursor: "pointer" }}
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
                <div style={{ fontSize: 16, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>{title}</div>
                {description && <div style={{ marginTop: 3, fontSize: 12, color: "#6B665F", lineHeight: 1.6 }}>{description}</div>}
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
        <div className="settings-card" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 18 }}>
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
                <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 500 }}>{label}</div>
                {hint && <div style={{ marginTop: 4, fontSize: 12, color: "#6B665F", lineHeight: 1.6 }}>{hint}</div>}
            </div>
            <div className="settings-row__value">
                {action ?? <div style={{ fontSize: 13, color: "#C8C4BE" }}>{value ?? "Not set"}</div>}
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
    const styles = tone === "primary"
        ? { background: "linear-gradient(135deg, #E8622A, #c9521e)", color: "#fff", border: "none" }
        : tone === "danger"
            ? { background: "rgba(166,59,36,0.18)", color: "#F5C0B3", border: "1px solid rgba(166,59,36,0.35)" }
            : { background: "rgba(255,255,255,0.03)", color: "#D8D2C8", border: "1px solid rgba(255,255,255,0.08)" };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: "10px 14px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1,
                ...styles,
            }}
        >
            {children}
        </button>
    );
}

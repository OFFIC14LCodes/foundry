type BillingReturnScreenProps = {
    mode: "success" | "cancelled";
    isProvisioning: boolean;
    accessReady: boolean;
    message?: string | null;
    onContinue: () => void;
    onRefresh: () => void;
};

export default function BillingReturnScreen({
    mode,
    isProvisioning,
    accessReady,
    message,
    onContinue,
    onRefresh,
}: BillingReturnScreenProps) {
    const title = mode === "success"
        ? (accessReady ? "Subscription active" : "Finalizing your subscription")
        : "Checkout canceled";

    const body = mode === "success"
        ? accessReady
            ? "Your paid Tekori access is active. You can continue into paid stages immediately."
            : "Stripe checkout completed. Tekori is waiting for the webhook-backed subscription state to finish syncing."
        : "No billing changes were made. Stage 1 remains available, and you can reopen pricing whenever you are ready.";

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "var(--color-bg-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                fontFamily: "var(--tekori-font-ui)",
                color: "var(--color-text)",
            }}
        >
            <div
                style={{
                    width: "100%",
                    maxWidth: 520,
                    textAlign: "center",
                    background: "linear-gradient(180deg, rgba(7,26,47,0.03), rgba(7,26,47,0.02))",
                    border: "1px solid rgba(7,26,47,0.08)",
                    borderRadius: 24,
                    padding: "28px 24px",
                }}
            >
                <div style={{ fontSize: 11, color: mode === "success" ? "var(--tekori-gold)" : "var(--color-text-muted)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 10 }}>
                    Billing
                </div>
                <div style={{ fontSize: "clamp(28px, 7vw, 38px)", lineHeight: 1.02, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, marginBottom: 12 }}>
                    {title}
                </div>
                <div style={{ fontSize: 14, color: "var(--color-text-soft)", lineHeight: 1.75, marginBottom: 14 }}>
                    {body}
                </div>
                {message && (
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.7, marginBottom: 16 }}>
                        {message}
                    </div>
                )}
                {mode === "success" && isProvisioning && !accessReady && (
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 18 }}>
                        Checking subscription state...
                    </div>
                )}
                <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                    {mode === "success" && !accessReady && (
                        <button
                            onClick={onRefresh}
                            style={{
                                padding: "10px 14px",
                                borderRadius: 12,
                                border: "1px solid rgba(7,26,47,0.1)",
                                background: "rgba(7,26,47,0.04)",
                                color: "#D8D2C8",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            Refresh status
                        </button>
                    )}
                    <button
                        onClick={onContinue}
                        style={{
                            padding: "10px 16px",
                            borderRadius: 12,
                            border: "none",
                            background: "linear-gradient(135deg, var(--tekori-gold), var(--tekori-soft-gold))",
                            color: "var(--color-primary)",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        {mode === "success" ? "Continue to Settings" : "Return to Pricing"}
                    </button>
                </div>
            </div>
        </div>
    );
}

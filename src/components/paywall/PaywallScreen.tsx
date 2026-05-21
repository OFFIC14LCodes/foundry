import { useMemo, useState } from "react";
import {
    BILLING_PLANS,
    FOUNDING_PRICING,
    REFUND_POLICY,
    SUPPORT_EMAIL,
    TEAM_SEAT_ADDON,
    formatAnnualSavings,
    formatUsd,
    getPlanPriceCents,
    getTeamSeatPriceCents,
    type BillingInterval,
} from "../../config/pricing";
import { beginCheckout } from "../../lib/billing";
import type { AccountAccess } from "../../lib/accessGate";
import { getAccessSummary, getEffectivePricingMode, getPaidStageBlockNote, getPaywallEntryMessage, hasLockedFoundingPricing } from "../../lib/foundryAccess";
import { Icons } from "../../icons";

interface Props {
    open: boolean;
    targetStage: number;
    access: AccountAccess | null;
    onManageSubscription: () => void;
    billingMessage: string | null;
    onClose: () => void;
}

function PriceLine({
    standardCents,
    foundingCents,
    useFounding,
    interval,
}: {
    standardCents: number;
    foundingCents: number | null;
    useFounding: boolean;
    interval: BillingInterval;
}) {
    const intervalLabel = interval === "yearly" ? "/year" : "/month";

    if (useFounding && foundingCents !== null) {
        return (
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 28, fontFamily: "var(--tekori-font-ui)", fontWeight: 700, color: "var(--color-text)" }}>
                    {formatUsd(foundingCents)}
                </span>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{intervalLabel}</span>
                <span style={{ fontSize: 11, color: "var(--tekori-slate)", textDecoration: "line-through" }}>
                    {formatUsd(standardCents)}
                </span>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 28, fontFamily: "var(--tekori-font-ui)", fontWeight: 700, color: "var(--color-text)" }}>
                {formatUsd(standardCents)}
            </span>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{intervalLabel}</span>
        </div>
    );
}

function PlanCard({
    planId,
    isCurrent,
    useFounding,
    interval,
    extraSeats,
    onSelect,
}: {
    planId: "starter" | "pro";
    isCurrent: boolean;
    useFounding: boolean;
    interval: BillingInterval;
    extraSeats: number;
    onSelect: (planId: "starter" | "pro") => void;
}) {
    const plan = BILLING_PLANS[planId];
    const seatTotal = getTeamSeatPriceCents(useFounding ? "founding" : "standard") * extraSeats;
    const total = getPlanPriceCents(planId, useFounding ? "founding" : "standard", interval) + seatTotal;
    const standardMonthly = plan.prices.standard.monthly;
    const standardYearly = plan.prices.standard.yearly;

    return (
        <div
            className="foundry-module-card foundry-panel-in"
            style={{
                flex: 1,
                minWidth: 260,
                textAlign: "center",
                background: planId === "pro"
                    ? "linear-gradient(180deg, rgba(216,155,43,0.085), rgba(7,26,47,0.024))"
                    : "rgba(7,26,47,0.024)",
                border: planId === "pro"
                    ? "1px solid rgba(216,155,43,0.18)"
                    : "1px solid rgba(7,26,47,0.065)",
                borderRadius: 14,
                padding: 20,
                boxShadow: planId === "pro" ? "0 14px 34px rgba(16,32,51,0.10)" : "none",
            }}
        >
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 10, marginBottom: 12, alignItems: "center" }}>
                <div>
                    <div style={{ fontSize: 11, color: planId === "pro" ? "var(--tekori-gold)" : "var(--color-text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
                        {plan.shortLabel}
                    </div>
                    <div style={{ fontSize: 20, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, color: "var(--color-text)" }}>
                        {plan.headline}
                    </div>
                </div>
                {planId === "pro" && (
                    <div style={{ fontSize: 10, color: "var(--tekori-gold)", background: "rgba(244,199,106,0.14)", border: "1px solid rgba(244,199,106,0.28)", borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>
                        Premium
                    </div>
                )}
            </div>

            <PriceLine
                standardCents={plan.prices.standard[interval]}
                foundingCents={plan.prices.founding[interval] ?? null}
                useFounding={useFounding}
                interval={interval}
            />

            <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6, marginTop: 10 }}>
                {plan.tagline}
            </div>

            {interval === "yearly" && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--color-success)" }}>
                    {formatAnnualSavings(standardMonthly, standardYearly)}
                </div>
            )}

            {extraSeats > 0 && (
                <div style={{ marginTop: 10, fontSize: 12, color: "var(--color-text-soft)" }}>
                    With {extraSeats} extra {extraSeats === 1 ? "seat" : "seats"}: {formatUsd(total)} / {interval === "yearly" ? "year" : "month"}
                </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16, alignItems: "center" }}>
                {plan.featureHighlights.map((feature) => (
                    <div key={feature} style={{ display: "flex", gap: 8, alignItems: "flex-start", justifyContent: "center", fontSize: 12, color: "var(--color-text-soft)", lineHeight: 1.5, textAlign: "center" }}>
                        <Icons.forge.check size={14} />
                        <span>{feature}</span>
                    </div>
                ))}
            </div>

            <button
                onClick={() => onSelect(planId)}
                disabled={isCurrent}
                className={`foundry-btn ${planId === "pro" ? "foundry-btn--primary" : "foundry-btn--secondary"}`}
                style={{
                    width: "100%",
                    marginTop: 18,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: isCurrent ? "1px solid rgba(7,26,47,0.08)" : "none",
                    background: isCurrent
                        ? "rgba(7,26,47,0.04)"
                        : planId === "pro"
                            ? "linear-gradient(135deg, var(--tekori-gold), var(--tekori-soft-gold))"
                            : "rgba(7,26,47,0.055)",
                    color: isCurrent ? "var(--color-text-muted)" : planId === "pro" ? "var(--color-primary)" : "var(--color-text)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: isCurrent ? "default" : "pointer",
                }}
            >
                {isCurrent ? "Current plan" : `Choose ${plan.name}`}
            </button>
        </div>
    );
}

export default function PaywallScreen({ open, targetStage, access, onManageSubscription, billingMessage, onClose }: Props) {
    const [extraSeats, setExtraSeats] = useState(0);
    const [message, setMessage] = useState("");
    const [interval, setInterval] = useState<BillingInterval>("monthly");
    const [loadingPlan, setLoadingPlan] = useState<null | "starter" | "pro">(null);
    const accessSummary = useMemo(() => getAccessSummary(access), [access]);
    const pricingMode = getEffectivePricingMode(access);
    const foundingVisible = pricingMode === "founding";
    const foundingLocked = hasLockedFoundingPricing(access);

    if (!open) return null;

    const handleSelectPlan = async (planId: "starter" | "pro") => {
        setLoadingPlan(planId);
        const result = await beginCheckout({
            planId,
            pricingMode,
            interval,
            extraSeats,
            source: "stage_gate",
        });
        setLoadingPlan(null);
        setMessage(result.message);
    };

    const extraSeatPrice = getTeamSeatPriceCents(pricingMode);
    const currentPaidPlan = access?.plan_type === "starter" || access?.plan_type === "pro";

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(7,26,47,0.42)", backdropFilter: "blur(14px)", display: "flex", justifyContent: "center", overflowY: "auto" }}>
            <div style={{ width: "100%", maxWidth: 1120, padding: "32px 20px 56px" }}>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 16, alignItems: "center", marginBottom: 24, textAlign: "center" }}>
                    <div style={{ maxWidth: 700 }}>
                        <div style={{ fontSize: 11, color: "var(--tekori-gold)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 10 }}>
                            Unlock Stage {targetStage}
                        </div>
                        <div style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 1, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, color: "var(--color-text)", marginBottom: 12 }}>
                            Continue the build. Step into execution.
                        </div>
                        <div style={{ fontSize: 15, color: "var(--color-text-soft)", lineHeight: 1.7, maxWidth: 760 }}>
                            {getPaywallEntryMessage(targetStage)}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="foundry-btn foundry-btn--ghost"
                        style={{ background: "rgba(7,26,47,0.06)", border: "1px solid rgba(7,26,47,0.1)", borderRadius: 12, padding: "10px 14px", color: "var(--color-text-soft)", fontSize: 12, cursor: "pointer", height: "fit-content" }}
                    >
                        Close
                    </button>
                </div>

                <div className="foundry-paywall-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(300px, 0.7fr)", gap: 18, alignItems: "start" }}>
                    <div>
                        <div className="foundry-command-panel" style={{ padding: 22, marginBottom: 18, textAlign: "center" }}>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, justifyContent: "center" }}>
                                <div style={{ fontSize: 11, color: "var(--tekori-gold)", background: "rgba(244,199,106,0.14)", border: "1px solid rgba(244,199,106,0.28)", borderRadius: 999, padding: "5px 10px" }}>
                                    Stage 1 remains free
                                </div>
                                {foundingVisible && (
                                    <div style={{ fontSize: 11, color: "var(--tekori-gold)", background: "rgba(244,199,106,0.14)", border: "1px solid rgba(244,199,106,0.28)", borderRadius: 999, padding: "5px 10px" }}>
                                        {foundingLocked ? FOUNDING_PRICING.lockedBadge : FOUNDING_PRICING.badge}
                                    </div>
                                )}
                            </div>

                            <div style={{ fontSize: 15, fontFamily: "var(--tekori-font-ui)", color: "var(--color-text)", marginBottom: 8 }}>
                                Why payment starts at Stage 2
                            </div>
                            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
                                Tekori opens freely in Stage 1 so founders can think clearly, pressure-test the problem, and decide whether they are serious. Stage 2 is where the real build begins: model decisions, execution structure, premium tools, and the full journey beyond the idea phase.
                            </div>
                            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                                {(["monthly", "yearly"] as BillingInterval[]).map((value) => (
                                    <button
                                        key={value}
                                        onClick={() => setInterval(value)}
                                        style={{
                                            padding: "9px 14px",
                                            borderRadius: 999,
                                            border: interval === value ? "1px solid rgba(216,155,43,0.35)" : "1px solid rgba(7,26,47,0.08)",
                                            background: interval === value ? "rgba(216,155,43,0.14)" : "rgba(7,26,47,0.03)",
                                            color: interval === value ? "var(--color-text)" : "var(--color-text-muted)",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {value === "monthly" ? "Monthly" : "Yearly"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            <PlanCard
                                planId="starter"
                                isCurrent={access?.plan_type === "starter"}
                                useFounding={foundingVisible}
                                interval={interval}
                                extraSeats={extraSeats}
                                onSelect={handleSelectPlan}
                            />
                            <PlanCard
                                planId="pro"
                                isCurrent={access?.plan_type === "pro"}
                                useFounding={foundingVisible}
                                interval={interval}
                                extraSeats={extraSeats}
                                onSelect={handleSelectPlan}
                            />
                        </div>

                        <div className="foundry-module-card" style={{ marginTop: 18, padding: 20, textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
                                Plan Comparison
                            </div>
                            <div className="foundry-plan-comparison-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 8 }}>Free</div>
                                    {BILLING_PLANS.free.comparisonPoints.map((point) => (
                                        <div key={point} style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6, marginBottom: 6 }}>{point}</div>
                                    ))}
                                </div>
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 12, color: "var(--color-text)", marginBottom: 8 }}>Starter</div>
                                    {BILLING_PLANS.starter.comparisonPoints.map((point) => (
                                        <div key={point} style={{ fontSize: 12, color: "var(--color-text-soft)", lineHeight: 1.6, marginBottom: 6 }}>{point}</div>
                                    ))}
                                </div>
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ fontSize: 12, color: "var(--tekori-gold)", marginBottom: 8 }}>Pro</div>
                                    {BILLING_PLANS.pro.comparisonPoints.map((point) => (
                                        <div key={point} style={{ fontSize: 12, color: "var(--color-text-soft)", lineHeight: 1.6, marginBottom: 6 }}>{point}</div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div className="foundry-module-card" style={{ padding: 18, textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
                                Current Access
                            </div>
                            <div style={{ fontSize: 18, fontFamily: "var(--tekori-font-ui)", color: "var(--color-text)", marginBottom: 6 }}>
                                {accessSummary.planName} · {accessSummary.statusLabel}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
                                {accessSummary.note}
                            </div>
                            {accessSummary.badge && (
                                <div style={{ marginTop: 12, fontSize: 11, color: "var(--tekori-gold)", background: "rgba(244,199,106,0.12)", border: "1px solid rgba(244,199,106,0.24)", borderRadius: 999, padding: "5px 10px", display: "inline-block" }}>
                                    {accessSummary.badge}
                                </div>
                            )}
                        </div>

                        <div className="foundry-module-card" style={{ padding: 18, textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
                                Team Add-On
                            </div>
                            <div style={{ fontSize: 16, fontFamily: "var(--tekori-font-ui)", color: "var(--color-text)", marginBottom: 8 }}>
                                Build with a cofounder or team
                            </div>
                            <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.7, marginBottom: 14 }}>
                                {TEAM_SEAT_ADDON.description} {foundingVisible ? `Current rate: ${formatUsd(extraSeatPrice)}/month per added member.` : `Configured rate: ${formatUsd(extraSeatPrice)}/month per added member.`}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                <button
                                    onClick={() => setExtraSeats((value) => Math.max(0, value - 1))}
                                    style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(7,26,47,0.1)", background: "rgba(7,26,47,0.03)", color: "var(--color-text)", cursor: "pointer" }}
                                >
                                    -
                                </button>
                                <div style={{ flex: 1, textAlign: "center" }}>
                                    <div style={{ fontSize: 24, fontFamily: "var(--tekori-font-ui)", color: "var(--color-text)" }}>{extraSeats}</div>
                                    <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Extra seats</div>
                                </div>
                                <button
                                    onClick={() => setExtraSeats((value) => Math.min(10, value + 1))}
                                    style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(7,26,47,0.1)", background: "rgba(7,26,47,0.03)", color: "var(--color-text)", cursor: "pointer" }}
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="foundry-module-card" style={{ padding: 18, textAlign: "center" }}>
                            <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
                                Access Rules
                            </div>
                            <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
                                {getPaidStageBlockNote(access)}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.7, marginTop: 10 }}>
                                Your current access, cancellation window, and any granted plan updates are reflected automatically.
                            </div>
                            <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.7, marginTop: 10 }}>
                                Refund policy: {REFUND_POLICY.summary}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.7, marginTop: 6 }}>
                                Support: {SUPPORT_EMAIL}
                            </div>
                            {currentPaidPlan && (
                                <button
                                    onClick={onManageSubscription}
                                    className="foundry-btn foundry-btn--secondary"
                                    style={{
                                        marginTop: 14,
                                        padding: "10px 14px",
                                        borderRadius: 12,
                                        border: "1px solid rgba(7,26,47,0.1)",
                                        background: "rgba(7,26,47,0.04)",
                                        color: "var(--color-text)",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                    }}
                                >
                                    Manage existing subscription
                                </button>
                            )}
                        </div>

                        {(message || billingMessage) && (
                            <div className="foundry-module-card" style={{ padding: 18, fontSize: 12, color: "var(--color-text-soft)", lineHeight: 1.6, textAlign: "center" }}>
                                {loadingPlan ? "Preparing checkout..." : (message || billingMessage)}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

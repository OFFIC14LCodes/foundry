import { BILLING_PLANS, getPlanPriceCents, getTeamSeatPriceCents } from "../config/pricing";
import type { BillingPlanId, PricingMode } from "../config/pricing";

export interface CheckoutIntent {
    planId: Exclude<BillingPlanId, "free">;
    pricingMode: PricingMode;
    extraSeats: number;
    source: "stage_gate" | "manage_plan";
}

export interface CheckoutResult {
    ok: boolean;
    message: string;
}

export function getCheckoutPriceSummary(intent: CheckoutIntent): string {
    const base = getPlanPriceCents(intent.planId, intent.pricingMode);
    const seatTotal = getTeamSeatPriceCents(intent.pricingMode) * Math.max(0, intent.extraSeats);
    return `$${((base + seatTotal) / 100).toFixed(2)}/month`;
}

export function getCheckoutLink(intent: CheckoutIntent): string | null {
    const plan = BILLING_PLANS[intent.planId];
    return plan.checkoutLinks[intent.pricingMode] ?? null;
}

export async function beginCheckout(intent: CheckoutIntent): Promise<CheckoutResult> {
    const checkoutLink = getCheckoutLink(intent);
    if (!checkoutLink) {
        return {
            ok: false,
            message: `Checkout is not connected yet for ${BILLING_PLANS[intent.planId].name}. The paywall is wired and ready; add the hosted checkout URL to complete the flow.`,
        };
    }

    const url = new URL(checkoutLink, window.location.origin);
    url.searchParams.set("plan", intent.planId);
    url.searchParams.set("pricing_mode", intent.pricingMode);
    url.searchParams.set("extra_seats", String(Math.max(0, intent.extraSeats)));
    url.searchParams.set("source", intent.source);
    window.location.assign(url.toString());

    return {
        ok: true,
        message: `Redirecting to checkout for ${BILLING_PLANS[intent.planId].name}.`,
    };
}

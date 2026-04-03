import { supabase } from "../supabase";
import { BILLING_PLANS, getPlanPriceCents, getTeamSeatPriceCents } from "../config/pricing";
import type { BillingInterval, BillingPlanId, PricingMode } from "../config/pricing";

export interface CheckoutIntent {
    planId: Exclude<BillingPlanId, "free">;
    pricingMode: PricingMode;
    interval: BillingInterval;
    extraSeats: number;
    source: "stage_gate" | "manage_plan";
}

export interface CheckoutResult {
    ok: boolean;
    message: string;
}

export function getCheckoutPriceSummary(intent: CheckoutIntent): string {
    const base = getPlanPriceCents(intent.planId, intent.pricingMode, intent.interval);
    const seatTotal = getTeamSeatPriceCents(intent.pricingMode) * Math.max(0, intent.extraSeats);
    return `$${((base + seatTotal) / 100).toFixed(2)}/${intent.interval === "yearly" ? "year" : "month"}`;
}

export async function beginCheckout(intent: CheckoutIntent): Promise<CheckoutResult> {
    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
            planId: intent.planId,
            interval: intent.interval,
            extraSeats: Math.max(0, intent.extraSeats),
            source: intent.source,
        },
    });

    if (error || !data?.url) {
        return {
            ok: false,
            message:
                data?.error ||
                error?.message ||
                `Checkout could not be started for ${BILLING_PLANS[intent.planId].name}.`,
        };
    }

    window.location.assign(data.url as string);

    return {
        ok: true,
        message: `Redirecting to checkout for ${BILLING_PLANS[intent.planId].name}.`,
    };
}

export async function openCustomerPortal(): Promise<CheckoutResult> {
    const { data, error } = await supabase.functions.invoke("create-customer-portal-session", {
        body: {},
    });

    if (error || !data?.url) {
        return {
            ok: false,
            message:
                data?.error ||
                error?.message ||
                "Billing management is not available right now.",
        };
    }

    window.location.assign(data.url as string);

    return {
        ok: true,
        message: "Redirecting to billing management.",
    };
}

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

async function getBillingAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
        throw new Error("Your session expired. Sign in again before starting checkout.");
    }

    return {
        Authorization: `Bearer ${token}`,
    };
}

export async function beginCheckout(intent: CheckoutIntent): Promise<CheckoutResult> {
    let headers: Record<string, string>;

    try {
        headers = await getBillingAuthHeaders();
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "You need to sign in before starting checkout.",
        };
    }

    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        headers,
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
    let headers: Record<string, string>;

    try {
        headers = await getBillingAuthHeaders();
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "You need to sign in before opening billing management.",
        };
    }

    const { data, error } = await supabase.functions.invoke("create-customer-portal-session", {
        headers,
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

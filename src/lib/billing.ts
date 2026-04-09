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
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

    if (!token) {
        throw new Error("Your session expired. Sign in again before starting checkout.");
    }

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing Supabase billing configuration.");
    }

    return {
        supabaseUrl,
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
    };
}

function normalizeBillingError(message: string | null | undefined, fallback: string) {
    if (!message) return fallback;

    const normalized = message.trim().toLowerCase();
    if (normalized === "invalid jwt" || normalized === "unauthorized.") {
        return "Billing could not be started from this session. Refresh the page and try again.";
    }

    return message;
}

async function invokeBillingFunction<TBody extends object>(name: string, body: TBody) {
    const headers = await getBillingAuthHeaders();
    const response = await fetch(`${headers.supabaseUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: headers.Authorization,
            apikey: headers.apikey,
        },
        body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null);

    return {
        ok: response.ok,
        status: response.status,
        data: payload,
    };
}

export async function beginCheckout(intent: CheckoutIntent): Promise<CheckoutResult> {
    try {
        const result = await invokeBillingFunction("create-checkout-session", {
            planId: intent.planId,
            interval: intent.interval,
            extraSeats: Math.max(0, intent.extraSeats),
            source: intent.source,
        });

        if (!result.ok || !result.data?.url) {
            return {
                ok: false,
                message: normalizeBillingError(
                    result.data?.error ||
                    result.data?.message ||
                    null,
                    `Checkout could not be started for ${BILLING_PLANS[intent.planId].name}.`,
                ),
            };
        }

        window.location.assign(result.data.url as string);

        return {
            ok: true,
            message: `Redirecting to checkout for ${BILLING_PLANS[intent.planId].name}.`,
        };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "You need to sign in before starting checkout.",
        };
    }
}

export async function openCustomerPortal(): Promise<CheckoutResult> {
    try {
        const result = await invokeBillingFunction("create-customer-portal-session", {});

        if (!result.ok || !result.data?.url) {
            return {
                ok: false,
                message: normalizeBillingError(
                    result.data?.error ||
                    result.data?.message ||
                    null,
                    "Billing management is not available right now.",
                ),
            };
        }

        window.location.assign(result.data.url as string);

        return {
            ok: true,
            message: "Redirecting to billing management.",
        };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "You need to sign in before opening billing management.",
        };
    }
}

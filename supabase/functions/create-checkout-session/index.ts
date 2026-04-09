import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.3.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import {
    COFOUNDER_ADDON_PRICE_ID,
    STRIPE_API_VERSION,
    getPriceRecord,
    resolveCheckoutPricingMode,
    type BillingInterval,
    type PaidPlanKey,
} from "../_shared/stripe-config.ts";

type CheckoutRequest = {
    planId: PaidPlanKey;
    interval: BillingInterval;
    extraSeats?: number;
    source?: "stage_gate" | "manage_plan";
};

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        if (request.method !== "POST") {
            return jsonResponse({ error: "Method not allowed." }, 405);
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

        if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
            return jsonResponse({ error: "Missing billing environment variables." }, 500);
        }

        const serviceClient = createClient(supabaseUrl, serviceRoleKey);
        const stripe = new Stripe(stripeSecretKey, { apiVersion: STRIPE_API_VERSION });
        const authHeader = request.headers.get("Authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

        const {
            data: { user },
            error: authError,
        } = await serviceClient.auth.getUser(token);

        if (!token || authError || !user) {
            return jsonResponse({ error: "Unauthorized." }, 401);
        }

        const body = (await request.json()) as CheckoutRequest;
        const planId = body.planId;
        const interval = body.interval;
        const extraSeats = Math.max(0, Math.min(10, Number(body.extraSeats ?? 0)));

        if (!["starter", "pro"].includes(planId) || !["monthly", "yearly"].includes(interval)) {
            return jsonResponse({ error: "Invalid plan selection." }, 400);
        }

        const { data: access } = await serviceClient
            .from("account_access")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle();

        if (
            access &&
            (access.subscription_status === "active" || access.subscription_status === "trial" || access.subscription_status === "past_due") &&
            (access.plan_type === "starter" || access.plan_type === "pro")
        ) {
            return jsonResponse({
                error: "This account already has a paid subscription. Use Manage Subscription in Settings to change billing.",
            }, 409);
        }

        const pricingMode = resolveCheckoutPricingMode();
        const selectedPrice = getPriceRecord(planId, interval, pricingMode);
        const baseUrl = getBaseUrl(request);
        const customerId = await getOrCreateStripeCustomer({
            stripe,
            serviceClient,
            userId: user.id,
            email: user.email ?? "",
            name: (user.user_metadata?.name as string | undefined) ?? null,
        });

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            client_reference_id: user.id,
            success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/pricing?checkout=cancelled`,
            allow_promotion_codes: false,
            billing_address_collection: "auto",
            line_items: [
                {
                    price: selectedPrice.priceId,
                    quantity: 1,
                },
                ...(extraSeats > 0
                    ? [{
                        price: COFOUNDER_ADDON_PRICE_ID,
                        quantity: extraSeats,
                    }]
                    : []),
            ],
            metadata: {
                user_id: user.id,
                plan_key: planId,
                billing_interval: interval,
                checkout_source: body.source ?? "stage_gate",
                cofounder_quantity: String(extraSeats),
                founding_price_locked: pricingMode === "founding" ? "true" : "false",
            },
            subscription_data: {
                metadata: {
                    user_id: user.id,
                    plan_key: planId,
                    billing_interval: interval,
                    cofounder_quantity: String(extraSeats),
                    founding_price_locked: pricingMode === "founding" ? "true" : "false",
                },
            },
            custom_text: {
                submit: {
                    message: "Foundry subscriptions renew automatically. Full refund within 7 days of first checkout.",
                },
            },
        });

        await serviceClient
            .from("billing_subscriptions")
            .upsert({
                user_id: user.id,
                stripe_customer_id: customerId,
                stripe_checkout_session_id: session.id,
                stripe_price_id: selectedPrice.priceId,
                plan_key: planId,
                billing_interval: interval,
                cofounder_quantity: extraSeats,
                founding_price_locked: pricingMode === "founding",
                updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });

        return jsonResponse({
            url: session.url,
            sessionId: session.id,
        });
    } catch (error) {
        return jsonResponse({
            error: error instanceof Error ? error.message : "Unexpected billing error.",
        }, 500);
    }
});

async function getOrCreateStripeCustomer({
    stripe,
    serviceClient,
    userId,
    email,
    name,
}: {
    stripe: Stripe;
    serviceClient: ReturnType<typeof createClient>;
    userId: string;
    email: string;
    name: string | null;
}) {
    const { data: existing } = await serviceClient
        .from("billing_subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", userId)
        .maybeSingle();

    if (existing?.stripe_customer_id) {
        return existing.stripe_customer_id;
    }

    const customer = await stripe.customers.create({
        email,
        name: name ?? undefined,
        metadata: {
            user_id: userId,
        },
    });

    await serviceClient
        .from("billing_subscriptions")
        .upsert({
            user_id: userId,
            stripe_customer_id: customer.id,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

    return customer.id;
}

function getBaseUrl(request: Request) {
    const appUrl = Deno.env.get("APP_URL") ?? "";
    const appUrlLocal = Deno.env.get("APP_URL_LOCAL") ?? "";
    const origin = request.headers.get("origin") ?? "";

    if ((origin.includes("localhost") || origin.includes("127.0.0.1")) && appUrlLocal) {
        return appUrlLocal.replace(/\/$/, "");
    }

    if (appUrl) return appUrl.replace(/\/$/, "");
    if (origin) return origin.replace(/\/$/, "");
    return "http://localhost:5175";
}

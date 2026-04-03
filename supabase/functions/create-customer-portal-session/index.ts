import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.3.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { STRIPE_API_VERSION, selectPortalConfigurationId } from "../_shared/stripe-config.ts";

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        if (request.method !== "POST") {
            return jsonResponse({ error: "Method not allowed." }, 405);
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

        if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeSecretKey) {
            return jsonResponse({ error: "Missing billing environment variables." }, 500);
        }

        const authClient = createClient(supabaseUrl, anonKey, {
            global: {
                headers: {
                    Authorization: request.headers.get("Authorization") ?? "",
                },
            },
        });
        const serviceClient = createClient(supabaseUrl, serviceRoleKey);
        const stripe = new Stripe(stripeSecretKey, { apiVersion: STRIPE_API_VERSION });

        const {
            data: { user },
            error: authError,
        } = await authClient.auth.getUser();

        if (authError || !user) {
            return jsonResponse({ error: "Unauthorized." }, 401);
        }

        const { data: billingRow } = await serviceClient
            .from("billing_subscriptions")
            .select("stripe_customer_id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (!billingRow?.stripe_customer_id) {
            return jsonResponse({
                error: "No Stripe customer is attached to this account yet.",
            }, 404);
        }

        const configurationId = selectPortalConfigurationId();
        const session = await stripe.billingPortal.sessions.create({
            customer: billingRow.stripe_customer_id,
            return_url: `${getBaseUrl(request)}/settings?billing=returned`,
            ...(configurationId ? { configuration: configurationId } : {}),
        });

        return jsonResponse({ url: session.url });
    } catch (error) {
        return jsonResponse({
            error: error instanceof Error ? error.message : "Unexpected billing error.",
        }, 500);
    }
});

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

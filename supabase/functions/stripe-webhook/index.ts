import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "npm:stripe@18.3.0";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { STRIPE_API_VERSION } from "../_shared/stripe-config.ts";
import {
    findUserIdForSubscription,
    recordBillingEvent,
    syncStripeSubscriptionToDatabase,
} from "../_shared/stripe-sync.ts";

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed." }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

    if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey || !webhookSecret) {
        return jsonResponse({ error: "Missing billing environment variables." }, 500);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: STRIPE_API_VERSION });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const signature = request.headers.get("stripe-signature") ?? "";
    const payload = await request.text();

    let event: Stripe.Event;

    try {
        event = await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
    } catch (error) {
        return jsonResponse({
            error: error instanceof Error ? error.message : "Invalid webhook signature.",
        }, 400);
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
                if (subscriptionId) {
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const result = await syncStripeSubscriptionToDatabase(serviceClient, subscription);
                    await serviceClient
                        .from("billing_subscriptions")
                        .update({
                            stripe_checkout_session_id: session.id,
                            checkout_completed_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .eq("user_id", result.userId);

                    await recordBillingEvent(serviceClient, event, {
                        userId: result.userId,
                        stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
                        stripeSubscriptionId: subscription.id,
                    });
                } else {
                    await recordBillingEvent(serviceClient, event, {
                        userId: session.client_reference_id ?? session.metadata?.user_id ?? null,
                        stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
                        processingStatus: "ignored",
                    });
                }
                break;
            }

            case "customer.subscription.created":
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                const result = await syncStripeSubscriptionToDatabase(serviceClient, subscription);
                await recordBillingEvent(serviceClient, event, {
                    userId: result.userId,
                    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
                    stripeSubscriptionId: subscription.id,
                });
                break;
            }

            case "invoice.payment_succeeded":
            case "invoice.payment_failed": {
                const invoice = event.data.object as Stripe.Invoice;
                const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
                const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;

                if (subscriptionId) {
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const result = await syncStripeSubscriptionToDatabase(serviceClient, subscription);
                    await serviceClient
                        .from("billing_subscriptions")
                        .update({
                            latest_invoice_id: invoice.id,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("user_id", result.userId);

                    await recordBillingEvent(serviceClient, event, {
                        userId: result.userId,
                        stripeCustomerId: customerId,
                        stripeSubscriptionId: subscriptionId,
                    });
                } else {
                    const userId = await findUserIdForSubscription(serviceClient, null, customerId, null);
                    await recordBillingEvent(serviceClient, event, {
                        userId,
                        stripeCustomerId: customerId,
                        processingStatus: "ignored",
                    });
                }
                break;
            }

            default: {
                await recordBillingEvent(serviceClient, event, {
                    processingStatus: "ignored",
                });
                break;
            }
        }

        return jsonResponse({ received: true });
    } catch (error) {
        await recordBillingEvent(serviceClient, event, {
            processingStatus: "failed",
            errorMessage: error instanceof Error ? error.message : "Webhook processing failed.",
        });

        return jsonResponse({
            error: error instanceof Error ? error.message : "Webhook processing failed.",
        }, 500);
    }
});

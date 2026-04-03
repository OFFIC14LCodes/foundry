import Stripe from "npm:stripe@18.3.0";
import {
    COFOUNDER_ADDON_PRICE_ID,
    extractSubscriptionShape,
} from "./stripe-config.ts";

export async function syncStripeSubscriptionToDatabase(
    serviceClient: any,
    subscription: Stripe.Subscription,
) {
    const customerId = typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id;

    const userId = await findUserIdForSubscription(serviceClient, subscription.id, customerId, subscription.metadata?.user_id);
    if (!userId) {
        throw new Error(`Unable to resolve user for subscription ${subscription.id}.`);
    }

    const priceIds = subscription.items.data.map((item) => item.price.id);
    const shape = extractSubscriptionShape(priceIds);
    const teamSeatItem = subscription.items.data.find((item) => item.price.id === COFOUNDER_ADDON_PRICE_ID);
    const cofounderQuantity = teamSeatItem?.quantity ?? 0;
    const normalizedStatus = normalizeSubscriptionStatus(subscription);
    const periodStart = toIso(subscription.current_period_start);
    const periodEnd = toIso(subscription.current_period_end);
    const canceledAt = toIso(subscription.canceled_at);

    await serviceClient
        .from("billing_subscriptions")
        .upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
            stripe_status: subscription.status,
            plan_key: shape.planKey,
            billing_interval: shape.billingInterval,
            current_period_start: periodStart,
            current_period_end: periodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
            canceled_at: canceledAt,
            trial_end: toIso(subscription.trial_end),
            cofounder_quantity: cofounderQuantity,
            founding_price_locked: shape.foundingPriceLocked,
            latest_invoice_id: typeof subscription.latest_invoice === "string" ? subscription.latest_invoice : subscription.latest_invoice?.id ?? null,
            checkout_completed_at: normalizedStatus === "active" || normalizedStatus === "trial"
                ? new Date().toISOString()
                : null,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

    const { data: existingAccess } = await serviceClient
        .from("account_access")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    const preserveAdminGrant = Boolean(
        existingAccess?.is_family_comp ||
        existingAccess?.subscription_status === "comped" ||
        existingAccess?.subscription_status === "gifted",
    );

    if (preserveAdminGrant) return { userId, normalizedStatus };

    const preservedAccessStatus =
        existingAccess?.access_status === "suspended" || existingAccess?.access_status === "revoked"
            ? existingAccess.access_status
            : "active";

    await serviceClient
        .from("account_access")
        .upsert({
            user_id: userId,
            access_status: preservedAccessStatus,
            plan_type: shape.planKey ?? existingAccess?.plan_type ?? "free",
            subscription_status: normalizedStatus,
            starts_at: periodStart,
            ends_at: periodEnd,
            canceled_at: canceledAt,
            founding_price_locked: shape.foundingPriceLocked,
            founding_member: shape.foundingPriceLocked,
            founding_member_label: shape.foundingPriceLocked ? "Founding pricing locked in" : null,
            team_seat_count: cofounderQuantity,
            team_seat_price_cents: cofounderQuantity > 0 ? 1000 : 0,
            billing_interval: shape.billingInterval,
            stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

    return { userId, normalizedStatus };
}

export async function recordBillingEvent(
    serviceClient: any,
    event: Stripe.Event,
    options?: {
        userId?: string | null;
        stripeCustomerId?: string | null;
        stripeSubscriptionId?: string | null;
        processingStatus?: string;
        errorMessage?: string | null;
    },
) {
    await serviceClient
        .from("billing_events")
        .upsert({
            id: event.id,
            user_id: options?.userId ?? null,
            stripe_customer_id: options?.stripeCustomerId ?? null,
            stripe_subscription_id: options?.stripeSubscriptionId ?? null,
            event_type: event.type,
            livemode: event.livemode,
            processing_status: options?.processingStatus ?? "processed",
            error_message: options?.errorMessage ?? null,
            payload: event,
            processed_at: new Date().toISOString(),
        }, { onConflict: "id" });
}

export async function findUserIdForSubscription(
    serviceClient: any,
    stripeSubscriptionId?: string | null,
    stripeCustomerId?: string | null,
    metadataUserId?: string | null,
) {
    if (metadataUserId) return metadataUserId;

    if (stripeSubscriptionId) {
        const { data } = await serviceClient
            .from("billing_subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", stripeSubscriptionId)
            .maybeSingle();
        if (data?.user_id) return data.user_id;
    }

    if (stripeCustomerId) {
        const { data } = await serviceClient
            .from("billing_subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", stripeCustomerId)
            .maybeSingle();
        if (data?.user_id) return data.user_id;
    }

    return null;
}

function normalizeSubscriptionStatus(subscription: Stripe.Subscription) {
    const currentPeriodEnd = subscription.current_period_end
        ? subscription.current_period_end * 1000
        : null;

    switch (subscription.status) {
        case "trialing":
            return "trial";
        case "active":
            return subscription.cancel_at_period_end ? "canceled" : "active";
        case "past_due":
            return "past_due";
        case "unpaid":
            return "unpaid";
        case "incomplete":
            return "incomplete";
        case "incomplete_expired":
            return "expired";
        case "canceled":
            if (currentPeriodEnd && currentPeriodEnd > Date.now()) return "canceled";
            return "expired";
        default:
            return "incomplete";
    }
}

function toIso(unixSeconds?: number | null) {
    if (!unixSeconds) return null;
    return new Date(unixSeconds * 1000).toISOString();
}

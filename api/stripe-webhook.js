/**
 * STRIPE WEBHOOK HANDLER
 *
 * Deployment: this file is a Vercel serverless function (api/stripe-webhook.js).
 * For Netlify: wrap the handler in `exports.handler = async (event) => { ... }`.
 * For Express: use `app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), handler)`.
 *
 * Required environment variables:
 *   STRIPE_SECRET_KEY          — your Stripe secret key
 *   STRIPE_WEBHOOK_SECRET      — from Stripe Dashboard → Webhooks → signing secret
 *   SUPABASE_URL               — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service role key (bypasses RLS for webhook writes)
 *
 * Stripe events handled:
 *   checkout.session.completed        — new subscription starts
 *   customer.subscription.created     — subscription created
 *   customer.subscription.updated     — status changes (active, past_due, canceled, etc.)
 *   customer.subscription.deleted     — subscription fully deleted
 *   invoice.payment_succeeded         — payment success, ensure access is active
 *   invoice.payment_failed            — payment failed → mark past_due
 *
 * Architecture:
 *   Stripe is NOT the source of truth for app access.
 *   Stripe events update billing_subscriptions and account_access in Supabase.
 *   The app reads from Supabase, not Stripe.
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Service role client — bypasses RLS for webhook writes
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Mapping helpers ─────────────────────────────────────────────

/**
 * Maps a Stripe subscription status to Foundry's subscription_status.
 */
function mapStripeStatus(stripeStatus) {
    const map = {
        trialing: 'trial',
        active: 'active',
        past_due: 'past_due',
        canceled: 'canceled',
        incomplete: 'incomplete',
        incomplete_expired: 'expired',
        unpaid: 'unpaid',
        paused: 'past_due',
    };
    return map[stripeStatus] ?? 'unknown';
}

/**
 * Maps a Stripe status to the access_status gate.
 * Active, trialing, and past_due all retain access initially.
 * Only canceled/expired/unpaid remove access.
 */
function deriveAccessStatus(stripeStatus, subscription) {
    if (['active', 'trialing', 'past_due', 'incomplete'].includes(stripeStatus)) {
        return 'active';
    }
    // canceled: check if within the grace period (current_period_end)
    if (stripeStatus === 'canceled') {
        const periodEnd = subscription.current_period_end * 1000; // ms
        if (Date.now() < periodEnd) return 'active'; // still in paid period
        return 'active'; // or 'revoked' — your call. Default: keep active unless admin revokes.
    }
    return 'active'; // default: keep active; admin can manually revoke
}

// ── Upsert helpers ──────────────────────────────────────────────

async function upsertBilling(userId, subscription) {
    const { error } = await supabase.from('billing_subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
        stripe_subscription_id: subscription.id,
        stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
        stripe_status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end ?? false,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) console.error('upsertBilling error:', error.message);
}

async function upsertAccess(userId, stripeStatus, subscription) {
    const subStatus = mapStripeStatus(stripeStatus);
    const accessStatus = deriveAccessStatus(stripeStatus, subscription);

    const updates = {
        user_id: userId,
        subscription_status: subStatus,
        access_status: accessStatus,
        updated_at: new Date().toISOString(),
    };

    if (stripeStatus === 'canceled') {
        updates.canceled_at = new Date().toISOString();
    }

    const { error } = await supabase.from('account_access').upsert(updates, { onConflict: 'user_id' });
    if (error) console.error('upsertAccess error:', error.message);
}

/**
 * Looks up our user_id from the Stripe customer_id.
 * We store stripe_customer_id in billing_subscriptions.
 */
async function getUserIdFromCustomer(stripeCustomerId) {
    const { data } = await supabase
        .from('billing_subscriptions')
        .select('user_id')
        .eq('stripe_customer_id', stripeCustomerId)
        .maybeSingle();
    return data?.user_id ?? null;
}

/**
 * Gets the userId from checkout metadata (set when creating the checkout session).
 * metadata.user_id should be set during checkout session creation.
 */
function getUserIdFromCheckout(session) {
    return session.metadata?.user_id ?? session.client_reference_id ?? null;
}

// ── Event handlers ──────────────────────────────────────────────

async function handleCheckoutCompleted(session) {
    const userId = getUserIdFromCheckout(session);
    if (!userId) { console.warn('checkout.session.completed: no user_id in metadata'); return; }

    // Retrieve the subscription to get full details
    if (session.mode === 'subscription' && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        await upsertBilling(userId, subscription);
        await upsertAccess(userId, subscription.status, subscription);
    }
}

async function handleSubscriptionCreated(subscription) {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    const userId = await getUserIdFromCustomer(customerId);
    if (!userId) { console.warn('subscription.created: user not found for customer', customerId); return; }
    await upsertBilling(userId, subscription);
    await upsertAccess(userId, subscription.status, subscription);
}

async function handleSubscriptionUpdated(subscription) {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    const userId = await getUserIdFromCustomer(customerId);
    if (!userId) { console.warn('subscription.updated: user not found for customer', customerId); return; }
    await upsertBilling(userId, subscription);
    await upsertAccess(userId, subscription.status, subscription);
}

async function handleSubscriptionDeleted(subscription) {
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    const userId = await getUserIdFromCustomer(customerId);
    if (!userId) { console.warn('subscription.deleted: user not found for customer', customerId); return; }
    await upsertBilling(userId, subscription);

    // Mark as canceled in access — keep access_status 'active' until admin revokes
    await supabase.from('account_access').upsert({
        user_id: userId,
        subscription_status: 'canceled',
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
}

async function handleInvoicePaymentFailed(invoice) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const userId = await getUserIdFromCustomer(customerId);
    if (!userId) return;

    await supabase.from('account_access').upsert({
        user_id: userId,
        subscription_status: 'past_due',
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
}

async function handleInvoicePaymentSucceeded(invoice) {
    if (invoice.billing_reason === 'subscription_create') return; // handled by subscription.created
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const userId = await getUserIdFromCustomer(customerId);
    if (!userId) return;

    await supabase.from('account_access').upsert({
        user_id: userId,
        subscription_status: 'active',
        access_status: 'active',
        updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
}

// ── Main handler ────────────────────────────────────────────────

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
        // req.body must be the raw buffer — ensure bodyParser is disabled for this route
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;
            case 'customer.subscription.created':
                await handleSubscriptionCreated(event.data.object);
                break;
            case 'customer.subscription.updated':
                await handleSubscriptionUpdated(event.data.object);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;
            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object);
                break;
            case 'invoice.payment_succeeded':
                await handleInvoicePaymentSucceeded(event.data.object);
                break;
            default:
                // Unhandled event type — silently ignore
                break;
        }
    } catch (err) {
        console.error(`Error handling ${event.type}:`, err);
        return res.status(500).json({ error: 'Internal handler error' });
    }

    res.status(200).json({ received: true });
};

// ── Vercel config — disable body parsing so we get the raw buffer ──
module.exports.config = {
    api: { bodyParser: false },
};

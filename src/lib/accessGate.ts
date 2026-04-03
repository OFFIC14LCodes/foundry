// ─────────────────────────────────────────────────────────────
// ACCESS GATE
//
// Single source of truth for whether a user may use the app.
// Completely independent of Stripe — Stripe syncs INTO our tables,
// but product access is determined solely from account_access.
// ─────────────────────────────────────────────────────────────

export type AccessStatus = 'active' | 'suspended' | 'revoked';

export type PlanType =
    | 'free'
    | 'starter'
    | 'pro'
    | 'enterprise'
    | 'family_comp'
    | 'gifted';

export type SubscriptionStatus =
    | 'trial'
    | 'active'
    | 'trialing'
    | 'past_due'
    | 'canceled'
    | 'incomplete'
    | 'unpaid'
    | 'comped'
    | 'gifted'
    | 'expired';

export interface AccountAccess {
    id: string;
    user_id: string;
    access_status: AccessStatus;
    plan_type: PlanType;
    subscription_status: SubscriptionStatus;
    is_family_comp: boolean;
    comp_reason: string | null;
    starts_at: string | null;
    ends_at: string | null;
    canceled_at: string | null;
    suspended_at: string | null;
    suspension_reason: string | null;
    founding_price_locked?: boolean | null;
    founding_member?: boolean | null;
    founding_member_label?: string | null;
    team_seat_count?: number | null;
    team_seat_price_cents?: number | null;
    billing_interval?: 'monthly' | 'yearly' | null;
    stripe_price_id?: string | null;
    updated_at: string;
}

export interface BillingSubscription {
    id: string;
    user_id: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    stripe_status: string | null;
    plan_key?: 'starter' | 'pro' | null;
    billing_interval?: 'monthly' | 'yearly' | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    canceled_at?: string | null;
    trial_end: string | null;
    cofounder_quantity?: number | null;
    founding_price_locked?: boolean | null;
    stripe_checkout_session_id?: string | null;
    latest_invoice_id?: string | null;
    created_at: string;
    updated_at: string;
}

// ── Core access check ─────────────────────────────────────────

/**
 * Determines if a user may access the app.
 * - null record  → allow (new users, before record is created)
 * - access_status 'active' → allow
 * - suspended or revoked → deny
 */
export function canAccessApp(access: AccountAccess | null): boolean {
    if (!access) return true;
    return access.access_status === 'active';
}

export function getAccessBlockReason(access: AccountAccess | null): string {
    if (!access || access.access_status === 'active') return '';
    if (access.access_status === 'suspended') {
        return access.suspension_reason
            ? `Your account has been suspended: ${access.suspension_reason}`
            : 'Your account has been temporarily suspended. Contact support for help.';
    }
    return 'Your access to Foundry has been revoked. Contact support for assistance.';
}

// ── Derived helpers ───────────────────────────────────────────

export function isComped(access: AccountAccess | null): boolean {
    return (
        access?.is_family_comp === true ||
        access?.subscription_status === 'comped' ||
        access?.subscription_status === 'gifted' ||
        access?.plan_type === 'family_comp' ||
        access?.plan_type === 'gifted'
    );
}

export function isCanceled(access: AccountAccess | null): boolean {
    return access?.subscription_status === 'canceled' || access?.subscription_status === 'expired';
}

export function isPastDue(access: AccountAccess | null): boolean {
    return access?.subscription_status === 'past_due' || access?.subscription_status === 'unpaid';
}

export function isInTrial(access: AccountAccess | null): boolean {
    return access?.subscription_status === 'trial';
}

// Human-readable label for the subscription status
export function subscriptionLabel(status: SubscriptionStatus | string | null | undefined): string {
    const map: Record<string, string> = {
        trial: 'Trial',
        active: 'Active',
        trialing: 'Trialing',
        past_due: 'Past Due',
        canceled: 'Canceled',
        incomplete: 'Incomplete',
        unpaid: 'Unpaid',
        comped: 'Comped',
        gifted: 'Gifted',
        expired: 'Expired',
    };
    return map[status ?? ''] ?? (status ?? 'Unknown');
}

export function planLabel(plan: PlanType | string | null | undefined): string {
    const map: Record<string, string> = {
        free: 'Free',
        starter: 'Starter',
        pro: 'Pro',
        enterprise: 'Enterprise',
        family_comp: 'Family',
        gifted: 'Gifted',
    };
    return map[plan ?? ''] ?? (plan ?? 'Unknown');
}

import { supabase } from '../supabase';
import type { AccountAccess, AccessStatus, PlanType, SubscriptionStatus } from './accessGate';
import type { UserRole } from './roles';

// ─────────────────────────────────────────────────────────────
// ADMIN DATABASE LAYER
//
// All operations here require the calling user to be an admin.
// Row Level Security enforces this server-side — see SQL below.
//
// ─────────────────────────────────────────────────────────────
// REQUIRED SQL (run in Supabase SQL Editor)
// ─────────────────────────────────────────────────────────────
//
// -- 1. Extend profiles table
// ALTER TABLE public.profiles
//   ADD COLUMN IF NOT EXISTS role        text NOT NULL DEFAULT 'user',
//   ADD COLUMN IF NOT EXISTS setup_completed boolean NOT NULL DEFAULT false,
//   ADD COLUMN IF NOT EXISTS email       text,
//   ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
//
// -- 2. Account access table
// CREATE TABLE IF NOT EXISTS public.account_access (
//   id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id            uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
//   access_status      text NOT NULL DEFAULT 'active',
//   plan_type          text NOT NULL DEFAULT 'free',
//   subscription_status text NOT NULL DEFAULT 'trial',
//   is_family_comp     boolean DEFAULT false,
//   comp_reason        text,
//   starts_at          timestamptz DEFAULT now(),
//   ends_at            timestamptz,
//   canceled_at        timestamptz,
//   suspended_at       timestamptz,
//   suspension_reason  text,
//   created_at         timestamptz DEFAULT now(),
//   updated_at         timestamptz DEFAULT now()
// );
//
// -- 3. Billing / Stripe mapping
// CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
//   id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id                uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
//   stripe_customer_id     text,
//   stripe_subscription_id text,
//   stripe_price_id        text,
//   stripe_status          text,
//   current_period_start   timestamptz,
//   current_period_end     timestamptz,
//   cancel_at_period_end   boolean DEFAULT false,
//   trial_end              timestamptz,
//   created_at             timestamptz DEFAULT now(),
//   updated_at             timestamptz DEFAULT now()
// );
//
// -- 4. Admin notes / retention tracking
// CREATE TABLE IF NOT EXISTS public.admin_notes (
//   id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id                 uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
//   admin_id                uuid REFERENCES auth.users(id),
//   note                    text NOT NULL,
//   retention_status        text,   -- at_risk | win_back_candidate | do_not_contact | converted
//   winback_status          text,   -- pending | contacted | offered_discount | returned | declined
//   cancellation_reason     text,
//   last_discount_offered_at timestamptz,
//   last_contacted_at       timestamptz,
//   created_at              timestamptz DEFAULT now()
// );
//
// -- 5. Admin/owner role helpers (SECURITY DEFINER bypasses RLS for the check itself)
// CREATE OR REPLACE FUNCTION public.current_user_role()
// RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
//   SELECT COALESCE(
//     (SELECT role FROM public.profiles WHERE id = auth.uid()),
//     'user'
//   )
// $$;
//
// CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
// RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
//   SELECT public.current_user_role() IN ('admin', 'owner')
// $$;
//
// -- 6. RLS: account_access
// ALTER TABLE public.account_access ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "own_read"   ON public.account_access FOR SELECT USING (user_id = auth.uid());
// CREATE POLICY "admin_all"  ON public.account_access FOR ALL   USING (public.is_admin_or_owner());
// CREATE POLICY "own_insert" ON public.account_access FOR INSERT WITH CHECK (user_id = auth.uid());
//
// -- 7. RLS: billing_subscriptions
// ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "own_read"  ON public.billing_subscriptions FOR SELECT USING (user_id = auth.uid());
// CREATE POLICY "admin_all" ON public.billing_subscriptions FOR ALL   USING (public.is_admin_or_owner());
//
// -- 8. RLS: admin_notes
// ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "admin_all" ON public.admin_notes FOR ALL USING (public.is_admin_or_owner());
//
// -- 9. RLS: profiles — admins can read all
// -- (Add to existing profiles RLS, or enable it if not yet enabled)
// ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "own_all"   ON public.profiles FOR ALL   USING (id = auth.uid());
// CREATE POLICY "admin_read" ON public.profiles FOR SELECT USING (public.is_admin_or_owner());
//
// -- 10. Trigger to auto-create account_access on profile insert (optional)
// CREATE OR REPLACE FUNCTION public.create_default_access()
// RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
// BEGIN
//   INSERT INTO public.account_access (user_id, access_status, plan_type, subscription_status)
//   VALUES (NEW.id, 'active', 'free', 'trial')
//   ON CONFLICT (user_id) DO NOTHING;
//   RETURN NEW;
// END;
// $$;
// CREATE TRIGGER on_profile_created
//   AFTER INSERT ON public.profiles
//   FOR EACH ROW EXECUTE FUNCTION public.create_default_access();
//
// -- OWNER ROLE SHOULD BE ASSIGNED IN THE AUTH/PROFILE TRIGGER FLOW.
// ─────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────

export interface AdminUser {
    // Profile
    id: string;
    name: string | null;
    email: string | null;
    business_name: string | null;
    created_at: string;
    last_active_at: string | null;
    role: UserRole;
    // Access
    access: {
        access_status: AccessStatus;
        plan_type: PlanType;
        subscription_status: SubscriptionStatus;
        is_family_comp: boolean;
        comp_reason: string | null;
        canceled_at: string | null;
        suspended_at: string | null;
        suspension_reason: string | null;
        ends_at: string | null;
    } | null;
    // Billing
    billing: {
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        stripe_status: string | null;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
    } | null;
}

export interface AdminNote {
    id: string;
    user_id: string;
    admin_id: string | null;
    note: string;
    retention_status: string | null;
    winback_status: string | null;
    cancellation_reason: string | null;
    last_discount_offered_at: string | null;
    last_contacted_at: string | null;
    created_at: string;
}

// ── Load all users ─────────────────────────────────────────────

export async function loadAdminUsers(): Promise<AdminUser[]> {
    const [profilesRes, accessRes, billingRes] = await Promise.all([
        supabase.from('profiles').select('id, name, email, business_name, created_at, last_active_at, role').order('created_at', { ascending: false }),
        supabase.from('account_access').select('user_id, access_status, plan_type, subscription_status, is_family_comp, comp_reason, canceled_at, suspended_at, suspension_reason, ends_at'),
        supabase.from('billing_subscriptions').select('user_id, stripe_customer_id, stripe_subscription_id, stripe_status, current_period_end, cancel_at_period_end'),
    ]);

    const profiles = profilesRes.data ?? [];
    const accessMap = new Map((accessRes.data ?? []).map(a => [a.user_id, a]));
    const billingMap = new Map((billingRes.data ?? []).map(b => [b.user_id, b]));

    return profiles.map(p => ({
        id: p.id,
        name: p.name ?? null,
        email: p.email ?? null,
        business_name: p.business_name ?? null,
        created_at: p.created_at,
        last_active_at: p.last_active_at ?? null,
        role: (p.role ?? 'user') as UserRole,
        access: accessMap.get(p.id) ?? null,
        billing: billingMap.get(p.id) ?? null,
    }));
}

// ── Load single user ───────────────────────────────────────────

export async function loadAdminUser(userId: string): Promise<AdminUser | null> {
    const [pRes, aRes, bRes] = await Promise.all([
        supabase.from('profiles').select('id, name, email, business_name, created_at, last_active_at, role').eq('id', userId).single(),
        supabase.from('account_access').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('billing_subscriptions').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    if (!pRes.data) return null;
    const p = pRes.data;
    return {
        id: p.id,
        name: p.name ?? null,
        email: p.email ?? null,
        business_name: p.business_name ?? null,
        created_at: p.created_at,
        last_active_at: p.last_active_at ?? null,
        role: (p.role ?? 'user') as UserRole,
        access: aRes.data ?? null,
        billing: bRes.data ?? null,
    };
}

// ── Account access mutations ───────────────────────────────────

async function upsertAccess(userId: string, updates: Partial<AccountAccess> & { updated_at?: string }): Promise<boolean> {
    updates.updated_at = new Date().toISOString();
    const { error } = await supabase
        .from('account_access')
        .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });
    if (error) { console.error('upsertAccess error:', error.message); return false; }
    return true;
}

export async function grantCompAccess(userId: string, isFamily: boolean, reason: string): Promise<boolean> {
    return upsertAccess(userId, {
        access_status: 'active',
        plan_type: isFamily ? 'family_comp' : 'gifted',
        subscription_status: isFamily ? 'comped' : 'gifted',
        is_family_comp: isFamily,
        comp_reason: reason || null,
        suspended_at: null,
        suspension_reason: null,
    });
}

export async function removeCompAccess(userId: string): Promise<boolean> {
    return upsertAccess(userId, {
        plan_type: 'free',
        subscription_status: 'trial',
        is_family_comp: false,
        comp_reason: null,
    });
}

export async function suspendUser(userId: string, reason: string): Promise<boolean> {
    return upsertAccess(userId, {
        access_status: 'suspended',
        suspended_at: new Date().toISOString(),
        suspension_reason: reason || 'No reason given',
    });
}

export async function reactivateUser(userId: string): Promise<boolean> {
    return upsertAccess(userId, {
        access_status: 'active',
        suspended_at: null,
        suspension_reason: null,
    });
}

export async function revokeAccess(userId: string): Promise<boolean> {
    return upsertAccess(userId, { access_status: 'revoked' });
}

export async function updatePlanType(userId: string, planType: PlanType): Promise<boolean> {
    return upsertAccess(userId, { plan_type: planType });
}

// ── Admin notes ────────────────────────────────────────────────

export async function addAdminNote(
    userId: string,
    adminId: string,
    note: string,
    options: {
        retentionStatus?: string;
        winbackStatus?: string;
        cancellationReason?: string;
        lastDiscountOfferedAt?: string;
        lastContactedAt?: string;
    } = {}
): Promise<boolean> {
    const { error } = await supabase.from('admin_notes').insert({
        user_id: userId,
        admin_id: adminId,
        note,
        retention_status: options.retentionStatus ?? null,
        winback_status: options.winbackStatus ?? null,
        cancellation_reason: options.cancellationReason ?? null,
        last_discount_offered_at: options.lastDiscountOfferedAt ?? null,
        last_contacted_at: options.lastContactedAt ?? null,
    });
    if (error) { console.error('addAdminNote error:', error.message); return false; }
    return true;
}

export async function loadAdminNotes(userId: string): Promise<AdminNote[]> {
    const { data, error } = await supabase
        .from('admin_notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) console.error('loadAdminNotes error:', error.message);
    return (data as AdminNote[]) ?? [];
}

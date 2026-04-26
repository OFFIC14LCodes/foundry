import { FREE_STAGE_LIMIT, isFoundingWindowActive } from "../config/pricing";
import type { PricingMode } from "../config/pricing";
import type { AccountAccess } from "./accessGate";
import { canAccessApp, isComped, planLabel, subscriptionLabel } from "./accessGate";

export type PaidStageAccessState =
    | "eligible"
    | "free"
    | "comped"
    | "canceled_active"
    | "canceled_ended"
    | "past_due"
    | "incomplete"
    | "suspended"
    | "revoked";

export interface AccessSummary {
    planName: string;
    statusLabel: string;
    note: string;
    badge: string | null;
    canAccessPaidStages: boolean;
    isFounding: boolean;
    isComped: boolean;
    endsAt: string | null;
}

export const FREE_TIER_ACADEMY_STAGE_LIMIT = 1;
export const FREE_TIER_PITCH_PRACTICE_LIMIT = 3;
export const FREE_TIER_BRIEFING_LIMIT = 5;
export const FREE_TIER_MARKET_REPORT_LIMIT = 5;

function parseDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isPlanPaid(planType: string | null | undefined): boolean {
    return planType === "starter" || planType === "pro" || planType === "enterprise";
}

export function hasLockedFoundingPricing(access: AccountAccess | null): boolean {
    return Boolean(
        access?.founding_price_locked ||
        access?.founding_member ||
        access?.founding_member_label
    );
}

export function getEffectivePricingMode(access: AccountAccess | null): PricingMode {
    if (hasLockedFoundingPricing(access)) return "founding";
    return isFoundingWindowActive() ? "founding" : "standard";
}

export function getPaidStageAccessState(access: AccountAccess | null, now = new Date()): PaidStageAccessState {
    if (!access) return "free";
    if (access.access_status === "suspended") return "suspended";
    if (access.access_status === "revoked") return "revoked";
    if (isComped(access)) return "comped";

    const entitledPlan = isPlanPaid(access.plan_type);
    const endsAt = parseDate(access.ends_at);
    const graceActive = Boolean(endsAt && endsAt.getTime() > now.getTime());

    if (!entitledPlan) return "free";

    switch (access.subscription_status) {
        case "active":
        case "trial":
            return "eligible";
        case "canceled":
        case "expired":
            return graceActive ? "canceled_active" : "canceled_ended";
        case "past_due":
        case "unpaid":
            return "past_due";
        case "incomplete":
            return "incomplete";
        case "comped":
        case "gifted":
            return "comped";
        default:
            return entitledPlan ? "eligible" : "free";
    }
}

export function canAccessPaidStages(access: AccountAccess | null, now = new Date()): boolean {
    if (!access || !canAccessApp(access)) return false;
    const state = getPaidStageAccessState(access, now);
    return state === "eligible" || state === "comped" || state === "canceled_active";
}

export function isFreeTierAccess(access: AccountAccess | null, now = new Date()): boolean {
    if (!access) return true;
    if (!canAccessApp(access)) return false;
    return !canAccessPaidStages(access, now);
}

export function canAccessStage(stageId: number, access: AccountAccess | null, now = new Date()): boolean {
    if (stageId <= FREE_STAGE_LIMIT) return !access || canAccessApp(access);
    return canAccessPaidStages(access, now);
}

export function getPaywallEntryMessage(targetStage: number): string {
    if (targetStage <= 2) {
        return "You are stepping out of validation and into execution. Stage 2 is where the business starts becoming real: model, priorities, decisions, and build discipline.";
    }
    return `Stage ${targetStage} continues the paid Foundry journey. This unlock keeps your build moving with the full execution path and premium support structure.`;
}

export function getPaidStageBlockNote(access: AccountAccess | null): string {
    const state = getPaidStageAccessState(access);
    switch (state) {
        case "free":
            return "Stage 1 stays free. Paid access begins when you unlock the execution phase at Stage 2.";
        case "canceled_active":
            return access?.ends_at
                ? `Your cancellation is scheduled, but access remains active through ${new Date(access.ends_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
                : "Your subscription is canceled, but your current access window is still active.";
        case "canceled_ended":
            return "Your paid access has ended. Unlock the full journey again to continue past Stage 1.";
        case "past_due":
            return "Your account is not currently cleared for paid stages. Update billing or use admin-granted access to continue.";
        case "incomplete":
            return "Your subscription setup is not complete yet. Finish billing or use admin-granted access to continue.";
        case "suspended":
            return "This account is suspended and cannot access paid stages right now.";
        case "revoked":
            return "This account no longer has Foundry access.";
        case "comped":
            return "This account has manually granted access.";
        case "eligible":
            return "This account already has access to paid stages.";
        default:
            return "Unlock the next phase to continue the full Foundry journey.";
    }
}

export function getAccessSummary(access: AccountAccess | null): AccessSummary {
    const state = getPaidStageAccessState(access);
    const paidAccess = canAccessPaidStages(access);
    const founding = hasLockedFoundingPricing(access) || getEffectivePricingMode(access) === "founding";
    const planName = access ? planLabel(access.plan_type) : "Free";
    const statusLabel = access ? subscriptionLabel(access.subscription_status) : "Free";

    if (!access) {
        return {
            planName,
            statusLabel,
            note: "Stage 1 is open. Unlock Stage 2 when you are ready to move into execution.",
            badge: founding ? "Founding pricing available" : null,
            canAccessPaidStages: false,
            isFounding: founding,
            isComped: false,
            endsAt: null,
        };
    }

    const base = {
        planName,
        statusLabel,
        badge: null as string | null,
        canAccessPaidStages: paidAccess,
        isFounding: founding,
        isComped: isComped(access),
        endsAt: access.ends_at ?? null,
    };

    if (isComped(access)) {
        return {
            ...base,
            note: access.is_family_comp
                ? "Family access is active. Paid-stage billing is bypassed for this account."
                : "Manual access is active on this account.",
            badge: access.is_family_comp ? "Family access" : "Comped access",
        };
    }

    if (state === "canceled_active") {
        return {
            ...base,
            note: access.ends_at
                ? `Canceled, but active through ${new Date(access.ends_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
                : "Canceled, but still active for the current billing window.",
            badge: "Access retained",
        };
    }

    if (state === "canceled_ended") {
        return {
            ...base,
            note: "Paid access has ended. Stage 1 remains available.",
            badge: "Access ended",
        };
    }

    if (state === "past_due") {
        return {
            ...base,
            note: "Billing needs attention before paid stages can be used.",
            badge: "Billing issue",
        };
    }

    if (state === "suspended" || state === "revoked") {
        return {
            ...base,
            note: "Account access is currently restricted by admin controls.",
            badge: state === "suspended" ? "Suspended" : "Revoked",
        };
    }

    if (paidAccess) {
        return {
            ...base,
            note: access.plan_type === "pro"
                ? "Full Foundry access is active, including premium tools and paid stages."
                : "Paid-stage access is active across the full Foundry journey.",
            badge: founding ? "Founding pricing locked in" : "Active plan",
        };
    }

    return {
        ...base,
        note: "Stage 1 is open. Unlock Stage 2 when you are ready to continue the real build.",
        badge: founding ? "Founding pricing available" : null,
    };
}

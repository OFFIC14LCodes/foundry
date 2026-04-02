export type BillingPlanId = "free" | "starter" | "pro";
export type PricingMode = "standard" | "founding";

export interface BillingPlanConfig {
    id: BillingPlanId;
    name: string;
    shortLabel: string;
    stageAccess: "stage_1_only" | "full_journey";
    tagline: string;
    headline: string;
    standardMonthlyCents: number;
    foundingMonthlyCents: number | null;
    featureHighlights: string[];
    comparisonPoints: string[];
    checkoutLinks: {
        standard: string | null;
        founding: string | null;
    };
}

export interface TeamSeatAddonConfig {
    name: string;
    standardMonthlyCents: number | null;
    foundingMonthlyCents: number | null;
    description: string;
}

export const FREE_STAGE_LIMIT = 1;

export const FOUNDING_PRICING = {
    enabled: import.meta.env.VITE_FOUNDING_PRICING_ENABLED !== "false",
    endsAt: import.meta.env.VITE_FOUNDING_PRICING_ENDS_AT || null,
    badge: "Founding pricing",
    lockedBadge: "Founding pricing locked in",
};

export const TEAM_SEAT_ADDON: TeamSeatAddonConfig = {
    name: "Extra team seat",
    standardMonthlyCents: 1000,
    foundingMonthlyCents: 1000,
    description: "Add a cofounder or team member seat without changing the core plan structure.",
};

export const BILLING_PLANS: Record<BillingPlanId, BillingPlanConfig> = {
    free: {
        id: "free",
        name: "Free",
        shortLabel: "Free",
        stageAccess: "stage_1_only",
        tagline: "Settle in and prove the problem is real.",
        headline: "Stage 1 only",
        standardMonthlyCents: 0,
        foundingMonthlyCents: null,
        featureHighlights: [
            "Account creation and onboarding",
            "Full access to Stage 1",
            "Forge guidance inside the validation phase",
        ],
        comparisonPoints: [
            "Stage 1 access",
            "Foundry onboarding",
            "Problem validation with Forge",
        ],
        checkoutLinks: {
            standard: null,
            founding: null,
        },
    },
    starter: {
        id: "starter",
        name: "Starter",
        shortLabel: "Starter",
        stageAccess: "full_journey",
        tagline: "Continue the real build with the full stage journey.",
        headline: "Core Foundry build path",
        standardMonthlyCents: 2999,
        foundingMonthlyCents: 2299,
        featureHighlights: [
            "Unlock Stages 2 through 6",
            "Core Foundry journey and milestone flow",
            "Forge across the full build and launch path",
            "Essential tools for serious execution",
        ],
        comparisonPoints: [
            "Full stage journey",
            "Core Foundry experience",
            "Execution-ready founder workflow",
        ],
        checkoutLinks: {
            standard: import.meta.env.VITE_CHECKOUT_STARTER_STANDARD || null,
            founding: import.meta.env.VITE_CHECKOUT_STARTER_FOUNDING || null,
        },
    },
    pro: {
        id: "pro",
        name: "Pro",
        shortLabel: "Pro",
        stageAccess: "full_journey",
        tagline: "The premium Foundry experience for founders building with range.",
        headline: "Unlimited / premium positioning",
        standardMonthlyCents: 4999,
        foundingMonthlyCents: 3599,
        featureHighlights: [
            "Everything in Starter",
            "Premium tools and advanced workflows",
            "Best fit for committed founders building at full pace",
            "Room for deeper execution and team readiness",
        ],
        comparisonPoints: [
            "Premium tool access",
            "Advanced founder workflows",
            "Best for committed execution",
        ],
        checkoutLinks: {
            standard: import.meta.env.VITE_CHECKOUT_PRO_STANDARD || null,
            founding: import.meta.env.VITE_CHECKOUT_PRO_FOUNDING || null,
        },
    },
};

function parseDate(value: string | null): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isFoundingWindowActive(now = new Date()): boolean {
    if (!FOUNDING_PRICING.enabled) return false;
    const endsAt = parseDate(FOUNDING_PRICING.endsAt);
    if (!endsAt) return true;
    return now.getTime() <= endsAt.getTime();
}

export function formatUsd(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
}

export function getPlanPriceCents(planId: BillingPlanId, mode: PricingMode): number {
    const plan = BILLING_PLANS[planId];
    if (!plan) return 0;
    if (mode === "founding" && plan.foundingMonthlyCents !== null) {
        return plan.foundingMonthlyCents;
    }
    return plan.standardMonthlyCents;
}

export function getTeamSeatPriceCents(mode: PricingMode): number {
    if (mode === "founding" && TEAM_SEAT_ADDON.foundingMonthlyCents !== null) {
        return TEAM_SEAT_ADDON.foundingMonthlyCents;
    }
    return TEAM_SEAT_ADDON.standardMonthlyCents ?? TEAM_SEAT_ADDON.foundingMonthlyCents ?? 0;
}

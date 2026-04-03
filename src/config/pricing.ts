export type BillingPlanId = "free" | "starter" | "pro";
export type PaidPlanId = Exclude<BillingPlanId, "free">;
export type PricingMode = "standard" | "founding";
export type BillingInterval = "monthly" | "yearly";

export interface BillingPlanPriceSet {
    standard: Record<BillingInterval, number>;
    founding: Partial<Record<BillingInterval, number>>;
}

export interface BillingPlanConfig {
    id: BillingPlanId;
    name: string;
    shortLabel: string;
    stageAccess: "stage_1_only" | "full_journey";
    tagline: string;
    headline: string;
    prices: BillingPlanPriceSet;
    featureHighlights: string[];
    comparisonPoints: string[];
}

export interface TeamSeatAddonConfig {
    name: string;
    standardMonthlyCents: number;
    foundingMonthlyCents: number;
    description: string;
}

export const FREE_STAGE_LIMIT = 1;

export const FOUNDING_PRICING = {
    enabled: import.meta.env.VITE_FOUNDING_PRICING_ENABLED !== "false",
    endsAt: import.meta.env.VITE_FOUNDING_WEEK_END_AT || import.meta.env.VITE_FOUNDING_PRICING_ENDS_AT || null,
    badge: "Founding pricing",
    lockedBadge: "Founding pricing locked in",
};

export const REFUND_POLICY = {
    windowDays: 7,
    summary: "Full refund within 7 days of first checkout.",
};

export const SUPPORT_EMAIL = "foundryandforge.app@gmail.com";

export const TEAM_SEAT_ADDON: TeamSeatAddonConfig = {
    name: "Cofounder add-on",
    standardMonthlyCents: 1000,
    foundingMonthlyCents: 1000,
    description: "Add a cofounder or teammate as a recurring quantity-based subscription item.",
};

export const BILLING_PLANS: Record<BillingPlanId, BillingPlanConfig> = {
    free: {
        id: "free",
        name: "Free",
        shortLabel: "Free",
        stageAccess: "stage_1_only",
        tagline: "Settle in and prove the problem is real.",
        headline: "Stage 1 only",
        prices: {
            standard: {
                monthly: 0,
                yearly: 0,
            },
            founding: {},
        },
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
    },
    starter: {
        id: "starter",
        name: "Starter",
        shortLabel: "Starter",
        stageAccess: "full_journey",
        tagline: "Continue the real build with the full stage journey.",
        headline: "Core Foundry build path",
        prices: {
            standard: {
                monthly: 2999,
                yearly: 29900,
            },
            founding: {
                monthly: 2299,
                yearly: 22900,
            },
        },
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
    },
    pro: {
        id: "pro",
        name: "Pro",
        shortLabel: "Pro",
        stageAccess: "full_journey",
        tagline: "The premium Foundry experience for founders building with range.",
        headline: "Unlimited / premium positioning",
        prices: {
            standard: {
                monthly: 4999,
                yearly: 49900,
            },
            founding: {
                monthly: 3599,
                yearly: 34900,
            },
        },
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

export function formatAnnualSavings(monthlyCents: number, yearlyCents: number): string {
    const annualizedMonthly = monthlyCents * 12;
    const savings = annualizedMonthly - yearlyCents;
    return savings > 0 ? `Save ${formatUsd(savings)}/yr` : "Annual billing";
}

export function getPlanPriceCents(
    planId: BillingPlanId,
    mode: PricingMode,
    interval: BillingInterval,
): number {
    const plan = BILLING_PLANS[planId];
    if (!plan) return 0;

    if (mode === "founding") {
        const foundingPrice = plan.prices.founding[interval];
        if (typeof foundingPrice === "number") return foundingPrice;
    }

    return plan.prices.standard[interval];
}

export function getTeamSeatPriceCents(mode: PricingMode): number {
    if (mode === "founding") return TEAM_SEAT_ADDON.foundingMonthlyCents;
    return TEAM_SEAT_ADDON.standardMonthlyCents;
}

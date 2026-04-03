export type PaidPlanKey = "starter" | "pro";
export type BillingInterval = "monthly" | "yearly";
export type PricingMode = "standard" | "founding";

type PriceRecord = {
    priceId: string;
    planKey: PaidPlanKey;
    interval: BillingInterval;
    pricingMode: PricingMode;
};

const FOUNDING_WEEK_END_AT = Deno.env.get("FOUNDING_WEEK_END_AT") ?? "";

export const STRIPE_API_VERSION = "2026-02-25.clover";
export const SUPPORT_EMAIL = "foundryandforge.app@gmail.com";
export const REFUND_WINDOW_DAYS = 7;
export const COFOUNDER_ADDON_PRICE_ID = "price_1THuCGRGzXn4MXJEM4puot48";

export const PRICE_CATALOG: PriceRecord[] = [
    { priceId: "price_1THuCHRGzXn4MXJEFZlud2b3", planKey: "starter", interval: "monthly", pricingMode: "founding" },
    { priceId: "price_1THuCDRGzXn4MXJEtIe3nIuf", planKey: "starter", interval: "monthly", pricingMode: "standard" },
    { priceId: "price_1THuCDRGzXn4MXJE4Qkd99YF", planKey: "starter", interval: "yearly", pricingMode: "founding" },
    { priceId: "price_1THuCDRGzXn4MXJEAMD2kqoA", planKey: "starter", interval: "yearly", pricingMode: "standard" },
    { priceId: "price_1THuCDRGzXn4MXJEeRhITOMw", planKey: "pro", interval: "monthly", pricingMode: "founding" },
    { priceId: "price_1THuCGRGzXn4MXJE8p24z1Zs", planKey: "pro", interval: "monthly", pricingMode: "standard" },
    { priceId: "price_1THuCDRGzXn4MXJEtJg253kY", planKey: "pro", interval: "yearly", pricingMode: "founding" },
    { priceId: "price_1THuCDRGzXn4MXJErqa3NBS3", planKey: "pro", interval: "yearly", pricingMode: "standard" },
];

const PRICE_BY_ID = new Map(PRICE_CATALOG.map((record) => [record.priceId, record]));

export function isFoundingWindowActive(now = new Date()): boolean {
    if (!FOUNDING_WEEK_END_AT) return true;
    const parsed = new Date(FOUNDING_WEEK_END_AT);
    if (Number.isNaN(parsed.getTime())) return true;
    return now.getTime() <= parsed.getTime();
}

export function getPriceRecord(planKey: PaidPlanKey, interval: BillingInterval, pricingMode: PricingMode): PriceRecord {
    const found = PRICE_CATALOG.find(
        (record) =>
            record.planKey === planKey &&
            record.interval === interval &&
            record.pricingMode === pricingMode,
    );

    if (!found) {
        throw new Error(`No Stripe price configured for ${planKey}/${interval}/${pricingMode}.`);
    }

    return found;
}

export function getPriceRecordById(priceId: string | null | undefined): PriceRecord | null {
    if (!priceId) return null;
    return PRICE_BY_ID.get(priceId) ?? null;
}

export function resolveCheckoutPricingMode(now = new Date()): PricingMode {
    return isFoundingWindowActive(now) ? "founding" : "standard";
}

export function selectPortalConfigurationId(now = new Date()): string | null {
    const foundingConfig = Deno.env.get("STRIPE_PORTAL_CONFIGURATION_ID_FOUNDING") ?? null;
    const standardConfig = Deno.env.get("STRIPE_PORTAL_CONFIGURATION_ID_STANDARD") ?? null;

    if (isFoundingWindowActive(now) && foundingConfig) return foundingConfig;
    return standardConfig ?? foundingConfig;
}

export function extractSubscriptionShape(priceIds: string[]) {
    const basePrice = priceIds.map((priceId) => getPriceRecordById(priceId)).find(Boolean) ?? null;
    return {
        planKey: basePrice?.planKey ?? null,
        billingInterval: basePrice?.interval ?? null,
        foundingPriceLocked: basePrice?.pricingMode === "founding",
    };
}

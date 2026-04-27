import { getFallbackBudgetAmount } from "./budget";

export type FinancialFrequency = "one_time" | "monthly" | "yearly";
export type ProfitBucketType = "income" | "profit" | "owner_comp" | "tax" | "opex";

export type FounderExpense = {
    id: string;
    userId: string;
    accountId: string | null;
    label: string;
    category: string;
    amount: number;
    currency: string;
    incurredOn: string | null;
    frequency: FinancialFrequency;
    renewalDate: string | null;
    isRecurring: boolean;
    notes: string | null;
    source: "manual" | "imported" | "legacy_migrated";
    createdAt: string;
    updatedAt: string;
};

export type FounderRevenue = {
    id: string;
    userId: string;
    accountId: string | null;
    label: string;
    category: string;
    amount: number;
    currency: string;
    receivedOn: string | null;
    frequency: FinancialFrequency;
    renewalDate: string | null;
    notes: string | null;
    source: "manual" | "imported" | "legacy_migrated";
    createdAt: string;
    updatedAt: string;
};

export type FounderFinancialSettings = {
    userId: string;
    startingCash: number | null;
    defaultCurrency: string;
    profitFirstEnabled: boolean;
    runwayOverrideMonths: number | null;
    breakEvenAssumptions: Record<string, any>;
    createdAt: string | null;
    updatedAt: string | null;
};

export type FounderProfitBucket = {
    id: string;
    userId: string;
    bucketType: ProfitBucketType;
    allocationPercent: number;
    currentBalance: number | null;
    displayOrder: number;
    createdAt: string;
    updatedAt: string;
};

export type FounderFinancialAccount = {
    id: string;
    userId: string;
    name: string;
    accountType: "cash" | "operating" | "profit" | "owner_comp" | "tax" | "revenue_hold" | "other";
    institutionName: string | null;
    last4: string | null;
    isExternalFeed: boolean;
    isActive: boolean;
    provider?: string | null;
    providerItemId?: string | null;
    providerAccountId?: string | null;
    officialName?: string | null;
    subtype?: string | null;
    mask?: string | null;
    lastSyncedAt?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type PlaidItem = {
    id: string;
    userId: string;
    plaidItemId: string;
    institutionId: string | null;
    institutionName: string | null;
    status: string | null;
    syncCursor: string | null;
    lastSyncedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type PlaidReviewTransaction = {
    id: string;
    userId: string;
    plaidItemId: string;
    plaidAccountId: string | null;
    plaidTransactionId: string;
    name: string | null;
    merchantName: string | null;
    amount: number;
    currency: string | null;
    authorizedDate: string | null;
    postedDate: string | null;
    categoryRaw: any;
    pending: boolean;
    reviewStatus: "pending" | "accepted" | "ignored";
    mappedDirection: "expense" | "revenue" | null;
    linkedExpenseId: string | null;
    linkedRevenueId: string | null;
    importedAt: string;
    updatedAt: string | null;
};

export type FounderFinancialData = {
    accounts: FounderFinancialAccount[];
    expenses: FounderExpense[];
    revenue: FounderRevenue[];
    settings: FounderFinancialSettings | null;
    profitBuckets: FounderProfitBucket[];
    plaidItems: PlaidItem[];
    pendingPlaidTransactions: PlaidReviewTransaction[];
    usedLegacyExpenses: boolean;
};

export type FinancialSummary = {
    availableCash: number;
    startingCash: number;
    totalExpenses: number;
    totalRevenue: number;
    monthlyRecurringExpenses: number;
    monthlyRecurringRevenue: number;
    monthlyBurn: number;
    runwayMonths: number | null;
    roughNetSnapshot: number;
    recurringExpenseCount: number;
    recurringRevenueCount: number;
    defaultCurrency: string;
    usesEstimatedInputs: boolean;
    usesLegacyExpenses: boolean;
    dataWarning: string;
    breakEvenReady: boolean;
    breakEvenMessage: string;
    operatingView: {
        monthlyRevenue: number;
        monthlyExpenses: number;
        monthlyOperatingGap: number;
    };
    profitFirst: {
        enabled: boolean;
        basisLabel: string;
        basisAmount: number;
        buckets: Array<FounderProfitBucket & { estimatedAmount: number }>;
    };
    assumptions: string[];
};

export const DEFAULT_PROFIT_BUCKETS: Array<Pick<FounderProfitBucket, "bucketType" | "allocationPercent" | "displayOrder">> = [
    { bucketType: "income", allocationPercent: 100, displayOrder: 0 },
    { bucketType: "profit", allocationPercent: 5, displayOrder: 1 },
    { bucketType: "owner_comp", allocationPercent: 50, displayOrder: 2 },
    { bucketType: "tax", allocationPercent: 15, displayOrder: 3 },
    { bucketType: "opex", allocationPercent: 30, displayOrder: 4 },
];

export function getDefaultProfitBuckets(userId: string): FounderProfitBucket[] {
    const now = new Date().toISOString();
    return DEFAULT_PROFIT_BUCKETS.map((bucket, index) => ({
        id: `default-${bucket.bucketType}-${index}`,
        userId,
        bucketType: bucket.bucketType,
        allocationPercent: bucket.allocationPercent,
        currentBalance: null,
        displayOrder: bucket.displayOrder,
        createdAt: now,
        updatedAt: now,
    }));
}

function getMonthlyEquivalent(amount: number, frequency: FinancialFrequency) {
    if (!Number.isFinite(amount)) return 0;
    if (frequency === "monthly") return amount;
    if (frequency === "yearly") return amount / 12;
    return 0;
}

function getBudgetFallback(profile: any) {
    if (Number(profile?.budget?.remaining) > 0) return Number(profile.budget.remaining);
    if (Number(profile?.exactBudgetAmount) > 0) return Number(profile.exactBudgetAmount);
    if (Number(profile?.budget?.total) > 0) return Number(profile.budget.total);
    return getFallbackBudgetAmount(profile?.budgetRange);
}

export function buildLegacyBudgetMirror(expenses: FounderExpense[], revenue: FounderRevenue[]) {
    const safeExpenses = Array.isArray(expenses) ? expenses : [];
    const safeRevenue = Array.isArray(revenue) ? revenue : [];
    const mapFrequency = (value: FinancialFrequency) => {
        if (value === "monthly") return "monthly";
        if (value === "yearly") return "yearly";
        return "one-time";
    };

    return {
        expenses: safeExpenses.map((item) => ({
            id: item.id,
            label: item.label,
            amount: item.amount,
            date: item.incurredOn ?? item.createdAt,
            frequency: mapFrequency(item.frequency),
            renewalDate: item.renewalDate ?? undefined,
            category: item.category,
            source: item.source,
        })),
        income: safeRevenue.map((item) => ({
            id: item.id,
            label: item.label,
            amount: item.amount,
            date: item.receivedOn ?? item.createdAt,
            frequency: mapFrequency(item.frequency),
            renewalDate: item.renewalDate ?? undefined,
            category: item.category,
            source: item.source,
        })),
    };
}

export const buildLegacyFinancialMirror = buildLegacyBudgetMirror;

export function getFinancialSummary(
    profile: any,
    financialData: FounderFinancialData | null,
): FinancialSummary {
    const expenses = financialData?.expenses ?? [];
    const revenue = financialData?.revenue ?? [];
    const settings = financialData?.settings ?? null;
    const buckets = (financialData?.profitBuckets?.length ? financialData.profitBuckets : (profile?.id ? getDefaultProfitBuckets(profile.id) : []))
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder);

    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalRevenue = revenue.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthlyRecurringExpenses = expenses.reduce((sum, item) => {
        const recurring = item.isRecurring || item.frequency !== "one_time";
        return sum + (recurring ? getMonthlyEquivalent(Number(item.amount || 0), item.frequency) : 0);
    }, 0);
    const monthlyRecurringRevenue = revenue.reduce((sum, item) => {
        return sum + getMonthlyEquivalent(Number(item.amount || 0), item.frequency);
    }, 0);
    const recurringExpenseCount = expenses.filter((item) => item.isRecurring || item.frequency !== "one_time").length;
    const recurringRevenueCount = revenue.filter((item) => item.frequency !== "one_time").length;
    const startingCash = Number(settings?.startingCash ?? getBudgetFallback(profile) ?? 0);
    const computedAvailableCash = startingCash + totalRevenue - totalExpenses;
    const availableCash = settings?.startingCash != null
        ? Math.max(computedAvailableCash, 0)
        : Number(profile?.budget?.remaining ?? computedAvailableCash ?? getBudgetFallback(profile) ?? 0);
    const monthlyBurn = Math.max(monthlyRecurringExpenses - monthlyRecurringRevenue, 0);
    const runwayMonths = monthlyBurn > 0 ? availableCash / monthlyBurn : (settings?.runwayOverrideMonths ?? null);
    const roughNetSnapshot = totalRevenue - totalExpenses;
    const profitFirstBasisAmount = monthlyRecurringRevenue > 0 ? monthlyRecurringRevenue : (totalRevenue > 0 ? totalRevenue : availableCash);
    const profitFirstBasisLabel = monthlyRecurringRevenue > 0
        ? "Estimated monthly revenue basis"
        : totalRevenue > 0
            ? "Total logged revenue basis"
            : "Available cash basis";
    const bucketRows = buckets.map((bucket) => ({
        ...bucket,
        estimatedAmount: profitFirstBasisAmount * (Number(bucket.allocationPercent || 0) / 100),
    }));
    const usesEstimatedInputs = Boolean(profile?.budgetIsEstimated) || !settings?.startingCash || financialData?.usedLegacyExpenses === true;
    const hasOperatingData = monthlyRecurringExpenses > 0 || monthlyRecurringRevenue > 0;

    return {
        availableCash,
        startingCash,
        totalExpenses,
        totalRevenue,
        monthlyRecurringExpenses,
        monthlyRecurringRevenue,
        monthlyBurn,
        runwayMonths,
        roughNetSnapshot,
        recurringExpenseCount,
        recurringRevenueCount,
        defaultCurrency: settings?.defaultCurrency || "USD",
        usesEstimatedInputs,
        usesLegacyExpenses: financialData?.usedLegacyExpenses ?? false,
        dataWarning: "Estimates based on the data you’ve entered.",
        breakEvenReady: hasOperatingData && totalRevenue > 0,
        breakEvenMessage: hasOperatingData && totalRevenue > 0
            ? "This is a rough operating view, not accounting-grade reporting."
            : "Add revenue and categorize expenses to unlock a better break-even view.",
        operatingView: {
            monthlyRevenue: monthlyRecurringRevenue,
            monthlyExpenses: monthlyRecurringExpenses,
            monthlyOperatingGap: monthlyRecurringRevenue - monthlyRecurringExpenses,
        },
        profitFirst: {
            enabled: settings?.profitFirstEnabled ?? true,
            basisLabel: profitFirstBasisLabel,
            basisAmount: profitFirstBasisAmount,
            buckets: bucketRows,
        },
        assumptions: [
            "Monthly burn uses recurring monthly expenses minus recurring monthly revenue.",
            "Yearly recurring items are amortized across 12 months.",
            "One-time items affect the snapshot totals but not recurring burn.",
            "This is not accounting, tax, or legal advice.",
        ],
    };
}

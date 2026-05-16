import { supabase } from "../supabase";
import {
    buildLegacyBudgetMirror,
    getDefaultProfitBuckets,
    type FinancialFrequency,
    type FounderExpense,
    type FounderFinancialAccount,
    type FounderFinancialData,
    type FounderFinancialSettings,
    type FounderProfitBucket,
    type FounderRevenue,
    type LedgerEntry,
    type PlaidReviewTransaction,
    type ProfitBucketType,
} from "./financialModeling";

type ExpenseInput = {
    id?: string;
    accountId?: string | null;
    label: string;
    category?: string;
    amount: number;
    currency?: string;
    incurredOn?: string | null;
    frequency?: FinancialFrequency;
    renewalDate?: string | null;
    isRecurring?: boolean;
    notes?: string | null;
    source?: "manual" | "imported" | "legacy_migrated";
    ledgerSource?: "manual" | "plaid";
    ledgerReferenceId?: string | null;
};

type RevenueInput = {
    id?: string;
    accountId?: string | null;
    label: string;
    category?: string;
    amount: number;
    currency?: string;
    receivedOn?: string | null;
    frequency?: FinancialFrequency;
    renewalDate?: string | null;
    notes?: string | null;
    source?: "manual" | "imported" | "legacy_migrated";
    ledgerSource?: "manual" | "plaid";
    ledgerReferenceId?: string | null;
};

type LedgerEntryInput = {
    date: string | null | undefined;
    description: string;
    amount: number;
    type: "debit" | "credit";
    category?: string | null;
    account?: string | null;
    source: "manual" | "plaid" | "invoice";
    referenceId?: string | null;
    reconciledAt?: string | null;
};

function toIsoDateOrNull(value: string | null | undefined) {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
}

let ledgerEntriesAvailable: boolean | null = null;

function isMissingLedgerRelationError(error: any) {
    const message = String(error?.message ?? "").toLowerCase();
    return error?.code === "PGRST205" || message.includes("ledger_entries") || message.includes("could not find the table");
}

function mapLedgerEntry(row: any): LedgerEntry {
    return {
        id: row.id,
        userId: row.user_id,
        date: row.date,
        description: row.description ?? "",
        amount: Number(row.amount ?? 0),
        type: row.type,
        category: row.category ?? "uncategorized",
        account: row.account ?? "operating",
        source: row.source ?? "manual",
        referenceId: row.reference_id ?? null,
        reconciledAt: row.reconciled_at ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

async function loadLedgerEntries(userId: string): Promise<LedgerEntry[]> {
    if (ledgerEntriesAvailable === false) return [];

    const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

    if (error) {
        if (isMissingLedgerRelationError(error)) {
            ledgerEntriesAvailable = false;
            return [];
        }
        console.error("loadLedgerEntries error:", error.message);
        return [];
    }

    ledgerEntriesAvailable = true;
    return (data ?? []).map(mapLedgerEntry);
}

async function upsertLedgerEntry(userId: string, entry: LedgerEntryInput): Promise<LedgerEntry | null> {
    if (ledgerEntriesAvailable === false) return null;
    if (!Number.isFinite(Number(entry.amount)) || Number(entry.amount) <= 0) return null;

    const payload = {
        user_id: userId,
        date: toIsoDateOrNull(entry.date) ?? todayIso(),
        description: entry.description || "Ledger entry",
        amount: Math.abs(Number(entry.amount)),
        type: entry.type,
        category: entry.category || (entry.type === "credit" ? "sales" : "operating"),
        account: entry.account || "operating",
        source: entry.source,
        reference_id: entry.referenceId ?? null,
        reconciled_at: entry.reconciledAt ?? null,
        updated_at: new Date().toISOString(),
    };

    const query = entry.referenceId
        ? supabase.from("ledger_entries").upsert(payload, { onConflict: "user_id,source,reference_id,type" })
        : supabase.from("ledger_entries").insert(payload);

    const { data, error } = await query.select("*").single();
    if (error) {
        if (isMissingLedgerRelationError(error)) {
            ledgerEntriesAvailable = false;
            return null;
        }
        console.error("upsertLedgerEntry error:", error.message);
        return null;
    }

    ledgerEntriesAvailable = true;
    return data ? mapLedgerEntry(data) : null;
}

async function deleteLedgerEntriesForReference(
    userId: string,
    source: "manual" | "plaid" | "invoice",
    referenceId: string,
) {
    if (ledgerEntriesAvailable === false) return false;

    const { error } = await supabase
        .from("ledger_entries")
        .delete()
        .eq("user_id", userId)
        .eq("source", source)
        .eq("reference_id", referenceId);

    if (error) {
        if (isMissingLedgerRelationError(error)) {
            ledgerEntriesAvailable = false;
            return false;
        }
        console.error("deleteLedgerEntriesForReference error:", error.message);
        return false;
    }
    ledgerEntriesAvailable = true;
    return true;
}

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function mapExpense(row: any): FounderExpense {
    return {
        id: row.id,
        userId: row.user_id,
        accountId: row.account_id ?? null,
        label: row.label,
        category: row.category ?? "operating",
        amount: Number(row.amount ?? 0),
        currency: row.currency ?? "USD",
        incurredOn: row.incurred_on ?? null,
        frequency: row.frequency ?? "one_time",
        renewalDate: row.renewal_date ?? null,
        isRecurring: Boolean(row.is_recurring),
        notes: row.notes ?? null,
        source: row.source ?? "manual",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapRevenue(row: any): FounderRevenue {
    return {
        id: row.id,
        userId: row.user_id,
        accountId: row.account_id ?? null,
        label: row.label,
        category: row.category ?? "sales",
        amount: Number(row.amount ?? 0),
        currency: row.currency ?? "USD",
        receivedOn: row.received_on ?? null,
        frequency: row.frequency ?? "one_time",
        renewalDate: row.renewal_date ?? null,
        notes: row.notes ?? null,
        source: row.source ?? "manual",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapAccount(row: any): FounderFinancialAccount {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        accountType: row.account_type,
        institutionName: row.institution_name ?? null,
        last4: row.last4 ?? null,
        isExternalFeed: Boolean(row.is_external_feed),
        isActive: Boolean(row.is_active),
        provider: row.provider ?? null,
        providerItemId: row.provider_item_id ?? null,
        providerAccountId: row.provider_account_id ?? null,
        officialName: row.official_name ?? null,
        subtype: row.subtype ?? null,
        mask: row.mask ?? null,
        lastSyncedAt: row.last_synced_at ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapSettings(row: any): FounderFinancialSettings {
    return {
        userId: row.user_id,
        startingCash: row.starting_cash == null ? null : Number(row.starting_cash),
        defaultCurrency: row.default_currency ?? "USD",
        profitFirstEnabled: row.profit_first_enabled ?? true,
        runwayOverrideMonths: row.runway_override_months == null ? null : Number(row.runway_override_months),
        breakEvenAssumptions: row.break_even_assumptions ?? {},
        createdAt: row.created_at ?? null,
        updatedAt: row.updated_at ?? null,
    };
}

function mapBucket(row: any): FounderProfitBucket {
    return {
        id: row.id,
        userId: row.user_id,
        bucketType: row.bucket_type as ProfitBucketType,
        allocationPercent: Number(row.allocation_percent ?? 0),
        currentBalance: row.current_balance == null ? null : Number(row.current_balance),
        displayOrder: Number(row.display_order ?? 0),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapPlaidReviewTransaction(row: any): PlaidReviewTransaction {
    return {
        id: row.id,
        userId: row.user_id,
        plaidItemId: row.plaid_item_id,
        plaidAccountId: row.plaid_account_id ?? null,
        plaidTransactionId: row.plaid_transaction_id,
        name: row.name ?? null,
        merchantName: row.merchant_name ?? null,
        amount: Number(row.amount ?? 0),
        currency: row.currency ?? null,
        authorizedDate: row.authorized_date ?? null,
        postedDate: row.posted_date ?? null,
        categoryRaw: row.category_raw ?? [],
        pending: Boolean(row.pending),
        reviewStatus: row.review_status ?? "pending",
        mappedDirection: row.mapped_direction ?? null,
        linkedExpenseId: row.linked_expense_id ?? null,
        linkedRevenueId: row.linked_revenue_id ?? null,
        importedAt: row.imported_at,
        updatedAt: row.updated_at ?? null,
    };
}

async function ensureDefaultProfitBuckets(userId: string, existingBuckets: FounderProfitBucket[]) {
    if (existingBuckets.length > 0) return existingBuckets;
    const defaults = getDefaultProfitBuckets(userId);
    const rows = defaults.map((bucket) => ({
        user_id: userId,
        bucket_type: bucket.bucketType,
        allocation_percent: bucket.allocationPercent,
        current_balance: bucket.currentBalance,
        display_order: bucket.displayOrder,
    }));
    const { data, error } = await supabase
        .from("founder_profit_buckets")
        .upsert(rows, { onConflict: "user_id,bucket_type" })
        .select("*");
    if (error || !data) return defaults;
    return data.map(mapBucket);
}

async function migrateLegacyExpenses(userId: string, profile: any) {
    const legacyExpenses = profile?.budget?.expenses ?? [];
    if (!legacyExpenses.length) return false;

    const { data: existingLegacyRows, error: existingLegacyError } = await supabase
        .from("founder_expenses")
        .select("id")
        .eq("user_id", userId)
        .eq("source", "legacy_migrated")
        .limit(1);
    if (existingLegacyError) {
        console.error("migrateLegacyExpenses existing check error:", existingLegacyError.message);
        return false;
    }
    if (existingLegacyRows && existingLegacyRows.length > 0) return false;

    const rows = legacyExpenses.map((item: any) => ({
        user_id: userId,
        label: item.label || "Legacy expense",
        category: item.category || "operating",
        amount: Number(item.amount || 0),
        currency: "USD",
        incurred_on: toIsoDateOrNull(item.date) ?? toIsoDateOrNull(item.renewalDate),
        frequency: item.frequency === "monthly" ? "monthly" : item.frequency === "yearly" ? "yearly" : "one_time",
        renewal_date: toIsoDateOrNull(item.renewalDate),
        is_recurring: item.frequency === "monthly" || item.frequency === "yearly",
        notes: "Migrated from legacy profile budget expenses.",
        source: "legacy_migrated",
    })).filter((item) => item.amount > 0);

    if (!rows.length) return false;
    const { error } = await supabase.from("founder_expenses").insert(rows);
    if (error) {
        console.error("migrateLegacyExpenses insert error:", error.message);
        return false;
    }
    return true;
}

export async function loadFounderFinancialData(userId: string, profile?: any): Promise<FounderFinancialData> {
    const [accountsResult, expensesResult, revenueResult, settingsResult, bucketsResult, ledgerEntries] = await Promise.all([
        supabase.from("founder_financial_accounts").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("founder_expenses").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("founder_revenue").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
        supabase.from("founder_financial_settings").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("founder_profit_buckets").select("*").eq("user_id", userId).order("display_order", { ascending: true }),
        loadLedgerEntries(userId),
    ]);

    if (expensesResult.error) console.error("loadFounderFinancialData expenses error:", expensesResult.error.message);
    if (revenueResult.error) console.error("loadFounderFinancialData revenue error:", revenueResult.error.message);
    if (settingsResult.error) console.error("loadFounderFinancialData settings error:", settingsResult.error.message);
    if (accountsResult.error) console.error("loadFounderFinancialData accounts error:", accountsResult.error.message);
    if (bucketsResult.error) console.error("loadFounderFinancialData buckets error:", bucketsResult.error.message);

    let expenses = (expensesResult.data ?? []).map(mapExpense);
    let usedLegacyExpenses = false;
    if (!expenses.length && profile?.budget?.expenses?.length) {
        const migrated = await migrateLegacyExpenses(userId, profile);
        if (migrated) {
            const { data: reloaded } = await supabase
                .from("founder_expenses")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });
            expenses = (reloaded ?? []).map(mapExpense);
            usedLegacyExpenses = true;
        } else {
            usedLegacyExpenses = true;
        }
    }

    const buckets = await ensureDefaultProfitBuckets(userId, (bucketsResult.data ?? []).map(mapBucket));

    return {
        accounts: (accountsResult.data ?? []).map(mapAccount),
        expenses,
        revenue: (revenueResult.data ?? []).map(mapRevenue),
        settings: settingsResult.data ? mapSettings(settingsResult.data) : null,
        profitBuckets: buckets,
        plaidItems: [],
        pendingPlaidTransactions: [],
        ledgerEntries,
        usedLegacyExpenses,
    };
}

export async function saveExpense(userId: string, input: ExpenseInput): Promise<FounderExpense | null> {
    const payload = {
        user_id: userId,
        account_id: input.accountId ?? null,
        label: input.label,
        category: input.category ?? "operating",
        amount: Number(input.amount ?? 0),
        currency: input.currency ?? "USD",
        incurred_on: toIsoDateOrNull(input.incurredOn),
        frequency: input.frequency ?? "one_time",
        renewal_date: toIsoDateOrNull(input.renewalDate),
        is_recurring: input.isRecurring ?? ((input.frequency ?? "one_time") !== "one_time"),
        notes: input.notes ?? null,
        source: input.source ?? "manual",
        updated_at: new Date().toISOString(),
    };
    const query = input.id
        ? supabase.from("founder_expenses").upsert({ ...payload, id: input.id }, { onConflict: "id" })
        : supabase.from("founder_expenses").insert(payload);
    const { data, error } = await query.select("*").single();
    if (error || !data) {
        console.error("saveExpense error:", error?.message);
        return null;
    }
    const saved = mapExpense(data);
    const ledgerSource = input.ledgerSource ?? (saved.source === "imported" ? "plaid" : "manual");
    await upsertLedgerEntry(userId, {
        date: saved.incurredOn ?? saved.createdAt,
        description: saved.label,
        amount: saved.amount,
        type: "debit",
        category: saved.category,
        account: saved.accountId ?? "operating",
        source: ledgerSource,
        referenceId: input.ledgerReferenceId ?? saved.id,
        reconciledAt: null,
    });
    return saved;
}

export async function deleteExpense(userId: string, expenseId: string) {
    const { error } = await supabase
        .from("founder_expenses")
        .delete()
        .eq("user_id", userId)
        .eq("id", expenseId);
    if (error) console.error("deleteExpense error:", error.message);
    if (!error) {
        await deleteLedgerEntriesForReference(userId, "manual", expenseId);
        await deleteLedgerEntriesForReference(userId, "plaid", expenseId);
    }
    return !error;
}

export async function saveRevenue(userId: string, input: RevenueInput): Promise<FounderRevenue | null> {
    const payload = {
        user_id: userId,
        account_id: input.accountId ?? null,
        label: input.label,
        category: input.category ?? "sales",
        amount: Number(input.amount ?? 0),
        currency: input.currency ?? "USD",
        received_on: toIsoDateOrNull(input.receivedOn),
        frequency: input.frequency ?? "one_time",
        renewal_date: toIsoDateOrNull(input.renewalDate),
        notes: input.notes ?? null,
        source: input.source ?? "manual",
        updated_at: new Date().toISOString(),
    };
    const query = input.id
        ? supabase.from("founder_revenue").upsert({ ...payload, id: input.id }, { onConflict: "id" })
        : supabase.from("founder_revenue").insert(payload);
    const { data, error } = await query.select("*").single();
    if (error || !data) {
        console.error("saveRevenue error:", error?.message);
        return null;
    }
    const saved = mapRevenue(data);
    const ledgerSource = input.ledgerSource ?? (saved.source === "imported" ? "plaid" : "manual");
    await upsertLedgerEntry(userId, {
        date: saved.receivedOn ?? saved.createdAt,
        description: saved.label,
        amount: saved.amount,
        type: "credit",
        category: saved.category,
        account: saved.accountId ?? "operating",
        source: ledgerSource,
        referenceId: input.ledgerReferenceId ?? saved.id,
        reconciledAt: null,
    });
    return saved;
}

export async function deleteRevenue(userId: string, revenueId: string) {
    const { error } = await supabase
        .from("founder_revenue")
        .delete()
        .eq("user_id", userId)
        .eq("id", revenueId);
    if (error) console.error("deleteRevenue error:", error.message);
    if (!error) {
        await deleteLedgerEntriesForReference(userId, "manual", revenueId);
        await deleteLedgerEntriesForReference(userId, "plaid", revenueId);
    }
    return !error;
}

export async function saveFinancialSettings(userId: string, updates: Partial<FounderFinancialSettings>) {
    const payload = {
        user_id: userId,
        starting_cash: updates.startingCash ?? null,
        default_currency: updates.defaultCurrency ?? "USD",
        profit_first_enabled: updates.profitFirstEnabled ?? true,
        runway_override_months: updates.runwayOverrideMonths ?? null,
        break_even_assumptions: updates.breakEvenAssumptions ?? {},
        updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
        .from("founder_financial_settings")
        .upsert(payload, { onConflict: "user_id" })
        .select("*")
        .single();
    if (error || !data) {
        console.error("saveFinancialSettings error:", error?.message);
        return null;
    }
    return mapSettings(data);
}

export async function saveProfitBuckets(userId: string, buckets: Array<Partial<FounderProfitBucket> & { bucketType: ProfitBucketType }>) {
    const rows = buckets.map((bucket, index) => ({
        user_id: userId,
        bucket_type: bucket.bucketType,
        allocation_percent: Number(bucket.allocationPercent ?? 0),
        current_balance: bucket.currentBalance ?? null,
        display_order: bucket.displayOrder ?? index,
        updated_at: new Date().toISOString(),
    }));
    const { data, error } = await supabase
        .from("founder_profit_buckets")
        .upsert(rows, { onConflict: "user_id,bucket_type" })
        .select("*");
    if (error || !data) {
        console.error("saveProfitBuckets error:", error?.message);
        return [];
    }
    return data.map(mapBucket).sort((a, b) => a.displayOrder - b.displayOrder);
}

export function buildLegacyFinancialMirror(financialData: FounderFinancialData) {
    return buildLegacyBudgetMirror(financialData.expenses, financialData.revenue);
}

export async function loadPendingPlaidTransactions(userId: string) {
    const { data, error } = await supabase
        .from("plaid_transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("review_status", "pending")
        .order("posted_date", { ascending: false })
        .order("imported_at", { ascending: false });
    if (error) {
        console.error("loadPendingPlaidTransactions error:", error.message);
        return [];
    }
    return (data ?? []).map(mapPlaidReviewTransaction);
}

export async function ignorePlaidTransaction(userId: string, transactionId: string) {
    const { error } = await supabase
        .from("plaid_transactions")
        .update({
            review_status: "ignored",
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("id", transactionId);
    if (error) {
        console.error("ignorePlaidTransaction error:", error.message);
        return false;
    }
    return true;
}

export async function acceptPlaidTransactionAsExpense(userId: string, transaction: PlaidReviewTransaction) {
    const expense = await saveExpense(userId, {
        label: transaction.merchantName || transaction.name || "Imported transaction",
        amount: Math.abs(Number(transaction.amount || 0)),
        category: "operating",
        incurredOn: transaction.postedDate ?? transaction.authorizedDate,
        frequency: "one_time",
        notes: `Imported from Plaid transaction ${transaction.plaidTransactionId}`,
        source: "imported",
        ledgerSource: "plaid",
        ledgerReferenceId: transaction.id,
    });
    if (!expense) return null;

    const { error } = await supabase
        .from("plaid_transactions")
        .update({
            review_status: "accepted",
            mapped_direction: "expense",
            linked_expense_id: expense.id,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("id", transaction.id);
    if (error) {
        console.error("acceptPlaidTransactionAsExpense error:", error.message);
        return null;
    }
    return expense;
}

export async function acceptPlaidTransactionAsRevenue(userId: string, transaction: PlaidReviewTransaction) {
    const revenue = await saveRevenue(userId, {
        label: transaction.merchantName || transaction.name || "Imported transaction",
        amount: Math.abs(Number(transaction.amount || 0)),
        category: "sales",
        receivedOn: transaction.postedDate ?? transaction.authorizedDate,
        frequency: "one_time",
        notes: `Imported from Plaid transaction ${transaction.plaidTransactionId}`,
        source: "imported",
        ledgerSource: "plaid",
        ledgerReferenceId: transaction.id,
    });
    if (!revenue) return null;

    const { error } = await supabase
        .from("plaid_transactions")
        .update({
            review_status: "accepted",
            mapped_direction: "revenue",
            linked_revenue_id: revenue.id,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("id", transaction.id);
    if (error) {
        console.error("acceptPlaidTransactionAsRevenue error:", error.message);
        return null;
    }
    return revenue;
}

export async function markLedgerEntryReconciled(userId: string, ledgerEntryId: string): Promise<boolean> {
    if (ledgerEntriesAvailable === false) return false;

    const { error } = await supabase
        .from("ledger_entries")
        .update({
            reconciled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("id", ledgerEntryId);

    if (error) {
        if (isMissingLedgerRelationError(error)) {
            ledgerEntriesAvailable = false;
            return false;
        }
        console.error("markLedgerEntryReconciled error:", error.message);
        return false;
    }

    return true;
}

// ── Invoices (Supabase) ───────────────────────────────────────────────────────

export type FounderInvoice = {
    id: string;
    invoiceNumber: string;
    clientName: string;
    clientEmail: string;
    description: string;
    amount: number;
    currency: string;
    issuedDate: string;
    dueDate: string;
    status: "draft" | "sent" | "paid";
    notes: string;
    createdAt: string;
};

function mapInvoice(row: any): FounderInvoice {
    const lineItems = Array.isArray(row.line_items) ? row.line_items : [];
    const first = lineItems[0] ?? {};
    return {
        id: row.id,
        invoiceNumber: row.invoice_number ?? "",
        clientName: row.client_name ?? "",
        clientEmail: row.client_email ?? "",
        description: first.description ?? "",
        amount: Number(row.total_amount ?? 0),
        currency: first.currency ?? "USD",
        issuedDate: first.issuedDate ?? (row.created_at ?? "").slice(0, 10),
        dueDate: row.due_date ?? "",
        status: (row.status as "draft" | "sent" | "paid") ?? "draft",
        notes: row.notes ?? "",
        createdAt: row.created_at ?? "",
    };
}

function generateInvoiceNumber(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const r = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `INV-${y}${m}-${r}`;
}

export async function loadInvoicesFromDb(userId: string): Promise<FounderInvoice[]> {
    const { data, error } = await supabase
        .from("founder_invoices")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
    if (error) {
        console.error("loadInvoicesFromDb error:", error.message);
        return [];
    }
    return (data ?? []).map(mapInvoice);
}

export async function saveInvoiceToDb(
    userId: string,
    invoice: Omit<FounderInvoice, "id" | "invoiceNumber" | "createdAt"> & { id?: string; invoiceNumber?: string },
): Promise<FounderInvoice | null> {
    const lineItems = [{ description: invoice.description, currency: invoice.currency, issuedDate: invoice.issuedDate }];
    const payload = {
        user_id: userId,
        invoice_number: invoice.invoiceNumber ?? generateInvoiceNumber(),
        client_name: invoice.clientName,
        client_email: invoice.clientEmail || null,
        line_items: lineItems,
        due_date: invoice.dueDate || null,
        notes: invoice.notes || null,
        status: invoice.status ?? "draft",
        total_amount: Number(invoice.amount ?? 0),
        updated_at: new Date().toISOString(),
    };

    const query = invoice.id
        ? supabase.from("founder_invoices").upsert({ ...payload, id: invoice.id }, { onConflict: "id" })
        : supabase.from("founder_invoices").insert(payload);

    const { data, error } = await query.select("*").single();
    if (error || !data) {
        console.error("saveInvoiceToDb error:", error?.message);
        return null;
    }
    const saved = mapInvoice(data);
    if (saved.status === "paid") {
        await upsertLedgerEntry(userId, {
            date: saved.issuedDate || saved.createdAt,
            description: `Invoice: ${saved.clientName || saved.invoiceNumber}`,
            amount: saved.amount,
            type: "credit",
            category: "sales",
            account: "accounts_receivable",
            source: "invoice",
            referenceId: saved.id,
        });
    } else {
        await deleteLedgerEntriesForReference(userId, "invoice", saved.id);
    }
    return saved;
}

export async function deleteInvoiceFromDb(userId: string, invoiceId: string): Promise<boolean> {
    const { error } = await supabase
        .from("founder_invoices")
        .delete()
        .eq("user_id", userId)
        .eq("id", invoiceId);
    if (error) console.error("deleteInvoiceFromDb error:", error.message);
    if (!error) await deleteLedgerEntriesForReference(userId, "invoice", invoiceId);
    return !error;
}

// ── Monthly Close Notes ───────────────────────────────────────────────────────

export async function saveMonthlyCloseNote(
    userId: string,
    data: {
        monthYear: string;
        revenue: number | null;
        expenses: number | null;
        net: number | null;
        forgeInsight: string | null;
        founderNote: string | null;
        revenueGoal: number | null;
    },
): Promise<boolean> {
    const { error } = await supabase.from("monthly_close_notes").insert({
        user_id: userId,
        month_year: data.monthYear,
        revenue: data.revenue,
        expenses: data.expenses,
        net: data.net,
        forge_insight: data.forgeInsight || null,
        founder_note: data.founderNote || null,
        revenue_goal: data.revenueGoal,
    });
    if (error) console.error("saveMonthlyCloseNote error:", error.message);
    return !error;
}

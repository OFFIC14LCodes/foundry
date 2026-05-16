import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    getFinancialSummary,
    type FinancialSummary,
    type FounderFinancialData,
    type ProfitBucketType,
} from "../lib/financialModeling";
import {
    deleteInvoiceFromDb,
    loadFounderFinancialData,
    loadInvoicesFromDb,
    markLedgerEntryReconciled,
    saveExpense,
    saveFinancialSettings,
    saveInvoiceToDb,
    saveMonthlyCloseNote,
    saveProfitBuckets,
    saveRevenue,
    type FounderInvoice,
} from "../lib/financialDb";
import { callForgeAPI, streamForgeAPI } from "../lib/forgeApi";
import { saveJournalEntry } from "../db";
import { printStyledPdf } from "../lib/documentExport";
import { formatCurrency } from "../lib/budget";
import HelpTooltip from "./HelpTooltip";

// ─── Types ────────────────────────────────────────────────────────────────────

type BucketDraftRow = { bucketType: ProfitBucketType; allocationPercent: number };

type ChartMonth = {
    year: number;
    month: number;
    label: string;
    revenue: number;
    expenses: number;
};

type ProfitLossCategoryRow = {
    category: string;
    revenue: number;
    expenses: number;
    net: number;
};

interface Props {
    userId: string;
    profile: any;
    onBack: () => void;
    onOpenNav?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET_LABELS: Record<ProfitBucketType, string> = {
    income: "Income",
    profit: "Profit",
    owner_comp: "Owner Comp",
    tax: "Tax",
    opex: "Operating",
};

const BUCKET_COLORS: Record<ProfitBucketType, string> = {
    income: "#F0EDE8",
    profit: "#4CAF8A",
    owner_comp: "#4CAF8A",
    tax: "#4CAF8A",
    opex: "rgba(240,237,232,0.3)",
};

const INVOICE_STORAGE_KEY_PREFIX = "foundry_invoices_";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

function dueDateDefault() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
}

function nextMonthFirstDay() {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
}

function buildInvoiceMarkdown(invoice: FounderInvoice, businessName: string): string {
    return [
        `# Invoice`,
        ``,
        `**Invoice #:** ${invoice.invoiceNumber}`,
        `**Issued:** ${invoice.issuedDate}`,
        `**Due:** ${invoice.dueDate}`,
        `**Status:** ${invoice.status.toUpperCase()}`,
        ``,
        `---`,
        ``,
        `**Bill To:** ${invoice.clientName}${invoice.clientEmail ? `  \n${invoice.clientEmail}` : ""}`,
        ``,
        `**From:** ${businessName}`,
        ``,
        `---`,
        ``,
        `## Services`,
        ``,
        invoice.description,
        ``,
        `---`,
        ``,
        `**Total Due:** ${formatCurrency(invoice.amount)} ${invoice.currency || "USD"}`,
        ``,
        invoice.notes ? `**Notes:** ${invoice.notes}` : "",
    ]
        .filter((line) => line !== undefined)
        .join("\n");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FinancialDashboardScreen({ userId, profile, onBack, onOpenNav }: Props) {
    const [financialData, setFinancialData] = useState<FounderFinancialData | null>(null);
    const [loading, setLoading] = useState(true);

    // Profit First
    const [editingBuckets, setEditingBuckets] = useState(false);
    const [bucketDraft, setBucketDraft] = useState<BucketDraftRow[]>([]);
    const [savingBuckets, setSavingBuckets] = useState(false);

    const [reconcilingLedgerId, setReconcilingLedgerId] = useState<string | null>(null);

    // Invoices
    const [invoices, setInvoices] = useState<FounderInvoice[]>([]);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<FounderInvoice | null>(null);
    const [invoiceDraft, setInvoiceDraft] = useState<Partial<FounderInvoice>>({});

    // Tax
    const [showTaxAsideModal, setShowTaxAsideModal] = useState(false);

    // Estimated data — starting cash modal
    const [showStartingCashModal, setShowStartingCashModal] = useState(false);
    const [startingCashInput, setStartingCashInput] = useState("");
    const [savingStartingCash, setSavingStartingCash] = useState(false);

    // Vital sign tooltip hover
    // Quick-add revenue / expense from chart empty state
    const [showAddRevenueModal, setShowAddRevenueModal] = useState(false);
    const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
    const [quickRevDraft, setQuickRevDraft] = useState({ label: "", amount: "", frequency: "one_time" as const, receivedOn: todayIso() });
    const [quickExpDraft, setQuickExpDraft] = useState({ label: "", amount: "", frequency: "one_time" as const, incurredOn: todayIso() });
    const [savingQuick, setSavingQuick] = useState(false);

    // Forge health summary
    const [forgeHealthSummary, setForgeHealthSummary] = useState<string | null>(null);
    const [forgeHealthLoading, setForgeHealthLoading] = useState(false);
    const forgeHealthGenerated = useRef(false);

    // Monthly close
    const [showMonthlyClose, setShowMonthlyClose] = useState(false);
    const [closeStep, setCloseStep] = useState<1 | 2 | 3>(1);
    const [closeFounderNote, setCloseFounderNote] = useState("");
    const [forgeInsight, setForgeInsight] = useState("");
    const [forgeInsightLoading, setForgeInsightLoading] = useState(false);
    const [nextMonthGoal, setNextMonthGoal] = useState("");
    const [nextMonthExpenses, setNextMonthExpenses] = useState([
        { label: "", amount: "" },
        { label: "", amount: "" },
        { label: "", amount: "" },
    ]);
    const [savingClose, setSavingClose] = useState(false);
    const [journalSaved, setJournalSaved] = useState(false);

    // ── Load data ──────────────────────────────────────────────────────────────

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            const data = await loadFounderFinancialData(userId, profile);
            setFinancialData(data);
        } catch (err) {
            console.error("FinancialDashboardScreen load error:", err);
        } finally {
            setLoading(false);
        }
    }, [profile, userId]);

    useEffect(() => {
        void reload();

        // Load invoices from Supabase, migrating any localStorage invoices first
        const migrateAndLoad = async () => {
            const legacyKey = `${INVOICE_STORAGE_KEY_PREFIX}${userId}`;
            const legacyRaw = localStorage.getItem(legacyKey);
            if (legacyRaw) {
                try {
                    const legacyInvoices = JSON.parse(legacyRaw) as any[];
                    for (const inv of legacyInvoices) {
                        await saveInvoiceToDb(userId, {
                            invoiceNumber: inv.id?.startsWith("inv_") ? undefined : inv.id,
                            clientName: inv.clientName ?? "",
                            clientEmail: inv.clientEmail ?? "",
                            description: inv.description ?? "",
                            amount: Number(inv.amount ?? 0),
                            currency: inv.currency ?? "USD",
                            issuedDate: inv.issuedDate ?? todayIso(),
                            dueDate: inv.dueDate ?? "",
                            status: inv.status ?? "draft",
                            notes: inv.notes ?? "",
                        });
                    }
                    localStorage.removeItem(legacyKey);
                } catch {
                    // Migration best-effort — don't block load
                }
            }
            const loaded = await loadInvoicesFromDb(userId);
            setInvoices(loaded);
        };
        void migrateAndLoad();
    }, [reload, userId]);

    const summary: FinancialSummary | null = useMemo(
        () => (financialData ? getFinancialSummary(profile, financialData) : null),
        [profile, financialData],
    );

    // ── Forge health summary ───────────────────────────────────────────────────

    useEffect(() => {
        if (!summary || forgeHealthGenerated.current) return;
        const hasData = summary.availableCash > 0 || summary.monthlyBurn > 0 || summary.totalRevenue > 0;
        if (!hasData) return;

        forgeHealthGenerated.current = true;
        setForgeHealthLoading(true);

        const prompt = `In 2 sentences maximum, summarize this founder's financial health in plain English. Be direct and specific. No generic advice. Start with the most important thing the numbers say.

Available cash: ${formatCurrency(summary.availableCash)}
Monthly burn: ${formatCurrency(summary.monthlyBurn)}
Runway: ${summary.runwayMonths != null ? `${summary.runwayMonths.toFixed(1)} months` : "unknown"}
Net snapshot: ${formatCurrency(summary.roughNetSnapshot)}
Profit First enabled: ${summary.profitFirst.enabled ? "yes" : "no"}`;

        callForgeAPI(
            [{ role: "user", content: prompt }],
            "You are Forge, a direct financial co-pilot for founders. Respond in 2 sentences maximum. Be specific to the numbers. No filler.",
            150,
        )
            .then((text) => setForgeHealthSummary(text))
            .catch(() => setForgeHealthSummary(null))
            .finally(() => setForgeHealthLoading(false));
    }, [summary]);

    const handleRefreshHealthSummary = () => {
        if (!summary) return;
        forgeHealthGenerated.current = false;
        setForgeHealthSummary(null);
        // Re-trigger the effect by toggling a flag
        const trigger = () => {
            forgeHealthGenerated.current = false;
            setForgeHealthLoading(true);
            const prompt = `In 2 sentences maximum, summarize this founder's financial health in plain English. Be direct and specific. No generic advice. Start with the most important thing the numbers say.

Available cash: ${formatCurrency(summary.availableCash)}
Monthly burn: ${formatCurrency(summary.monthlyBurn)}
Runway: ${summary.runwayMonths != null ? `${summary.runwayMonths.toFixed(1)} months` : "unknown"}
Net snapshot: ${formatCurrency(summary.roughNetSnapshot)}
Profit First enabled: ${summary.profitFirst.enabled ? "yes" : "no"}`;
            callForgeAPI(
                [{ role: "user", content: prompt }],
                "You are Forge, a direct financial co-pilot for founders. Respond in 2 sentences maximum. Be specific to the numbers. No filler.",
                150,
            )
                .then((text) => { forgeHealthGenerated.current = true; setForgeHealthSummary(text); })
                .catch(() => setForgeHealthSummary(null))
                .finally(() => setForgeHealthLoading(false));
        };
        trigger();
    };

    // ── Chart data ─────────────────────────────────────────────────────────────

    const chartData: ChartMonth[] = useMemo(() => {
        const months: ChartMonth[] = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - (5 - i));
            return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("en-US", { month: "short" }), revenue: 0, expenses: 0 };
        });
        if (!financialData) return months;
        if (financialData.ledgerEntries.length > 0) {
            for (const entry of financialData.ledgerEntries) {
                const d = new Date(entry.date + "T00:00:00");
                const idx = months.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth());
                if (idx < 0) continue;
                if (entry.type === "credit") months[idx].revenue += Number(entry.amount || 0);
                if (entry.type === "debit") months[idx].expenses += Number(entry.amount || 0);
            }
            return months;
        }
        for (const rev of financialData.revenue) {
            if (!rev.receivedOn) continue;
            const d = new Date(rev.receivedOn + "T00:00:00");
            const idx = months.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth());
            if (idx >= 0) months[idx].revenue += Number(rev.amount || 0);
        }
        for (const exp of financialData.expenses) {
            if (!exp.incurredOn) continue;
            const d = new Date(exp.incurredOn + "T00:00:00");
            const idx = months.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth());
            if (idx >= 0) months[idx].expenses += Number(exp.amount || 0);
        }
        return months;
    }, [financialData]);

    const chartMax = useMemo(() => Math.max(...chartData.flatMap((m) => [m.revenue, m.expenses]), 1), [chartData]);
    const chartIsEmpty = useMemo(() => chartData.every((m) => m.revenue === 0 && m.expenses === 0), [chartData]);
    const chartActiveMonths = useMemo(() => chartData.filter((m) => m.revenue > 0 || m.expenses > 0).length, [chartData]);

    // ── Ledger-based P&L and tax estimates ─────────────────────────────────────

    const profitLoss = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const ledgerRows = financialData?.ledgerEntries ?? [];
        const rowsInRange = ledgerRows.filter((entry) => {
            const d = new Date(entry.date + "T00:00:00");
            return d.getFullYear() === currentYear;
        });
        const byCategory = new Map<string, ProfitLossCategoryRow>();

        for (const entry of rowsInRange) {
            const category = entry.category || "uncategorized";
            const existing = byCategory.get(category) ?? { category, revenue: 0, expenses: 0, net: 0 };
            if (entry.type === "credit") existing.revenue += Number(entry.amount || 0);
            if (entry.type === "debit") existing.expenses += Number(entry.amount || 0);
            existing.net = existing.revenue - existing.expenses;
            byCategory.set(category, existing);
        }

        const revenue = rowsInRange.filter((entry) => entry.type === "credit").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
        const expenses = rowsInRange.filter((entry) => entry.type === "debit").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
        const categoryRows = Array.from(byCategory.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, 5);

        return {
            year: currentYear,
            revenue,
            expenses,
            netIncome: revenue - expenses,
            categoryRows,
            hasLedger: ledgerRows.length > 0,
        };
    }, [financialData]);

    const unreconciledLedgerEntries = useMemo(
        () => (financialData?.ledgerEntries ?? []).filter((entry) => !entry.reconciledAt),
        [financialData],
    );

    const taxableIncome = Math.max(profitLoss.revenue - profitLoss.expenses, 0);
    const taxBasisLabel = profitLoss.hasLedger
        ? `${formatCurrency(profitLoss.revenue)} ledger revenue - ${formatCurrency(profitLoss.expenses)} deductible ledger expenses = ${formatCurrency(taxableIncome)} estimated taxable income`
        : "Ledger rows are not available yet, so this falls back to logged revenue minus logged expenses.";

    const fallbackTaxableIncome = Math.max((summary?.totalRevenue ?? 0) - (summary?.totalExpenses ?? 0), 0);
    const taxBasisAmount = profitLoss.hasLedger ? taxableIncome : fallbackTaxableIncome;
    const seTax = taxBasisAmount * 0.153;
    const federalTax = taxBasisAmount * 0.22;
    const totalTax = seTax + federalTax;
    const quarterlyTax = totalTax / 4;

    // ── Monthly close data ─────────────────────────────────────────────────────

    const closeMonthData = useMemo(() => {
        const now = new Date();
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const prevYear = prevDate.getFullYear();
        const prevMonth = prevDate.getMonth();

        const rev = (financialData?.revenue ?? [])
            .filter((r) => {
                if (!r.receivedOn) return false;
                const d = new Date(r.receivedOn + "T00:00:00");
                return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
            })
            .reduce((s, r) => s + r.amount, 0);

        const exp = (financialData?.expenses ?? [])
            .filter((e) => {
                if (!e.incurredOn) return false;
                const d = new Date(e.incurredOn + "T00:00:00");
                return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
            })
            .reduce((s, e) => s + e.amount, 0);

        return {
            prevMonthLabel: prevDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
            nextMonthLabel: nextDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
            revenue: rev,
            expenses: exp,
            net: rev - exp,
        };
    }, [financialData]);

    // ── CSV export ─────────────────────────────────────────────────────────────

    const handleExportCsv = () => {
        const expenses = financialData?.expenses ?? [];
        const revenue = financialData?.revenue ?? [];
        const lines: string[] = [];

        lines.push("EXPENSES");
        lines.push("Date,Label,Category,Amount,Frequency,Recurring");
        for (const exp of expenses) {
            const date = exp.incurredOn || exp.createdAt.slice(0, 10);
            lines.push(`${date},"${exp.label}","${exp.category}",${exp.amount},${exp.frequency},${exp.isRecurring ? "Yes" : "No"}`);
        }
        lines.push("");

        lines.push("REVENUE");
        lines.push("Date,Label,Category,Amount,Frequency");
        for (const rev of revenue) {
            const date = rev.receivedOn || rev.createdAt.slice(0, 10);
            lines.push(`${date},"${rev.label}","${rev.category}",${rev.amount},${rev.frequency}`);
        }
        lines.push("");

        lines.push("SUMMARY");
        lines.push("Available Cash,Monthly Burn,Runway (months),Net Snapshot");
        lines.push(
            `${summary?.availableCash ?? 0},${summary?.monthlyBurn ?? 0},${summary?.runwayMonths?.toFixed(1) ?? "N/A"},${summary?.roughNetSnapshot ?? 0}`,
        );

        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `foundry-finances-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Profit bucket handlers ─────────────────────────────────────────────────

    const openBucketEditor = () => {
        const buckets = summary?.profitFirst?.buckets ?? [];
        setBucketDraft(buckets.map((b) => ({ bucketType: b.bucketType, allocationPercent: b.allocationPercent })));
        setEditingBuckets(true);
    };

    const handleSaveBuckets = async () => {
        setSavingBuckets(true);
        try {
            const currentBuckets = financialData?.profitBuckets ?? [];
            const updates = bucketDraft.map((row, index) => {
                const existing = currentBuckets.find((b) => b.bucketType === row.bucketType);
                return { bucketType: row.bucketType, allocationPercent: row.allocationPercent, currentBalance: existing?.currentBalance ?? null, displayOrder: existing?.displayOrder ?? index };
            });
            await saveProfitBuckets(userId, updates);
            await reload();
            setEditingBuckets(false);
        } catch (err) {
            console.error("saveProfitBuckets error:", err);
        } finally {
            setSavingBuckets(false);
        }
    };

    const handleConfirmLedgerReconciled = async (ledgerEntryId: string) => {
        setReconcilingLedgerId(ledgerEntryId);
        try {
            await markLedgerEntryReconciled(userId, ledgerEntryId);
            await reload();
        } catch (err) {
            console.error("markLedgerEntryReconciled error:", err);
        } finally {
            setReconcilingLedgerId(null);
        }
    };

    // ── Starting cash modal ────────────────────────────────────────────────────

    const handleSaveStartingCash = async () => {
        const val = Number(startingCashInput);
        if (!val || val <= 0) return;
        setSavingStartingCash(true);
        try {
            await saveFinancialSettings(userId, { startingCash: val, defaultCurrency: "USD", profitFirstEnabled: true, runwayOverrideMonths: null, breakEvenAssumptions: {} });
            await reload();
            setShowStartingCashModal(false);
            setStartingCashInput("");
        } catch (err) {
            console.error("handleSaveStartingCash error:", err);
        } finally {
            setSavingStartingCash(false);
        }
    };

    // ── Quick revenue / expense add ────────────────────────────────────────────

    const handleSaveQuickRevenue = async () => {
        if (!quickRevDraft.label.trim() || !quickRevDraft.amount) return;
        setSavingQuick(true);
        try {
            await saveRevenue(userId, { label: quickRevDraft.label, amount: Number(quickRevDraft.amount), frequency: quickRevDraft.frequency, receivedOn: quickRevDraft.receivedOn || null });
            await reload();
            setShowAddRevenueModal(false);
            setQuickRevDraft({ label: "", amount: "", frequency: "one_time", receivedOn: todayIso() });
        } catch (err) { console.error("handleSaveQuickRevenue error:", err); }
        finally { setSavingQuick(false); }
    };

    const handleSaveQuickExpense = async () => {
        if (!quickExpDraft.label.trim() || !quickExpDraft.amount) return;
        setSavingQuick(true);
        try {
            await saveExpense(userId, { label: quickExpDraft.label, amount: Number(quickExpDraft.amount), frequency: quickExpDraft.frequency, incurredOn: quickExpDraft.incurredOn || null });
            await reload();
            setShowAddExpenseModal(false);
            setQuickExpDraft({ label: "", amount: "", frequency: "one_time", incurredOn: todayIso() });
        } catch (err) { console.error("handleSaveQuickExpense error:", err); }
        finally { setSavingQuick(false); }
    };

    // ── Invoice handlers ───────────────────────────────────────────────────────

    const openNewInvoice = () => {
        setEditingInvoice(null);
        setInvoiceDraft({ currency: "USD", issuedDate: todayIso(), dueDate: dueDateDefault(), status: "draft" });
        setShowInvoiceModal(true);
    };

    const openEditInvoice = (inv: FounderInvoice) => {
        setEditingInvoice(inv);
        setInvoiceDraft({ ...inv });
        setShowInvoiceModal(true);
    };

    const handleSaveInvoice = async () => {
        const d = invoiceDraft;
        if (!d.clientName?.trim() || !d.description?.trim() || !d.amount) return;

        const payload = {
            id: editingInvoice?.id,
            invoiceNumber: editingInvoice?.invoiceNumber,
            clientName: d.clientName!,
            clientEmail: d.clientEmail || "",
            description: d.description!,
            amount: Number(d.amount),
            currency: d.currency || "USD",
            issuedDate: d.issuedDate || todayIso(),
            dueDate: d.dueDate || dueDateDefault(),
            status: (d.status || "draft") as "draft" | "sent" | "paid",
            notes: d.notes || "",
        };

        const saved = await saveInvoiceToDb(userId, payload);
        if (saved) {
            setInvoices((prev) =>
                editingInvoice
                    ? prev.map((inv) => (inv.id === editingInvoice.id ? saved : inv))
                    : [saved, ...prev],
            );
        }
        setShowInvoiceModal(false);
    };

    const handleDeleteInvoice = async (id: string) => {
        await deleteInvoiceFromDb(userId, id);
        setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    };

    const handleDownloadInvoice = (inv: FounderInvoice) => {
        const businessName = profile?.businessName || profile?.name || "Foundry";
        printStyledPdf(buildInvoiceMarkdown(inv, businessName), { title: `Invoice — ${inv.clientName}`, businessName, docType: "Invoice", date: inv.issuedDate });
    };

    // ── Monthly close handlers ─────────────────────────────────────────────────

    const openMonthlyClose = () => {
        setCloseStep(1);
        setCloseFounderNote("");
        setForgeInsight("");
        setJournalSaved(false);
        setNextMonthGoal("");
        setNextMonthExpenses([{ label: "", amount: "" }, { label: "", amount: "" }, { label: "", amount: "" }]);
        setShowMonthlyClose(true);
    };

    const handleAdvanceToStep2 = async () => {
        setCloseStep(2);
        setForgeInsightLoading(true);
        setForgeInsight("");

        const prompt = `You are Forge reviewing a founder's monthly financial close. Be direct, specific, and useful. No generic advice.

Month: ${closeMonthData.prevMonthLabel}
Revenue: ${formatCurrency(closeMonthData.revenue)}
Expenses: ${formatCurrency(closeMonthData.expenses)}
Net: ${formatCurrency(closeMonthData.net)}
Runway: ${summary?.runwayMonths != null ? `${summary.runwayMonths.toFixed(1)} months` : "unknown"}
Founder note: ${closeFounderNote.trim() || "None"}

Write 3-5 sentences covering:
1. One thing the numbers say that the founder might not have noticed
2. One specific question about next month based on this month's data
3. One action Forge recommends before the month closes

Be the partner who has been watching the whole time.`;

        try {
            const final = await streamForgeAPI(
                [{ role: "user", content: prompt }],
                "You are Forge, a direct financial co-pilot for founders. Write 3-5 specific, actionable sentences. No filler. No generic advice.",
                (chunk) => setForgeInsight(chunk),
                600,
            );
            setForgeInsight(final);
        } catch (err) {
            console.error("Monthly close Forge insight error:", err);
            setForgeInsight("Unable to generate insight at this time.");
        } finally {
            setForgeInsightLoading(false);
        }
    };

    const handleSaveInsightToJournal = async () => {
        if (!forgeInsight) return;
        const content = `Monthly Close — ${closeMonthData.prevMonthLabel}\n\n${forgeInsight}`;
        await saveJournalEntry(userId, content);
        setJournalSaved(true);
    };

    const handleFinishClose = async () => {
        setSavingClose(true);
        try {
            if (nextMonthGoal && Number(nextMonthGoal) > 0) {
                const existingAssumptions = financialData?.settings?.breakEvenAssumptions ?? {};
                await saveFinancialSettings(userId, {
                    startingCash: financialData?.settings?.startingCash ?? null,
                    defaultCurrency: financialData?.settings?.defaultCurrency ?? "USD",
                    profitFirstEnabled: financialData?.settings?.profitFirstEnabled ?? true,
                    runwayOverrideMonths: financialData?.settings?.runwayOverrideMonths ?? null,
                    breakEvenAssumptions: { ...existingAssumptions, monthlyRevenueGoal: Number(nextMonthGoal) },
                });
            }

            for (const exp of nextMonthExpenses) {
                if (exp.label.trim() && Number(exp.amount) > 0) {
                    await saveExpense(userId, { label: exp.label, amount: Number(exp.amount), frequency: "one_time", incurredOn: nextMonthFirstDay() });
                }
            }

            await saveMonthlyCloseNote(userId, {
                monthYear: closeMonthData.prevMonthLabel,
                revenue: closeMonthData.revenue,
                expenses: closeMonthData.expenses,
                net: closeMonthData.net,
                forgeInsight: forgeInsight || null,
                founderNote: closeFounderNote.trim() || null,
                revenueGoal: Number(nextMonthGoal) || null,
            });

            await reload();
            setShowMonthlyClose(false);
        } catch (err) {
            console.error("handleFinishClose error:", err);
        } finally {
            setSavingClose(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    const buckets = summary?.profitFirst?.buckets ?? [];
    const isEstimated = summary?.usesEstimatedInputs ?? false;

    const cardStyle: React.CSSProperties = {
        background: "rgba(255,255,255,0.018)",
        border: "1px solid rgba(255,255,255,0.052)",
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
    };
    const sectionHeadingStyle: React.CSSProperties = {
        fontSize: 15,
        fontFamily: "'Lora', Georgia, serif",
        fontWeight: 600,
        color: "#F0EDE8",
        marginBottom: 12,
        marginTop: 0,
    };
    const labelStyle: React.CSSProperties = { fontSize: 10, color: "var(--foundry-text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" };
    const valueStyle: React.CSSProperties = { fontSize: 18, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, lineHeight: 1.15, marginBottom: 2 };

    // Vital sign card definitions
    const vitalCards = [
        {
            label: "Available Cash",
            value: `${isEstimated ? "~" : ""}${formatCurrency(summary?.availableCash ?? 0)}`,
            color: "#F0EDE8",
            tooltip: isEstimated ? "This figure is estimated from your starting budget. Connect your bank for real balances." : null,
        },
        {
            label: "Monthly Burn",
            value: formatCurrency(summary?.monthlyBurn ?? 0),
            color: (summary?.monthlyBurn ?? 0) > 0 ? "#D96A55" : "#4CAF8A",
            tooltip: null,
        },
        {
            label: "Runway",
            value: summary?.runwayMonths != null ? `${isEstimated ? "~" : ""}${summary.runwayMonths.toFixed(1)} mo` : "TBD",
            color: summary?.runwayMonths == null ? "#888" : summary.runwayMonths > 6 ? "#4CAF8A" : summary.runwayMonths > 3 ? "#D9B15D" : "#D96A55",
            tooltip: isEstimated ? "Runway estimate based on manually entered expenses. May differ from actual burn." : null,
        },
        {
            label: "Net Snapshot",
            value: formatCurrency(summary?.roughNetSnapshot ?? 0),
            color: (summary?.roughNetSnapshot ?? 0) >= 0 ? "#4CAF8A" : "#FF6B6B",
            tooltip: null,
        },
    ];

    const inputStyle: React.CSSProperties = {
        width: "100%",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 8,
        padding: "8px 10px",
        color: "#F0EDE8",
        fontSize: 13,
        boxSizing: "border-box",
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "var(--foundry-bg-app)", color: "var(--foundry-text-primary)", zIndex: 130, display: "flex", flexDirection: "column", overflowY: "auto" }}>

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(8,8,9,0.95)", borderBottom: "1px solid var(--foundry-border-subtle)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", backdropFilter: "blur(12px)" }}>
                <button className="foundry-btn foundry-btn--ghost" onClick={onOpenNav ?? onBack} style={{ padding: "6px 10px", fontSize: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3.5" width="14" height="1.5" rx="0.75" fill="currentColor" /><rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor" /><rect x="1" y="11" width="14" height="1.5" rx="0.75" fill="currentColor" /></svg>
                </button>
                <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: "#F0EDE8", flex: 1 }}>
                    Financial Dashboard
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                        className="foundry-btn foundry-btn--primary"
                        onClick={openMonthlyClose}
                        style={{ padding: "7px 13px", fontSize: 12 }}
                    >
                        Monthly Close
                    </button>
                    <button
                        className="foundry-btn foundry-btn--secondary"
                        onClick={handleExportCsv}
                        style={{ padding: "7px 13px", fontSize: 12 }}
                    >
                        Export CSV
                    </button>
                </div>
            </div>

            {/* ── Body ────────────────────────────────────────────────────────── */}
            <div style={{ flex: 1, padding: "20px 20px 80px", maxWidth: 680, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
                {loading ? (
                    <div style={{ textAlign: "center", color: "var(--foundry-text-muted)", padding: 60, fontSize: 13 }}>Loading your financial data...</div>
                ) : (
                    <>
                        {/* ── Forge Health Summary ───────────────────────────── */}
                        {(forgeHealthSummary || forgeHealthLoading) && (
                            <div style={{ background: "rgba(232,98,42,0.06)", border: "1px solid rgba(232,98,42,0.15)", borderRadius: 12, padding: "14px 16px", marginBottom: 14, position: "relative" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(232,98,42,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#E8622A", fontWeight: 700 }}>F</div>
                                    <span style={{ fontSize: 10, color: "#E8622A", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Forge</span>
                                </div>
                                {forgeHealthLoading ? (
                                    <div style={{ fontSize: 13, color: "rgba(240,237,232,0.58)", fontStyle: "italic", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Reading your numbers...</div>
                                ) : (
                                    <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8", lineHeight: 1.7 }}>{forgeHealthSummary}</div>
                                )}
                                <button
                                    onClick={handleRefreshHealthSummary}
                                    title="Refresh"
                                    style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "rgba(240,237,232,0.55)", fontSize: 13, cursor: "pointer", padding: 4 }}
                                >
                                    ↻
                                </button>
                            </div>
                        )}

                        {/* ── Estimated Data Banner ──────────────────────────── */}
                        {isEstimated && (
                            <div style={{ background: "rgba(217,177,93,0.08)", border: "1px solid rgba(217,177,93,0.24)", borderRadius: 10, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
                                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(240,237,232,0.85)", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Some figures are estimated</div>
                                        <HelpTooltip content="Your available cash is based on your starting budget, not a confirmed bank balance. Connect your bank or update your starting cash for accurate figures." />
                                    </div>
                                    <button
                                        onClick={() => { setStartingCashInput(String(financialData?.settings?.startingCash ?? "")); setShowStartingCashModal(true); }}
                                        style={{ marginTop: 8, background: "none", border: "none", color: "#E8622A", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0, fontFamily: "'DM Sans', system-ui, sans-serif" }}
                                    >
                                        Update Starting Cash →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Section 1: Vital Signs ─────────────────────────── */}
                        <div style={cardStyle}>
                            <p style={sectionHeadingStyle}>Vital Signs</p>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                {vitalCards.map((card) => (
                                    <div
                                        key={card.label}
                                        style={{ position: "relative", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}
                                    >
                                        <div style={{ ...valueStyle, color: card.color }}>{card.value}</div>
                                        <div style={labelStyle}>{card.label}</div>
                                        {card.tooltip && <div style={{ position: "absolute", top: 8, right: 8 }}><HelpTooltip content={card.tooltip} /></div>}
                                    </div>
                                ))}
                            </div>
                            {isEstimated && (
                                <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
                                    <HelpTooltip content="Based on estimated inputs. Add actuals for more precise runway, burn, and cash figures." />
                                </div>
                            )}
                        </div>

                        {/* ── Section 2: Profit & Loss Summary ─────────────── */}
                        <div style={cardStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                                <div>
                                    <p style={{ ...sectionHeadingStyle, marginBottom: 3 }}>Profit &amp; Loss Summary</p>
                                    <HelpTooltip content={`Ledger basis: Jan 1-${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${profitLoss.year}`} />
                                </div>
                                <div style={{
                                    fontSize: 10,
                                    color: profitLoss.hasLedger ? "#4CAF8A" : "#E8C42A",
                                    background: profitLoss.hasLedger ? "rgba(76,175,138,0.12)" : "rgba(232,196,42,0.1)",
                                    border: `1px solid ${profitLoss.hasLedger ? "rgba(76,175,138,0.25)" : "rgba(232,196,42,0.25)"}`,
                                    borderRadius: 999,
                                    padding: "4px 8px",
                                    whiteSpace: "nowrap",
                                }}>
                                    {profitLoss.hasLedger ? "Ledger active" : "Waiting for ledger"}
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                                {[
                                    { label: "Revenue", value: formatCurrency(profitLoss.revenue), color: "#4CAF8A" },
                                    { label: "Expenses", value: formatCurrency(profitLoss.expenses), color: "#D96A55" },
                                    { label: profitLoss.netIncome >= 0 ? "Net Income" : "Net Loss", value: formatCurrency(Math.abs(profitLoss.netIncome)), color: profitLoss.netIncome >= 0 ? "#4CAF8A" : "#D96A55" },
                                ].map((item) => (
                                    <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: item.color, marginBottom: 2 }}>{item.value}</div>
                                        <div style={labelStyle}>{item.label}</div>
                                    </div>
                                ))}
                            </div>
                            {profitLoss.categoryRows.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                    {profitLoss.categoryRows.map((row) => (
                                        <div key={row.category} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", fontSize: 12, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                                            <div style={{ color: "#C8C4BE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.category}</div>
                                            <div style={{ color: row.net >= 0 ? "#4CAF8A" : "#D96A55", fontWeight: 700 }}>{formatCurrency(Math.abs(row.net))}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
                                    <HelpTooltip content="Save revenue, expenses, paid invoices, or accepted bank transactions to populate a ledger-backed P&L." />
                                </div>
                            )}
                        </div>

                        {/* ── Section 2: Profit First Buckets ───────────────── */}
                        <div style={cardStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <p style={{ ...sectionHeadingStyle, marginBottom: 0 }}>Profit First Buckets</p>
                                <button onClick={openBucketEditor} style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7, padding: "5px 10px", color: "#A8A4A0", fontSize: 11, cursor: "pointer" }}>
                                    Edit Allocations
                                </button>
                            </div>
                            {summary?.profitFirst?.basisLabel && (
                                <div style={{ marginBottom: 10 }}>
                                    <HelpTooltip content={`Basis: ${summary.profitFirst.basisLabel} · ${formatCurrency(summary.profitFirst.basisAmount)}`} />
                                </div>
                            )}
                            {buckets.map((bucket) => {
                                const pct = Math.min(100, bucket.allocationPercent);
                                const color = BUCKET_COLORS[bucket.bucketType] || "#888";
                                return (
                                    <div key={bucket.bucketType} style={{ marginBottom: 12 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, color: "#C8C4BE" }}>
                                            <span>{BUCKET_LABELS[bucket.bucketType]}</span>
                                            <span>{bucket.allocationPercent}% · {formatCurrency(bucket.estimatedAmount)}</span>
                                        </div>
                                        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                                            <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.3s" }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── Section 3: Break-Even Analysis ────────────────── */}
                        <div style={cardStyle}>
                            <p style={sectionHeadingStyle}>Break-Even Analysis</p>
                            {summary?.breakEvenReady ? (
                                <>
                                    <div style={{ display: "inline-block", fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "rgba(76,175,138,0.15)", color: "#4CAF8A", marginBottom: 12, letterSpacing: "0.05em" }}>Data available</div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                                        {[
                                            { label: "Monthly Revenue", value: formatCurrency(summary.operatingView.monthlyRevenue), color: "#4CAF8A" },
                                            { label: "Monthly Expenses", value: formatCurrency(summary.operatingView.monthlyExpenses), color: "#D96A55" },
                                            { label: summary.operatingView.monthlyOperatingGap >= 0 ? "Monthly Surplus" : "Monthly Gap", value: formatCurrency(Math.abs(summary.operatingView.monthlyOperatingGap)), color: summary.operatingView.monthlyOperatingGap >= 0 ? "#4CAF8A" : "#D96A55" },
                                        ].map((item) => (
                                            <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                                                <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: item.color, marginBottom: 2 }}>{item.value}</div>
                                                <div style={labelStyle}>{item.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {summary.operatingView.monthlyExpenses > 0 && (
                                        <>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--foundry-text-secondary)", marginBottom: 4 }}>
                                                <span>Revenue vs expenses</span>
                                                <span>{Math.round((summary.operatingView.monthlyRevenue / summary.operatingView.monthlyExpenses) * 100)}%</span>
                                            </div>
                                            <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                                                <div style={{ width: `${Math.min(100, (summary.operatingView.monthlyRevenue / summary.operatingView.monthlyExpenses) * 100)}%`, height: "100%", background: summary.operatingView.monthlyOperatingGap >= 0 ? "#4CAF8A" : "#D96A55", borderRadius: 4, transition: "width 0.3s" }} />
                                            </div>
                                        </>
                                    )}
                                    <div style={{ marginTop: 10 }}><HelpTooltip content={summary.breakEvenMessage} /></div>
                                </>
                            ) : (
                                <div style={{ textAlign: "center", padding: "20px 0" }}>
                                    <div style={{ display: "inline-block", fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "rgba(255,255,255,0.04)", color: "var(--foundry-text-secondary)", marginBottom: 12 }}>Not enough data</div>
                                    {summary?.breakEvenMessage && <HelpTooltip content={summary.breakEvenMessage} />}
                                </div>
                            )}
                        </div>

                        {/* ── Section 4: Cash Flow Chart ───────────────────── */}
                        <div style={cardStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                                <div>
                                    <p style={{ ...sectionHeadingStyle, marginBottom: 3 }}>Cash Flow (6 months)</p>
                                    <HelpTooltip content={financialData?.ledgerEntries?.length ? "Ledger cash in vs cash out" : "Revenue and expense fallback until ledger rows exist"} />
                                </div>
                            </div>
                            {chartIsEmpty ? (
                                <div style={{ textAlign: "center", padding: "28px 0 20px" }}>
                                    <div style={{ fontSize: 32, color: "rgba(240,237,232,0.35)", marginBottom: 12 }}>▦</div>
                                    <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", color: "rgba(240,237,232,0.6)", marginBottom: 6 }}>No financial data yet</div>
                                    <div style={{ marginBottom: 16 }}>
                                        <HelpTooltip content="Add your first expense or revenue entry to see your monthly cash flow history here." />
                                    </div>
                                    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                                        <button onClick={() => setShowAddRevenueModal(true)} style={{ background: "rgba(76,175,138,0.12)", border: "1px solid rgba(76,175,138,0.3)", borderRadius: 8, padding: "7px 14px", color: "#4CAF8A", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                                            Add Revenue
                                        </button>
                                        <button onClick={() => setShowAddExpenseModal(true)} style={{ background: "rgba(217,106,85,0.1)", border: "1px solid rgba(217,106,85,0.25)", borderRadius: 8, padding: "7px 14px", color: "#D96A55", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                                            Add Expense
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120 }}>
                                        {chartData.map((month) => {
                                            const revH = chartMax > 0 ? Math.max(2, (month.revenue / chartMax) * 100) : 2;
                                            const expH = chartMax > 0 ? Math.max(2, (month.expenses / chartMax) * 100) : 2;
                                            return (
                                                <div key={`${month.year}-${month.month}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                                    <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end", gap: 2 }}>
                                                        <div title={`Cash in: ${formatCurrency(month.revenue)}`} style={{ flex: 1, height: `${revH}%`, background: "#4CAF8A", borderRadius: "3px 3px 0 0", minHeight: 2, transition: "height 0.3s" }} />
                                                        <div title={`Cash out: ${formatCurrency(month.expenses)}`} style={{ flex: 1, height: `${expH}%`, background: "#D96A55", borderRadius: "3px 3px 0 0", minHeight: 2, opacity: 0.8, transition: "height 0.3s" }} />
                                                    </div>
                                                    <div style={{ fontSize: 9, color: "var(--foundry-text-muted)", letterSpacing: "0.04em" }}>{month.label}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(240,237,232,0.62)" }}>
                                            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#4CAF8A" }} />Cash In
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(240,237,232,0.62)" }}>
                                            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#D96A55" }} />Cash Out
                                        </div>
                                    </div>
                                    {chartActiveMonths === 1 && (
                                        <div style={{ marginTop: 8 }}>
                                            <HelpTooltip content="Add more months of data to see trends." />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* ── Section 5: Bank Reconciliation ───────────────── */}
                        <div style={cardStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
                                <p style={{ ...sectionHeadingStyle, marginBottom: 0 }}>Bank Reconciliation</p>
                                <div style={{
                                    fontSize: 10,
                                    color: unreconciledLedgerEntries.length > 0 ? "#E8C42A" : "#4CAF8A",
                                    background: unreconciledLedgerEntries.length > 0 ? "rgba(232,196,42,0.1)" : "rgba(76,175,138,0.12)",
                                    border: `1px solid ${unreconciledLedgerEntries.length > 0 ? "rgba(232,196,42,0.25)" : "rgba(76,175,138,0.25)"}`,
                                    borderRadius: 999,
                                    padding: "4px 9px",
                                    whiteSpace: "nowrap",
                                }}>
                                    {unreconciledLedgerEntries.length} unreconciled
                                </div>
                            </div>
                            <div style={{ marginBottom: 10 }}><HelpTooltip content="Manual ledger rows can be marked reconciled after you compare them against your bank records." /></div>
                            {unreconciledLedgerEntries.length === 0 ? (
                                <div style={{ background: "rgba(76,175,138,0.06)", border: "1px solid rgba(76,175,138,0.16)", borderRadius: 10, padding: "12px 14px", color: "#4CAF8A", fontSize: 12, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                                    No unmatched accepted bank entries.
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {unreconciledLedgerEntries.slice(0, 5).map((entry) => {
                                        const busy = reconcilingLedgerId === entry.id;
                                        return (
                                            <div key={entry.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600, marginBottom: 2 }}>{entry.description}</div>
                                                    <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)" }}>{entry.date} · {entry.category} · {entry.type === "credit" ? "cash in" : "cash out"}</div>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <div style={{ fontSize: 12, color: entry.type === "credit" ? "#4CAF8A" : "#D96A55", fontWeight: 700 }}>{formatCurrency(entry.amount)}</div>
                                                    <button onClick={() => void handleConfirmLedgerReconciled(entry.id)} disabled={busy} style={{ background: "rgba(76,175,138,0.12)", border: "1px solid rgba(76,175,138,0.3)", borderRadius: 7, padding: "5px 9px", color: "#4CAF8A", fontSize: 10, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
                                                        {busy ? "Confirming..." : "Confirm"}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {unreconciledLedgerEntries.length > 5 && (
                                        <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                                            Showing 5 of {unreconciledLedgerEntries.length} unreconciled ledger rows.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── Section 6: Bank Connection ────────────────────── */}
                        <div style={cardStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                                <p style={{ ...sectionHeadingStyle, marginBottom: 0 }}>Bank Connection</p>
                                <div style={{ background: "rgba(99,179,237,0.1)", border: "1px solid rgba(99,179,237,0.22)", borderRadius: 999, padding: "5px 10px", color: "#8FC8F6", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                    Coming Soon
                                </div>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 14px", color: "#A8A4A0", fontSize: 12, lineHeight: 1.6 }}>
                                Plaid bank account linking will be added after launch. For now, Foundry keeps financial tracking local with manual revenue, expense, invoice, bucket, and reconciliation tools.
                            </div>
                        </div>

                        {/* ── Section 7: Invoices ───────────────────────────── */}
                        <div style={cardStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <p style={{ ...sectionHeadingStyle, marginBottom: 0 }}>Invoices</p>
                                <button onClick={openNewInvoice} style={{ background: "rgba(76,175,138,0.12)", border: "1px solid rgba(76,175,138,0.3)", borderRadius: 8, padding: "6px 12px", color: "#4CAF8A", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                    + New Invoice
                                </button>
                            </div>
                            {invoices.length === 0 ? (
                                <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
                                    <HelpTooltip content="No invoices yet. Create one to generate a print-ready PDF." />
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {invoices.map((inv) => (
                                        <div key={inv.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600, marginBottom: 2 }}>{inv.clientName}</div>
                                                <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)" }}>
                                                    {formatCurrency(inv.amount)} · Due {inv.dueDate} ·{" "}
                                                    <span style={{ color: inv.status === "paid" ? "#4CAF8A" : inv.status === "sent" ? "#E8C42A" : "#888" }}>
                                                        {inv.status.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", gap: 6 }}>
                                                {[
                                                    { label: "PDF", handler: () => handleDownloadInvoice(inv), style: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#A8A4A0" } },
                                                    { label: "Edit", handler: () => openEditInvoice(inv), style: { background: "none", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(240,237,232,0.62)" } },
                                                    { label: "×", handler: () => void handleDeleteInvoice(inv.id), style: { background: "none", border: "1px solid rgba(217,106,85,0.22)", color: "#D96A55" } },
                                                ].map((btn) => (
                                                    <button key={btn.label} onClick={btn.handler} style={{ ...btn.style, borderRadius: 7, padding: "5px 9px", fontSize: 10, cursor: "pointer" }}>{btn.label}</button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── Section 8: Tax Estimate Tracker ──────────────── */}
                        <div style={cardStyle}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <p style={{ ...sectionHeadingStyle, marginBottom: 0 }}>Tax Estimate Tracker</p>
                                <button onClick={() => setShowTaxAsideModal(true)} style={{ background: "rgba(217,177,93,0.1)", border: "1px solid rgba(217,177,93,0.25)", borderRadius: 8, padding: "6px 12px", color: "#D9B15D", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                    Set Aside
                                </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                                {[
                                    { label: "SE Tax (15.3%)", value: formatCurrency(seTax) },
                                    { label: "Federal (~22%)", value: formatCurrency(federalTax) },
                                    { label: "Total Estimate", value: formatCurrency(totalTax) },
                                    { label: "Quarterly Est.", value: formatCurrency(quarterlyTax) },
                                ].map((item) => (
                                    <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: "#E8C42A", marginBottom: 2 }}>{item.value}</div>
                                        <div style={labelStyle}>{item.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: 11, color: "#4CAF8A", fontStyle: "italic", fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: 10 }}>
                                Conservative estimate — actual will likely be lower
                            </div>
                            <div style={{ marginBottom: 10 }}>
                                <HelpTooltip content={taxBasisLabel} />
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 8, padding: "12px 14px" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <div style={{ fontSize: 10, color: "#F0EDE8", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'DM Sans', system-ui, sans-serif" }}>This estimate assumes</div>
                                    <HelpTooltip content={[
                                        "Sole proprietor or single-member LLC (self-employed)",
                                        `Taxable income = ledger credits (${formatCurrency(profitLoss.hasLedger ? profitLoss.revenue : summary?.totalRevenue ?? 0)}) minus ledger debits (${formatCurrency(profitLoss.hasLedger ? profitLoss.expenses : summary?.totalExpenses ?? 0)})`,
                                        "Federal rate of 22% (may vary based on total income)",
                                        "Self-employment tax of 15.3% on net earnings",
                                        "Expense categories are assumed deductible unless your CPA says otherwise",
                                        "No state income tax included",
                                        "This is a conservative overestimate by design. Consult a CPA for your actual tax liability.",
                                    ].join("\n")} />
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* ════════════════════════════════════════════════════════════════
                MODALS
            ════════════════════════════════════════════════════════════════ */}

            {/* ── Bucket Editor ─────────────────────────────────────────────── */}
            {editingBuckets && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setEditingBuckets(false)}>
                    <div style={{ background: "rgb(16,16,18)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 18 }}>Edit Profit First Allocations</div>
                        {bucketDraft.map((row, idx) => (
                            <div key={row.bucketType} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                <div style={{ fontSize: 13, color: "#C8C4BE", flex: 1 }}>{BUCKET_LABELS[row.bucketType]}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <input type="number" min={0} max={100} value={row.allocationPercent} onChange={(e) => { const val = Math.max(0, Math.min(100, Number(e.target.value) || 0)); setBucketDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, allocationPercent: val } : r))); }} style={{ width: 60, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 8px", color: "#F0EDE8", fontSize: 13, textAlign: "right" }} />
                                    <span style={{ fontSize: 12, color: "var(--foundry-text-secondary)" }}>%</span>
                                </div>
                            </div>
                        ))}
                        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                            <button onClick={() => setEditingBuckets(false)} style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, padding: "10px", color: "rgba(240,237,232,0.62)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                            <button onClick={() => void handleSaveBuckets()} disabled={savingBuckets} style={{ flex: 2, background: "linear-gradient(135deg, #4CAF8A, #3a9470)", border: "none", borderRadius: 9, padding: "10px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: savingBuckets ? "default" : "pointer", opacity: savingBuckets ? 0.7 : 1 }}>
                                {savingBuckets ? "Saving..." : "Save Allocations"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Invoice Create/Edit ───────────────────────────────────────── */}
            {showInvoiceModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 20px", overflowY: "auto" }} onClick={() => setShowInvoiceModal(false)}>
                    <div style={{ background: "rgb(16,16,18)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 460, boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 18 }}>{editingInvoice ? "Edit Invoice" : "New Invoice"}</div>
                        {[
                            { label: "Client Name *", field: "clientName", type: "text", placeholder: "Acme Corp" },
                            { label: "Client Email", field: "clientEmail", type: "email", placeholder: "client@example.com" },
                            { label: "Description *", field: "description", type: "textarea", placeholder: "Services rendered..." },
                            { label: "Amount *", field: "amount", type: "number", placeholder: "0" },
                            { label: "Issue Date", field: "issuedDate", type: "date", placeholder: "" },
                            { label: "Due Date", field: "dueDate", type: "date", placeholder: "" },
                            { label: "Notes", field: "notes", type: "textarea", placeholder: "Payment terms, etc." },
                        ].map(({ label, field, type, placeholder }) => (
                            <div key={field} style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: "rgba(240,237,232,0.62)", marginBottom: 4 }}>{label}</div>
                                {type === "textarea" ? (
                                    <textarea rows={3} value={(invoiceDraft as any)[field] ?? ""} placeholder={placeholder} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, [field]: e.target.value }))} style={{ ...inputStyle, resize: "vertical" }} />
                                ) : (
                                    <input type={type} value={(invoiceDraft as any)[field] ?? ""} placeholder={placeholder} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, [field]: e.target.value }))} style={inputStyle} />
                                )}
                            </div>
                        ))}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: "rgba(240,237,232,0.62)", marginBottom: 4 }}>Status</div>
                            <select value={invoiceDraft.status ?? "draft"} onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, status: e.target.value as any }))} style={inputStyle}>
                                <option value="draft">Draft</option>
                                <option value="sent">Sent</option>
                                <option value="paid">Paid</option>
                            </select>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setShowInvoiceModal(false)} style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, padding: "10px", color: "rgba(240,237,232,0.62)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                            <button onClick={() => void handleSaveInvoice()} style={{ flex: 2, background: "linear-gradient(135deg, #4CAF8A, #3a9470)", border: "none", borderRadius: 9, padding: "10px", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                                {editingInvoice ? "Save Changes" : "Create Invoice"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Tax Set Aside ─────────────────────────────────────────────── */}
            {showTaxAsideModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowTaxAsideModal(false)}>
                    <div style={{ background: "rgb(16,16,18)", border: "1px solid rgba(232,196,42,0.3)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 10 }}>Set Aside for Taxes</div>
                        <div style={{ marginBottom: 14 }}><HelpTooltip content="Based on estimated taxable income from your ledger, this is your quarterly tax reserve." /></div>
                        <div style={{ textAlign: "center", marginBottom: 18 }}>
                            <div style={{ fontSize: 28, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: "#E8C42A" }}>{formatCurrency(quarterlyTax)}</div>
                            <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", marginTop: 4 }}>per quarter</div>
                        </div>
                        <div style={{ marginBottom: 20 }}><HelpTooltip content="Formula: taxable income × (15.3% self-employment + 22% federal) ÷ 4. Transfer this reserve before estimated tax deadlines (Apr, Jun, Sep, Jan). This is an estimate. Consult a CPA." /></div>
                        <button onClick={() => setShowTaxAsideModal(false)} style={{ width: "100%", background: "rgba(232,196,42,0.12)", border: "1px solid rgba(232,196,42,0.3)", borderRadius: 9, padding: "11px", color: "#E8C42A", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Got it</button>
                    </div>
                </div>
            )}

            {/* ── Starting Cash ─────────────────────────────────────────────── */}
            {showStartingCashModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowStartingCashModal(false)}>
                    <div style={{ background: "rgb(16,16,18)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                            <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>Update Starting Cash</div>
                            <HelpTooltip content="Enter your current confirmed cash balance. This replaces the estimated figure and gives you accurate runway and burn calculations." />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: "rgba(240,237,232,0.62)", marginBottom: 4 }}>Starting Cash ($)</div>
                            <input type="number" min={0} value={startingCashInput} onChange={(e) => setStartingCashInput(e.target.value)} placeholder="e.g. 12000" style={inputStyle} autoFocus />
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setShowStartingCashModal(false)} style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, padding: "10px", color: "rgba(240,237,232,0.62)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                            <button onClick={() => void handleSaveStartingCash()} disabled={savingStartingCash} style={{ flex: 2, background: "rgba(232,98,42,0.15)", border: "1px solid rgba(232,98,42,0.4)", borderRadius: 9, padding: "10px", color: "#E8622A", fontSize: 13, fontWeight: 600, cursor: savingStartingCash ? "default" : "pointer", opacity: savingStartingCash ? 0.7 : 1 }}>
                                {savingStartingCash ? "Saving..." : "Update Cash"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add Revenue (quick) ───────────────────────────────────────── */}
            {showAddRevenueModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowAddRevenueModal(false)}>
                    <div style={{ background: "rgb(16,16,18)", border: "1px solid rgba(76,175,138,0.2)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 16 }}>Add Revenue</div>
                        {[
                            { label: "Label *", field: "label", type: "text", placeholder: "Client payment" },
                            { label: "Amount *", field: "amount", type: "number", placeholder: "0" },
                            { label: "Date", field: "receivedOn", type: "date", placeholder: "" },
                        ].map(({ label, field, type, placeholder }) => (
                            <div key={field} style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: "rgba(240,237,232,0.62)", marginBottom: 4 }}>{label}</div>
                                <input type={type} value={(quickRevDraft as any)[field] ?? ""} placeholder={placeholder} onChange={(e) => setQuickRevDraft((p) => ({ ...p, [field]: e.target.value }))} style={inputStyle} />
                            </div>
                        ))}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: "rgba(240,237,232,0.62)", marginBottom: 4 }}>Frequency</div>
                            <select value={quickRevDraft.frequency} onChange={(e) => setQuickRevDraft((p) => ({ ...p, frequency: e.target.value as any }))} style={inputStyle}>
                                <option value="one_time">One-time</option>
                                <option value="monthly">Monthly</option>
                                <option value="yearly">Yearly</option>
                            </select>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setShowAddRevenueModal(false)} style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, padding: "10px", color: "rgba(240,237,232,0.62)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                            <button onClick={() => void handleSaveQuickRevenue()} disabled={savingQuick} style={{ flex: 2, background: "rgba(76,175,138,0.15)", border: "1px solid rgba(76,175,138,0.4)", borderRadius: 9, padding: "10px", color: "#4CAF8A", fontSize: 13, fontWeight: 600, cursor: savingQuick ? "default" : "pointer", opacity: savingQuick ? 0.7 : 1 }}>
                                {savingQuick ? "Saving..." : "Add Revenue"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add Expense (quick) ───────────────────────────────────────── */}
            {showAddExpenseModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowAddExpenseModal(false)}>
                    <div style={{ background: "rgb(16,16,18)", border: "1px solid rgba(217,106,85,0.22)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, boxSizing: "border-box" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 16 }}>Add Expense</div>
                        {[
                            { label: "Label *", field: "label", type: "text", placeholder: "AWS hosting" },
                            { label: "Amount *", field: "amount", type: "number", placeholder: "0" },
                            { label: "Date", field: "incurredOn", type: "date", placeholder: "" },
                        ].map(({ label, field, type, placeholder }) => (
                            <div key={field} style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: 11, color: "rgba(240,237,232,0.62)", marginBottom: 4 }}>{label}</div>
                                <input type={type} value={(quickExpDraft as any)[field] ?? ""} placeholder={placeholder} onChange={(e) => setQuickExpDraft((p) => ({ ...p, [field]: e.target.value }))} style={inputStyle} />
                            </div>
                        ))}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: "rgba(240,237,232,0.62)", marginBottom: 4 }}>Frequency</div>
                            <select value={quickExpDraft.frequency} onChange={(e) => setQuickExpDraft((p) => ({ ...p, frequency: e.target.value as any }))} style={inputStyle}>
                                <option value="one_time">One-time</option>
                                <option value="monthly">Monthly</option>
                                <option value="yearly">Yearly</option>
                            </select>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setShowAddExpenseModal(false)} style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, padding: "10px", color: "rgba(240,237,232,0.62)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                            <button onClick={() => void handleSaveQuickExpense()} disabled={savingQuick} style={{ flex: 2, background: "rgba(217,106,85,0.14)", border: "1px solid rgba(217,106,85,0.34)", borderRadius: 9, padding: "10px", color: "#D96A55", fontSize: 13, fontWeight: 600, cursor: savingQuick ? "default" : "pointer", opacity: savingQuick ? 0.7 : 1 }}>
                                {savingQuick ? "Saving..." : "Add Expense"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Monthly Close Modal ───────────────────────────────────────── */}
            {showMonthlyClose && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 3000, display: "flex", flexDirection: "column", overflowY: "auto" }}>
                    <div style={{ flex: 1, padding: "32px 20px 60px", maxWidth: 560, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

                        {/* Step indicator */}
                        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
                            {(["Review", "Insights", "Next Month"] as const).map((step, i) => {
                                const stepNum = i + 1;
                                const isActive = closeStep === stepNum;
                                const isDone = closeStep > stepNum;
                                return (
                                    <div key={step} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "none" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: isDone ? "#4CAF8A" : isActive ? "#E8622A" : "rgba(255,255,255,0.06)", border: `1px solid ${isDone ? "#4CAF8A" : isActive ? "#E8622A" : "rgba(255,255,255,0.1)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: isDone || isActive ? "#fff" : "#555", fontWeight: 700, flexShrink: 0 }}>
                                                {isDone ? "✓" : stepNum}
                                            </div>
                                            <span style={{ fontSize: 12, color: isActive ? "#F0EDE8" : isDone ? "#4CAF8A" : "#555", fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: isActive ? 600 : 400 }}>{step}</span>
                                        </div>
                                        {i < 2 && <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)", margin: "0 10px" }} />}
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── Step 1: Review ──────────────────────────────────── */}
                        {closeStep === 1 && (
                            <div>
                                <div style={{ fontSize: 20, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 4 }}>
                                    Closing {closeMonthData.prevMonthLabel}
                                </div>
                                <div style={{ fontSize: 13, color: "var(--foundry-text-secondary)", fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: 24 }}>
                                    How did the month go?
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                                    {[
                                        { label: "Revenue", value: formatCurrency(closeMonthData.revenue), color: "#4CAF8A" },
                                        { label: "Expenses", value: formatCurrency(closeMonthData.expenses), color: "#D96A55" },
                                        { label: closeMonthData.net >= 0 ? "Surplus" : "Deficit", value: formatCurrency(Math.abs(closeMonthData.net)), color: closeMonthData.net >= 0 ? "#4CAF8A" : "#FF6B6B" },
                                    ].map((item) => (
                                        <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                                            <div style={{ fontSize: 18, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: item.color, marginBottom: 3 }}>{item.value}</div>
                                            <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{item.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {summary?.runwayMonths != null && (
                                    <div style={{ fontSize: 12, color: "#A8A4A0", fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: 20, padding: "10px 14px", background: "rgba(255,255,255,0.02)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
                                        Current runway: <strong style={{ color: summary.runwayMonths > 6 ? "#4CAF8A" : summary.runwayMonths > 3 ? "#D9B15D" : "#D96A55" }}>{summary.runwayMonths.toFixed(1)} months</strong>
                                    </div>
                                )}

                                <div style={{ marginBottom: 24 }}>
                                    <div style={{ fontSize: 12, color: "rgba(240,237,232,0.62)", marginBottom: 8, fontFamily: "'DM Sans', system-ui, sans-serif" }}>Anything else worth noting about this month?</div>
                                    <textarea
                                        rows={4}
                                        value={closeFounderNote}
                                        onChange={(e) => setCloseFounderNote(e.target.value)}
                                        placeholder="Unexpected expenses, big wins, challenges..."
                                        style={{ ...inputStyle, resize: "vertical" }}
                                    />
                                </div>

                                <div style={{ display: "flex", gap: 10 }}>
                                    <button onClick={() => setShowMonthlyClose(false)} style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, padding: "11px", color: "rgba(240,237,232,0.62)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                                    <button onClick={() => void handleAdvanceToStep2()} style={{ flex: 2, background: "rgba(232,98,42,0.15)", border: "1px solid rgba(232,98,42,0.4)", borderRadius: 9, padding: "11px", color: "#E8622A", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                        Next → Get Forge Insights
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Step 2: Forge Insights ──────────────────────────── */}
                        {closeStep === 2 && (
                            <div>
                                <div style={{ fontSize: 20, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 4 }}>Forge's Take</div>
                                <div style={{ fontSize: 13, color: "var(--foundry-text-secondary)", fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: 24 }}>Based on your {closeMonthData.prevMonthLabel} numbers</div>

                                <div style={{ background: "rgba(232,98,42,0.06)", border: "1px solid rgba(232,98,42,0.15)", borderRadius: 12, padding: "18px 18px 16px", marginBottom: 20, minHeight: 100 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(232,98,42,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#E8622A", fontWeight: 700 }}>F</div>
                                        <span style={{ fontSize: 10, color: "#E8622A", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Forge</span>
                                    </div>
                                    {forgeInsightLoading && !forgeInsight ? (
                                        <div style={{ fontSize: 13, color: "rgba(240,237,232,0.58)", fontStyle: "italic", fontFamily: "'DM Sans', system-ui, sans-serif" }}>Reading your month...</div>
                                    ) : (
                                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8", lineHeight: 1.7 }}>{forgeInsight}</div>
                                    )}
                                </div>

                                {forgeInsight && !forgeInsightLoading && (
                                    <button
                                        onClick={() => void handleSaveInsightToJournal()}
                                        disabled={journalSaved}
                                        style={{ display: "block", width: "100%", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, padding: "9px", color: journalSaved ? "#4CAF8A" : "#888", fontSize: 12, cursor: journalSaved ? "default" : "pointer", marginBottom: 12, fontFamily: "'DM Sans', system-ui, sans-serif" }}
                                    >
                                        {journalSaved ? "✓ Saved to Journal" : "Save to Journal"}
                                    </button>
                                )}

                                <div style={{ display: "flex", gap: 10 }}>
                                    <button onClick={() => setCloseStep(1)} style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, padding: "11px", color: "rgba(240,237,232,0.62)", fontSize: 13, cursor: "pointer" }}>← Back</button>
                                    <button onClick={() => setCloseStep(3)} disabled={forgeInsightLoading} style={{ flex: 2, background: "rgba(232,98,42,0.15)", border: "1px solid rgba(232,98,42,0.4)", borderRadius: 9, padding: "11px", color: "#E8622A", fontSize: 13, fontWeight: 700, cursor: forgeInsightLoading ? "default" : "pointer", opacity: forgeInsightLoading ? 0.5 : 1 }}>
                                        Continue →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ── Step 3: Next Month ──────────────────────────────── */}
                        {closeStep === 3 && (
                            <div>
                                <div style={{ fontSize: 20, fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 4 }}>Looking Ahead</div>
                                <div style={{ fontSize: 13, color: "var(--foundry-text-secondary)", fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: 24 }}>Set yourself up for {closeMonthData.nextMonthLabel}</div>

                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: 13, color: "#C8C4BE", fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: 8 }}>Revenue goal for {closeMonthData.nextMonthLabel}</div>
                                    <input type="number" min={0} value={nextMonthGoal} onChange={(e) => setNextMonthGoal(e.target.value)} placeholder="e.g. 5000" style={inputStyle} />
                                </div>

                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: 13, color: "#C8C4BE", fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: 8 }}>Any planned expenses next month? <span style={{ fontSize: 11, color: "var(--foundry-text-muted)" }}>(optional)</span></div>
                                    {nextMonthExpenses.map((exp, i) => (
                                        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
                                            <input type="text" value={exp.label} onChange={(e) => setNextMonthExpenses((prev) => prev.map((r, idx) => idx === i ? { ...r, label: e.target.value } : r))} placeholder={`Expense ${i + 1}`} style={inputStyle} />
                                            <input type="number" value={exp.amount} onChange={(e) => setNextMonthExpenses((prev) => prev.map((r, idx) => idx === i ? { ...r, amount: e.target.value } : r))} placeholder="$" style={{ ...inputStyle, width: 80 }} />
                                        </div>
                                    ))}
                                </div>

                                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "12px 14px", marginBottom: 24, fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif", color: "#A8A4A0", lineHeight: 1.6 }}>
                                    You're entering <strong style={{ color: "#F0EDE8" }}>{closeMonthData.nextMonthLabel}</strong> with{" "}
                                    <strong style={{ color: summary?.runwayMonths != null ? (summary.runwayMonths > 6 ? "#4CAF8A" : "#E8C42A") : "#888" }}>
                                        {summary?.runwayMonths != null ? `${summary.runwayMonths.toFixed(1)} months` : "unknown"} of runway
                                    </strong>
                                    {nextMonthGoal && Number(nextMonthGoal) > 0 && (
                                        <> and a goal of <strong style={{ color: "#4CAF8A" }}>{formatCurrency(Number(nextMonthGoal))}</strong> in revenue</>
                                    )}.
                                </div>

                                <div style={{ display: "flex", gap: 10 }}>
                                    <button onClick={() => setCloseStep(2)} style={{ flex: 1, background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 9, padding: "11px", color: "rgba(240,237,232,0.62)", fontSize: 13, cursor: "pointer" }}>← Back</button>
                                    <button onClick={() => void handleFinishClose()} disabled={savingClose} style={{ flex: 2, background: "rgba(232,98,42,0.15)", border: "1px solid rgba(232,98,42,0.4)", borderRadius: 9, padding: "11px", color: "#E8622A", fontSize: 13, fontWeight: 700, cursor: savingClose ? "default" : "pointer", opacity: savingClose ? 0.7 : 1 }}>
                                        {savingClose ? "Saving..." : "Close the Month"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

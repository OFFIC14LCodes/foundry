import { useEffect, useState } from "react";
import { STAGES_DATA } from "../constants/stages";
import { STAGE_COLORS } from "../constants/glossary";
import { BUDGET_CARDS } from "../constants/onboarding";
import { TAG_COLORS } from "../constants/styles";
import { Icons } from "../icons";
import { Archive } from "lucide-react";
import { formatCurrency, getBudgetRangeLabel, parseBudgetInput } from "../lib/budget";
import { getBusinessHealth } from "../lib/businessHealth";
import { summarizeBusinessIdea } from "../lib/businessSummary";
import Logo from "./Logo";
import MicButton from "./MicButton";
import PlaidConnectButton from "./PlaidConnectButton";

export default function HubScreen({
    profile,
    marketReport,
    onUpdateProfile,
    onEnterStage,
    onOpenForge,
    onRevertToStage,
    onLogout,
    onOpenUpgrade,
    onReset,
    onOpenJournal,
    onOpenBriefings,
    onOpenPitchPractice,
    onOpenDocuments,
    onOpenMarketIntel,
    onOpenBusinessModelCanvas,
    onOpenCofounder,
    onOpenSettings,
    onOpenAdminHub,
    onOpenAcademy,
    onOpenArchive,
    isAdmin = false,
    completedByStage,
    furthestStageReached = 1,
    accessSummary,
    activeNudge = null,
    onDismissNudge,
    onActOnNudge,
    financialData = null,
    financialSummary = null,
    onSaveExpense,
    onDeleteExpense,
    onSaveRevenue,
    onDeleteRevenue,
    onSaveFinancialSettings,
    onPlaidConnected,
    onSyncPlaidTransactions,
    onDisconnectPlaidItem,
    onAcceptPlaidTransactionAsExpense,
    onAcceptPlaidTransactionAsRevenue,
    onIgnorePlaidTransaction,
}) {
    const [showDecisionModal, setShowDecisionModal] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showIncomeModal, setShowIncomeModal] = useState(false);
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [decisionText, setDecisionText] = useState("");
    const [decisionTag, setDecisionTag] = useState("Strategy");
    const [expenseLabel, setExpenseLabel] = useState("");
    const [expenseAmount, setExpenseAmount] = useState("");
    const [expenseCategory, setExpenseCategory] = useState("operating");
    const [expenseDate, setExpenseDate] = useState("");
    const [expenseFrequency, setExpenseFrequency] = useState<"one-time" | "monthly" | "yearly">("one-time");
    const [expenseRenewalDate, setExpenseRenewalDate] = useState("");
    const [incomeLabel, setIncomeLabel] = useState("");
    const [incomeAmount, setIncomeAmount] = useState("");
    const [incomeCategory, setIncomeCategory] = useState("sales");
    const [incomeDate, setIncomeDate] = useState("");
    const [incomeFrequency, setIncomeFrequency] = useState<"one-time" | "monthly" | "yearly">("one-time");
    const [incomeRenewalDate, setIncomeRenewalDate] = useState("");
    const [budgetEditAmount, setBudgetEditAmount] = useState("");
    const [budgetEditRange, setBudgetEditRange] = useState(profile.budgetRange || "");
    const [resetConfirmationCode, setResetConfirmationCode] = useState("");
    const [resetError, setResetError] = useState<string | null>(null);
    const [syncingPlaidItemId, setSyncingPlaidItemId] = useState<string | null>(null);
    const [plaidActionId, setPlaidActionId] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!showResetModal) {
            setResetConfirmationCode("");
            setResetError(null);
        }
    }, [showResetModal]);

    useEffect(() => {
        console.debug("[AdminHub] HubScreen props", {
            authUserEmail: null,
            profileEmail: profile?.email ?? null,
            profileRole: profile?.role ?? null,
            hasAdminHubAccess: isAdmin,
            hubScreenIsAdminProp: isAdmin,
            willRenderAdminTab: isAdmin,
        });
    }, [profile?.email, profile?.role, isAdmin]);

    const addDecision = () => {
        if (!decisionText.trim()) return;

        onUpdateProfile({
            decisions: [
                { text: decisionText.trim(), tag: decisionTag, date: "Today" },
                ...(profile.decisions || []),
            ],
        });

        setDecisionText("");
        setDecisionTag("Strategy");
        setShowDecisionModal(false);
    };

    const expenseCategoryOptions = ["operating", "software", "marketing", "legal", "payroll", "contractor", "other"];
    const revenueCategoryOptions = ["sales", "services", "subscription", "consulting", "other"];
    const normalizedExpenses = financialData?.expenses || [];
    const normalizedRevenue = financialData?.revenue || [];
    const plaidItems = financialData?.plaidItems || [];
    const pendingPlaidTransactions = financialData?.pendingPlaidTransactions || [];
    const plaidAccounts = (financialData?.accounts || []).filter((account: any) => account.provider === "plaid");
    const formatFinancialDate = (value?: string | null) => {
        if (!value) return "";
        const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? new Date(`${value}T12:00:00`)
            : new Date(value);
        if (Number.isNaN(parsed.getTime())) return String(value);
        return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };
    const expenseRows = normalizedExpenses.length ? normalizedExpenses : (profile.budget?.expenses || []).map((item: any) => ({
        id: item.id || item.label,
        label: item.label,
        category: item.category || "operating",
        amount: Number(item.amount || 0),
        incurredOn: item.incurredOn || item.date || null,
        frequency: item.frequency === "monthly" || item.frequency === "yearly" ? item.frequency : "one_time",
    }));
    const revenueRows = normalizedRevenue.length ? normalizedRevenue : (profile.budget?.income || []).map((item: any) => ({
        id: item.id || item.label,
        label: item.label,
        category: item.category || "sales",
        amount: Number(item.amount || 0),
        receivedOn: item.receivedOn || item.date || null,
        frequency: item.frequency === "monthly" || item.frequency === "yearly" ? item.frequency : "one_time",
    }));

    const addExpense = async () => {
        const amt = parseFloat(expenseAmount);
        if (!expenseLabel.trim() || isNaN(amt) || amt <= 0) return;
        if (expenseFrequency !== "one-time" && !expenseRenewalDate) return;

        await onSaveExpense?.({
            label: expenseLabel.trim(),
            amount: amt,
            category: expenseCategory,
            incurredOn: expenseDate || null,
            frequency: expenseFrequency === "monthly" ? "monthly" : expenseFrequency === "yearly" ? "yearly" : "one_time",
            renewalDate: expenseFrequency !== "one-time" ? expenseRenewalDate : null,
            notes: null,
        });
        setExpenseLabel(""); setExpenseAmount(""); setExpenseCategory("operating"); setExpenseDate(""); setExpenseFrequency("one-time"); setExpenseRenewalDate("");
        setShowExpenseModal(false);
    };

    const addIncome = async () => {
        const amt = parseFloat(incomeAmount);
        if (!incomeLabel.trim() || isNaN(amt) || amt <= 0) return;
        if (incomeFrequency !== "one-time" && !incomeRenewalDate) return;

        await onSaveRevenue?.({
            label: incomeLabel.trim(),
            amount: amt,
            category: incomeCategory,
            receivedOn: incomeDate || null,
            frequency: incomeFrequency === "monthly" ? "monthly" : incomeFrequency === "yearly" ? "yearly" : "one_time",
            renewalDate: incomeFrequency !== "one-time" ? incomeRenewalDate : null,
            notes: null,
        });
        setIncomeLabel(""); setIncomeAmount(""); setIncomeCategory("sales"); setIncomeDate(""); setIncomeFrequency("one-time"); setIncomeRenewalDate("");
        setShowIncomeModal(false);
    };

    const deleteExpense = async (id: string) => {
        await onDeleteExpense?.(id);
    };

    const deleteIncome = async (id: string) => {
        await onDeleteRevenue?.(id);
    };

    const handleSyncPlaid = async (plaidItemId: string) => {
        setSyncingPlaidItemId(plaidItemId);
        try {
            await onSyncPlaidTransactions?.(plaidItemId);
        } finally {
            setSyncingPlaidItemId(null);
        }
    };

    const handleDisconnectPlaid = async (plaidItemId: string, institutionName?: string | null) => {
        const confirmed = window.confirm(
            `Disconnect ${institutionName || "this bank connection"}? Imported transactions still waiting for review from this bank will be removed, but transactions you already approved into your financial model will stay.`,
        );
        if (!confirmed) return;

        setSyncingPlaidItemId(plaidItemId);
        try {
            await onDisconnectPlaidItem?.(plaidItemId);
        } finally {
            setSyncingPlaidItemId(null);
        }
    };

    const handleAcceptImportedExpense = async (transaction: any) => {
        setPlaidActionId(transaction.id);
        try {
            await onAcceptPlaidTransactionAsExpense?.(transaction);
        } finally {
            setPlaidActionId(null);
        }
    };

    const handleAcceptImportedRevenue = async (transaction: any) => {
        setPlaidActionId(transaction.id);
        try {
            await onAcceptPlaidTransactionAsRevenue?.(transaction);
        } finally {
            setPlaidActionId(null);
        }
    };

    const handleIgnoreImportedTransaction = async (transactionId: string) => {
        setPlaidActionId(transactionId);
        try {
            await onIgnorePlaidTransaction?.(transactionId);
        } finally {
            setPlaidActionId(null);
        }
    };

    const openBudgetModal = () => {
        setBudgetEditAmount(String(profile.exactBudgetAmount ?? profile.budget?.total ?? 0));
        setBudgetEditRange(profile.budgetRange || "");
        setShowBudgetModal(true);
    };

    const confirmReset = async () => {
        if (resetConfirmationCode.trim() !== "12345") {
            setResetError("Type 12345 exactly to confirm the reset.");
            return;
        }

        setResetError(null);
        setShowResetModal(false);
        setSidebarOpen(false);
        await onReset();
    };

    const saveBudget = () => {
        const parsedAmount = parseBudgetInput(budgetEditAmount);
        if (!parsedAmount) return;

        onUpdateProfile({
            budgetRange: budgetEditRange || null,
            exactBudgetAmount: parsedAmount,
            budgetIsEstimated: false,
            budget: {
                ...profile.budget,
                total: parsedAmount,
                remaining: parsedAmount,
            },
        });
        void onSaveFinancialSettings?.({ startingCash: parsedAmount });

        setShowBudgetModal(false);
    };

    const currentStage = profile.currentStage || 1;
    const revisitingStage = furthestStageReached > currentStage;
    const nextReachedStage = revisitingStage ? currentStage + 1 : null;
    const businessSummary = summarizeBusinessIdea(profile.businessName, profile.idea, 10);
    const businessHealth = getBusinessHealth(profile, completedByStage, marketReport, financialSummary);

    const NAV_ITEMS = [
        ...(isAdmin ? [{
            icon: Icons.sidebar.admin,
            label: "Admin Hub",
            sub: "Internal control panel",
            action: () => {
                setSidebarOpen(false);
                onOpenAdminHub?.();
            },
            available: true,
        }] : []),
        {
            icon: Icons.sidebar.academy,
            label: "Forge Academy",
            sub: "Deep founder learning hub",
            action: () => {
                setSidebarOpen(false);
                onOpenAcademy?.();
            },
            available: true,
        },
        {
            icon: Archive,
            label: "Archive",
            sub: "Saved conversation snapshots",
            action: () => {
                setSidebarOpen(false);
                onOpenArchive?.();
            },
            available: true,
        },
        {
            icon: Icons.sidebar.journal,
            label: "Founder's Journal",
            sub: "Private writing space",
            action: () => {
                setSidebarOpen(false);
                onOpenJournal();
            },
            available: true,
        },
        {
            icon: Icons.sidebar.briefings,
            label: "Monday Briefings",
            sub: "Weekly Forge updates",
            action: () => {
                setSidebarOpen(false);
                onOpenBriefings();
            },
            available: true,
        },
        {
            icon: Icons.sidebar.pitchPractice,
            label: "Pitch Practice",
            sub: "Simulate investor meetings",
            action: () => {
                setSidebarOpen(false);
                onOpenPitchPractice();
            },
            available: true,
        },
        {
            icon: Icons.sidebar.documents,
            label: "Document Production",
            sub: "Professional documents",
            action: () => {
                setSidebarOpen(false);
                onOpenDocuments();
            },
            available: true,
        },
        {
            icon: Icons.stages.plan,
            label: "Business Model Canvas",
            sub: "Living Stage 2 strategy map",
            action: () => {
                setSidebarOpen(false);
                onOpenBusinessModelCanvas?.();
            },
            available: true,
        },
        {
            icon: Icons.sidebar.marketIntel,
            label: "Market Intelligence",
            sub: "Daily industry briefing",
            action: () => {
                setSidebarOpen(false);
                onOpenMarketIntel();
            },
            available: true,
        },
        {
            icon: Icons.sidebar.cofounder,
            label: "Co-Founder Mode",
            sub: "Shared team workspace",
            action: () => {
                setSidebarOpen(false);
                onOpenCofounder();
            },
            available: true,
        },
        {
            icon: Icons.sidebar.settings,
            label: "Settings",
            sub: "Account, billing, and policies",
            action: () => {
                setSidebarOpen(false);
                onOpenSettings?.();
            },
            available: true,
        },
    ];


    return (
        <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8" }}>
            {sidebarOpen && (
                <div
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 40,
                        background: "rgba(0,0,0,0.6)",
                        backdropFilter: "blur(4px)",
                        animation: "fadeIn 0.2s ease",
                    }}
                />
            )}

            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: "var(--foundry-hub-sidebar-width)",
                    zIndex: 50,
                    background: "#0C0C0E",
                    borderRight: "1px solid rgba(255,255,255,0.08)",
                    transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
                    transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1)",
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                }}
            >
                <div
                    style={{
                        padding: "var(--foundry-hub-sidebar-header-padding)",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 14,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Logo variant="flame" style={{ width: 18, height: 18, objectFit: "contain" }} />
                            <span
                                style={{
                                    fontSize: "var(--foundry-hub-sidebar-title-font)",
                                    fontFamily: "'Playfair Display', Georgia, serif",
                                    fontWeight: 700,
                                    color: "#F0EDE8",
                                }}
                            >
                                Foundry
                            </span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            style={{
                                background: "rgba(255,255,255,0.05)",
                                border: "none",
                                borderRadius: 6,
                                padding: "var(--foundry-hub-sidebar-close-padding)",
                                color: "#555",
                                fontSize: "var(--foundry-hub-sidebar-close-font)",
                                cursor: "pointer",
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    <div
                        style={{
                            fontSize: "var(--foundry-hub-sidebar-name-font)",
                            fontFamily: "'Lora', Georgia, serif",
                            color: "#C8C4BE",
                            fontWeight: 500,
                        }}
                    >
                        {profile.name}
                    </div>
                    <div
                        style={{
                            fontSize: "var(--foundry-hub-sidebar-summary-font)",
                            color: "#555",
                            marginTop: 2,
                            fontStyle: "italic",
                        }}
                    >
                        {businessSummary}
                    </div>
                </div>

                <div style={{ padding: "12px 10px", flex: 1 }}>
                    {accessSummary && (
                        <div style={{ padding: "0 8px 14px" }}>
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 12px 10px" }}>
                                <div style={{ fontSize: "var(--foundry-hub-sidebar-section-label-font)", color: "#444", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                                    Access
                                </div>
                                <div style={{ fontSize: "var(--foundry-hub-sidebar-card-title-font)", color: "#F0EDE8", fontWeight: 600, marginBottom: 4 }}>
                                    {accessSummary.planName} · {accessSummary.statusLabel}
                                </div>
                                <div style={{ fontSize: "var(--foundry-hub-sidebar-card-copy-font)", color: "#666", lineHeight: 1.6 }}>
                                    {accessSummary.note}
                                </div>
                                {!accessSummary.canAccessPaidStages && (
                                    <button
                                        onClick={() => {
                                            setSidebarOpen(false);
                                            onOpenUpgrade?.();
                                        }}
                                        style={{ marginTop: 10, width: "100%", padding: "var(--foundry-hub-sidebar-card-button-padding)", borderRadius: 8, border: "1px solid rgba(232,98,42,0.22)", background: "rgba(232,98,42,0.1)", color: "#E8622A", fontSize: "var(--foundry-hub-sidebar-card-button-font)", cursor: "pointer", fontWeight: 600 }}
                                    >
                                        Unlock Stage 2
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div
                        style={{
                            fontSize: "var(--foundry-hub-sidebar-section-label-font)",
                            color: "#444",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            padding: "4px 8px 10px",
                        }}
                    >
                        Features
                    </div>

                    {NAV_ITEMS.map((item, i) => {
                        const Icon = item.icon;

                        return (
                            <button
                                key={i}
                                onClick={item.available && item.action ? item.action : undefined}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "var(--foundry-hub-sidebar-nav-gap)",
                                    padding: "var(--foundry-hub-sidebar-nav-padding)",
                                    borderRadius: 10,
                                    border: "none",
                                    background: "transparent",
                                    cursor: item.available ? "pointer" : "default",
                                    opacity: item.available ? 1 : 0.35,
                                    transition: "background 0.15s",
                                    marginBottom: 2,
                                    textAlign: "left",
                                }}
                                onMouseEnter={(e) => {
                                    if (item.available) {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "transparent";
                                }}
                            >
                                <div
                                    style={{
                                        width: "var(--foundry-hub-sidebar-nav-icon-box)",
                                        height: "var(--foundry-hub-sidebar-nav-icon-box)",
                                        borderRadius: 9,
                                        background: item.available
                                            ? "rgba(232,98,42,0.12)"
                                            : "rgba(255,255,255,0.04)",
                                        border: item.available
                                            ? "1px solid rgba(232,98,42,0.2)"
                                            : "1px solid rgba(255,255,255,0.06)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                        color: item.available ? "#F0EDE8" : "#888",
                                    }}
                                >
                                    <Icon size={"var(--foundry-hub-sidebar-nav-icon-size)"} />
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            fontSize: "var(--foundry-hub-sidebar-nav-title-font)",
                                            color: item.available ? "#F0EDE8" : "#666",
                                            fontWeight: 500,
                                            lineHeight: 1.2,
                                            marginBottom: 2,
                                        }}
                                    >
                                        {item.label}
                                    </div>
                                    <div style={{ fontSize: "var(--foundry-hub-sidebar-nav-sub-font)", color: "#444" }}>
                                        {item.available ? item.sub : "Coming soon"}
                                    </div>
                                </div>

                                {item.available && <span style={{ fontSize: "var(--foundry-hub-sidebar-nav-sub-font)", color: "#555" }}>→</span>}
                            </button>
                        );
                    })}

                    <div style={{ padding: "12px 10px 24px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <button
                            onClick={() => setShowLogoutModal(true)}
                            style={{
                                width: "100%",
                                padding: "var(--foundry-hub-sidebar-footer-button-padding)",
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 8,
                                color: "#888",
                                fontSize: "var(--foundry-hub-sidebar-footer-button-font)",
                                cursor: "pointer",
                                marginBottom: 8,
                            }}
                        >
                            Log Out
                        </button>
                        <button
                            onClick={() => setShowResetModal(true)}
                            style={{
                                width: "100%",
                                padding: "var(--foundry-hub-sidebar-footer-button-padding)",
                                background: "transparent",
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: 8,
                                color: "#444",
                                fontSize: "var(--foundry-hub-sidebar-footer-button-font)",
                                cursor: "pointer",
                            }}
                        >
                            Reset Account
                        </button>
                    </div>
                </div>
            </div>

            <div
                className="hub-topbar"
                style={{
                    padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    position: "sticky",
                    top: 0,
                    background: "rgba(8,8,9,0.95)",
                    backdropFilter: "blur(12px)",
                    zIndex: 10,
                }}
            >
                <div className="hub-topbar__identity">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 8,
                            padding: "var(--foundry-hub-header-menu-padding)",
                            color: "#888",
                            fontSize: "var(--foundry-hub-header-menu-font)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        ☰
                    </button>

                    <div>
                        <div
                            style={{
                                fontSize: "var(--foundry-hub-header-title-font)",
                                fontFamily: "'Playfair Display', Georgia, serif",
                                fontWeight: 700,
                                color: "#F0EDE8",
                            }}
                        >
                            Foundry
                        </div>
                        <div style={{ fontSize: "var(--foundry-hub-header-meta-font)", color: "#555" }}>Hub · {profile.name}</div>
                    </div>
                </div>

                <button
                    onClick={onOpenForge}
                    style={{
                        background: "linear-gradient(135deg, #E8622A, #c9521e)",
                        border: "none",
                        borderRadius: 10,
                        padding: "var(--foundry-hub-header-cta-padding)",
                        color: "#fff",
                        fontSize: "var(--foundry-hub-header-cta-font)",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontFamily: "'Lora', Georgia, serif",
                    }}
                >
                    <Icons.forge.chat size={"var(--foundry-hub-header-cta-icon-size)"} /> Talk to Forge
                </button>
            </div>

            <div className="hub-content">
                <div
                    style={{
                        marginBottom: 16,
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? "translateY(0)" : "translateY(8px)",
                        transition: "all 0.5s ease",
                    }}
                >
                    <div
                        style={{
                            fontSize: 22,
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontWeight: 700,
                            color: "#F0EDE8",
                            lineHeight: 1.2,
                            marginBottom: 4,
                        }}
                    >
                        Welcome back, {profile.name}
                    </div>
                    <div
                        style={{
                            fontSize: 13,
                            color: "#666",
                            fontFamily: "'Lora', Georgia, serif",
                            fontStyle: "italic",
                        }}
                    >
                        {businessSummary}
                    </div>
                </div>

                {activeNudge && (
                    <div
                        style={{
                            background: "rgba(232, 98, 42, 0.08)",
                            border: "1px solid rgba(232, 98, 42, 0.3)",
                            borderRadius: 14,
                            padding: "14px 16px",
                            marginBottom: 14,
                            animation: "fadeSlideUp 0.4s ease 0.05s both",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                            <div
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: "50%",
                                    background: "rgba(232, 98, 42, 0.18)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    marginTop: 1,
                                }}
                            >
                                <Icons.forge.chat size={14} color="#E8622A" />
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    color: "#D4CFC9",
                                    fontFamily: "'Lora', Georgia, serif",
                                    lineHeight: 1.5,
                                }}
                            >
                                {activeNudge.nudgeText}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, paddingLeft: 38 }}>
                            <button
                                onClick={() => {
                                    onActOnNudge?.();
                                    onOpenForge();
                                }}
                                style={{
                                    background: "linear-gradient(135deg, #E8622A, #c9521e)",
                                    border: "none",
                                    borderRadius: 8,
                                    padding: "6px 14px",
                                    color: "#fff",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontFamily: "'Lora', Georgia, serif",
                                }}
                            >
                                Talk to Forge
                            </button>
                            <button
                                onClick={() => onDismissNudge?.()}
                                style={{
                                    background: "transparent",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 8,
                                    padding: "6px 12px",
                                    color: "#666",
                                    fontSize: 12,
                                    cursor: "pointer",
                                    fontFamily: "'Lora', Georgia, serif",
                                }}
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                <div
                    style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 16,
                        padding: "14px 16px",
                        marginBottom: 14,
                        animation: "fadeSlideUp 0.5s ease 0.1s both",
                    }}
                >
                    <div className="hub-section-header" style={{ marginBottom: 12 }}>
                        <div
                            style={{
                                fontSize: 15,
                                fontFamily: "'Lora', Georgia, serif",
                                fontWeight: 600,
                                color: "#F0EDE8",
                            }}
                        >
                            Your Journey
                        </div>
                        <div style={{ fontSize: 11, color: "#E8622A" }}>
                            Stage {currentStage} of 6
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                        {STAGES_DATA.map((stage) => {
                            const isComplete = stage.id < currentStage;
                            const isCurrent = stage.id === currentStage;
                            const StageIcon = stage.icon;

                            return (
                                <div
                                    key={stage.id}
                                    onClick={() => stage.id <= currentStage && onEnterStage(stage.id)}
                                    style={{
                                        flex: 1,
                                        cursor: stage.id <= currentStage ? "pointer" : "default",
                                        textAlign: "center",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: "100%",
                                            aspectRatio: "1",
                                            maxWidth: 44,
                                            margin: "0 auto 5px",
                                            borderRadius: 10,
                                            fontSize: 16,
                                            background: isComplete
                                                ? "linear-gradient(135deg, #E8622A, #c9521e)"
                                                : isCurrent
                                                    ? "rgba(232,98,42,0.15)"
                                                    : "rgba(255,255,255,0.03)",
                                            border: isCurrent ? "1px solid rgba(232,98,42,0.5)" : "none",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        {isComplete ? "✓" : <StageIcon size={18} color={isCurrent ? stage.color : "#888"} />}
                                    </div>

                                    <div
                                        style={{
                                            fontSize: 9,
                                            color: isCurrent ? "#E8622A" : isComplete ? "#666" : "#333",
                                            fontWeight: isCurrent ? 600 : 400,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                        }}
                                    >
                                        {stage.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ marginTop: 4, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                        <div
                            style={{
                                height: "100%",
                                width: `${((currentStage - 1) / 5) * 100}%`,
                                background: "linear-gradient(90deg, #E8622A, #F5A843)",
                                borderRadius: 2,
                                transition: "width 1s ease",
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <div style={{ fontSize: 11, color: "#555" }}>
                            {Math.round(((currentStage - 1) / 5) * 100)}% complete
                        </div>
                        <div
                            onClick={() => onEnterStage(currentStage)}
                            style={{ fontSize: 11, color: "#E8622A", cursor: "pointer" }}
                        >
                            Continue Stage {currentStage} →
                        </div>
                    </div>

                    {currentStage > 1 && (
                        <button
                            onClick={() => onRevertToStage?.(currentStage - 1)}
                            style={{
                                marginTop: 12,
                                width: "100%",
                                padding: "10px 12px",
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 10,
                                color: "#C8C4BE",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            Go Back to Stage {currentStage - 1}
                        </button>
                    )}

                    {revisitingStage && nextReachedStage && (
                        <div style={{ marginTop: 10, fontSize: 11, color: "#666", lineHeight: 1.6 }}>
                            You&apos;re revisiting Stage {currentStage}. When you&apos;re ready, the Goals tab will let you move back into Stage {nextReachedStage}.
                        </div>
                    )}
                </div>

                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px", marginBottom: 14, animation: "fadeSlideUp 0.5s ease 0.14s both" }}>
                    <div className="hub-section-header" style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>
                            Business Health
                        </div>
                        <div className="foundry-inline-actions">
                            <div style={{ fontSize: 11, color: businessHealth.overallScore >= 62 ? "#4CAF8A" : businessHealth.overallScore >= 45 ? "#D9B15D" : "#E8622A" }}>
                                {businessHealth.statusLabel}
                            </div>
                            <button
                                onClick={() => onOpenMarketIntel?.()}
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "4px 12px", color: "#C8C4BE", fontSize: 11, cursor: "pointer", fontWeight: 500 }}
                            >
                                Market Intel
                            </button>
                        </div>
                    </div>

                    <div className="hub-health-grid">
                        <BusinessHealthDonut health={businessHealth} />
                        <div style={{ display: "grid", gap: 8 }}>
                            {businessHealth.segments.map((segment) => (
                                <div key={segment.key} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: "8px 9px" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9, marginBottom: 5 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                            <span style={{ width: 7, height: 7, borderRadius: 999, background: segment.color, flexShrink: 0 }} />
                                            <span style={{ fontSize: 11, color: "#F0EDE8", fontWeight: 600 }}>{segment.label}</span>
                                        </div>
                                        <span style={{ fontSize: 11, color: segment.color, fontWeight: 700 }}>{segment.value}</span>
                                    </div>
                                    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 999, overflow: "hidden", marginBottom: 6 }}>
                                        <div style={{ width: `${segment.value}%`, height: "100%", background: segment.color, borderRadius: 999, transition: "width 0.6s ease" }} />
                                    </div>
                                    <div style={{ fontSize: 10, color: "#787169", lineHeight: 1.55 }}>
                                        {segment.note}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginTop: 14, fontSize: 11, color: "#666", lineHeight: 1.7 }}>
                        This is a directional founder health view built from your stage progress, financial position, decision history, and latest market intelligence.
                        {!businessHealth.hasMarketReport && " Generate a market report to sharpen the Market and Growth scores."}
                    </div>
                </div>

                {accessSummary && (
                    <div style={{ background: "linear-gradient(180deg, rgba(232,98,42,0.08), rgba(255,255,255,0.02))", border: "1px solid rgba(232,98,42,0.16)", borderRadius: 16, padding: "14px 16px", marginBottom: 14, animation: "fadeSlideUp 0.5s ease 0.18s both" }}>
                        <div className="hub-section-header" style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>
                                Access
                            </div>
                            <div style={{ fontSize: 11, color: accessSummary.canAccessPaidStages ? "#4CAF8A" : "#E8622A" }}>
                                {accessSummary.planName} · {accessSummary.statusLabel}
                            </div>
                        </div>
                        <div style={{ fontSize: 12, color: "#A8A4A0", lineHeight: 1.7 }}>
                            {accessSummary.note}
                        </div>
                        {!accessSummary.canAccessPaidStages && (
                            <button
                                onClick={() => onOpenUpgrade?.()}
                                style={{ marginTop: 12, padding: "9px 14px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                            >
                                Unlock the execution phase
                            </button>
                        )}
                    </div>
                )}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 14, animation: "fadeSlideUp 0.5s ease 0.22s both" }}>
                    <div className="hub-section-header" style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Business Model Canvas</div>
                        <button
                            onClick={() => onOpenBusinessModelCanvas?.()}
                            style={{ background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.25)", borderRadius: 8, padding: "4px 12px", color: "#E8622A", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                        >
                            Open Canvas
                        </button>
                    </div>
                    <div style={{ fontSize: 12, color: "#A8A4A0", lineHeight: 1.65 }}>
                        Forge uses the canvas to turn Stage 2 thinking into a sharper business model. Open it to see what is already solid, what is still vague, and where Forge should push next.
                    </div>
                </div>
                {/* Financial Modeling */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 14, animation: "fadeSlideUp 0.5s ease 0.25s both" }}>
                    <div className="hub-section-header" style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Financial Modeling</div>
                        <div className="foundry-inline-actions">
                            <button onClick={openBudgetModal} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "4px 12px", color: "#F0EDE8", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>Customize</button>
                            <button onClick={() => setShowIncomeModal(true)} style={{ background: "rgba(76,175,138,0.1)", border: "1px solid rgba(76,175,138,0.25)", borderRadius: 8, padding: "4px 12px", color: "#4CAF8A", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>+ Revenue</button>
                            <button onClick={() => setShowExpenseModal(true)} style={{ background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.25)", borderRadius: 8, padding: "4px 12px", color: "#E8622A", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>+ Expense</button>
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#A8A4A0", lineHeight: 1.6, marginBottom: 12 }}>
                        Estimates based on the data you&apos;ve entered. This is not accounting, tax, or legal advice.
                    </div>
                    {(profile.budgetRange || profile.budgetIsEstimated) && (
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 12, fontSize: 10, color: "#666" }}>
                            <div>Range: {getBudgetRangeLabel(profile.budgetRange) || "Not set"}</div>
                            <div>{profile.budgetIsEstimated ? "Using provisional amount" : "Exact budget confirmed"}</div>
                        </div>
                    )}
                    <div className="hub-budget-grid" style={{ marginBottom: 14 }}>
                        {[
                            { label: "Available Cash", value: formatCurrency(financialSummary?.availableCash || profile.budget?.remaining || 0), color: "#F0EDE8" },
                            { label: "Monthly Burn", value: formatCurrency(financialSummary?.monthlyBurn || 0), color: "#E8622A" },
                            { label: "Runway", value: financialSummary?.runwayMonths != null ? `${financialSummary.runwayMonths.toFixed(1)} mo` : "TBD", color: "#4CAF8A" },
                            { label: "Net Snapshot", value: formatCurrency(financialSummary?.roughNetSnapshot || 0), color: (financialSummary?.roughNetSnapshot || 0) >= 0 ? "#4CAF8A" : "#FF6B6B" },
                        ].map(item => (
                            <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px", textAlign: "center" }}>
                                <div style={{ fontSize: "clamp(14px, 4vw, 20px)", fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: item.color, lineHeight: 1.1, marginBottom: 3 }}>{item.value}</div>
                                <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.label}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                            <div>
                                <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Connect Bank</div>
                                <div style={{ fontSize: 11, color: "#A8A4A0", lineHeight: 1.6, marginTop: 4 }}>
                                    Imported transactions need review. These will not affect your financial model until approved.
                                </div>
                            </div>
                            <PlaidConnectButton onConnected={onPlaidConnected} />
                        </div>
                        {plaidItems.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                                {plaidItems.map((item) => (
                                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600 }}>{item.institutionName || "Connected bank"}</div>
                                            <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                                                {plaidAccounts.filter((account: any) => account.providerItemId === item.plaidItemId).length} linked accounts
                                                {item.lastSyncedAt ? ` · last synced ${formatFinancialDate(item.lastSyncedAt)}` : ""}
                                            </div>
                                            {plaidAccounts.filter((account: any) => account.providerItemId === item.plaidItemId).length > 0 && (
                                                <div style={{ fontSize: 10, color: "#8B8680", marginTop: 4, lineHeight: 1.5 }}>
                                                    {plaidAccounts
                                                        .filter((account: any) => account.providerItemId === item.plaidItemId)
                                                        .slice(0, 3)
                                                        .map((account: any) => account.officialName || account.name || `Account ••${account.mask || account.last4 || ""}`)
                                                        .join(" · ")}
                                                    {plaidAccounts.filter((account: any) => account.providerItemId === item.plaidItemId).length > 3 ? " · ..." : ""}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                                            <button
                                                onClick={() => handleSyncPlaid(item.plaidItemId)}
                                                disabled={syncingPlaidItemId === item.plaidItemId}
                                                style={{
                                                    background: "rgba(255,255,255,0.04)",
                                                    border: "1px solid rgba(255,255,255,0.08)",
                                                    borderRadius: 8,
                                                    padding: "8px 12px",
                                                    color: "#F0EDE8",
                                                    fontSize: 11,
                                                    cursor: syncingPlaidItemId === item.plaidItemId ? "default" : "pointer",
                                                }}
                                            >
                                                {syncingPlaidItemId === item.plaidItemId ? "Working..." : "Sync Transactions"}
                                            </button>
                                            <button
                                                onClick={() => handleDisconnectPlaid(item.plaidItemId, item.institutionName)}
                                                disabled={syncingPlaidItemId === item.plaidItemId}
                                                style={{
                                                    background: "rgba(232,98,42,0.1)",
                                                    border: "1px solid rgba(232,98,42,0.25)",
                                                    borderRadius: 8,
                                                    padding: "8px 12px",
                                                    color: "#E8622A",
                                                    fontSize: 11,
                                                    cursor: syncingPlaidItemId === item.plaidItemId ? "default" : "pointer",
                                                }}
                                            >
                                                Unlink Bank
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 8, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Profit First Buckets</div>
                            <div style={{ fontSize: 10, color: "#666" }}>{financialSummary?.profitFirst?.basisLabel || "Estimated basis"}</div>
                        </div>
                        {(financialSummary?.profitFirst?.buckets || []).map((bucket) => (
                            <div key={bucket.bucketType} style={{ marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                                    <div style={{ fontSize: 12, color: "#F0EDE8", textTransform: "capitalize" }}>{bucket.bucketType.replace("_", " ")}</div>
                                    <div style={{ fontSize: 11, color: "#C8C4BE" }}>{bucket.allocationPercent}% · {formatCurrency(bucket.estimatedAmount)}</div>
                                </div>
                                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                                    <div style={{ width: `${Math.max(0, Math.min(bucket.allocationPercent, 100))}%`, height: "100%", background: bucket.bucketType === "profit" || bucket.bucketType === "tax" ? "linear-gradient(90deg, #4CAF8A, #75D0A7)" : "linear-gradient(90deg, #E8622A, #F5A843)" }} />
                                </div>
                            </div>
                        ))}
                        <div style={{ fontSize: 10, color: "#666", lineHeight: 1.5 }}>Connect bank data later to improve accuracy. For now, these allocations are estimated from your entered revenue or available cash.</div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 8 }}>Runway Calculator</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 10 }}>
                            <div>
                                <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Recurring Expenses</div>
                                <div style={{ fontSize: 16, color: "#E8622A", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>{formatCurrency(financialSummary?.monthlyRecurringExpenses || 0)}/mo</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Recurring Revenue</div>
                                <div style={{ fontSize: 16, color: "#4CAF8A", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>{formatCurrency(financialSummary?.monthlyRecurringRevenue || 0)}/mo</div>
                            </div>
                        </div>
                        <div style={{ fontSize: 11, color: "#A8A4A0", lineHeight: 1.6 }}>
                            Estimated monthly burn is recurring expenses minus recurring revenue, with yearly items spread across 12 months. One-time items stay in the snapshot totals but do not inflate recurring burn.
                        </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 8 }}>Rough Monthly Snapshot</div>
                        {financialSummary?.breakEvenReady ? (
                            <>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 10 }}>
                                    <div>
                                        <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Monthly Revenue</div>
                                        <div style={{ fontSize: 15, color: "#4CAF8A", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>{formatCurrency(financialSummary?.operatingView.monthlyRevenue || 0)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Monthly Expenses</div>
                                        <div style={{ fontSize: 15, color: "#E8622A", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>{formatCurrency(financialSummary?.operatingView.monthlyExpenses || 0)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Operating Gap</div>
                                        <div style={{ fontSize: 15, color: (financialSummary?.operatingView.monthlyOperatingGap || 0) >= 0 ? "#4CAF8A" : "#FF6B6B", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>{formatCurrency(financialSummary?.operatingView.monthlyOperatingGap || 0)}</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: 11, color: "#A8A4A0", lineHeight: 1.6 }}>{financialSummary.breakEvenMessage}</div>
                            </>
                        ) : (
                            <div style={{ fontSize: 12, color: "#A8A4A0", lineHeight: 1.6 }}>
                                Add revenue and categorize expenses to unlock a better break-even view. Foundry will keep this honest until the inputs are strong enough to say more.
                            </div>
                        )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <div style={{ fontSize: 12, color: "#F0EDE8", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>Imported Transactions</div>
                                <div style={{ fontSize: 10, color: "#666" }}>{pendingPlaidTransactions.length} pending</div>
                            </div>
                            <div style={{ fontSize: 10, color: "#666", lineHeight: 1.5, marginBottom: 8 }}>
                                These will not affect your financial model until you approve them.
                            </div>
                            {pendingPlaidTransactions.length === 0 ? (
                                <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>No imported transactions are waiting for review right now.</div>
                            ) : pendingPlaidTransactions.slice(0, 8).map((transaction: any) => (
                                <div key={transaction.id} style={{ padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12, color: "#C8C4BE" }}>{transaction.merchantName || transaction.name || "Imported transaction"}</div>
                                            <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                                                {formatFinancialDate(transaction.postedDate || transaction.authorizedDate)}{transaction.currency ? ` · ${transaction.currency}` : ""}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 12, color: Number(transaction.amount || 0) >= 0 ? "#E8622A" : "#4CAF8A", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>
                                            {Number(transaction.amount || 0) >= 0 ? "-" : "+"}{formatCurrency(Math.abs(Number(transaction.amount || 0)))}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                                        <button onClick={() => handleAcceptImportedExpense(transaction)} disabled={plaidActionId === transaction.id} style={{ background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.25)", borderRadius: 8, padding: "5px 10px", color: "#E8622A", fontSize: 11, cursor: plaidActionId === transaction.id ? "default" : "pointer" }}>Accept as Expense</button>
                                        <button onClick={() => handleAcceptImportedRevenue(transaction)} disabled={plaidActionId === transaction.id} style={{ background: "rgba(76,175,138,0.1)", border: "1px solid rgba(76,175,138,0.25)", borderRadius: 8, padding: "5px 10px", color: "#4CAF8A", fontSize: 11, cursor: plaidActionId === transaction.id ? "default" : "pointer" }}>Accept as Revenue</button>
                                        <button onClick={() => handleIgnoreImportedTransaction(transaction.id)} disabled={plaidActionId === transaction.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 10px", color: "#A8A4A0", fontSize: 11, cursor: plaidActionId === transaction.id ? "default" : "pointer" }}>Ignore</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <div style={{ fontSize: 12, color: "#F0EDE8", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>Expenses</div>
                                <div style={{ fontSize: 10, color: "#666" }}>{expenseRows.length} logged</div>
                            </div>
                            {expenseRows.length === 0 ? (
                                <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>No normalized expenses yet. Add the costs that actually shape the business and Foundry will start modeling burn and runway more intelligently.</div>
                            ) : expenseRows.map((exp: any) => (
                                <div key={exp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, color: "#C8C4BE" }}>{exp.label}</div>
                                        <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{exp.category} · {String(exp.frequency).replace("_", " ")}{exp.incurredOn ? ` · ${formatFinancialDate(exp.incurredOn)}` : ""}</div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ fontSize: 12, color: "#E8622A", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>-{formatCurrency(exp.amount)}</div>
                                        <button onClick={() => deleteExpense(exp.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }} title="Delete expense">×</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <div style={{ fontSize: 12, color: "#F0EDE8", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>Revenue</div>
                                <div style={{ fontSize: 10, color: "#666" }}>{revenueRows.length} logged</div>
                            </div>
                            {revenueRows.length === 0 ? (
                                <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>No revenue logged yet. Add sales, services, or recurring receipts to sharpen the operating view and make runway more realistic.</div>
                            ) : revenueRows.map((inc: any) => (
                                <div key={inc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, color: "#C8C4BE" }}>{inc.label}</div>
                                        <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{inc.category} · {String(inc.frequency).replace("_", " ")}{inc.receivedOn ? ` · ${formatFinancialDate(inc.receivedOn)}` : ""}</div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ fontSize: 12, color: "#4CAF8A", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>+{formatCurrency(inc.amount)}</div>
                                        <button onClick={() => deleteIncome(inc.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }} title="Delete revenue">×</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Glossary learned */}
                {(profile.glossaryLearned || []).length > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, animation: "fadeSlideUp 0.5s ease 0.32s both" }}>
                        <div className="hub-section-header" style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Icons.glossary.book size={14} />
                                <span>Your Glossary</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#4CAF8A" }}>{(profile.glossaryLearned || []).length} terms learned</div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {(profile.glossaryLearned || []).map((item, i) => {
                                const color = STAGE_COLORS[item.stage] || "#E8622A";
                                return <div key={i} style={{ fontSize: 11, color, background: `${color}12`, border: `1px solid ${color}25`, borderRadius: 20, padding: "3px 10px", fontFamily: "'Lora', Georgia, serif", fontWeight: 500 }}>{item.term}</div>;
                            })}
                        </div>
                        {(profile.glossaryLearned || []).length >= 5 && (
                            <div style={{ fontSize: 11, color: "#555", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", marginTop: 10 }}>You're building real business literacy. Keep going.</div>
                        )}
                    </div>
                )}

                {/* Concepts explored */}
                {(profile.exploredConcepts || []).length > 0 && (
                    <div style={{ background: "rgba(159,122,234,0.03)", border: "1px solid rgba(159,122,234,0.12)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, animation: "fadeSlideUp 0.5s ease 0.34s both" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>
                                <span style={{ color: "#9F7AEA" }}>✦</span>
                                <span>Concepts Explored</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#9F7AEA" }}>{(profile.exploredConcepts || []).length} explored</div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {(profile.exploredConcepts || []).map((item: any, i: number) => (
                                <div key={i} style={{ fontSize: 11, color: "#9F7AEA", background: "rgba(159,122,234,0.1)", border: "1px solid rgba(159,122,234,0.22)", borderRadius: 20, padding: "3px 10px", fontFamily: "'Lora', Georgia, serif", fontWeight: 500 }}>
                                    ✦ {item.concept}
                                </div>
                            ))}
                        </div>
                        {(profile.exploredConcepts || []).length >= 3 && (
                            <div style={{ fontSize: 11, color: "#555", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", marginTop: 10 }}>Every concept you explore is a framework you now carry into every decision.</div>
                        )}
                    </div>
                )}

                {/* Archive quick-access */}
                <button
                    onClick={() => onOpenArchive?.()}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderLeft: "4px solid rgba(232,98,42,0.4)", borderRadius: 16, padding: "14px 16px", marginBottom: 14, animation: "fadeSlideUp 0.5s ease 0.28s both", cursor: "pointer", textAlign: "left" }}
                >
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Archive size={18} color="#E8622A" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 2 }}>Archive</div>
                        <div style={{ fontSize: 11, color: "#666", fontFamily: "'Lora', Georgia, serif" }}>Browse saved conversation snapshots</div>
                    </div>
                    <span style={{ fontSize: 12, color: "#555" }}>→</span>
                </button>

                {/* Decisions */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", animation: "fadeSlideUp 0.5s ease 0.3s both" }}>
                        <div className="hub-section-header" style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Decisions</div>
                        <button onClick={() => setShowDecisionModal(true)} style={{ background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.25)", borderRadius: 8, padding: "4px 12px", color: "#E8622A", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>+ Log Decision</button>
                    </div>
                    {(!profile.decisions || profile.decisions.length === 0) ? (
                        <div style={{ fontSize: 13, color: "#444", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>No decisions logged yet. Every call you make deliberately is worth recording.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {profile.decisions.slice(0, 4).map((d, i) => {
                                const dec = typeof d === "string" ? { text: d, tag: "Strategy", date: "Recent" } : d;
                                return (
                                    <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                            <div style={{ fontSize: 12, color: "#C8C4BE", lineHeight: 1.5, flex: 1 }}>{dec.text}</div>
                                            {dec.tag && <div style={{ fontSize: 10, color: TAG_COLORS[dec.tag]?.text || "#888", background: TAG_COLORS[dec.tag]?.bg || "rgba(255,255,255,0.06)", borderRadius: 20, padding: "2px 8px", flexShrink: 0 }}>{dec.tag}</div>}
                                        </div>
                                        <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>{dec.date}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Decision modal */}
            {showDecisionModal && (
                <div className="hub-modal-backdrop" onClick={() => setShowDecisionModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 22, animation: "fadeSlideUp 0.3s ease" }}>
                        <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 16 }}>Log a Decision</div>
                        <div style={{ position: "relative" }}>
                            <textarea value={decisionText} onChange={e => setDecisionText(e.target.value)} placeholder="What did you decide and why?" rows={3} autoFocus style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 36px 10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", lineHeight: 1.6, boxSizing: "border-box" }} />
                            <div style={{ position: "absolute", top: 8, right: 8 }}>
                                <MicButton value={decisionText} onChange={setDecisionText} size={16} idleColor="#555" />
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                            {Object.keys(TAG_COLORS).map(t => (
                                <button key={t} onClick={() => setDecisionTag(t)} style={{ padding: "4px 12px", borderRadius: 20, border: "none", background: decisionTag === t ? TAG_COLORS[t].bg : "rgba(255,255,255,0.04)", color: decisionTag === t ? TAG_COLORS[t].text : "#555", fontSize: 11, cursor: "pointer" }}>{t}</button>
                            ))}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                            <button onClick={() => setShowDecisionModal(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#555", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                            <button onClick={addDecision} style={{ flex: 2, padding: "10px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}>Save Decision</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Expense modal */}
            {showExpenseModal && (
                <div className="hub-modal-backdrop" onClick={() => setShowExpenseModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 22, animation: "fadeSlideUp 0.3s ease" }}>
                        <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 16 }}>Log an Expense</div>
                        <input value={expenseLabel} onChange={e => setExpenseLabel(e.target.value)} placeholder="What was it for?" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 10, boxSizing: "border-box" }} />
                        <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 10, boxSizing: "border-box" }}>
                            {expenseCategoryOptions.map((category) => (
                                <option key={category} value={category} style={{ background: "#0E0E10" }}>{category}</option>
                            ))}
                        </select>
                        <input value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Amount ($)" type="number" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 10, boxSizing: "border-box" }} />
                        <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 10, boxSizing: "border-box", colorScheme: "dark" }} />
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Frequency</div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                            {(["one-time", "monthly", "yearly"] as const).map(f => (
                                <button key={f} onClick={() => { setExpenseFrequency(f); if (f === "one-time") setExpenseRenewalDate(""); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: expenseFrequency === f ? "1px solid rgba(232,98,42,0.5)" : "1px solid rgba(255,255,255,0.08)", background: expenseFrequency === f ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.03)", color: expenseFrequency === f ? "#E8622A" : "#888", fontSize: 11, cursor: "pointer", fontWeight: 500, textTransform: "capitalize" }}>{f}</button>
                            ))}
                        </div>
                        {expenseFrequency !== "one-time" && (
                            <>
                                <div style={{ fontSize: 11, color: "#666", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Next Renewal Date</div>
                                <input type="date" value={expenseRenewalDate} onChange={e => setExpenseRenewalDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 10, boxSizing: "border-box", colorScheme: "dark" }} />
                            </>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                            <button onClick={() => setShowExpenseModal(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#555", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                            <button onClick={addExpense} style={{ flex: 2, padding: "10px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}>Save Expense</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Income modal */}
            {showIncomeModal && (
                <div className="hub-modal-backdrop" onClick={() => setShowIncomeModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 22, animation: "fadeSlideUp 0.3s ease" }}>
                        <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 16 }}>Log Revenue</div>
                        <input value={incomeLabel} onChange={e => setIncomeLabel(e.target.value)} placeholder="Where did the revenue come from?" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 10, boxSizing: "border-box" }} />
                        <select value={incomeCategory} onChange={e => setIncomeCategory(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 10, boxSizing: "border-box" }}>
                            {revenueCategoryOptions.map((category) => (
                                <option key={category} value={category} style={{ background: "#0E0E10" }}>{category}</option>
                            ))}
                        </select>
                        <input value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} placeholder="Amount ($)" type="number" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 10, boxSizing: "border-box" }} />
                        <input type="date" value={incomeDate} onChange={e => setIncomeDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 10, boxSizing: "border-box", colorScheme: "dark" }} />
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Frequency</div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                            {(["one-time", "monthly", "yearly"] as const).map(f => (
                                <button key={f} onClick={() => { setIncomeFrequency(f); if (f === "one-time") setIncomeRenewalDate(""); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: incomeFrequency === f ? "1px solid rgba(76,175,138,0.5)" : "1px solid rgba(255,255,255,0.08)", background: incomeFrequency === f ? "rgba(76,175,138,0.12)" : "rgba(255,255,255,0.03)", color: incomeFrequency === f ? "#4CAF8A" : "#888", fontSize: 11, cursor: "pointer", fontWeight: 500, textTransform: "capitalize" }}>{f}</button>
                            ))}
                        </div>
                        {incomeFrequency !== "one-time" && (
                            <>
                                <div style={{ fontSize: 11, color: "#666", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Next Renewal Date</div>
                                <input type="date" value={incomeRenewalDate} onChange={e => setIncomeRenewalDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 10, boxSizing: "border-box", colorScheme: "dark" }} />
                            </>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                            <button onClick={() => setShowIncomeModal(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#555", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                            <button onClick={addIncome} style={{ flex: 2, padding: "10px", background: "linear-gradient(135deg, #4CAF8A, #3a9470)", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}>Save Revenue</button>
                        </div>
                    </div>
                </div>
            )}

            {showBudgetModal && (
                <div className="hub-modal-backdrop" onClick={() => setShowBudgetModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 22, animation: "fadeSlideUp 0.3s ease" }}>
                        <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 10 }}>Customize Budget</div>
                        <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.6, marginBottom: 16 }}>
                            Your budget is a living input. Update the exact amount you can realistically plan around right now, and adjust the range if it changed too.
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: "#666", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>Budget Range</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {BUDGET_CARDS.map((card) => (
                                    <button
                                        key={card.id}
                                        onClick={() => setBudgetEditRange(card.id)}
                                        style={{
                                            padding: "6px 10px",
                                            borderRadius: 999,
                                            border: budgetEditRange === card.id ? "1px solid rgba(232,98,42,0.35)" : "1px solid rgba(255,255,255,0.08)",
                                            background: budgetEditRange === card.id ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.03)",
                                            color: budgetEditRange === card.id ? "#E8622A" : "#C8C4BE",
                                            fontSize: 11,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {card.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <input
                            value={budgetEditAmount}
                            onChange={e => setBudgetEditAmount(e.target.value)}
                            placeholder="Exact amount available right now"
                            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 16, boxSizing: "border-box" }}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setShowBudgetModal(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#555", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                            <button onClick={saveBudget} style={{ flex: 2, padding: "10px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}>Save Budget</button>
                        </div>
                    </div>
                </div>
            )}

            {showLogoutModal && (
                <div
                    className="hub-modal-backdrop"
                    onClick={() => setShowLogoutModal(false)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ width: "100%", maxWidth: 420, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 22, animation: "fadeSlideUp 0.3s ease" }}
                    >
                        <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 10 }}>
                            Log out?
                        </div>
                        <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.6, marginBottom: 16 }}>
                            Are you sure you want to log out? Your local session will be cleared and you&apos;ll return to sign in.
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#555", fontSize: 12, cursor: "pointer" }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowLogoutModal(false);
                                    setSidebarOpen(false);
                                    onLogout?.();
                                }}
                                style={{ flex: 2, padding: "10px", background: "linear-gradient(135deg, #F0EDE8, #D9D2C7)", border: "none", borderRadius: 10, color: "#111", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}
                            >
                                Yes, log out
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showResetModal && (
                <div
                    className="hub-modal-backdrop"
                    onClick={() => setShowResetModal(false)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{ width: "100%", maxWidth: 440, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 22, animation: "fadeSlideUp 0.3s ease" }}
                    >
                        <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 10 }}>
                            Reset account?
                        </div>
                        <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.6, marginBottom: 16 }}>
                            Resetting your account will make Foundry and Forge both completely restart and forget any progress you&apos;ve made. This cannot be undone.
                        </div>
                        <div style={{ fontSize: 11, color: "#666", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                            Confirmation code
                        </div>
                        <div style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.7, marginBottom: 10 }}>
                            To avoid accidental resets, type <span style={{ color: "#F0EDE8", fontWeight: 700 }}>12345</span> to continue.
                        </div>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={resetConfirmationCode}
                            onChange={(e) => setResetConfirmationCode(e.target.value)}
                            placeholder="Type 12345"
                            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 16, boxSizing: "border-box" }}
                        />
                        {resetError && (
                            <div style={{ fontSize: 12, color: "#D28B76", lineHeight: 1.6, marginBottom: 16 }}>
                                {resetError}
                            </div>
                        )}
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={() => setShowResetModal(false)}
                                style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#555", fontSize: 12, cursor: "pointer" }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmReset}
                                style={{ flex: 2, padding: "10px", background: "linear-gradient(135deg, #A63B24, #842B1A)", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}
                            >
                                Yes, reset everything
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

    )
}

function BusinessHealthDonut({ health }) {
    const size = 228;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = 76;
    const labelR = 98;
    const n = health.segments.length;
    const rings = [0.2, 0.4, 0.6, 0.8, 1.0];

    const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
    const pt = (r: number, i: number) => ({
        x: cx + r * Math.cos(angle(i)),
        y: cy + r * Math.sin(angle(i)),
    });
    const polyStr = (r: number) =>
        Array.from({ length: n }, (_, i) => pt(r, i)).map(p => `${p.x},${p.y}`).join(" ");

    const dataPts = health.segments.map((seg, i) => pt((seg.value / 100) * maxR, i));
    const dataPolyStr = dataPts.map(p => `${p.x},${p.y}`).join(" ");

    const anchor = (i: number) => {
        const cos = Math.cos(angle(i));
        return cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
    };

    const scoreColor = health.overallScore >= 62 ? "#4CAF8A" : health.overallScore >= 45 ? "#D9B15D" : "#E8622A";

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <svg
                width={size} height={size}
                viewBox={`0 0 ${size} ${size}`}
                style={{ overflow: "visible" }}
            >
                {/* Grid rings */}
                {rings.map((r, ri) => (
                    <polygon
                        key={ri}
                        points={polyStr(r * maxR)}
                        fill={ri === rings.length - 1 ? "rgba(255,255,255,0.018)" : "none"}
                        stroke="rgba(255,255,255,0.07)"
                        strokeWidth={0.75}
                    />
                ))}

                {/* Axis spokes */}
                {health.segments.map((_, i) => {
                    const outer = pt(maxR, i);
                    return (
                        <line key={i} x1={cx} y1={cy} x2={outer.x} y2={outer.y}
                            stroke="rgba(255,255,255,0.07)" strokeWidth={0.75} />
                    );
                })}

                {/* Shaded data polygon */}
                <polygon
                    points={dataPolyStr}
                    fill="rgba(255,255,255,0.05)"
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth={1.2}
                    strokeLinejoin="round"
                />

                {/* Colored dots */}
                {health.segments.map((seg, i) => {
                    const p = dataPts[i];
                    return (
                        <g key={seg.key}>
                            <circle cx={p.x} cy={p.y} r={7} fill={seg.color} opacity={0.16} />
                            <circle cx={p.x} cy={p.y} r={4.25} fill={seg.color} />
                        </g>
                    );
                })}

                {/* Axis labels */}
                {health.segments.map((seg, i) => {
                    const lp = pt(labelR, i);
                    return (
                        <text key={seg.key} x={lp.x} y={lp.y}
                            textAnchor={anchor(i)} dominantBaseline="middle"
                            fill={seg.color} fontSize={9}
                            fontFamily="'DM Sans', sans-serif" fontWeight="600"
                            letterSpacing="0.07em" opacity={0.85}
                        >
                            {seg.label.toUpperCase()}
                        </text>
                    );
                })}

                {/* Center score */}
                <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="auto"
                    fill="#F0EDE8" fontSize={28}
                    fontFamily="'Playfair Display', Georgia, serif" fontWeight="700"
                >
                    {health.overallScore}
                </text>
                <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="hanging"
                    fill={scoreColor} fontSize={8}
                    fontFamily="'DM Sans', sans-serif" fontWeight="600" letterSpacing="0.14em"
                >
                    {health.statusLabel.toUpperCase()}
                </text>
            </svg>
            <div style={{ fontSize: 11, color: "#5B5650", lineHeight: 1.6, textAlign: "center", maxWidth: 260 }}>
                A founder-facing view of how the business is holding up across execution, capital, clarity, market strength, and upside.
            </div>
        </div>
    );
}

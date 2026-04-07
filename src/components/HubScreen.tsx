import { useEffect, useState } from "react";
import { STAGES_DATA } from "../constants/stages";
import { STAGE_COLORS } from "../constants/glossary";
import { BUDGET_CARDS } from "../constants/onboarding";
import { TAG_COLORS } from "../constants/styles";
import { Icons } from "../icons";
import { formatCurrency, getBudgetRangeLabel, parseBudgetInput } from "../lib/budget";
import { summarizeBusinessIdea } from "../lib/businessSummary";
import Logo from "./Logo";

export default function HubScreen({
    profile,
    onUpdateProfile,
    onEnterStage,
    onOpenForge,
    onLogout,
    onOpenUpgrade,
    onReset,
    onOpenJournal,
    onOpenBriefings,
    onOpenPitchPractice,
    onOpenDocuments,
    onOpenMarketIntel,
    onOpenCofounder,
    onOpenSettings,
    onOpenAdminHub,
    onOpenChatRoom,
    isAdmin = false,
    completedByStage,
    accessSummary,
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
    const [expenseFrequency, setExpenseFrequency] = useState<"one-time" | "monthly" | "yearly">("one-time");
    const [expenseRenewalDate, setExpenseRenewalDate] = useState("");
    const [incomeLabel, setIncomeLabel] = useState("");
    const [incomeAmount, setIncomeAmount] = useState("");
    const [incomeFrequency, setIncomeFrequency] = useState<"one-time" | "monthly" | "yearly">("one-time");
    const [incomeRenewalDate, setIncomeRenewalDate] = useState("");
    const [budgetEditAmount, setBudgetEditAmount] = useState("");
    const [budgetEditRange, setBudgetEditRange] = useState(profile.budgetRange || "");

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

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

    // Auto-apply recurring charges/income when renewal date passes
    useEffect(() => {
        const expenses = profile.budget?.expenses || [];
        const incomes = profile.budget?.income || [];
        const todayStr = new Date().toISOString().split("T")[0];

        let hasChanges = false;
        let newSpent = profile.budget?.spent || 0;
        let newTotalIncome = profile.budget?.totalIncome || 0;

        const updatedExpenses = expenses.map((exp: any) => {
            if (!exp.renewalDate || exp.frequency === "one-time" || exp.renewalDate > todayStr) return exp;
            hasChanges = true;
            newSpent += exp.amount;
            const next = new Date(`${exp.renewalDate}T12:00:00`);
            if (exp.frequency === "monthly") next.setMonth(next.getMonth() + 1);
            else if (exp.frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
            return { ...exp, renewalDate: next.toISOString().split("T")[0] };
        });

        const updatedIncomes = incomes.map((inc: any) => {
            if (!inc.renewalDate || inc.frequency === "one-time" || inc.renewalDate > todayStr) return inc;
            hasChanges = true;
            newTotalIncome += inc.amount;
            const next = new Date(`${inc.renewalDate}T12:00:00`);
            if (inc.frequency === "monthly") next.setMonth(next.getMonth() + 1);
            else if (inc.frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
            return { ...inc, renewalDate: next.toISOString().split("T")[0] };
        });

        if (!hasChanges) return;
        const newRemaining = (profile.budget?.total || 0) + newTotalIncome - newSpent;
        onUpdateProfile({
            budget: { ...profile.budget, expenses: updatedExpenses, income: updatedIncomes, spent: newSpent, totalIncome: newTotalIncome, remaining: newRemaining },
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const addExpense = () => {
        const amt = parseFloat(expenseAmount);
        if (!expenseLabel.trim() || isNaN(amt) || amt <= 0) return;
        if (expenseFrequency !== "one-time" && !expenseRenewalDate) return;

        const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const todayDisplay = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const newEntry: any = { id, label: expenseLabel.trim(), amount: amt, date: todayDisplay, frequency: expenseFrequency };
        if (expenseFrequency !== "one-time") newEntry.renewalDate = expenseRenewalDate;

        const newExpenses = [...(profile.budget?.expenses || []), newEntry];
        const newSpent = (profile.budget?.spent || 0) + amt;
        const totalIncome = profile.budget?.totalIncome || 0;
        const newRemaining = (profile.budget?.total || 0) + totalIncome - newSpent;

        onUpdateProfile({ budget: { ...profile.budget, expenses: newExpenses, spent: newSpent, remaining: newRemaining } });
        setExpenseLabel(""); setExpenseAmount(""); setExpenseFrequency("one-time"); setExpenseRenewalDate("");
        setShowExpenseModal(false);
    };

    const addIncome = () => {
        const amt = parseFloat(incomeAmount);
        if (!incomeLabel.trim() || isNaN(amt) || amt <= 0) return;
        if (incomeFrequency !== "one-time" && !incomeRenewalDate) return;

        const id = `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const todayDisplay = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const newEntry: any = { id, label: incomeLabel.trim(), amount: amt, date: todayDisplay, frequency: incomeFrequency };
        if (incomeFrequency !== "one-time") newEntry.renewalDate = incomeRenewalDate;

        const newIncomes = [...(profile.budget?.income || []), newEntry];
        const newTotalIncome = (profile.budget?.totalIncome || 0) + amt;
        const spent = profile.budget?.spent || 0;
        const newRemaining = (profile.budget?.total || 0) + newTotalIncome - spent;

        onUpdateProfile({ budget: { ...profile.budget, income: newIncomes, totalIncome: newTotalIncome, remaining: newRemaining } });
        setIncomeLabel(""); setIncomeAmount(""); setIncomeFrequency("one-time"); setIncomeRenewalDate("");
        setShowIncomeModal(false);
    };

    const deleteExpense = (id: string) => {
        const updated = (profile.budget?.expenses || []).filter((e: any) => e.id !== id);
        const newSpent = updated.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
        const totalIncome = profile.budget?.totalIncome || 0;
        const newRemaining = (profile.budget?.total || 0) + totalIncome - newSpent;
        onUpdateProfile({ budget: { ...profile.budget, expenses: updated, spent: newSpent, remaining: newRemaining } });
    };

    const deleteIncome = (id: string) => {
        const updated = (profile.budget?.income || []).filter((e: any) => e.id !== id);
        const newTotalIncome = updated.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
        const spent = profile.budget?.spent || 0;
        const newRemaining = (profile.budget?.total || 0) + newTotalIncome - spent;
        onUpdateProfile({ budget: { ...profile.budget, income: updated, totalIncome: newTotalIncome, remaining: newRemaining } });
    };

    const openBudgetModal = () => {
        setBudgetEditAmount(String(profile.exactBudgetAmount ?? profile.budget?.total ?? 0));
        setBudgetEditRange(profile.budgetRange || "");
        setShowBudgetModal(true);
    };

    const saveBudget = () => {
        const parsedAmount = parseBudgetInput(budgetEditAmount);
        if (!parsedAmount) return;

        const spent = profile.budget?.spent || 0;
        onUpdateProfile({
            budgetRange: budgetEditRange || null,
            exactBudgetAmount: parsedAmount,
            budgetIsEstimated: false,
            budget: {
                ...profile.budget,
                total: parsedAmount,
                remaining: Math.max(parsedAmount - spent, 0),
            },
        });

        setShowBudgetModal(false);
    };

    const currentStage = profile.currentStage || 1;
    const businessSummary = summarizeBusinessIdea(profile.businessName, profile.idea, 10);
    const spentPct = profile.budget?.total
        ? Math.min((profile.budget.spent / profile.budget.total) * 100, 100)
        : 0;

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
            icon: Icons.sidebar.chatRoom,
            label: "Chat with Forge",
            sub: "Open-ended learning & questions",
            action: () => {
                setSidebarOpen(false);
                onOpenChatRoom?.();
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
        <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8" }}>
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
                    width: 280,
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
                        padding: "max(20px, calc(14px + env(safe-area-inset-top))) 16px 16px",
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
                                    fontSize: 15,
                                    fontFamily: "'Cormorant Garamond', Georgia, serif",
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
                                padding: "5px 10px",
                                color: "#555",
                                fontSize: 12,
                                cursor: "pointer",
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    <div
                        style={{
                            fontSize: 13,
                            fontFamily: "'Lora', Georgia, serif",
                            color: "#C8C4BE",
                            fontWeight: 500,
                        }}
                    >
                        {profile.name}
                    </div>
                    <div
                        style={{
                            fontSize: 11,
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
                                <div style={{ fontSize: 9, color: "#444", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                                    Access
                                </div>
                                <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 600, marginBottom: 4 }}>
                                    {accessSummary.planName} · {accessSummary.statusLabel}
                                </div>
                                <div style={{ fontSize: 10, color: "#666", lineHeight: 1.6 }}>
                                    {accessSummary.note}
                                </div>
                                {!accessSummary.canAccessPaidStages && (
                                    <button
                                        onClick={() => {
                                            setSidebarOpen(false);
                                            onOpenUpgrade?.();
                                        }}
                                        style={{ marginTop: 10, width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(232,98,42,0.22)", background: "rgba(232,98,42,0.1)", color: "#E8622A", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                                    >
                                        Unlock Stage 2
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div
                        style={{
                            fontSize: 9,
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
                                    gap: 12,
                                    padding: "10px 10px",
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
                                        width: 36,
                                        height: 36,
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
                                    <Icon size={16} />
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            color: item.available ? "#F0EDE8" : "#666",
                                            fontWeight: 500,
                                            lineHeight: 1.2,
                                            marginBottom: 2,
                                        }}
                                    >
                                        {item.label}
                                    </div>
                                    <div style={{ fontSize: 10, color: "#444" }}>
                                        {item.available ? item.sub : "Coming soon"}
                                    </div>
                                </div>

                                {item.available && <span style={{ fontSize: 10, color: "#555" }}>→</span>}
                            </button>
                        );
                    })}

                    <div style={{ padding: "12px 10px 24px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <button
                            onClick={() => setShowLogoutModal(true)}
                            style={{
                                width: "100%",
                                padding: "9px",
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 8,
                                color: "#888",
                                fontSize: 11,
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
                                padding: "9px",
                                background: "transparent",
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: 8,
                                color: "#444",
                                fontSize: 11,
                                cursor: "pointer",
                            }}
                        >
                            Reset Account
                        </button>
                    </div>
                </div>
            </div>

            <div
                style={{
                    padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    position: "sticky",
                    top: 0,
                    background: "rgba(8,8,9,0.95)",
                    backdropFilter: "blur(12px)",
                    zIndex: 10,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 8,
                            padding: "6px 10px",
                            color: "#888",
                            fontSize: 16,
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
                                fontSize: 16,
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontWeight: 700,
                                color: "#F0EDE8",
                            }}
                        >
                            Foundry
                        </div>
                        <div style={{ fontSize: 10, color: "#555" }}>Hub · {profile.name}</div>
                    </div>
                </div>

                <button
                    onClick={onOpenForge}
                    style={{
                        background: "linear-gradient(135deg, #E8622A, #c9521e)",
                        border: "none",
                        borderRadius: 10,
                        padding: "8px 16px",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontFamily: "'DM Sans', sans-serif",
                    }}
                >
                    <Icons.forge.chat size={14} /> Talk to Forge
                </button>
            </div>

            <div style={{ padding: "16px", maxWidth: 680, margin: "0 auto", paddingBottom: 60 }}>
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
                            fontFamily: "'Cormorant Garamond', Georgia, serif",
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
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 12,
                        }}
                    >
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
                </div>

                {accessSummary && (
                    <div style={{ background: "linear-gradient(180deg, rgba(232,98,42,0.08), rgba(255,255,255,0.02))", border: "1px solid rgba(232,98,42,0.16)", borderRadius: 16, padding: "14px 16px", marginBottom: 14, animation: "fadeSlideUp 0.5s ease 0.18s both" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
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
                {/* Budget */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 14, animation: "fadeSlideUp 0.5s ease 0.25s both" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Budget</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button onClick={openBudgetModal} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "4px 12px", color: "#F0EDE8", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>Customize</button>
                            <button onClick={() => setShowIncomeModal(true)} style={{ background: "rgba(76,175,138,0.1)", border: "1px solid rgba(76,175,138,0.25)", borderRadius: 8, padding: "4px 12px", color: "#4CAF8A", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>+ Income</button>
                            <button onClick={() => setShowExpenseModal(true)} style={{ background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.25)", borderRadius: 8, padding: "4px 12px", color: "#E8622A", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>+ Expense</button>
                        </div>
                    </div>
                    {(profile.budgetRange || profile.budgetIsEstimated) && (
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 12, fontSize: 10, color: "#666" }}>
                            <div>Range: {getBudgetRangeLabel(profile.budgetRange) || "Not set"}</div>
                            <div>{profile.budgetIsEstimated ? "Using provisional amount" : "Exact budget confirmed"}</div>
                        </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginBottom: 14 }}>
                        {[
                            { label: "Budget", value: formatCurrency(profile.budget?.total || 0), color: "#F0EDE8" },
                            { label: "Income", value: formatCurrency(profile.budget?.totalIncome || 0), color: "#4CAF8A" },
                            { label: "Spent", value: formatCurrency(profile.budget?.spent || 0), color: "#E8622A" },
                            { label: "Remaining", value: formatCurrency((profile.budget?.total || 0) + (profile.budget?.totalIncome || 0) - (profile.budget?.spent || 0)), color: (profile.budget?.total || 0) + (profile.budget?.totalIncome || 0) - (profile.budget?.spent || 0) >= 0 ? "#4CAF8A" : "#FF4444" },
                        ].map(item => (
                            <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px", textAlign: "center" }}>
                                <div style={{ fontSize: "clamp(14px, 4vw, 20px)", fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: item.color, lineHeight: 1, marginBottom: 3 }}>{item.value}</div>
                                <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.label}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${spentPct}%`, background: spentPct > 75 ? "linear-gradient(90deg, #E85A2A, #FF4444)" : "linear-gradient(90deg, #E8622A, #F5A843)", borderRadius: 3, transition: "width 1s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <div style={{ fontSize: 10, color: "#555" }}>{spentPct.toFixed(0)}% spent</div>
                        <div style={{ fontSize: 10, color: "#555" }}>Runway: {profile.budget?.runway || "TBD"}</div>
                    </div>
                    {profile.budget?.expenses?.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Expenses</div>
                            {profile.budget.expenses.map((exp: any, i: number) => (
                                <div key={exp.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < profile.budget.expenses.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, color: "#888" }}>{exp.label}</div>
                                        {exp.frequency && exp.frequency !== "one-time" && (
                                            <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>
                                                {exp.frequency} · renews {exp.renewalDate ? new Date(`${exp.renewalDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ fontSize: 12, color: "#E8622A", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>-{formatCurrency(exp.amount)}</div>
                                        {exp.id && (
                                            <button onClick={() => deleteExpense(exp.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }} title="Delete expense">×</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {profile.budget?.income?.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Income</div>
                            {profile.budget.income.map((inc: any, i: number) => (
                                <div key={inc.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < profile.budget.income.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, color: "#888" }}>{inc.label}</div>
                                        {inc.frequency && inc.frequency !== "one-time" && (
                                            <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>
                                                {inc.frequency} · renews {inc.renewalDate ? new Date(`${inc.renewalDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ fontSize: 12, color: "#4CAF8A", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>+{formatCurrency(inc.amount)}</div>
                                        {inc.id && (
                                            <button onClick={() => deleteIncome(inc.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }} title="Delete income">×</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Glossary learned */}
                {(profile.glossaryLearned || []).length > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, animation: "fadeSlideUp 0.5s ease 0.32s both" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Icons.glossary.book size={14} />
                                <span>Your Glossary</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#4CAF8A" }}>{(profile.glossaryLearned || []).length} terms learned</div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {(profile.glossaryLearned || []).map((item, i) => {
                                const color = STAGE_COLORS[item.stage] || "#E8622A";
                                return <div key={i} style={{ fontSize: 11, color, background: `${color}12`, border: `1px solid ${color}25`, borderRadius: 20, padding: "3px 10px", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{item.term}</div>;
                            })}
                        </div>
                        {(profile.glossaryLearned || []).length >= 5 && (
                            <div style={{ fontSize: 11, color: "#555", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", marginTop: 10 }}>You're building real business literacy. Keep going.</div>
                        )}
                    </div>
                )}

                {/* Decisions */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", animation: "fadeSlideUp 0.5s ease 0.3s both" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
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
                <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }} onClick={() => setShowDecisionModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 22, animation: "fadeSlideUp 0.3s ease" }}>
                        <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 16 }}>Log a Decision</div>
                        <textarea value={decisionText} onChange={e => setDecisionText(e.target.value)} placeholder="What did you decide and why?" rows={3} autoFocus style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, boxSizing: "border-box" }} />
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
                <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }} onClick={() => setShowExpenseModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 22, animation: "fadeSlideUp 0.3s ease" }}>
                        <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 16 }}>Log an Expense</div>
                        <input value={expenseLabel} onChange={e => setExpenseLabel(e.target.value)} placeholder="What was it for?" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 10, boxSizing: "border-box" }} />
                        <input value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Amount ($)" type="number" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 10, boxSizing: "border-box" }} />
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Frequency</div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                            {(["one-time", "monthly", "yearly"] as const).map(f => (
                                <button key={f} onClick={() => { setExpenseFrequency(f); if (f === "one-time") setExpenseRenewalDate(""); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: expenseFrequency === f ? "1px solid rgba(232,98,42,0.5)" : "1px solid rgba(255,255,255,0.08)", background: expenseFrequency === f ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.03)", color: expenseFrequency === f ? "#E8622A" : "#888", fontSize: 11, cursor: "pointer", fontWeight: 500, textTransform: "capitalize" }}>{f}</button>
                            ))}
                        </div>
                        {expenseFrequency !== "one-time" && (
                            <>
                                <div style={{ fontSize: 11, color: "#666", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Next Renewal Date</div>
                                <input type="date" value={expenseRenewalDate} onChange={e => setExpenseRenewalDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 10, boxSizing: "border-box", colorScheme: "dark" }} />
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
                <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }} onClick={() => setShowIncomeModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 22, animation: "fadeSlideUp 0.3s ease" }}>
                        <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 16 }}>Log Income</div>
                        <input value={incomeLabel} onChange={e => setIncomeLabel(e.target.value)} placeholder="Source of income?" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 10, boxSizing: "border-box" }} />
                        <input value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} placeholder="Amount ($)" type="number" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 10, boxSizing: "border-box" }} />
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Frequency</div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                            {(["one-time", "monthly", "yearly"] as const).map(f => (
                                <button key={f} onClick={() => { setIncomeFrequency(f); if (f === "one-time") setIncomeRenewalDate(""); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: incomeFrequency === f ? "1px solid rgba(76,175,138,0.5)" : "1px solid rgba(255,255,255,0.08)", background: incomeFrequency === f ? "rgba(76,175,138,0.12)" : "rgba(255,255,255,0.03)", color: incomeFrequency === f ? "#4CAF8A" : "#888", fontSize: 11, cursor: "pointer", fontWeight: 500, textTransform: "capitalize" }}>{f}</button>
                            ))}
                        </div>
                        {incomeFrequency !== "one-time" && (
                            <>
                                <div style={{ fontSize: 11, color: "#666", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Next Renewal Date</div>
                                <input type="date" value={incomeRenewalDate} onChange={e => setIncomeRenewalDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 10, boxSizing: "border-box", colorScheme: "dark" }} />
                            </>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                            <button onClick={() => setShowIncomeModal(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#555", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                            <button onClick={addIncome} style={{ flex: 2, padding: "10px", background: "linear-gradient(135deg, #4CAF8A, #3a9470)", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}>Save Income</button>
                        </div>
                    </div>
                </div>
            )}

            {showBudgetModal && (
                <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }} onClick={() => setShowBudgetModal(false)}>
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
                            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 16, boxSizing: "border-box" }}
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
                    style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }}
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
                    style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }}
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
                        <div style={{ display: "flex", gap: 8 }}>
                            <button
                                onClick={() => setShowResetModal(false)}
                                style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#555", fontSize: 12, cursor: "pointer" }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowResetModal(false);
                                    setSidebarOpen(false);
                                    onReset();
                                }}
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

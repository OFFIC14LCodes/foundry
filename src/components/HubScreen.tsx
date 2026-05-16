import { useEffect, useState, type ReactNode } from "react";
import { STAGES_DATA } from "../constants/stages";
import { STAGE_COLORS } from "../constants/glossary";
import { BUDGET_CARDS } from "../constants/onboarding";
import { TAG_COLORS } from "../constants/styles";
import { Icons } from "../icons";
import { BarChart3, Zap } from "lucide-react";
import { formatCurrency, getBudgetRangeLabel, parseBudgetInput } from "../lib/budget";
import { getBusinessHealth } from "../lib/businessHealth";
import { summarizeBusinessIdea } from "../lib/businessSummary";
import MicButton from "./MicButton";

function HubFocusCard({
    eyebrow,
    title,
    body,
    actionLabel,
    icon,
    onClick,
    tone = "primary",
}: {
    eyebrow: string;
    title: string;
    body: string;
    actionLabel: string;
    icon: ReactNode;
    onClick?: () => void;
    tone?: "primary" | "learn" | "execute" | "clarity";
}) {
    const tones = {
        primary: {
            background: "linear-gradient(180deg, rgba(232,98,42,0.075), rgba(255,255,255,0.022))",
            border: "1px solid rgba(232,98,42,0.16)",
            color: "#E8622A",
        },
        learn: {
            background: "linear-gradient(180deg, rgba(99,179,237,0.07), rgba(255,255,255,0.02))",
            border: "1px solid rgba(99,179,237,0.15)",
            color: "#8FC8F6",
        },
        execute: {
            background: "linear-gradient(180deg, rgba(76,175,138,0.065), rgba(255,255,255,0.02))",
            border: "1px solid rgba(76,175,138,0.15)",
            color: "#8FD0B5",
        },
        clarity: {
            background: "linear-gradient(180deg, rgba(167,139,250,0.085), rgba(255,255,255,0.022))",
            border: "1px solid rgba(167,139,250,0.18)",
            color: "#A78BFA",
        },
    } as const;
    const selected = tones[tone];

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!onClick}
            style={{
                background: selected.background,
                border: selected.border,
                borderRadius: "var(--foundry-radius-card)",
                padding: "14px 14px 13px",
                color: "inherit",
                cursor: onClick ? "pointer" : "default",
                display: "grid",
                gap: 12,
                textAlign: "left",
                minHeight: 174,
                alignContent: "space-between",
            }}
        >
            <div style={{ display: "grid", gap: 9 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontSize: 10, color: selected.color, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 800 }}>
                        {eyebrow}
                    </div>
                    <div style={{ color: selected.color, opacity: 0.9 }}>{icon}</div>
                </div>
                <div style={{ fontSize: 17, color: "#F0EDE8", fontFamily: "'Lora', Georgia, serif", fontWeight: 700, lineHeight: 1.18 }}>
                    {title}
                </div>
                <div style={{ fontSize: 12, color: "#A8A4A0", lineHeight: 1.65 }}>
                    {body}
                </div>
            </div>
            <div style={{ fontSize: 12, color: selected.color, fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 800 }}>
                {actionLabel} →
            </div>
        </button>
    );
}

function getNudgePresentation(activeNudge: any) {
    const source = String(activeNudge?.signalSource ?? "").toLowerCase();
    const type = String(activeNudge?.nudgeType ?? "").toLowerCase();

    if (source.includes("cash") || source.includes("cash_flow")) {
        return {
            eyebrow: "Clarity",
            title: "Money questions keep resurfacing",
            actionLabel: "Start quick chat",
            color: "#A78BFA",
            icon: <BarChart3 size={16} />,
        };
    }

    if (source.includes("pricing")) {
        return {
            eyebrow: "Clarity",
            title: "Pricing keeps coming up",
            actionLabel: "Start quick chat",
            color: "#A78BFA",
            icon: <BarChart3 size={16} />,
        };
    }

    if (type.includes("decision")) {
        return {
            eyebrow: "Clarity",
            title: "A decision needs another look",
            actionLabel: "Start quick chat",
            color: "#A78BFA",
            icon: <Zap size={16} />,
        };
    }

    if (type.includes("stage")) {
        return {
            eyebrow: "Clarity",
            title: "Something is slowing progress",
            actionLabel: "Start quick chat",
            color: "#A78BFA",
            icon: <Icons.forge.chat size={16} />,
        };
    }

    return {
        eyebrow: "Clarity",
        title: "Pick up the thread",
        actionLabel: "Start quick chat",
        color: "#A78BFA",
        icon: <Icons.forge.chat size={16} />,
    };
}

export default function HubScreen({
    profile,
    marketReport,
    onUpdateProfile,
    onEnterStage,
    onOpenForge,
    onOpenNav,
    onRevertToStage,
    onLogout,
    onReset,
    onOpenMarketIntel,
    onOpenActionCenter,
    onOpenCofounder,
    cofounderUnreadCount = 0,
    pendingCofounderInvites = [],
    onAcceptCofounderInvite,
    onDeclineCofounderInvite,
    onOpenSettings,
    onOpenAdminHub,
    onOpenAcademy,
    isAdmin = false,
    completedByStage,
    furthestStageReached = 1,
    activeNudge = null,
    onActOnNudge,
    onOpenClaritySession,
    financialData = null,
    financialSummary = null,
    onSaveExpense,
    onDeleteExpense,
    onSaveRevenue,
    onDeleteRevenue,
    onSaveFinancialSettings,
    onOpenFinancialDashboard,
    onGetHealthScore,
}) {
    const [showDecisionModal, setShowDecisionModal] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showIncomeModal, setShowIncomeModal] = useState(false);
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
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
    const currentStageData = STAGES_DATA[currentStage - 1] || STAGES_DATA[0];
    const currentStageCompleted = completedByStage[currentStage] || [];
    const nextMilestone = currentStageData.milestones.find((milestone: { id: string; label: string }) => !currentStageCompleted.includes(milestone.id));
    const currentStagePct = Math.round((currentStageCompleted.length / Math.max(currentStageData.milestones.length, 1)) * 100);
    const businessSummary = summarizeBusinessIdea(profile.businessName, profile.idea, 10);
    const businessHealth = getBusinessHealth(profile, completedByStage, marketReport, financialSummary);
    const isStageGoalsComplete = (stage: (typeof STAGES_DATA)[number]) =>
        stage.milestones.length > 0 &&
        (completedByStage[stage.id] || []).length >= stage.milestones.length;
    const isStageDoneInJourney = (stage: (typeof STAGES_DATA)[number]) =>
        stage.id < currentStage || isStageGoalsComplete(stage);
    const completedJourneyStages = STAGES_DATA.filter(isStageDoneInJourney).length;
    const journeyPct = Math.round((completedJourneyStages / STAGES_DATA.length) * 100);
    const nextExecutionLabel = nextMilestone
        ? `Next stage move: ${nextMilestone.label}`
        : "Review the actions that keep execution honest.";
    const nudgePresentation = activeNudge ? getNudgePresentation(activeNudge) : null;
    const primaryFocusCards = [
        {
            eyebrow: "Learn",
            title: "Continue Academy",
            body: `Use Academy to sharpen the founder skill behind Stage ${currentStage}: ${currentStageData.label}.`,
            actionLabel: "Open Academy",
            icon: <Icons.sidebar.academy size={17} />,
            onClick: onOpenAcademy,
            tone: "learn" as const,
        },
        {
            eyebrow: "Execute",
            title: "Move the work forward",
            body: nextExecutionLabel,
            actionLabel: onOpenActionCenter ? "Open Actions" : `Continue Stage ${currentStage}`,
            icon: <Zap size={17} />,
            onClick: onOpenActionCenter ?? (() => onEnterStage(currentStage)),
            tone: "execute" as const,
        },
        ...(activeNudge && nudgePresentation ? [{
            eyebrow: nudgePresentation.eyebrow,
            title: nudgePresentation.title,
            body: activeNudge.nudgeText,
            actionLabel: nudgePresentation.actionLabel,
            icon: nudgePresentation.icon,
            onClick: () => {
                onActOnNudge?.();
                onOpenClaritySession?.(activeNudge);
            },
            tone: "clarity" as const,
        }] : [{
            eyebrow: "Think",
            title: "Talk to Forge",
            body: "Use Forge to turn uncertainty, decisions, and messy next steps into a clear move.",
            actionLabel: "Talk to Forge",
            icon: <Icons.forge.chat size={17} />,
            onClick: onOpenForge,
            tone: "primary" as const,
        }]),
    ];
    return (
        <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8" }}>
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
                        onClick={onOpenNav}
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 8,
                            padding: "var(--foundry-hub-header-menu-padding)",
                            color: "rgba(240,237,232,0.62)",
                            fontSize: "var(--foundry-hub-header-menu-font)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <Icons.sidebar.menu size={"var(--foundry-app-header-icon-size)"} />
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
                        <div style={{ fontSize: "var(--foundry-hub-header-meta-font)", color: "var(--foundry-text-muted)" }}>Hub · {profile.name}</div>
                    </div>
                </div>

            </div>

            <div className="hub-content">
                <div
                    className="foundry-command-panel foundry-panel-in"
                    style={{
                        marginBottom: 16,
                        padding: "18px 18px 16px",
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? "translateY(0)" : "translateY(8px)",
                        transition: "all 0.5s var(--foundry-ease)",
                    }}
                >
                    <div className="foundry-label" style={{ marginBottom: 12, color: "var(--foundry-orange)" }}>
                        Education + Execution
                    </div>
                    <div className="foundry-hub-command-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16, alignItems: "start", marginBottom: 16 }}>
                        <div style={{ minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: 24,
                                    fontFamily: "'Playfair Display', Georgia, serif",
                                    fontWeight: 700,
                                    color: "var(--foundry-text-primary)",
                                    lineHeight: 1.12,
                                    marginBottom: 8,
                                }}
                            >
                                Welcome back, {profile.name}
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    color: "var(--foundry-text-secondary)",
                                    fontFamily: "'DM Sans', system-ui, sans-serif",
                                    lineHeight: 1.7,
                                    maxWidth: 680,
                                }}
                            >
                                {businessSummary}
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            padding: "15px 15px 14px",
                            borderRadius: "var(--foundry-radius-card)",
                            background: "linear-gradient(135deg, rgba(232,98,42,0.12), rgba(245,168,67,0.055) 48%, rgba(255,255,255,0.026))",
                            border: "1px solid rgba(232,98,42,0.26)",
                            boxShadow: "0 18px 44px rgba(232,98,42,0.10)",
                            marginBottom: 16,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                            <div>
                                <div className="foundry-label" style={{ color: "var(--foundry-orange)", marginBottom: 4 }}>
                                    Resume Progress
                                </div>
                                <div style={{ fontSize: 17, color: "var(--foundry-text-primary)", fontFamily: "'Lora', Georgia, serif", fontWeight: 700, lineHeight: 1.2 }}>
                                    Stage {currentStage} · {currentStageData.label}
                                </div>
                            </div>
                            <div className="foundry-font-ui" style={{ fontSize: 12, color: "var(--foundry-ember)", fontWeight: 700 }}>
                                {currentStagePct}%
                            </div>
                        </div>
                        <div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 11 }}>
                            <div
                                className="foundry-progress-fill"
                                style={{
                                    height: "100%",
                                    width: `${currentStagePct}%`,
                                    borderRadius: 999,
                                    background: "linear-gradient(90deg, var(--foundry-orange), var(--foundry-ember))",
                                }}
                            />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontSize: 13, color: "var(--foundry-text-secondary)", lineHeight: 1.65, maxWidth: 680 }}>
                                {nextMilestone
                                    ? `Next best action: ${nextMilestone.label}`
                                    : currentStageData.mission}
                            </div>
                            <button
                                onClick={() => onEnterStage(currentStage)}
                                className="foundry-btn foundry-btn--primary"
                                style={{ padding: "8px 13px", fontSize: 12 }}
                            >
                                Continue Stage {currentStage}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginBottom: 16 }}>
                        {primaryFocusCards.map((card) => (
                            <HubFocusCard
                                key={card.eyebrow}
                                eyebrow={card.eyebrow}
                                title={card.title}
                                body={card.body}
                                actionLabel={card.actionLabel}
                                icon={card.icon}
                                onClick={card.onClick}
                                tone={card.tone}
                            />
                        ))}
                    </div>
                </div>

                {pendingCofounderInvites.map((invite: any) => (
                    <div
                        key={invite.id}
                        style={{
                            background: "rgba(99, 179, 237, 0.07)",
                            border: "1px solid rgba(99, 179, 237, 0.25)",
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
                                    background: "rgba(99, 179, 237, 0.15)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    marginTop: 1,
                                    fontSize: 14,
                                }}
                            >
                                🤝
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontSize: 13,
                                        color: "#D4CFC9",
                                        fontFamily: "'Lora', Georgia, serif",
                                        lineHeight: 1.5,
                                    }}
                                >
                                    <strong style={{ color: "#63B3ED" }}>{invite.inviter_name}</strong> has invited you to join <strong style={{ color: "#F0EDE8" }}>{invite.team_name}</strong> on Foundry.
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, paddingLeft: 38 }}>
                            <button
                                onClick={() => onAcceptCofounderInvite?.(invite)}
                                style={{
                                    background: "linear-gradient(135deg, #63B3ED, #4299e1)",
                                    border: "none",
                                    borderRadius: 8,
                                    padding: "6px 16px",
                                    color: "#fff",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontFamily: "'Lora', Georgia, serif",
                                }}
                            >
                                Accept
                            </button>
                            <button
                                onClick={() => onDeclineCofounderInvite?.(invite)}
                                style={{
                                    background: "transparent",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 8,
                                    padding: "6px 12px",
                                    color: "var(--foundry-text-secondary)",
                                    fontSize: 12,
                                    cursor: "pointer",
                                    fontFamily: "'Lora', Georgia, serif",
                                }}
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                ))}

                <div
                    className="foundry-quiet-panel"
                    style={{
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
                        <div style={{ fontSize: 11, color: "var(--foundry-text-muted)" }}>
                            Stage {currentStage} of 6
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                        {STAGES_DATA.map((stage) => {
                            const isComplete = isStageDoneInJourney(stage);
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
                                                ? "rgba(76,175,138,0.16)"
                                                : isCurrent
                                                    ? "rgba(232,98,42,0.15)"
                                                    : "rgba(255,255,255,0.03)",
                                            color: isComplete ? "#4CAF8A" : undefined,
                                            border: isComplete
                                                ? "1px solid rgba(76,175,138,0.24)"
                                                : isCurrent && !isComplete ? "1px solid rgba(232,98,42,0.42)" : "1px solid rgba(255,255,255,0.04)",
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
                                            color: isCurrent && !isComplete ? "#E8622A" : isComplete ? "#4CAF8A" : "#555",
                                            fontWeight: isCurrent && !isComplete ? 600 : 400,
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
                                width: `${journeyPct}%`,
                                background: "linear-gradient(90deg, #E8622A, #F5A843)",
                                borderRadius: 2,
                                transition: "width 1s ease",
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <div style={{ fontSize: 11, color: "var(--foundry-text-muted)" }}>
                            {journeyPct}% complete
                        </div>
                        <div
                            onClick={() => onEnterStage(currentStage)}
                            style={{ fontSize: 11, color: "var(--foundry-text-secondary)", cursor: "pointer" }}
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
                        <div style={{ marginTop: 10, fontSize: 11, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>
                            You&apos;re revisiting Stage {currentStage}. When you&apos;re ready, the Goals tab will let you move back into Stage {nextReachedStage}.
                        </div>
                    )}
                </div>

                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "16px", marginBottom: 14, animation: "fadeSlideUp 0.5s ease 0.14s both" }}>
                    <div className="hub-section-header" style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>
                            Support Signal: Business Health
                        </div>
                        <div className="foundry-inline-actions">
                            <div style={{ fontSize: 11, color: businessHealth.overallScore >= 62 ? "#4CAF8A" : businessHealth.overallScore >= 45 ? "#D9B15D" : "#D96A55" }}>
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

                    {businessHealth.hasMarketReport ? (
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
                    ) : (
                        <div style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>
                            <div style={{ filter: "grayscale(1)", opacity: 0.28, pointerEvents: "none", userSelect: "none" }} aria-hidden="true">
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
                                                    <div style={{ width: `${segment.value}%`, height: "100%", background: segment.color, borderRadius: 999 }} />
                                                </div>
                                                <div style={{ height: 10, background: "rgba(255,255,255,0.04)", borderRadius: 4 }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "rgba(8,8,9,0.45)", backdropFilter: "blur(2px)", padding: 16 }}>
                                <button
                                    onClick={() => onGetHealthScore?.()}
                                    style={{ background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 12, padding: "11px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Lora', Georgia, serif", textAlign: "center", lineHeight: 1.4, boxShadow: "0 4px 18px rgba(232,98,42,0.35)" }}
                                >
                                    Get Your Business Health Score
                                </button>
                                <div style={{ fontSize: 10, color: "rgba(240,237,232,0.7)", textAlign: "center", lineHeight: 1.6, maxWidth: 180 }}>
                                    Run a market analysis to unlock your full score
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: 14, fontSize: 11, color: "var(--foundry-text-secondary)", lineHeight: 1.7 }}>
                        {businessHealth.hasMarketReport
                            ? "This is a directional founder health view built from your stage progress, financial position, decision history, and latest market intelligence."
                            : "Your business health score unlocks after your first market intelligence run. Click the button above to generate it."
                        }
                    </div>
                </div>

                {/* Financial Modeling */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 14, animation: "fadeSlideUp 0.5s ease 0.25s both" }}>
                    <div className="hub-section-header" style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Support: Financial Modeling</div>
                        <div className="foundry-inline-actions">
                            <button onClick={openBudgetModal} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "4px 12px", color: "#F0EDE8", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>Customize</button>
                            <button onClick={() => setShowIncomeModal(true)} style={{ background: "rgba(76,175,138,0.1)", border: "1px solid rgba(76,175,138,0.25)", borderRadius: 8, padding: "4px 12px", color: "#4CAF8A", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>+ Revenue</button>
                            <button onClick={() => setShowExpenseModal(true)} style={{ background: "rgba(217,106,85,0.1)", border: "1px solid rgba(217,106,85,0.25)", borderRadius: 8, padding: "4px 12px", color: "#D96A55", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>+ Expense</button>
                        </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#A8A4A0", lineHeight: 1.6, marginBottom: 12 }}>
                        Estimates based on the data you&apos;ve entered. This is not accounting, tax, or legal advice.
                    </div>
                    {(profile.budgetRange || profile.budgetIsEstimated) && (
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 12, fontSize: 10, color: "var(--foundry-text-secondary)" }}>
                            <div>Range: {getBudgetRangeLabel(profile.budgetRange) || "Not set"}</div>
                            <div>{profile.budgetIsEstimated ? "Using provisional amount" : "Exact budget confirmed"}</div>
                        </div>
                    )}
                    <div className="hub-budget-grid" style={{ marginBottom: 14 }}>
                        {[
                            { label: "Available Cash", value: formatCurrency(financialSummary?.availableCash || profile.budget?.remaining || 0), color: "#F0EDE8" },
                            { label: "Monthly Burn", value: formatCurrency(financialSummary?.monthlyBurn || 0), color: "#D96A55" },
                            { label: "Runway", value: financialSummary?.runwayMonths != null ? `${financialSummary.runwayMonths.toFixed(1)} mo` : "TBD", color: "#4CAF8A" },
                            { label: "Net Snapshot", value: formatCurrency(financialSummary?.roughNetSnapshot || 0), color: (financialSummary?.roughNetSnapshot || 0) >= 0 ? "#4CAF8A" : "#FF6B6B" },
                        ].map(item => (
                            <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px", textAlign: "center" }}>
                                <div style={{ fontSize: "clamp(14px, 4vw, 20px)", fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: item.color, lineHeight: 1.1, marginBottom: 3 }}>{item.value}</div>
                                <div style={{ fontSize: 9, color: "var(--foundry-text-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.label}</div>
                            </div>
                        ))}
                    </div>

                    {onOpenFinancialDashboard && (
                        <button
                            onClick={onOpenFinancialDashboard}
                            style={{
                                width: "100%",
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 10,
                                padding: "10px 14px",
                                color: "#A8A4A0",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                textAlign: "center",
                                marginBottom: 12,
                                letterSpacing: "0.02em",
                            }}
                        >
                            Full Financial Dashboard →
                        </button>
                    )}

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                            <div>
                                <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Bank Connections</div>
                                <div style={{ fontSize: 11, color: "#A8A4A0", lineHeight: 1.6, marginTop: 4 }}>
                                    Plaid bank linking is coming soon. For launch, keep this local by entering revenue and expenses manually.
                                </div>
                            </div>
                            <div style={{ background: "rgba(99,179,237,0.1)", border: "1px solid rgba(99,179,237,0.22)", borderRadius: 999, padding: "6px 10px", color: "#8FC8F6", fontSize: 10, fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                Coming Soon
                            </div>
                        </div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 8, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Profit First Buckets</div>
                            <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)" }}>{financialSummary?.profitFirst?.basisLabel || "Estimated basis"}</div>
                        </div>
                        {(financialSummary?.profitFirst?.buckets || []).map((bucket) => (
                            <div key={bucket.bucketType} style={{ marginBottom: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                                    <div style={{ fontSize: 12, color: "#F0EDE8", textTransform: "capitalize" }}>{bucket.bucketType.replace("_", " ")}</div>
                                    <div style={{ fontSize: 11, color: "#C8C4BE" }}>{bucket.allocationPercent}% · {formatCurrency(bucket.estimatedAmount)}</div>
                                </div>
                                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                                    <div style={{ width: `${Math.max(0, Math.min(bucket.allocationPercent, 100))}%`, height: "100%", background: bucket.bucketType === "profit" || bucket.bucketType === "tax" ? "linear-gradient(90deg, #4CAF8A, #75D0A7)" : "linear-gradient(90deg, #D96A55, #D9B15D)" }} />
                                </div>
                            </div>
                        ))}
                        <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", lineHeight: 1.5 }}>Connect bank data later to improve accuracy. For now, these allocations are estimated from your entered revenue or available cash.</div>
                    </div>

                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                        <div style={{ fontSize: 13, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 8 }}>Runway Calculator</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 10 }}>
                            <div>
                                <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Recurring Expenses</div>
                                <div style={{ fontSize: 16, color: "#D96A55", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>{formatCurrency(financialSummary?.monthlyRecurringExpenses || 0)}/mo</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Recurring Revenue</div>
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
                                        <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Monthly Revenue</div>
                                        <div style={{ fontSize: 15, color: "#4CAF8A", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>{formatCurrency(financialSummary?.operatingView.monthlyRevenue || 0)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Monthly Expenses</div>
                                        <div style={{ fontSize: 15, color: "#D96A55", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>{formatCurrency(financialSummary?.operatingView.monthlyExpenses || 0)}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Operating Gap</div>
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
                                <div style={{ fontSize: 10, color: "#8FC8F6", fontWeight: 700 }}>Coming soon</div>
                            </div>
                            <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", lineHeight: 1.5, marginBottom: 8 }}>
                                Bank imports will arrive after launch. Until then, use manual revenue and expense entries so the model stays fully local.
                            </div>
                            <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>No imported transaction review is available yet.</div>
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <div style={{ fontSize: 12, color: "#F0EDE8", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>Expenses</div>
                                <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)" }}>{expenseRows.length} logged</div>
                            </div>
                            {expenseRows.length === 0 ? (
                                <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>No normalized expenses yet. Add the costs that actually shape the business and Foundry will start modeling burn and runway more intelligently.</div>
                            ) : expenseRows.map((exp: any) => (
                                <div key={exp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, color: "#C8C4BE" }}>{exp.label}</div>
                                        <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", marginTop: 2 }}>{exp.category} · {String(exp.frequency).replace("_", " ")}{exp.incurredOn ? ` · ${formatFinancialDate(exp.incurredOn)}` : ""}</div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ fontSize: 12, color: "#D96A55", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>-{formatCurrency(exp.amount)}</div>
                                        <button onClick={() => deleteExpense(exp.id)} style={{ background: "none", border: "none", color: "var(--foundry-text-muted)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }} title="Delete expense">×</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <div style={{ fontSize: 12, color: "#F0EDE8", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>Revenue</div>
                                <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)" }}>{revenueRows.length} logged</div>
                            </div>
                            {revenueRows.length === 0 ? (
                                <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>No revenue logged yet. Add sales, services, or recurring receipts to sharpen the operating view and make runway more realistic.</div>
                            ) : revenueRows.map((inc: any) => (
                                <div key={inc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, color: "#C8C4BE" }}>{inc.label}</div>
                                        <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", marginTop: 2 }}>{inc.category} · {String(inc.frequency).replace("_", " ")}{inc.receivedOn ? ` · ${formatFinancialDate(inc.receivedOn)}` : ""}</div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={{ fontSize: 12, color: "#4CAF8A", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>+{formatCurrency(inc.amount)}</div>
                                        <button onClick={() => deleteIncome(inc.id)} style={{ background: "none", border: "none", color: "var(--foundry-text-muted)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "0 2px" }} title="Delete revenue">×</button>
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
                            <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", marginTop: 10 }}>You're building real business literacy. Keep going.</div>
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
                            <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", marginTop: 10 }}>Every concept you explore is a framework you now carry into every decision.</div>
                        )}
                    </div>
                )}

                {/* Decisions */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", animation: "fadeSlideUp 0.5s ease 0.3s both" }}>
                        <div className="hub-section-header" style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Decisions</div>
                        <button onClick={() => setShowDecisionModal(true)} className="foundry-btn foundry-btn--secondary" style={{ padding: "4px 12px", fontSize: 11 }}>+ Log Decision</button>
                    </div>
                    {(!profile.decisions || profile.decisions.length === 0) ? (
                        <div style={{ fontSize: 13, color: "var(--foundry-text-secondary)", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>No decisions logged yet. Every call you make deliberately is worth recording.</div>
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
                                        <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", marginTop: 4 }}>{dec.date}</div>
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
                            <button onClick={() => setShowDecisionModal(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "var(--foundry-text-muted)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
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
                        <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Frequency</div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                            {(["one-time", "monthly", "yearly"] as const).map(f => (
                                <button key={f} onClick={() => { setExpenseFrequency(f); if (f === "one-time") setExpenseRenewalDate(""); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: expenseFrequency === f ? "1px solid rgba(232,98,42,0.5)" : "1px solid rgba(255,255,255,0.08)", background: expenseFrequency === f ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.03)", color: expenseFrequency === f ? "#E8622A" : "#888", fontSize: 11, cursor: "pointer", fontWeight: 500, textTransform: "capitalize" }}>{f}</button>
                            ))}
                        </div>
                        {expenseFrequency !== "one-time" && (
                            <>
                                <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Next Renewal Date</div>
                                <input type="date" value={expenseRenewalDate} onChange={e => setExpenseRenewalDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 10, boxSizing: "border-box", colorScheme: "dark" }} />
                            </>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                            <button onClick={() => setShowExpenseModal(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "var(--foundry-text-muted)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
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
                        <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Frequency</div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                            {(["one-time", "monthly", "yearly"] as const).map(f => (
                                <button key={f} onClick={() => { setIncomeFrequency(f); if (f === "one-time") setIncomeRenewalDate(""); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, border: incomeFrequency === f ? "1px solid rgba(76,175,138,0.5)" : "1px solid rgba(255,255,255,0.08)", background: incomeFrequency === f ? "rgba(76,175,138,0.12)" : "rgba(255,255,255,0.03)", color: incomeFrequency === f ? "#4CAF8A" : "#888", fontSize: 11, cursor: "pointer", fontWeight: 500, textTransform: "capitalize" }}>{f}</button>
                            ))}
                        </div>
                        {incomeFrequency !== "one-time" && (
                            <>
                                <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", marginBottom: 6, letterSpacing: "0.08em", textTransform: "uppercase" }}>Next Renewal Date</div>
                                <input type="date" value={incomeRenewalDate} onChange={e => setIncomeRenewalDate(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", marginBottom: 10, boxSizing: "border-box", colorScheme: "dark" }} />
                            </>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                            <button onClick={() => setShowIncomeModal(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "var(--foundry-text-muted)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
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
                            <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>Budget Range</div>
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
                            <button onClick={() => setShowBudgetModal(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "var(--foundry-text-muted)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
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
                                style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "var(--foundry-text-muted)", fontSize: 12, cursor: "pointer" }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowLogoutModal(false);
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
                        <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
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
                                style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "var(--foundry-text-muted)", fontSize: 12, cursor: "pointer" }}
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

    const scoreColor = health.overallScore >= 62 ? "#4CAF8A" : health.overallScore >= 45 ? "#D9B15D" : "#D96A55";

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

function clamp(value: number, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}

function keywordScore(content: string, positiveWords: string[], negativeWords: string[], base: number) {
    const normalized = (content || "").toLowerCase();
    if (!normalized.trim()) return base;

    const positiveHits = positiveWords.reduce((count, word) => count + (normalized.includes(word) ? 1 : 0), 0);
    const negativeHits = negativeWords.reduce((count, word) => count + (normalized.includes(word) ? 1 : 0), 0);

    return clamp(base + (positiveHits * 8) - (negativeHits * 7));
}

export function getBusinessHealth(
    profile: any,
    completedByStage: Record<number, string[]>,
    marketReport?: any | null,
    financialSummary?: {
        availableCash?: number;
        totalRevenue?: number;
        totalExpenses?: number;
        runwayMonths?: number | null;
    } | null,
) {
    const currentStage = profile?.currentStage || 1;
    const stageMilestones = Number.isFinite(currentStage) ? completedByStage[currentStage] || [] : [];
    const currentStageTotal = STAGES_DATA[currentStage - 1]?.milestones?.length || 1;
    const executionScore = clamp((stageMilestones.length / currentStageTotal) * 100);

    const totalBudget = Number(profile?.budget?.total || 0);
    const totalIncome = Number((financialSummary?.totalRevenue ?? profile?.budget?.totalIncome) || 0);
    const spent = Number((financialSummary?.totalExpenses ?? profile?.budget?.spent) || 0);
    const remaining = Number(financialSummary?.availableCash ?? (Math.max(totalBudget + totalIncome, 0) - spent));
    const effectiveBudget = Math.max(remaining + spent, 0);
    const remainingRatio = effectiveBudget > 0 ? clamp((remaining / effectiveBudget) * 100) : 45;
    const runwayBonus = (financialSummary?.runwayMonths != null) || (profile?.budget?.runway && profile.budget.runway !== "TBD") ? 10 : 0;
    const incomeBonus = totalIncome > 0 ? Math.min(15, Math.round((totalIncome / Math.max(totalBudget || 1, 1)) * 25)) : 0;
    const financialScore = clamp((remainingRatio * 0.75) + runwayBonus + incomeBonus);

    const claritySignals = [
        profile?.industry && profile.industry !== "Still being clarified" ? 25 : 0,
        profile?.idea && profile.idea !== "Still being clarified" ? 20 : 0,
        profile?.strategyLabel || profile?.strategy ? 20 : 0,
        profile?.businessName ? 10 : 0,
        Math.min(25, (profile?.decisions?.length || 0) * 5),
    ];
    const clarityScore = clamp(claritySignals.reduce((sum, value) => sum + value, 0));

    const reportContent = marketReport?.content || "";
    const hasMarketReport = !!reportContent.trim();
    const marketBase = hasMarketReport ? 58 : (profile?.industry ? 52 : 40);
    const growthBase = hasMarketReport ? 60 : (profile?.industry ? 55 : 42);

    const marketStrengthScore = keywordScore(
        reportContent,
        ["strong demand", "tailwind", "growing demand", "underserved", "expanding", "attractive", "healthy demand", "opportunity"],
        ["crowded", "saturated", "declining", "headwind", "commoditized", "weak demand", "shrinking", "regulatory risk"],
        marketBase
    );

    const growthPotentialScore = keywordScore(
        reportContent,
        ["scalable", "expansion", "upsell", "repeat purchase", "recurring", "margin", "growth potential", "high upside"],
        ["low margin", "capital intensive", "seasonal", "manual", "fragile", "limited upside", "slow growth", "high churn"],
        growthBase
    );

    const overallScore = Math.round(
        (executionScore * 0.24) +
        (financialScore * 0.22) +
        (clarityScore * 0.18) +
        (marketStrengthScore * 0.18) +
        (growthPotentialScore * 0.18)
    );

    const statusLabel = overallScore >= 78
        ? "Strong"
        : overallScore >= 62
            ? "Stable"
            : overallScore >= 45
                ? "Developing"
                : "Needs Attention";

    return {
        overallScore,
        statusLabel,
        hasMarketReport,
        segments: [
            {
                key: "execution",
                label: "Execution",
                value: Math.round(executionScore),
                color: "#E8622A",
                note: "Current stage progress and milestone completion.",
            },
            {
                key: "financial",
                label: "Financial",
                value: Math.round(financialScore),
                color: "#4CAF8A",
                note: "Budget position, remaining capital, and runway signals.",
            },
            {
                key: "clarity",
                label: "Clarity",
                value: Math.round(clarityScore),
                color: "#D9B15D",
                note: "How clearly the business direction and decisions are defined.",
            },
            {
                key: "market",
                label: "Market",
                value: Math.round(marketStrengthScore),
                color: "#5D9DF5",
                note: hasMarketReport ? "Read from the latest market intelligence report." : "Estimated until a market report is generated.",
            },
            {
                key: "growth",
                label: "Growth",
                value: Math.round(growthPotentialScore),
                color: "#9F7AEA",
                note: hasMarketReport ? "Inferred from scalability and upside signals in the market report." : "Estimated until a market report is generated.",
            },
        ],
    };
}
import { STAGES_DATA } from "../constants/stages";

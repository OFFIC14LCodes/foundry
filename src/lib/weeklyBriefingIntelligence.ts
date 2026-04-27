import type { FounderDecision, FounderNudge, StageSummary } from "../db";
import { STAGES_DATA } from "../constants/stages";
import type { AcademyWeeklyActivity } from "./academyDb";

type WeeklyJournalEntry = {
    createdAt: string;
    forgeSummary?: string | null;
    themes?: string[];
};

type WeeklyExpense = {
    label?: string;
    amount?: number;
    date?: string;
};

type WeeklyBriefingInput = {
    profile: any;
    currentStageId: number;
    completedByStage: Record<number, any[]>;
    stageProgressDates?: Record<number, string>;
    recentSummaries?: StageSummary[];
    foundryDecisions?: FounderDecision[];
    journalEntries?: WeeklyJournalEntry[];
    activeNudge?: FounderNudge | null;
    academyActivity?: AcademyWeeklyActivity | null;
    now?: Date;
};

export type WeeklyBriefingHighlights = {
    stageLabel: string;
    completedMilestones: number;
    totalMilestones: number;
    stageMovedThisWeek: boolean;
    recentDecisionTags: string[];
    journalThemes: string[];
    recurringThemes: string[];
    academyCompletedTitles: string[];
    academyOpenedTitles: string[];
    activeNudge: string | null;
};

export type WeeklyBriefingIntelligence = {
    weekStart: string;
    contextBlock: string;
    highlights: WeeklyBriefingHighlights;
    sourceCounts: Record<string, number>;
};

const RECURRING_THEME_KEYWORDS: Array<{ label: string; keywords: string[] }> = [
    { label: "cash discipline", keywords: ["cash", "runway", "burn", "budget", "expense", "money"] },
    { label: "customer clarity", keywords: ["customer", "buyer", "discovery", "sales", "conversion"] },
    { label: "positioning and offer clarity", keywords: ["offer", "positioning", "message", "pricing", "price"] },
    { label: "founder confidence", keywords: ["fear", "doubt", "clarity", "momentum", "stuck"] },
];

function toLocalDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function startOfWeekMonday(now: Date) {
    const result = new Date(now);
    result.setHours(0, 0, 0, 0);
    const day = result.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + diff);
    return result;
}

function isWithinLookback(dateLike: string | null | undefined, cutoffMs: number) {
    if (!dateLike) return false;
    const ms = new Date(dateLike).getTime();
    return Number.isFinite(ms) && ms >= cutoffMs;
}

function truncate(value: string, max = 140) {
    const normalized = value.replace(/\s+/g, " ").trim();
    if (normalized.length <= max) return normalized;
    return `${normalized.slice(0, max - 1).trim()}…`;
}

function safeParseExpenseDate(value: string | null | undefined) {
    if (!value) return null;
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return null;
    return parsed;
}

function collectRecurringThemes(
    summaries: StageSummary[],
    decisions: FounderDecision[],
    journalThemes: string[],
) {
    const bag = [
        ...summaries.map((item) => item.summary.toLowerCase()),
        ...decisions.map((item) => `${item.tag ?? ""} ${item.text}`.toLowerCase()),
        ...journalThemes.map((theme) => theme.toLowerCase()),
    ].join(" ");

    return RECURRING_THEME_KEYWORDS
        .filter((cluster) => cluster.keywords.some((keyword) => bag.includes(keyword)))
        .map((cluster) => cluster.label);
}

export function buildWeeklyBriefingIntelligence({
    profile,
    currentStageId,
    completedByStage,
    stageProgressDates = {},
    recentSummaries = [],
    foundryDecisions = [],
    journalEntries = [],
    activeNudge = null,
    academyActivity = null,
    now = new Date(),
}: WeeklyBriefingInput): WeeklyBriefingIntelligence {
    const weekStartDate = startOfWeekMonday(now);
    const weekStart = toLocalDateKey(weekStartDate);
    const cutoffMs = weekStartDate.getTime();

    const stage = STAGES_DATA.find((item) => item.id === currentStageId) ?? STAGES_DATA[0];
    const completedMilestones = (completedByStage[currentStageId] || []).length;
    const totalMilestones = stage.milestones.length;
    const stageMovedThisWeek = isWithinLookback(stageProgressDates[currentStageId], cutoffMs);

    const weeklyDecisions = foundryDecisions
        .filter((item) => isWithinLookback(item.decidedAt, cutoffMs))
        .slice(0, 4);

    const weeklySummaries = recentSummaries
        .filter((item) => isWithinLookback(`${item.summaryDate}T23:59:59`, cutoffMs))
        .slice(0, 3);

    const weeklyJournalEntries = journalEntries
        .filter((item) => isWithinLookback(item.createdAt, cutoffMs))
        .filter((item) => item.forgeSummary || (item.themes && item.themes.length > 0))
        .slice(0, 4);

    const journalThemes = Array.from(
        new Set(
            weeklyJournalEntries.flatMap((item) => item.themes ?? []).filter(Boolean),
        ),
    );

    const recurringThemes = collectRecurringThemes(weeklySummaries, weeklyDecisions, journalThemes);

    const expenses: WeeklyExpense[] = Array.isArray(profile?.budget?.expenses) ? profile.budget.expenses : [];
    const parseableRecentExpenses = expenses
        .map((expense) => ({ expense, parsedDate: safeParseExpenseDate(expense?.date) }))
        .filter((item) => item.parsedDate && item.parsedDate.getTime() >= cutoffMs)
        .sort((a, b) => (b.parsedDate?.getTime() ?? 0) - (a.parsedDate?.getTime() ?? 0))
        .slice(0, 3);

    const weeklyMovementLines = [
        `Stage ${currentStageId} — ${stage.label}`,
        stageMovedThisWeek
            ? `Stage progress moved this week. The founder now sits at ${completedMilestones}/${totalMilestones} milestones complete.`
            : `Current stage progress stands at ${completedMilestones}/${totalMilestones} milestones complete.`,
    ];

    if (weeklyDecisions.length > 0) {
        weeklyMovementLines.push(`Logged ${weeklyDecisions.length} notable decision${weeklyDecisions.length === 1 ? "" : "s"} this week.`);
    }
    if ((academyActivity?.completedCount ?? 0) > 0) {
        weeklyMovementLines.push(`Academy learning advanced with ${academyActivity?.completedCount} lesson completion${academyActivity?.completedCount === 1 ? "" : "s"}.`);
    }

    const decisionsBlock = weeklyDecisions.length > 0
        ? weeklyDecisions.map((item) => `- ${item.tag ? `[${item.tag}] ` : ""}${truncate(item.text, 120)}`).join("\n")
        : "- No major decisions were logged this week.";

    const journalBlock = weeklyJournalEntries.length > 0
        ? weeklyJournalEntries
            .map((item) => {
                const themeSuffix = item.themes && item.themes.length > 0
                    ? ` Themes: ${item.themes.join(", ")}.`
                    : "";
                const summary = item.forgeSummary ? truncate(item.forgeSummary, 150) : "Summary pending.";
                return `- ${summary}${themeSuffix}`;
            })
            .join("\n")
        : "- No journal summaries or themes were captured this week.";

    const academyBlock = academyActivity
        ? [
            `- Lessons opened this week: ${academyActivity.openedCount}`,
            `- Lessons completed this week: ${academyActivity.completedCount}`,
            academyActivity.recentOpenedLessons.length > 0
                ? `- Recent lessons visited: ${academyActivity.recentOpenedLessons.join(", ")}`
                : null,
            academyActivity.recentCompletedLessons.length > 0
                ? `- Recently completed: ${academyActivity.recentCompletedLessons.join(", ")}`
                : null,
            academyActivity.seriesProgress.length > 0
                ? `- Series progress: ${academyActivity.seriesProgress.map((item) => `${item.seriesTitle} (${item.completedCount}/${item.totalCount})`).join("; ")}`
                : null,
        ].filter(Boolean).join("\n")
        : "- No Academy activity was captured this week.";

    const summaryBlock = weeklySummaries.length > 0
        ? weeklySummaries
            .map((item) => {
                const stageLabel = STAGES_DATA.find((stageItem) => stageItem.id === item.stageId)?.label ?? `Stage ${item.stageId}`;
                return `- ${stageLabel}: ${truncate(item.summary, 150)}`;
            })
            .join("\n")
        : "- No recent Forge session summaries were available this week.";

    const financialLines = [
        `- Budget remaining: $${Number(profile?.budget?.remaining || 0).toLocaleString()}`,
        `- Budget spent: $${Number(profile?.budget?.spent || 0).toLocaleString()}`,
        parseableRecentExpenses.length > 0
            ? `- Reliably dated recent expenses: ${parseableRecentExpenses.map(({ expense }) => `$${Number(expense.amount || 0).toLocaleString()} for ${expense.label || "an expense"}`).join("; ")}`
            : expenses.length > 0
                ? "- Expenses exist, but their dates are not reliable enough to make a week-specific claim. Use the snapshot, not a delta."
                : "- No expenses recorded yet.",
    ];

    const focusCandidates = [
        activeNudge?.nudgeText ? truncate(activeNudge.nudgeText, 150) : null,
        recurringThemes[0] ? `There is a repeated pattern around ${recurringThemes[0]}.` : null,
        weeklyDecisions.length > 0 ? `Multiple decisions were made quickly enough this week that follow-through may matter more than new options.` : null,
        stageMovedThisWeek ? `Stage progress moved. The next move should reinforce that momentum rather than scatter it.` : null,
        `The founder is in Stage ${currentStageId}, where the real question is: ${stage.mission}.`,
    ].filter(Boolean);

    const contextBlock = [
        "[WEEKLY_FOUNDER_CONTEXT]",
        `CURRENT STAGE:\n- Stage ${currentStageId} — ${stage.label}\n- Mission: ${stage.mission}\n- Business: ${profile?.businessName || profile?.idea || "Still being clarified"}\n- Industry: ${profile?.industry || "Early stage"}\n- Strategy mode: ${profile?.strategyLabel || profile?.strategy || "Not specified"}`,
        `THIS WEEK'S MOVEMENT:\n${weeklyMovementLines.map((line) => `- ${line}`).join("\n")}`,
        `DECISIONS:\n${decisionsBlock}`,
        `JOURNAL SIGNALS:\n${journalBlock}`,
        `ACADEMY LEARNING:\n${academyBlock}`,
        `RECENT FORGE CONVERSATIONS:\n${summaryBlock}`,
        `FINANCIAL SNAPSHOT:\n${financialLines.join("\n")}`,
        `RECURRING THEMES:\n${recurringThemes.length > 0 ? recurringThemes.map((theme) => `- ${theme}`).join("\n") : "- No strong repeated pattern stood out yet."}`,
        `ACTIVE NUDGE:\n- ${activeNudge?.nudgeText ? truncate(activeNudge.nudgeText, 150) : "No active nudge is currently sitting with the founder."}`,
        `FORGE'S BRIEFING FOCUS:\n- ${focusCandidates[0]}`,
        "[/WEEKLY_FOUNDER_CONTEXT]",
    ].join("\n\n");

    return {
        weekStart,
        contextBlock,
        highlights: {
            stageLabel: stage.label,
            completedMilestones,
            totalMilestones,
            stageMovedThisWeek,
            recentDecisionTags: Array.from(new Set(weeklyDecisions.map((item) => item.tag).filter(Boolean) as string[])),
            journalThemes,
            recurringThemes,
            academyCompletedTitles: academyActivity?.recentCompletedLessons ?? [],
            academyOpenedTitles: academyActivity?.recentOpenedLessons ?? [],
            activeNudge: activeNudge?.nudgeText ?? null,
        },
        sourceCounts: {
            decisions: weeklyDecisions.length,
            chat_summaries: weeklySummaries.length,
            journal_entries: weeklyJournalEntries.length,
            journal_themes: journalThemes.length,
            academy_history: academyActivity?.recentActivity.length ?? 0,
            academy_completed: academyActivity?.completedCount ?? 0,
            parseable_recent_expenses: parseableRecentExpenses.length,
            active_nudges: activeNudge ? 1 : 0,
        },
    };
}

export function buildWeeklyBriefingPrompt(
    profile: any,
    stageLabel: string,
    completedCount: number,
    totalCount: number,
    weeklyContextBlock: string,
) {
    return `
You are Forge. Write a weekly founder briefing for ${profile.name}, who is building "${profile.businessName || profile.idea}".

You should sound like a business partner who has been tracking the shape of the founder's week. Be observant, warm, and direct. Do not sound like you are reading records or analyzing a database.

Use the weekly context below. Treat it as directional memory, not raw material to repeat mechanically.

${weeklyContextBlock}

Anchor points:
- Current stage: Stage ${profile.currentStage} — ${stageLabel}
- Stage progress: ${completedCount}/${totalCount} milestones complete
- Budget remaining: $${Number(profile.budget?.remaining || 0).toLocaleString()}

Write the briefing in this structure:

1. Opening reflection
- 2-3 sentences
- grounded in the founder's actual week
- natural language, not data-speak

2. What moved this week
- 2-4 bullets
- reference meaningful movement: decisions, learning, stage progress, financial movement, or recent Forge work

3. What seems stuck or repeated
- 1 short paragraph or 2-3 bullets
- surface friction, repetition, or a pattern worth naming

4. What deserves attention now
- 2-3 sentences
- name the one thing Forge thinks matters most this week

5. This week's focus
- exactly one clear focus line

6. One concrete next action
- exactly one concrete next action
- practical, specific, and doable this week

Keep it under 420 words. Keep everything flush-left and easy to scan on a phone. Use short paragraphs and bullets when helpful. Do not quote private journal text. Do not say phrases like "based on the data" or "I noticed from your records."
    `.trim();
}

// Template-based nudge generation — no API calls, no async AI.
// Runs after data loads. Returns null when no nudge is warranted.

import type { StageSummary, FounderDecision, FounderNudge } from "../db";
import { saveNudge } from "../db";
import { buildLongitudinalContext } from "./longitudinalMemory";
import { detectJournalPatterns } from "./journalIntelligence";

const STAGE_NAMES: Record<number, string> = {
    1: "Idea Validation",
    2: "Business Planning",
    3: "Legal Foundation",
    4: "Financial Setup",
    5: "Pre-Launch",
    6: "Growth",
};

function daysAgo(isoString: string): number {
    const ms = Date.now() - new Date(isoString).getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

// ── Template pools ─────────────────────────────────────────────

function stageAlertNudge(stage: number, days: number, completedPct: number): { text: string; source: string } {
    const name = STAGE_NAMES[stage] ?? `Stage ${stage}`;
    const templates = [
        `You've been in ${name} for ${days} days with ${completedPct}% of milestones done. Want to talk through what's keeping you here?`,
        `${days} days in ${name} — and still ${100 - completedPct}% of milestones ahead. Forge can help you pinpoint the blocker.`,
        `You've spent ${days} days in ${name}. Let's figure out together what's keeping progress from moving forward.`,
    ];
    return {
        text: templates[days % templates.length],
        source: `stage_alert:stage_${stage}:days_${days}`,
    };
}

function decisionFollowUpNudge(decision: FounderDecision): { text: string; source: string } {
    const ago = daysAgo(decision.decidedAt);
    const agoStr = ago === 0 ? "earlier today" : ago === 1 ? "yesterday" : `${ago} days ago`;
    const truncated = decision.text.length > 80 ? decision.text.slice(0, 77) + "…" : decision.text;
    const templates = [
        `You decided "${truncated}" ${agoStr}. How has that played out so far?`,
        `Quick check-in: "${truncated}" was your call ${agoStr}. Any second thoughts or new info since then?`,
        `A decision you made ${agoStr} — "${truncated}" — might be worth revisiting with Forge.`,
    ];
    return {
        text: templates[ago % templates.length],
        source: `decision_followup:${decision.id}`,
    };
}

function recurringThemeNudge(theme: string): { text: string; source: string } {
    const map: Record<string, { texts: string[]; source: string }> = {
        cash: {
            texts: [
                "Cash flow has been a recurring topic in your sessions. Want Forge to help you map your current runway?",
                "Money questions keep coming up in your chats. Forge can run a quick financial clarity session with you.",
            ],
            source: "theme:cash_flow",
        },
        customer: {
            texts: [
                "Customer acquisition keeps surfacing in your chats. Want to work through a concrete acquisition plan with Forge?",
                "You keep circling back to customer and sales questions. Let's build a focused plan together.",
            ],
            source: "theme:customer_acquisition",
        },
        mindset: {
            texts: [
                "Mindset challenges have come up in several sessions. Sometimes it helps to just name what's getting in the way — Forge is here for that.",
                "You've mentioned doubt and nerves more than once. Want to talk it through with Forge today?",
            ],
            source: "theme:mindset",
        },
        stuck: {
            texts: [
                "Decision paralysis has appeared across multiple sessions. Forge can help you break the loop — one decision at a time.",
                "You've felt stuck or blocked recently. A quick Forge session might help clear the path.",
            ],
            source: "theme:paralysis",
        },
        pricing: {
            texts: [
                "Pricing has come up repeatedly and still seems unsettled. Want Forge to walk you through a pricing framework?",
                "The pricing question keeps resurfacing. Let's put it to rest with Forge today.",
            ],
            source: "theme:pricing",
        },
    };

    const entry = map[theme];
    if (!entry) return { text: "Something's been coming up across your sessions — want to dig into it with Forge?", source: "theme:unknown" };
    const idx = Math.floor(Math.random() * entry.texts.length);
    return { text: entry.texts[idx], source: entry.source };
}

// ── Detect dominant recurring theme ───────────────────────────

const THEME_KEYWORD_MAP: Array<{ key: string; keywords: string[] }> = [
    { key: "cash", keywords: ["cash", "money", "runway", "burn"] },
    { key: "customer", keywords: ["customer", "sales", "conversion"] },
    { key: "mindset", keywords: ["fear", "scared", "nervous", "doubt", "imposter"] },
    { key: "stuck", keywords: ["stuck", "blocked", "not sure", "confused"] },
    { key: "pricing", keywords: ["pricing", "price", "charge", "cost"] },
];

function detectDominantTheme(recentSummaries: StageSummary[]): string | null {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    const text = recentSummaries
        .filter(s => new Date(s.summaryDate + "T23:59:59") >= cutoff)
        .map(s => s.summary.toLowerCase())
        .join(" ");

    if (!text) return null;

    let best: { key: string; count: number } | null = null;
    for (const cluster of THEME_KEYWORD_MAP) {
        const count = cluster.keywords.reduce((acc, kw) => {
            const regex = new RegExp(`\\b${kw}\\b`, "gi");
            return acc + (text.match(regex)?.length ?? 0);
        }, 0);
        if (count > 2 && (!best || count > best.count)) {
            best = { key: cluster.key, count };
        }
    }
    return best?.key ?? null;
}

// ── Find best decision to follow up on ────────────────────────

function bestDecisionToFollowUp(decisions: FounderDecision[]): FounderDecision | null {
    const cutoff14 = new Date();
    cutoff14.setDate(cutoff14.getDate() - 14);
    // Prefer decisions 3-14 days old (enough time to have an outcome)
    const candidates = decisions.filter(d => {
        const ago = daysAgo(d.decidedAt);
        return ago >= 3 && ago <= 14;
    });
    return candidates[0] ?? null;
}

// ── Journal pattern nudge templates ───────────────────────────

const JOURNAL_THEME_NUDGES: Record<string, string> = {
    fear: "You've been writing about fear more than once this week. That's worth bringing into your Forge session.",
    clarity: "Your journal shows you working toward clarity on something. Forge can help you find it faster.",
    momentum: "Something's moving for you this week — your journal reflects it. Let's build on it.",
    product: "Product questions keep showing up in your writing. Let's get specific with Forge.",
    team: "Team dynamics have come up in your journal. That's worth a real conversation.",
    pricing: "Pricing is showing up in your journal. Let's work through it together in Forge.",
    cash_flow: "Cash concerns have been appearing in your writing. Forge can help you map what's real.",
    customers: "Customer questions are recurring in your journal. Let's build a concrete plan.",
    mindset: "Your journal is reflecting some internal friction. Forge can help you work through it.",
    legal: "Legal questions are coming up in your writing. Let's get them answered.",
    growth: "Growth thinking is showing up in your journal. Let's pressure-test it with Forge.",
};

// ── Main export ────────────────────────────────────────────────

export async function generateNudgeIfNeeded(
    userId: string,
    currentStage: number,
    recentSummaries: StageSummary[],
    decisions: FounderDecision[],
    completedByStage: Record<number, string[]>,
    stageProgressDates: Record<number, string>,
    activeNudge: FounderNudge | null,
    journalEntries: any[] = []
): Promise<FounderNudge | null> {
    // If an undismissed nudge from the last 7 days already exists, keep it
    if (activeNudge) return activeNudge;

    // Build the longitudinal block to check for a stage alert
    const block = buildLongitudinalContext(
        currentStage,
        recentSummaries,
        decisions,
        completedByStage,
        stageProgressDates
    );

    let nudgePayload: { text: string; source: string; type: string } | null = null;

    // Priority 1 — stage alert
    const alertMatch = block.match(/STAGE ALERT:.*?(\d+) days.*?(\d+)% of core milestones/);
    if (alertMatch) {
        const days = parseInt(alertMatch[1], 10);
        const pct = parseInt(alertMatch[2], 10);
        const { text, source } = stageAlertNudge(currentStage, days, pct);
        nudgePayload = { text, source, type: "stage_alert" };
    }

    // Priority 2 — decision follow-up
    if (!nudgePayload) {
        const decision = bestDecisionToFollowUp(decisions);
        if (decision) {
            const { text, source } = decisionFollowUpNudge(decision);
            nudgePayload = { text, source, type: "decision_followup" };
        }
    }

    // Priority 3 — recurring theme
    if (!nudgePayload) {
        const theme = detectDominantTheme(recentSummaries);
        if (theme) {
            const { text, source } = recurringThemeNudge(theme);
            nudgePayload = { text, source, type: "recurring_theme" };
        }
    }

    // Priority 4 — journal pattern (theme appears in 2+ entries in last 14 days)
    if (!nudgePayload && journalEntries.length > 0) {
        const journalThemes = detectJournalPatterns(journalEntries, 14);
        if (journalThemes.length > 0) {
            const theme = journalThemes[0];
            const text = JOURNAL_THEME_NUDGES[theme]
                ?? "A theme has been showing up in your journal this week. Let's talk it through with Forge.";
            nudgePayload = {
                text,
                source: `journal_theme_${theme}`,
                type: "recurring_theme",
            };
        }
    }

    if (!nudgePayload) return null;

    return saveNudge(userId, nudgePayload.type, nudgePayload.text, nudgePayload.source);
}

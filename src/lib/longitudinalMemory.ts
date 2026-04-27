// Builds the LONGITUDINAL MEMORY context block injected into Forge's system prompt.
// Pure synchronous function — all inputs are pre-loaded from Supabase at app startup.
// No async calls, no side effects.

import type { StageSummary, FounderDecision } from "../db";

const THEME_CLUSTERS: Array<{ keywords: string[]; label: string }> = [
    {
        keywords: ["cash", "money", "runway", "burn"],
        label: "Cash flow has come up repeatedly",
    },
    {
        keywords: ["customer", "sales", "conversion"],
        label: "Customer acquisition is a recurring theme",
    },
    {
        keywords: ["fear", "scared", "nervous", "doubt", "imposter"],
        label: "Mindset friction has surfaced multiple times",
    },
    {
        keywords: ["stuck", "blocked", "not sure", "confused"],
        label: "Decision paralysis has appeared in recent sessions",
    },
    {
        keywords: ["pricing", "price", "charge", "cost"],
        label: "Pricing remains an open question",
    },
];

function daysAgo(isoString: string): number {
    const ms = Date.now() - new Date(isoString).getTime();
    return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function buildLongitudinalContext(
    currentStage: number,
    recentSummaries: StageSummary[],
    decisions: FounderDecision[],
    completedByStage: Record<number, string[]>,
    stageProgressDates: Record<number, string> = {}
): string {
    const parts: string[] = [];

    // ── Time in stage ────────────────────────────────────────────
    const stageStartIso = stageProgressDates[currentStage];
    const daysInStage = stageStartIso ? daysAgo(stageStartIso) : null;

    if (daysInStage !== null) {
        const flag =
            daysInStage > 21
                ? " (above average — worth examining if there's a blocker)"
                : "";
        parts.push(`TIME IN STAGE: ${daysInStage} days in Stage ${currentStage}${flag}`);
    }

    // ── Decision history (last 30 days) ──────────────────────────
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const recentDecisions = decisions.filter(d => new Date(d.decidedAt) >= cutoff30);

    if (recentDecisions.length > 0) {
        const lines = recentDecisions.map(d => {
            const ago = daysAgo(d.decidedAt);
            const agoStr = ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`;
            const tagStr = d.tag ? `[${d.tag}]` : "[Decision]";
            return `  Stage ${d.stageId} — ${tagStr} ${d.text} (${agoStr})`;
        });
        parts.push(`DECISION HISTORY (last 30 days):\n${lines.join("\n")}`);
    }

    // ── Cross-stage journey summary ───────────────────────────────
    // Pick the most recent summary per stage
    const latestByStage: Record<number, StageSummary> = {};
    for (const s of recentSummaries) {
        if (!latestByStage[s.stageId] || s.summaryDate > latestByStage[s.stageId].summaryDate) {
            latestByStage[s.stageId] = s;
        }
    }

    const journeyStages = Object.values(latestByStage).sort((a, b) => a.stageId - b.stageId);
    if (journeyStages.length > 0) {
        const lines = journeyStages.map(s => {
            const label = s.stageId === currentStage ? "current" : "prior";
            return `  Stage ${s.stageId} (${label}): ${s.summary}`;
        });
        parts.push(`FOUNDER JOURNEY SUMMARY:\n${lines.join("\n")}`);
    }

    // ── Pattern detection (last 14 days) ─────────────────────────
    const cutoff14 = new Date();
    cutoff14.setDate(cutoff14.getDate() - 14);
    const recentText = recentSummaries
        .filter(s => new Date(s.summaryDate + "T23:59:59") >= cutoff14)
        .map(s => s.summary.toLowerCase())
        .join(" ");

    if (recentText.length > 0) {
        const themes: string[] = [];
        for (const cluster of THEME_CLUSTERS) {
            const count = cluster.keywords.reduce((acc, kw) => {
                const regex = new RegExp(`\\b${kw}\\b`, "gi");
                return acc + (recentText.match(regex)?.length ?? 0);
            }, 0);
            if (count > 2) {
                themes.push(`  → ${cluster.label}`);
            }
        }
        if (themes.length > 0) {
            parts.push(`RECURRING THEMES (last 14 days):\n${themes.join("\n")}`);
        }
    }

    // ── Stage duration alert ──────────────────────────────────────
    if (daysInStage !== null && daysInStage > 21) {
        const completed = (completedByStage[currentStage] || []).length;
        const total = 5; // all stages have 5 milestones
        const pct = Math.round((completed / total) * 100);
        if (pct < 50) {
            parts.push(
                `STAGE ALERT: Founder has been in Stage ${currentStage} for ${daysInStage} days with ${pct}% of core milestones complete. This may indicate a blocker worth surfacing.`
            );
        }
    }

    if (parts.length === 0) return "";

    return [
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "LONGITUDINAL MEMORY",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        parts.join("\n\n"),
    ].join("\n");
}

// Extracts the recurring themes and stage alert lines from the longitudinal block
// for use in augmenting Forge's greeting prompt.
export function extractLongitudinalSignals(longitudinalBlock: string): string {
    if (!longitudinalBlock) return "";
    const lines: string[] = [];

    const themeMatch = longitudinalBlock.match(/RECURRING THEMES[\s\S]*?(?=\n\nSTAGE ALERT|\n\n━|$)/);
    if (themeMatch) lines.push(themeMatch[0].trim());

    const alertMatch = longitudinalBlock.match(/STAGE ALERT:.*$/m);
    if (alertMatch) lines.push(alertMatch[0].trim());

    return lines.join("\n\n");
}

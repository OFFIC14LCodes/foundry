// Journal Intelligence — summarization, context building, pattern detection, weekly reflection.
// All AI calls use callForgeAPI (non-streaming). No side effects in pure helpers.

import { callForgeAPI } from "./forgeApi";
import { updateJournalEntrySummary } from "../db";

const VALID_THEMES = new Set([
    "pricing", "cash_flow", "customers", "mindset", "legal",
    "product", "team", "growth", "fear", "clarity", "momentum",
]);

type JournalEntry = {
    id: string;
    content: string;
    createdAt: string;
    forgeSummary: string | null;
    themes: string[];
    summaryGeneratedAt: string | null;
};

function entriesInWindow(entries: JournalEntry[], daysBack: number): JournalEntry[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    return entries.filter(e => new Date(e.createdAt) >= cutoff);
}

function formatEntryDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
    });
}

// ── Entry summarization ────────────────────────────────────────

export async function summarizeJournalEntry(
    entryId: string,
    content: string,
    userId: string
): Promise<{ summary: string; themes: string[] } | null> {
    const prompt = `You are analyzing a founder's private journal entry. Your job is to:
1. Write a 2-3 sentence summary of what this entry is really about — the underlying concern, insight, or state of mind, not just a restatement of the words.
2. Identify which of these themes are present (return only themes that genuinely apply, minimum 0, maximum 4): pricing, cash_flow, customers, mindset, legal, product, team, growth, fear, clarity, momentum

Respond in this exact JSON format with no other text:
{"summary": "...", "themes": ["theme1", "theme2"]}

Journal entry:
${content}`;

    try {
        const raw = await callForgeAPI(
            [{ role: "user", content: prompt }],
            "You are a concise analyst. Respond only with the JSON object requested. No markdown, no explanation.",
            400
        );

        // Strip markdown code fences if model wrapped the response
        const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        const parsed = JSON.parse(cleaned);

        if (typeof parsed.summary !== "string") throw new Error("Invalid summary field");

        const themes: string[] = Array.isArray(parsed.themes)
            ? parsed.themes.filter((t: unknown) => typeof t === "string" && VALID_THEMES.has(t))
            : [];

        await updateJournalEntrySummary(entryId, userId, parsed.summary, themes);
        return { summary: parsed.summary, themes };
    } catch (err) {
        console.error("summarizeJournalEntry parse error:", err);
        return null;
    }
}

// ── Context block for Forge ────────────────────────────────────

export function buildJournalContext(entries: JournalEntry[], daysBack: number): string {
    const recent = entriesInWindow(entries, daysBack).slice(0, 7);
    if (recent.length === 0) return "";

    const lines = recent.map(e => {
        const date = formatEntryDate(e.createdAt);
        const text = e.forgeSummary
            ? e.forgeSummary
            : e.content.trim().slice(0, 100) + (e.content.length > 100 ? "…" : "");
        const themeLine = e.themes.length > 0 ? `\n  Themes: ${e.themes.join(", ")}` : "";
        return `  ${date} — ${text}${themeLine}`;
    });

    return `JOURNAL CONTEXT (last ${daysBack} days):\n${lines.join("\n\n")}`;
}

// ── Pattern detection ──────────────────────────────────────────

export function detectJournalPatterns(entries: JournalEntry[], daysBack: number): string[] {
    const recent = entriesInWindow(entries, daysBack);
    const counts: Record<string, number> = {};
    for (const entry of recent) {
        for (const theme of entry.themes) {
            counts[theme] = (counts[theme] ?? 0) + 1;
        }
    }
    return Object.entries(counts)
        .filter(([, count]) => count >= 2)
        .map(([theme]) => theme);
}

// ── Weekly journal summary ─────────────────────────────────────

export async function generateWeeklyJournalSummary(
    _userId: string,
    entries: JournalEntry[]
): Promise<string | null> {
    const weekEntries = entriesInWindow(entries, 7);
    if (weekEntries.length < 2) return null;

    const formatted = weekEntries
        .map(e => `${formatEntryDate(e.createdAt)}: ${e.content.trim()}`)
        .join("\n\n");

    const prompt = `You are Forge, an AI business partner reviewing a founder's journal from the past week. Write a weekly reflection in 3-4 sentences that:
- Names the dominant emotional or mental state across the entries
- Surfaces one pattern the founder may not have consciously noticed
- Ends with one sharp question worth sitting with this week

Do not use generic encouragement. Be specific, grounded, and direct. Write in Forge's voice — warm but not soft, honest but not harsh.

Journal entries from the past 7 days:
${formatted}`;

    try {
        const result = await callForgeAPI(
            [{ role: "user", content: prompt }],
            "You are Forge. Respond with only the weekly reflection — no preamble, no sign-off.",
            300
        );
        return result.trim() || null;
    } catch (err) {
        console.error("generateWeeklyJournalSummary error:", err);
        return null;
    }
}

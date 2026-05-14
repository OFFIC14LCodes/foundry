import { supabase } from "../supabase";

const SONNET_INPUT_COST_PER_MILLION = 3;
const SONNET_OUTPUT_COST_PER_MILLION = 15;

export type AdminTokenUsageSummary = {
    userId: string | null;
    messageCount: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    windowDays: number | null;
};

type TokenUsageRow = {
    user_id: string | null;
    role: string | null;
    token_count?: number | null;
    content?: string | null;
};

function estimateTokenCount(content: string | null | undefined) {
    return Math.max(1, Math.ceil(String(content || "").length / 4));
}

function emptySummary(userId: string | null, windowDays: number | null): AdminTokenUsageSummary {
    return {
        userId,
        messageCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        windowDays,
    };
}

function addRow(summary: AdminTokenUsageSummary, row: TokenUsageRow) {
    const tokens = Math.max(0, Math.round(Number(row.token_count ?? estimateTokenCount(row.content))));
    const role = String(row.role || "").toLowerCase();
    summary.messageCount += 1;
    summary.totalTokens += tokens;
    if (role === "forge" || role === "assistant") {
        summary.outputTokens += tokens;
    } else {
        summary.inputTokens += tokens;
    }
}

function finalize(summary: AdminTokenUsageSummary) {
    summary.estimatedCostUsd =
        (summary.inputTokens / 1_000_000) * SONNET_INPUT_COST_PER_MILLION +
        (summary.outputTokens / 1_000_000) * SONNET_OUTPUT_COST_PER_MILLION;
    return summary;
}

function cutoffIso(windowDays: number | null) {
    if (!windowDays) return null;
    return new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
}

export function formatTokenCount(tokens: number) {
    return new Intl.NumberFormat("en-US").format(Math.round(tokens));
}

export function formatEstimatedCost(amount: number) {
    if (amount <= 0) return "$0.00";
    if (amount < 0.01) return "<$0.01";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function tokenUsageEstimateNote() {
    return `Estimate based on saved message text. Input tokens use $${SONNET_INPUT_COST_PER_MILLION}/MTok and Forge output tokens use $${SONNET_OUTPUT_COST_PER_MILLION}/MTok for Claude Sonnet. It does not include repeated system/context prompts, prompt cache effects, file/image processing, or unsaved legacy calls.`;
}

export async function loadAdminTokenUsageSummary(options: {
    userId?: string;
    windowDays?: number | null;
} = {}): Promise<AdminTokenUsageSummary> {
    const windowDays = options.windowDays ?? null;
    const summary = emptySummary(options.userId ?? null, windowDays);
    const since = cutoffIso(windowDays);

    let conversationQuery = supabase
        .from("conversation_messages")
        .select("user_id, role, token_count, content, created_at");
    if (options.userId) conversationQuery = conversationQuery.eq("user_id", options.userId);
    if (since) conversationQuery = conversationQuery.gte("created_at", since);

    const conversationRes = await conversationQuery;
    if (!conversationRes.error) {
        for (const row of conversationRes.data ?? []) addRow(summary, row as TokenUsageRow);
    }

    let legacyQuery = supabase
        .from("messages")
        .select("user_id, role, content, created_at");
    if (options.userId) legacyQuery = legacyQuery.eq("user_id", options.userId);
    if (since) legacyQuery = legacyQuery.gte("created_at", since);

    const legacyRes = await legacyQuery;
    if (!legacyRes.error) {
        for (const row of legacyRes.data ?? []) addRow(summary, row as TokenUsageRow);
    }

    return finalize(summary);
}

export async function loadAdminTokenUsageByUser(windowDays = 30): Promise<Map<string, AdminTokenUsageSummary>> {
    const usageByUser = new Map<string, AdminTokenUsageSummary>();
    const since = cutoffIso(windowDays);

    const getSummary = (userId: string | null) => {
        const key = userId || "unknown";
        let summary = usageByUser.get(key);
        if (!summary) {
            summary = emptySummary(userId, windowDays);
            usageByUser.set(key, summary);
        }
        return summary;
    };

    const conversationQuery = supabase
        .from("conversation_messages")
        .select("user_id, role, token_count, content, created_at")
        .gte("created_at", since!);
    const legacyQuery = supabase
        .from("messages")
        .select("user_id, role, content, created_at")
        .gte("created_at", since!);

    const [conversationRes, legacyRes] = await Promise.all([conversationQuery, legacyQuery]);

    if (!conversationRes.error) {
        for (const row of conversationRes.data ?? []) addRow(getSummary(row.user_id ?? null), row as TokenUsageRow);
    }
    if (!legacyRes.error) {
        for (const row of legacyRes.data ?? []) addRow(getSummary(row.user_id ?? null), row as TokenUsageRow);
    }

    usageByUser.forEach(finalize);
    return usageByUser;
}


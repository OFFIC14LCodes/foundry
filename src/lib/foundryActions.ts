import { supabase } from "../supabase";
import type { AcademyContent } from "./academy";
import {
    BUSINESS_MODEL_CANVAS_LABELS,
    type BusinessModelCanvasWeakness,
} from "./businessModelCanvas";

export type FoundryActionSourceModule =
    | "forge"
    | "academy"
    | "market_intelligence"
    | "weekly_intelligence"
    | "finance"
    | "strategy"
    | "document_vault"
    | "journal"
    | "system";

export type FoundryActionType =
    | "task"
    | "canvas_update"
    | "document_create"
    | "document_review"
    | "finance_review"
    | "market_followup"
    | "academy_apply"
    | "journal_reflection"
    | "forge_followup"
    | "stage_gate";

export type FoundryActionStatus = "suggested" | "accepted" | "in_progress" | "completed" | "dismissed";
export type FoundryActionPriority = "low" | "medium" | "high" | "critical";
export type FoundryActionOutcomeType = "success" | "partial" | "failed" | "unknown";

const OPEN_ACTION_STATUSES: FoundryActionStatus[] = ["suggested", "accepted", "in_progress"];
const PRIORITY_ORDER: FoundryActionPriority[] = ["low", "medium", "high", "critical"];

export type FoundryActionSuggestion = {
    title: string;
    description: string;
    sourceModule: FoundryActionSourceModule;
    sourceType: string;
    sourceId?: string | null;
    actionType: FoundryActionType;
    priority?: FoundryActionPriority;
    dueDate?: string | null;
    metadata?: Record<string, unknown>;
};

export type FoundryAction = FoundryActionSuggestion & {
    id: string;
    userId: string;
    status: FoundryActionStatus;
    priority: FoundryActionPriority;
    outcomeType: FoundryActionOutcomeType | null;
    outcomeNotes: string | null;
    outcomeScore: number | null;
    outcomeRecordedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type FoundryActionOutcome = {
    actionId: string;
    outcomeType: FoundryActionOutcomeType | null;
    outcomeNotes: string | null;
    outcomeScore: number | null;
    outcomeRecordedAt: string | null;
};

export type RecentActionOutcomeContext = {
    title: string;
    sourceModule: FoundryActionSourceModule;
    outcomeType: FoundryActionOutcomeType;
    outcomeScore: number | null;
    outcomeNotes: string | null;
};

type SimilarActionOutcome = {
    title: string;
    sourceModule: FoundryActionSourceModule;
    sourceType: string;
    actionType: FoundryActionType;
    outcomeType: FoundryActionOutcomeType;
};

function mapAction(row: any): FoundryAction {
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        description: row.description ?? "",
        sourceModule: row.source_module,
        sourceType: row.source_type,
        sourceId: row.source_id ?? null,
        actionType: row.action_type,
        status: row.status,
        priority: row.priority ?? "medium",
        dueDate: row.due_date ?? null,
        outcomeType: row.outcome_type ?? null,
        outcomeNotes: row.outcome_notes ?? null,
        outcomeScore: row.outcome_score ?? null,
        outcomeRecordedAt: row.outcome_recorded_at ?? null,
        completedAt: row.completed_at ?? null,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function toActionPayload(userId: string, suggestion: FoundryActionSuggestion) {
    return {
        user_id: userId,
        title: suggestion.title.trim(),
        description: suggestion.description.trim(),
        source_type: suggestion.sourceType.trim() || "insight",
        source_id: suggestion.sourceId ?? null,
        source_module: suggestion.sourceModule,
        action_type: suggestion.actionType,
        priority: suggestion.priority ?? "medium",
        due_date: suggestion.dueDate ?? null,
        metadata: suggestion.metadata ?? {},
        updated_at: new Date().toISOString(),
    };
}

export function buildForgePromptForAction(action: FoundryAction | FoundryActionSuggestion) {
    const dueLine = action.dueDate ? `\nDue date: ${action.dueDate}` : "";
    return `Help me execute this Foundry action.

Action: ${action.title}
Source module: ${formatActionModule(action.sourceModule)}
Source context: ${formatActionSourceType(action.sourceType)}
Action type: ${formatActionType(action.actionType)}
Priority: ${action.priority ?? "medium"}${dueLine}

Why this matters:
${action.description}

What I need help doing:
1. Identify the decision or execution risk underneath this action.
2. Give me the smallest concrete next step I can take today.
3. Define what "done" means so I know when to mark this complete.`;
}

export async function createFoundryAction(userId: string, suggestion: FoundryActionSuggestion): Promise<FoundryAction | null> {
    if (!suggestion.title.trim()) return null;
    const initialPayload = toActionPayload(userId, suggestion);

    if (suggestion.sourceId) {
        const { data: existing, error: lookupError } = await supabase
            .from("foundry_actions")
            .select("*")
            .eq("user_id", userId)
            .eq("source_module", suggestion.sourceModule)
            .eq("source_type", initialPayload.source_type)
            .eq("source_id", suggestion.sourceId)
            .eq("action_type", suggestion.actionType)
            .in("status", OPEN_ACTION_STATUSES)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lookupError) {
            console.error("createFoundryAction lookup error:", lookupError.message);
            return null;
        }

        if (existing) return mapAction(existing);
    }

    const outcomeAwareSuggestion = await applyOutcomeAwareSuggestion(userId, suggestion);
    if (!outcomeAwareSuggestion) {
        console.info("createFoundryAction suppressed by recent failed outcomes:", suggestion.title);
        return null;
    }
    const payload = toActionPayload(userId, outcomeAwareSuggestion);

    const { data, error } = await supabase
        .from("foundry_actions")
        .insert(payload)
        .select("*")
        .single();
    if (error) {
        console.error("createFoundryAction error:", error.message);
        return null;
    }
    return data ? mapAction(data) : null;
}

async function applyOutcomeAwareSuggestion(userId: string, suggestion: FoundryActionSuggestion): Promise<FoundryActionSuggestion | null> {
    const similarOutcomes = await loadSimilarActionOutcomes(userId, suggestion);
    if (similarOutcomes.length === 0) return suggestion;

    const failedCount = similarOutcomes.filter((outcome) => outcome.outcomeType === "failed").length;
    const successCount = similarOutcomes.filter((outcome) => outcome.outcomeType === "success").length;
    const partialCount = similarOutcomes.filter((outcome) => outcome.outcomeType === "partial").length;
    const mixedResults = failedCount > 0 && successCount > 0;
    if (mixedResults) return suggestion;

    const currentPriority = suggestion.priority ?? "medium";

    // First-step outcome-aware suggestion logic. This intentionally stays simple:
    // match recent completed outcomes by module/type/title keywords, then nudge priority
    // or suppress only when there is a clear repeated failure pattern. This can evolve
    // into stronger recommendation logic once Foundry has more outcome history.
    if (failedCount >= 2 && successCount === 0) {
        if (currentPriority === "low" || currentPriority === "medium") return null;
        return withOutcomeAwareness(suggestion, "recent_similar_failures", lowerPriority(currentPriority), failedCount, successCount, partialCount);
    }

    if (failedCount === 1 && successCount === 0) {
        return withOutcomeAwareness(suggestion, "recent_similar_failure", lowerPriority(currentPriority), failedCount, successCount, partialCount);
    }

    if (successCount >= 2 && failedCount === 0) {
        return withOutcomeAwareness(suggestion, "recent_similar_successes", raisePriority(currentPriority), failedCount, successCount, partialCount);
    }

    return suggestion;
}

async function loadSimilarActionOutcomes(userId: string, suggestion: FoundryActionSuggestion): Promise<SimilarActionOutcome[]> {
    const { data, error } = await supabase
        .from("foundry_actions")
        .select("title,source_module,source_type,action_type,outcome_type,outcome_recorded_at,completed_at")
        .eq("user_id", userId)
        .eq("status", "completed")
        .not("outcome_type", "is", null)
        .order("outcome_recorded_at", { ascending: false, nullsFirst: false })
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(20);

    if (error) {
        console.error("loadSimilarActionOutcomes error:", error.message);
        return [];
    }

    const suggestionKeywords = getActionKeywords(suggestion.title);
    return (data ?? [])
        .filter((row: any) => {
            const sameSourceAndType = row.source_module === suggestion.sourceModule
                && row.source_type === suggestion.sourceType
                && row.action_type === suggestion.actionType;
            const overlap = countKeywordOverlap(suggestionKeywords, getActionKeywords(row.title ?? ""));
            const specificEnoughTypeMatch = sameSourceAndType && overlap >= 1;
            const similarTitle = overlap >= 2 || (overlap >= 1 && row.source_module === suggestion.sourceModule && row.source_type === suggestion.sourceType);
            return specificEnoughTypeMatch || similarTitle;
        })
        .slice(0, 8)
        .map((row: any) => ({
            title: row.title,
            sourceModule: row.source_module,
            sourceType: row.source_type,
            actionType: row.action_type,
            outcomeType: row.outcome_type,
        }));
}

function withOutcomeAwareness(
    suggestion: FoundryActionSuggestion,
    adjustment: string,
    priority: FoundryActionPriority,
    failedCount: number,
    successCount: number,
    partialCount: number,
): FoundryActionSuggestion {
    return {
        ...suggestion,
        priority,
        metadata: {
            ...(suggestion.metadata ?? {}),
            outcomeAware: {
                adjustment,
                failedCount,
                successCount,
                partialCount,
            },
        },
    };
}

function raisePriority(priority: FoundryActionPriority): FoundryActionPriority {
    return PRIORITY_ORDER[Math.min(PRIORITY_ORDER.length - 1, PRIORITY_ORDER.indexOf(priority) + 1)];
}

function lowerPriority(priority: FoundryActionPriority): FoundryActionPriority {
    return PRIORITY_ORDER[Math.max(0, PRIORITY_ORDER.indexOf(priority) - 1)];
}

function getActionKeywords(value: string) {
    const stopWords = new Set([
        "this", "that", "with", "from", "into", "your", "business", "action", "stage", "week", "move",
        "apply", "choose", "decide", "check", "tighten", "review", "compare", "against", "operating",
    ]);
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3 && !stopWords.has(word));
}

function countKeywordOverlap(left: string[], right: string[]) {
    const rightSet = new Set(right);
    return new Set(left.filter((word) => rightSet.has(word))).size;
}

export async function loadFoundryAction(userId: string, actionId: string): Promise<FoundryAction | null> {
    const { data, error } = await supabase
        .from("foundry_actions")
        .select("*")
        .eq("user_id", userId)
        .eq("id", actionId)
        .maybeSingle();
    if (error) {
        console.error("loadFoundryAction error:", error.message);
        return null;
    }
    return data ? mapAction(data) : null;
}

export async function loadFoundryActionsByUser(userId: string): Promise<FoundryAction[]> {
    const { data, error } = await supabase
        .from("foundry_actions")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
    if (error) {
        console.error("loadFoundryActionsByUser error:", error.message);
        throw error;
    }
    return (data ?? []).map(mapAction);
}

export async function loadOpenFoundryActionsByUser(userId: string): Promise<FoundryAction[]> {
    const { data, error } = await supabase
        .from("foundry_actions")
        .select("*")
        .eq("user_id", userId)
        .in("status", ["suggested", "accepted", "in_progress"])
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false });
    if (error) {
        console.error("loadOpenFoundryActionsByUser error:", error.message);
        return [];
    }
    return (data ?? []).map(mapAction);
}

export async function updateFoundryActionStatus(userId: string, actionId: string, status: FoundryActionStatus): Promise<FoundryAction | null> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from("foundry_actions")
        .update({
            status,
            completed_at: status === "completed" ? now : null,
            updated_at: now,
        })
        .eq("user_id", userId)
        .eq("id", actionId)
        .select("*")
        .single();
    if (error) {
        console.error("updateFoundryActionStatus error:", error.message);
        return null;
    }
    return data ? mapAction(data) : null;
}

export function completeFoundryAction(userId: string, actionId: string) {
    return updateFoundryActionStatus(userId, actionId, "completed");
}

export function dismissFoundryAction(userId: string, actionId: string) {
    return updateFoundryActionStatus(userId, actionId, "dismissed");
}

export async function recordActionOutcome(
    actionId: string,
    outcomeType: FoundryActionOutcomeType,
    notes?: string | null,
    score?: number | null,
): Promise<FoundryAction | null> {
    const normalizedScore = typeof score === "number" && Number.isFinite(score)
        ? Math.max(1, Math.min(5, Math.round(score)))
        : null;
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from("foundry_actions")
        .update({
            outcome_type: outcomeType,
            outcome_notes: notes?.trim() || null,
            outcome_score: normalizedScore,
            outcome_recorded_at: now,
            updated_at: now,
        })
        .eq("id", actionId)
        .select("*")
        .single();

    if (error) {
        console.error("recordActionOutcome error:", error.message);
        return null;
    }
    return data ? mapAction(data) : null;
}

export async function loadActionOutcome(actionId: string): Promise<FoundryActionOutcome | null> {
    const { data, error } = await supabase
        .from("foundry_actions")
        .select("id,outcome_type,outcome_notes,outcome_score,outcome_recorded_at")
        .eq("id", actionId)
        .maybeSingle();

    if (error) {
        console.error("loadActionOutcome error:", error.message);
        return null;
    }

    return data ? {
        actionId: data.id,
        outcomeType: data.outcome_type ?? null,
        outcomeNotes: data.outcome_notes ?? null,
        outcomeScore: data.outcome_score ?? null,
        outcomeRecordedAt: data.outcome_recorded_at ?? null,
    } : null;
}

export async function loadRecentActionOutcomesForForge(userId: string, limit = 8): Promise<RecentActionOutcomeContext[]> {
    const { data, error } = await supabase
        .from("foundry_actions")
        .select("title,source_module,outcome_type,outcome_score,outcome_notes,outcome_recorded_at,completed_at")
        .eq("user_id", userId)
        .eq("status", "completed")
        .not("outcome_type", "is", null)
        .order("outcome_recorded_at", { ascending: false, nullsFirst: false })
        .order("completed_at", { ascending: false, nullsFirst: false })
        .limit(Math.max(1, Math.min(10, limit)));

    if (error) {
        console.error("loadRecentActionOutcomesForForge error:", error.message);
        return [];
    }

    return (data ?? []).map((row: any) => ({
        title: row.title,
        sourceModule: row.source_module,
        outcomeType: row.outcome_type,
        outcomeScore: row.outcome_score ?? null,
        outcomeNotes: row.outcome_notes ?? null,
    }));
}

export function buildRecentActionOutcomesContext(outcomes: RecentActionOutcomeContext[]) {
    if (outcomes.length === 0) return "";

    const lines = outcomes.map((outcome) => {
        const score = outcome.outcomeScore ? `, score ${outcome.outcomeScore}/5` : "";
        const title = sanitizeOutcomeContextText(outcome.title, 90);
        const notesText = outcome.outcomeNotes ? sanitizeOutcomeContextText(outcome.outcomeNotes, 160) : "";
        const notes = notesText ? ` (notes: ${notesText})` : "";
        return `- "${title}" from ${formatActionModule(outcome.sourceModule)} -> ${formatOutcomeLabel(outcome.outcomeType)}${score}${notes}`;
    });

    return `RECENT ACTION OUTCOMES:
${lines.join("\n")}`;
}

function sanitizeOutcomeContextText(value: string, maxLength: number) {
    return value
        .replace(/\s+/g, " ")
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .trim()
        .slice(0, maxLength);
}

export async function deleteFoundryAction(userId: string, actionId: string): Promise<boolean> {
    const { error } = await supabase
        .from("foundry_actions")
        .delete()
        .eq("user_id", userId)
        .eq("id", actionId);
    if (error) {
        console.error("deleteFoundryAction error:", error.message);
        return false;
    }
    return true;
}

export function suggestActionFromMarketInsight(input: {
    kind: "competitor" | "trend" | "benchmark";
    id: string;
    name: string;
    description?: string | null;
    impactLevel?: string | null;
}): FoundryActionSuggestion {
    const impact = input.impactLevel?.toLowerCase();
    const priority: FoundryActionPriority = impact === "critical"
        ? "critical"
        : impact === "high"
            ? "high"
            : impact === "low"
                ? "low"
                : "medium";
    const fallbackContext = input.kind === "competitor"
        ? `${input.name} showed up in market research. Check whether your positioning, pricing, or target buyer still looks defensible against this competitor.`
        : input.kind === "trend"
            ? `${input.name} showed up in market research. Decide whether this trend changes your roadmap, messaging, or customer-discovery questions.`
            : `${input.name} showed up as a benchmark. Use it to check whether your current assumptions are realistic enough to run the business.`;
    return {
        title: input.kind === "competitor"
            ? `Compare positioning against ${input.name}`
            : input.kind === "trend"
                ? `Decide what ${input.name} changes`
                : `Check assumptions against ${input.name}`,
        description: input.description
            ? `This ${input.kind} appeared in market research: ${input.description}`
            : fallbackContext,
        sourceModule: "market_intelligence",
        sourceType: input.kind,
        sourceId: input.id,
        actionType: "market_followup",
        priority,
        metadata: { insightName: input.name, impactLevel: input.impactLevel ?? null },
    };
}

export function suggestActionFromWeeklyBriefing(input: {
    id: string;
    content: string;
    stageId?: number | null;
}): FoundryActionSuggestion {
    const preview = input.content.replace(/\s+/g, " ").trim().slice(0, 520);
    return {
        title: input.stageId
            ? `Choose a Stage ${input.stageId} move`
            : "Choose this week's operating move",
        description: `This briefing is only useful if it changes the week. Use the signal below to pick one decision, experiment, or follow-up to move forward.\n\nBriefing signal: ${preview}`,
        sourceModule: "weekly_intelligence",
        sourceType: "briefing",
        sourceId: input.id,
        actionType: "forge_followup",
        priority: "medium",
        metadata: { stageId: input.stageId ?? null, preview },
    };
}

export function suggestActionFromFinanceRisk(input: {
    id?: string | null;
    title: string;
    description: string;
    priority?: FoundryActionPriority;
}): FoundryActionSuggestion {
    const title = /^(review|check|update|fix|decide|compare|audit|reduce|increase|model|forecast)\b/i.test(input.title.trim())
        ? input.title.trim()
        : `Review ${input.title.trim()}`;
    return {
        title,
        description: `${input.description} This matters because financial risks become expensive when they stay implicit in the model.`,
        sourceModule: "finance",
        sourceType: "risk",
        sourceId: input.id ?? null,
        actionType: "finance_review",
        priority: input.priority ?? "high",
    };
}

export function suggestActionFromAcademyLesson(content: AcademyContent): FoundryActionSuggestion {
    const lessonContext = content.learningGoal || content.forgeContext || content.starterPrompt || "This lesson should change a real decision, message, workflow, or operating habit.";
    return {
        title: `Apply ${content.title}`,
        description: `You finished the lesson. Now turn it into execution: ${lessonContext}`,
        sourceModule: "academy",
        sourceType: "lesson",
        sourceId: content.id,
        actionType: "academy_apply",
        priority: "medium",
        metadata: { lessonTitle: content.title, stageIds: content.stageIds },
    };
}

export function suggestActionFromCanvasWeakness(weakness: BusinessModelCanvasWeakness): FoundryActionSuggestion {
    const label = BUSINESS_MODEL_CANVAS_LABELS[weakness.section];
    return {
        title: `Tighten ${label}`,
        description: `${label} is a weak part of the canvas: ${weakness.message} This matters because unclear canvas sections turn into vague positioning, sales, and product decisions.`,
        sourceModule: "strategy",
        sourceType: "canvas_weakness",
        sourceId: weakness.section,
        actionType: "canvas_update",
        priority: weakness.severity === "empty" ? "high" : "medium",
        metadata: { section: weakness.section, severity: weakness.severity },
    };
}

export function formatActionModule(module: FoundryActionSourceModule) {
    const labels: Record<FoundryActionSourceModule, string> = {
        forge: "Forge Chat",
        academy: "Forge Academy",
        market_intelligence: "Market Intelligence",
        weekly_intelligence: "Weekly Intelligence",
        finance: "Finance",
        strategy: "Strategy",
        document_vault: "Document Vault",
        journal: "Journal",
        system: "System",
    };
    return labels[module];
}

export function formatActionType(type: FoundryActionType) {
    const labels: Record<FoundryActionType, string> = {
        task: "Task",
        canvas_update: "Canvas update",
        document_create: "Create document",
        document_review: "Review document",
        finance_review: "Finance review",
        market_followup: "Market follow-up",
        academy_apply: "Apply lesson",
        journal_reflection: "Journal reflection",
        forge_followup: "Forge follow-up",
        stage_gate: "Stage gate",
    };
    return labels[type];
}

export function formatActionSourceType(sourceType: string) {
    const labels: Record<string, string> = {
        insight: "Insight",
        competitor: "Competitor",
        trend: "Trend",
        benchmark: "Benchmark",
        briefing: "Weekly briefing",
        risk: "Finance risk",
        lesson: "Academy lesson",
        canvas_weakness: "Canvas weak spot",
        market_change: "Market change",
    };
    return labels[sourceType] ?? sourceType.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

export function formatOutcomeLabel(outcomeType: FoundryActionOutcomeType) {
    const labels: Record<FoundryActionOutcomeType, string> = {
        success: "Success",
        partial: "Partial",
        failed: "Failed",
        unknown: "Unknown",
    };
    return labels[outcomeType];
}

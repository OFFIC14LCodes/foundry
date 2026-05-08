import { supabase } from "./supabase";
import { OWNER_EMAIL, hasAdminAccess, isOwnerRole, normalizeEmail, normalizeUserRole } from "./lib/roles";
import { DOC_CATEGORIES } from "./constants/docCategories";
import {
    buildStyledDocxArtifact,
    buildStyledHtmlArtifact,
    type DocumentExportMeta,
} from "./lib/documentExport";
import {
    MEANINGFUL_ACTIVITY_THROTTLE_MS,
    DEFAULT_ADMIN_NOTIFICATION_SETTINGS,
    DEFAULT_USER_NOTIFICATION_PREFERENCES,
    type AdminNotificationSettings,
    type AppNotification,
    type UserNotificationPreferences,
} from "./lib/notifications";
import {
    detectMarketIntelligenceChanges,
    suggestActionFromMarketChange,
    type MarketIntelligenceDetectedChange,
    type MarketIntelligenceChangeEntityType,
    type MarketIntelligenceChangeType,
} from "./lib/marketIntelligenceChanges";

// ─────────────────────────────────────────────────────────────
// FOUNDRY DATABASE LAYER
// All Supabase reads and writes go through here.
// ─────────────────────────────────────────────────────────────

function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

let dailyChatSummariesAvailable: boolean | null = null;
let producedDocumentsAvailable: boolean | null = null;
let documentVaultAvailable: boolean | null = null;
let documentTemplatesAvailable: boolean | null = null;
let pitchSessionsAvailable: boolean | null = null;
let conversationThreadsAvailable: boolean | null = null;

const DOCUMENT_FILE_BUCKET = "document-files";

function isMissingRelationError(error: any, relationName: string) {
    const message = String(error?.message ?? "").toLowerCase();
    return error?.code === "PGRST205" || message.includes(relationName.toLowerCase()) || message.includes("could not find the table");
}

function isMissingDocumentVaultRelationError(error: any) {
    return [
        "documents",
        "document_versions",
        "document_files",
        "document_folders",
        "document_signature_requests",
        "document_signature_events",
        "product_usage_events",
    ].some((relationName) => isMissingRelationError(error, relationName));
}

// ── PROFILE ──────────────────────────────────────────────────

export async function loadProfile(userId: string) {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
    if (error || !data) return null;

    const role = normalizeUserRole(data.role);
    const setupCompleted = data.setup_completed ?? Boolean(
        data.idea ||
        data.business_name ||
        (data.current_stage ?? 1) > 1
    );

    // Reshape from DB columns back into the profile shape the app expects
    return {
        name: data.name,
        idea: data.idea,
        businessName: data.business_name,
        industry: data.industry,
        strategy: data.strategy,
        strategyLabel: data.strategy_label,
        experience: data.experience,
        currentStage: data.current_stage ?? 1,
        budget: {
            total: data.exact_budget_amount ?? data.budget_total ?? 0,
            spent: data.budget_spent ?? 0,
            remaining: data.budget_remaining ?? (data.exact_budget_amount ?? data.budget_total ?? 0),
            runway: data.budget_runway ?? "TBD",
            expenses: data.expenses ?? [],
        },
        budgetRange: data.budget_range ?? null,
        exactBudgetAmount: data.exact_budget_amount ?? data.budget_total ?? 0,
        budgetIsEstimated: data.budget_is_estimated ?? false,
        glossaryLearned: data.glossary_learned ?? [],
        decisions: data.decisions ?? [],
        setupCompleted,
        role,
        isAdmin: hasAdminAccess(role),
        isOwner: isOwnerRole(role),
        email: data.email ?? null,
        lastActiveAt: data.last_active_at ?? null,
    };
}

const _activityTouchCache = new Map<string, number>();

export async function saveProfile(userId: string, profile: any) {
    if (!profile) return;
    const { error } = await supabase.from("profiles").upsert({
        id: userId,
        email: profile.email ?? null,
        name: profile.name,
        idea: profile.idea,
        business_name: profile.businessName,
        industry: profile.industry,
        strategy: profile.strategy,
        strategy_label: profile.strategyLabel,
        experience: profile.experience,
        current_stage: profile.currentStage ?? 1,
        setup_completed: profile.setupCompleted ?? false,
        budget_total: profile.budget?.total ?? 0,
        budget_spent: profile.budget?.spent ?? 0,
        budget_remaining: profile.budget?.remaining ?? 0,
        budget_runway: profile.budget?.runway ?? "TBD",
        budget_range: profile.budgetRange ?? null,
        exact_budget_amount: profile.exactBudgetAmount ?? profile.budget?.total ?? 0,
        budget_is_estimated: profile.budgetIsEstimated ?? false,
        expenses: profile.budget?.expenses ?? [],
        glossary_learned: profile.glossaryLearned ?? [],
        decisions: profile.decisions ?? [],
        updated_at: new Date().toISOString(),
    });
    if (error) console.error("saveProfile error:", error.message);
}

export async function ensureUserProfile(userId: string, user?: { email?: string | null; user_metadata?: Record<string, any> | null }) {
    const { error } = await supabase
        .from("profiles")
        .upsert({
            id: userId,
            email: user?.email ?? null,
            updated_at: new Date().toISOString(),
        }, { onConflict: "id", ignoreDuplicates: true });

    if (error) {
        console.error("ensureUserProfile error:", error.message);
    }
    return !error;
}

// ── STAGE PROGRESS ────────────────────────────────────────────

export async function loadAllStageProgress(userId: string) {
    const { data, error } = await supabase
        .from("stage_progress")
        .select("*")
        .eq("user_id", userId);

    const result: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    if (error || !data) return result;
    data.forEach(row => {
        result[row.stage_id] = row.completed_milestones ?? [];
    });
    return result;
}

export async function saveStageProgress(userId: string, stageId: number, completedMilestones: string[]) {
    const { error } = await supabase.from("stage_progress").upsert({
        user_id: userId,
        stage_id: stageId,
        completed_milestones: completedMilestones,
        updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,stage_id" });
    if (error) console.error("saveStageProgress error:", error.message);
}

export async function saveStageEnteredAt(userId: string, stageId: number, enteredAt = new Date().toISOString()) {
    const { data: existing, error: loadError } = await supabase
        .from("stage_progress")
        .select("completed_milestones")
        .eq("user_id", userId)
        .eq("stage_id", stageId)
        .maybeSingle();

    if (loadError) {
        console.error("saveStageEnteredAt load error:", loadError.message);
        return;
    }

    const { error } = await supabase.from("stage_progress").upsert({
        user_id: userId,
        stage_id: stageId,
        completed_milestones: existing?.completed_milestones ?? [],
        stage_entered_at: enteredAt,
        updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,stage_id" });
    if (error) console.error("saveStageEnteredAt error:", error.message);
}

// ── MESSAGES ──────────────────────────────────────────────────

export type ConversationThread = {
    id: string;
    userId: string;
    stageId: number;
    summaryId: string | null;
    createdAt: string;
    lastMessageAt: string | null;
};

export type ConversationMessage = {
    id: string;
    threadId: string;
    userId: string;
    role: "user" | "forge" | "assistant" | "system";
    text: string;
    createdAt: string;
    tokenCount: number;
    attachments?: MessageAttachment[];
};

export type MessageAttachment = {
    id: string;
    messageId: string;
    fileName: string;
    fileType: string;
    storagePath: string;
    createdAt: string;
};

function isMissingConversationThreadRelationError(error: any) {
    return ["conversation_threads", "conversation_messages", "message_attachments"].some((relationName) => isMissingRelationError(error, relationName));
}

function estimateTokenCount(content: string) {
    return Math.max(1, Math.ceil(String(content || "").length / 4));
}

function mapConversationThread(row: any): ConversationThread {
    return {
        id: row.id,
        userId: row.user_id,
        stageId: Number(row.stage_id),
        summaryId: row.summary_id ?? null,
        createdAt: row.created_at,
        lastMessageAt: row.last_message_at ?? null,
    };
}

function mapMessageAttachment(row: any): MessageAttachment {
    return {
        id: row.id,
        messageId: row.message_id,
        fileName: row.file_name,
        fileType: row.file_type,
        storagePath: row.storage_path,
        createdAt: row.created_at,
    };
}

function mapConversationMessage(row: any): ConversationMessage {
    const attachments = Array.isArray(row.message_attachments) ? row.message_attachments.map(mapMessageAttachment) : undefined;
    return {
        id: row.id,
        threadId: row.thread_id,
        userId: row.user_id,
        role: row.role,
        text: row.content ?? "",
        createdAt: row.created_at,
        tokenCount: Number(row.token_count ?? 0),
        attachments,
    };
}

const _activeThreadCache = new Map<string, ConversationThread>();
const _savedLocalMessageIds = new Set<string>();

export async function createConversationThread(userId: string, stageId: number, summaryId?: string | null): Promise<ConversationThread | null> {
    if (conversationThreadsAvailable === false) return null;
    const { data, error } = await supabase
        .from("conversation_threads")
        .insert({ user_id: userId, stage_id: stageId, summary_id: summaryId ?? null })
        .select("*")
        .single();
    if (error || !data) {
        if (isMissingConversationThreadRelationError(error)) {
            conversationThreadsAvailable = false;
            return null;
        }
        console.error("createConversationThread error:", error?.message);
        return null;
    }
    conversationThreadsAvailable = true;
    const thread = mapConversationThread(data);
    _activeThreadCache.set(`${userId}:${stageId}`, thread);
    return thread;
}

export async function getOrCreateConversationThread(userId: string, stageId: number): Promise<ConversationThread | null> {
    if (conversationThreadsAvailable === false) return null;
    const key = `${userId}:${stageId}`;
    const cached = _activeThreadCache.get(key);
    if (cached) return cached;

    const { data, error } = await supabase
        .from("conversation_threads")
        .select("*")
        .eq("user_id", userId)
        .eq("stage_id", stageId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        if (isMissingConversationThreadRelationError(error)) {
            conversationThreadsAvailable = false;
            return null;
        }
        console.error("getOrCreateConversationThread error:", error.message);
        return null;
    }
    if (data) {
        conversationThreadsAvailable = true;
        const thread = mapConversationThread(data);
        _activeThreadCache.set(key, thread);
        return thread;
    }
    return createConversationThread(userId, stageId);
}

export async function loadConversationMessagesPage(
    userId: string,
    stageId: number,
    options?: { before?: string | null; limit?: number },
): Promise<{ thread: ConversationThread | null; messages: ConversationMessage[]; hasMore: boolean }> {
    const thread = await getOrCreateConversationThread(userId, stageId);
    if (!thread) return { thread: null, messages: [], hasMore: false };
    const limit = Math.max(1, Math.min(100, options?.limit ?? 50));
    let query = supabase
        .from("conversation_messages")
        .select("*, message_attachments(*)")
        .eq("user_id", userId)
        .eq("thread_id", thread.id)
        .order("created_at", { ascending: false })
        .limit(limit + 1);
    if (options?.before) query = query.lt("created_at", options.before);
    const { data, error } = await query;
    if (error) {
        if (isMissingConversationThreadRelationError(error)) {
            conversationThreadsAvailable = false;
            return { thread: null, messages: [], hasMore: false };
        }
        console.error("loadConversationMessagesPage error:", error.message);
        return { thread, messages: [], hasMore: false };
    }
    conversationThreadsAvailable = true;
    const rows = data ?? [];
    const messages = rows.slice(0, limit).map(mapConversationMessage).reverse();
    messages.forEach((message) => _savedLocalMessageIds.add(`${userId}:${stageId}:${message.id}`));
    return { thread, messages, hasMore: rows.length > limit };
}

export async function loadAllMessages(userId: string) {
    const threaded: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    if (conversationThreadsAvailable !== false) {
        let loadedAnyThread = false;
        for (let stageId = 1; stageId <= 6; stageId += 1) {
            const page = await loadConversationMessagesPage(userId, stageId, { limit: 50 });
            if (page.thread) loadedAnyThread = true;
            threaded[stageId] = page.messages;
        }
        if (loadedAnyThread || conversationThreadsAvailable === true) return threaded;
    }

    const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

    const result: Record<number, any[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    if (error || !data) return result;
    data.forEach(row => {
        if (!result[row.stage_id]) result[row.stage_id] = [];
        // Deduplicate: skip if an identical (role, content) pair was already added
        // consecutively — guards against duplicate rows created by a prior race condition.
        const stage = result[row.stage_id];
        const prev = stage[stage.length - 1];
        if (prev && prev.role === row.role && prev.text === row.content) return;
        stage.push({
            id: row.id,
            role: row.role,
            text: row.content,
            createdAt: row.created_at ?? null,
        });
    });
    return result;
}

// Per-stage debounce state — coalesces rapid calls during streaming so each
// user/Forge message is appended once after text settles.
const _saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export function saveMessages(userId: string, stageId: number, messages: any[]) {
    const key = `${userId}:${stageId}`;
    clearTimeout(_saveTimers[key]);
    const snapshot = messages.slice();
    _saveTimers[key] = setTimeout(async () => {
        delete _saveTimers[key];
        if (snapshot.length === 0) return;

        if (conversationThreadsAvailable !== false) {
            const thread = await getOrCreateConversationThread(userId, stageId);
            if (thread) {
                const unsaved = snapshot.filter((m) => {
                    if (!m?.id || _savedLocalMessageIds.has(`${userId}:${stageId}:${m.id}`)) return false;
                    return String(m.text || "").trim().length > 0;
                });

                for (const message of unsaved) {
                    const createdAt = message.createdAt ?? new Date().toISOString();
                    const { data, error } = await supabase
                        .from("conversation_messages")
                        .insert({
                            thread_id: thread.id,
                            user_id: userId,
                            role: message.role,
                            content: message.text || "",
                            created_at: createdAt,
                            token_count: estimateTokenCount(message.text || ""),
                        })
                        .select("*")
                        .single();

                    if (error || !data) {
                        if (isMissingConversationThreadRelationError(error)) {
                            conversationThreadsAvailable = false;
                            break;
                        }
                        console.error("saveMessages conversation_messages error:", error?.message);
                        continue;
                    }

                    _savedLocalMessageIds.add(`${userId}:${stageId}:${message.id}`);

                    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
                    if (attachments.length > 0) {
                        const rows = attachments.map((file: any) => ({
                            message_id: data.id,
                            file_name: file.name || file.fileName || "Attachment",
                            file_type: file.mimeType || file.fileType || "application/octet-stream",
                            storage_path: file.storagePath || `inline:${file.id || file.name || data.id}`,
                        }));
                        const { error: attachmentError } = await supabase.from("message_attachments").insert(rows);
                        if (attachmentError) console.error("saveMessages message_attachments error:", attachmentError.message);
                    }

                    await supabase
                        .from("conversation_threads")
                        .update({ last_message_at: createdAt })
                        .eq("id", thread.id)
                        .eq("user_id", userId);
                }
                if (conversationThreadsAvailable !== false) return;
            }
        }

        await supabase
            .from("messages")
            .delete()
            .eq("user_id", userId)
            .eq("stage_id", stageId);

        const rows = snapshot.filter((m) => String(m.text || "").trim()).map(m => ({
            user_id: userId,
            stage_id: stageId,
            role: m.role,
            content: m.text || "",
            created_at: m.createdAt ?? new Date().toISOString(),
        }));

        if (rows.length === 0) return;
        const { error } = await supabase.from("messages").insert(rows);
        if (error) console.error("saveMessages fallback error:", error.message);
    }, 500);
}

// ── JOURNAL ───────────────────────────────────────────────────

export async function loadJournalEntries(userId: string) {
    const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map(row => ({
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        stageId: row.stage_id ?? null,
        wordCount: row.word_count ?? null,
        forgeSummary: row.forge_summary ?? null,
        themes: row.themes ?? [],
        summaryGeneratedAt: row.summary_generated_at ?? null,
        mood: row.mood ?? null,
    }));
}

export async function saveJournalEntry(userId: string, content: string, stageId?: number, wordCount?: number, mood?: string | null) {
    const { data, error } = await supabase
        .from("journal_entries")
        .insert({
            user_id: userId,
            content,
            ...(stageId != null ? { stage_id: stageId } : {}),
            ...(wordCount != null ? { word_count: wordCount } : {}),
            ...(mood != null ? { mood } : {}),
        })
        .select()
        .single();

    if (error) { console.error("saveJournalEntry error:", error.message); return null; }
    await recordMeaningfulActivity(userId, undefined, { force: true });
    return {
        id: data.id,
        content: data.content,
        createdAt: data.created_at,
        stageId: data.stage_id ?? null,
        wordCount: data.word_count ?? null,
        forgeSummary: data.forge_summary ?? null,
        themes: data.themes ?? [],
        summaryGeneratedAt: data.summary_generated_at ?? null,
        mood: data.mood ?? null,
    };
}

export async function updateJournalEntry(
    userId: string,
    entryId: string,
    content: string,
    wordCount: number,
    mood?: string | null
) {
    const { data, error } = await supabase
        .from("journal_entries")
        .update({
            content,
            word_count: wordCount,
            ...(mood !== undefined ? { mood } : {}),
            forge_summary: null,
            themes: [],
            summary_generated_at: null,
        })
        .eq("id", entryId)
        .eq("user_id", userId)
        .select()
        .single();

    if (error) { console.error("updateJournalEntry error:", error.message); return null; }
    return {
        id: data.id,
        content: data.content,
        createdAt: data.created_at,
        stageId: data.stage_id ?? null,
        wordCount: data.word_count ?? null,
        forgeSummary: null,
        themes: [] as string[],
        summaryGeneratedAt: null,
        mood: data.mood ?? null,
    };
}

export async function updateJournalEntrySummary(
    entryId: string,
    userId: string,
    summary: string,
    themes: string[]
): Promise<void> {
    const { error } = await supabase
        .from("journal_entries")
        .update({
            forge_summary: summary,
            themes,
            summary_generated_at: new Date().toISOString(),
        })
        .eq("id", entryId)
        .eq("user_id", userId);

    if (error) console.error("updateJournalEntrySummary error:", error.message);
}

export async function loadJournalEntriesWithSummaries(userId: string, limit = 50) {
    const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error || !data) return [];
    return data.map(row => ({
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        stageId: row.stage_id ?? null,
        wordCount: row.word_count ?? null,
        forgeSummary: row.forge_summary ?? null,
        themes: row.themes ?? [],
        summaryGeneratedAt: row.summary_generated_at ?? null,
        mood: row.mood ?? null,
    }));
}

// ── JOURNAL WEEKLY SUMMARIES ──────────────────────────────────

export async function loadWeeklySummary(userId: string, weekStart: string) {
    const { data } = await supabase
        .from("journal_weekly_summaries")
        .select("*")
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .maybeSingle();

    if (!data) return null;
    return {
        summaryText: data.summary_text as string,
        themes: (data.themes as string[]) ?? [],
        generatedAt: data.generated_at as string,
        entryCount: data.entry_count as number,
    };
}

export async function saveWeeklySummary(
    userId: string,
    weekStart: string,
    weekEnd: string,
    summaryText: string,
    themes: string[],
    entryCount: number
): Promise<void> {
    const { error } = await supabase
        .from("journal_weekly_summaries")
        .upsert({
            user_id: userId,
            week_start: weekStart,
            week_end: weekEnd,
            summary_text: summaryText,
            themes,
            entry_count: entryCount,
            generated_at: new Date().toISOString(),
        }, { onConflict: "user_id,week_start" });

    if (error) console.error("saveWeeklySummary error:", error.message);
}

// ── DAILY CHAT SUMMARIES ─────────────────────────────────────

export async function loadConversationSummaries(userId: string) {
    if (dailyChatSummariesAvailable === false) return [];

    const { data, error } = await supabase
        .from("daily_chat_summaries")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        if (isMissingRelationError(error, "daily_chat_summaries")) {
            dailyChatSummariesAvailable = false;
            return [];
        }
        console.error("loadConversationSummaries error:", error.message);
        return [];
    }

    dailyChatSummariesAvailable = true;
    if (!data) return [];
    return data.map((row) => ({
        id: row.id,
        userId: row.user_id,
        stageId: row.stage_id,
        date: row.summary_date,
        title: row.title,
        summary: row.summary,
        messageCount: row.message_count ?? 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
}

export async function saveConversationSummary(
    userId: string,
    stageId: number,
    summaryDate: string,
    title: string,
    summary: string,
    messageCount: number
) {
    if (dailyChatSummariesAvailable === false) return null;

    const { data, error } = await supabase
        .from("daily_chat_summaries")
        .insert({
            user_id: userId,
            stage_id: stageId,
            summary_date: summaryDate,
            title,
            summary,
            message_count: messageCount,
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        if (isMissingRelationError(error, "daily_chat_summaries")) {
            dailyChatSummariesAvailable = false;
            return null;
        }
        console.error("saveConversationSummary error:", error.message);
        return null;
    }

    dailyChatSummariesAvailable = true;
    return {
        id: data.id,
        userId: data.user_id,
        stageId: data.stage_id,
        date: data.summary_date,
        title: data.title,
        summary: data.summary,
        messageCount: data.message_count ?? 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}

export async function updateConversationSummary(
    userId: string,
    summaryId: string,
    updates: {
        stageId?: number;
        summaryDate?: string;
        title?: string;
        summary?: string;
        messageCount?: number;
    }
) {
    if (dailyChatSummariesAvailable === false) return null;

    const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
    };

    if (typeof updates.stageId === "number") payload.stage_id = updates.stageId;
    if (typeof updates.summaryDate === "string") payload.summary_date = updates.summaryDate;
    if (typeof updates.title === "string") payload.title = updates.title;
    if (typeof updates.summary === "string") payload.summary = updates.summary;
    if (typeof updates.messageCount === "number") payload.message_count = updates.messageCount;

    const { data, error } = await supabase
        .from("daily_chat_summaries")
        .update(payload)
        .eq("id", summaryId)
        .eq("user_id", userId)
        .select()
        .single();

    if (error) {
        if (isMissingRelationError(error, "daily_chat_summaries")) {
            dailyChatSummariesAvailable = false;
            return null;
        }
        console.error("updateConversationSummary error:", error.message);
        return null;
    }

    dailyChatSummariesAvailable = true;
    return {
        id: data.id,
        userId: data.user_id,
        stageId: data.stage_id,
        date: data.summary_date,
        title: data.title,
        summary: data.summary,
        messageCount: data.message_count ?? 0,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}

export async function deleteConversationSummary(userId: string, summaryId: string) {
    if (dailyChatSummariesAvailable === false) return false;

    const { error } = await supabase
        .from("daily_chat_summaries")
        .delete()
        .eq("id", summaryId)
        .eq("user_id", userId);

    if (error) {
        if (isMissingRelationError(error, "daily_chat_summaries")) {
            dailyChatSummariesAvailable = false;
            return false;
        }
        console.error("deleteConversationSummary error:", error.message);
        return false;
    }

    dailyChatSummariesAvailable = true;
    return true;
}

// ── PITCH PRACTICE SESSIONS ─────────────────────────────────

export type PitchSessionTranscriptMessage = {
    role: "user" | "forge";
    text: string;
};

export type PitchSessionRecord = {
    id: string;
    userId: string;
    scenario: string;
    mode: string;
    durationSeconds: number | null;
    transcript: PitchSessionTranscriptMessage[];
    feedback: string | null;
    clarityScore: number | null;
    confidenceScore: number | null;
    persuasivenessScore: number | null;
    brevityScore: number | null;
    overallScore: number | null;
    keyStrengths: string[];
    keyImprovements: string[];
    mostImportantFix: string | null;
    encouragement: string | null;
    createdAt: string;
};

export type PitchSessionInput = {
    scenario: string;
    mode: string;
    duration_seconds?: number | null;
    transcript: PitchSessionTranscriptMessage[];
    feedback?: string | null;
    clarity_score?: number | null;
    confidence_score?: number | null;
    persuasiveness_score?: number | null;
    brevity_score?: number | null;
    overall_score?: number | null;
    key_strengths?: string[];
    key_improvements?: string[];
    most_important_fix?: string | null;
    encouragement?: string | null;
};

function mapPitchSession(row: any): PitchSessionRecord {
    return {
        id: row.id,
        userId: row.user_id,
        scenario: row.scenario,
        mode: row.mode,
        durationSeconds: row.duration_seconds ?? null,
        transcript: Array.isArray(row.transcript) ? row.transcript : [],
        feedback: row.feedback ?? null,
        clarityScore: row.clarity_score ?? null,
        confidenceScore: row.confidence_score ?? null,
        persuasivenessScore: row.persuasiveness_score ?? null,
        brevityScore: row.brevity_score ?? null,
        overallScore: row.overall_score ?? null,
        keyStrengths: Array.isArray(row.key_strengths) ? row.key_strengths : [],
        keyImprovements: Array.isArray(row.key_improvements) ? row.key_improvements : [],
        mostImportantFix: row.most_important_fix ?? null,
        encouragement: row.encouragement ?? null,
        createdAt: row.created_at,
    };
}

export async function savePitchSession(userId: string, session: PitchSessionInput): Promise<PitchSessionRecord | null> {
    if (pitchSessionsAvailable === false) return null;

    const { data, error } = await supabase
        .from("pitch_sessions")
        .insert({
            user_id: userId,
            scenario: session.scenario,
            mode: session.mode,
            duration_seconds: session.duration_seconds ?? null,
            transcript: session.transcript ?? [],
            feedback: session.feedback ?? null,
            clarity_score: session.clarity_score ?? null,
            confidence_score: session.confidence_score ?? null,
            persuasiveness_score: session.persuasiveness_score ?? null,
            brevity_score: session.brevity_score ?? null,
            overall_score: session.overall_score ?? null,
            key_strengths: session.key_strengths ?? [],
            key_improvements: session.key_improvements ?? [],
            most_important_fix: session.most_important_fix ?? null,
            encouragement: session.encouragement ?? null,
        })
        .select()
        .single();

    if (error) {
        if (isMissingRelationError(error, "pitch_sessions")) {
            pitchSessionsAvailable = false;
            return null;
        }
        console.error("savePitchSession error:", error.message);
        return null;
    }

    pitchSessionsAvailable = true;
    return mapPitchSession(data);
}

export async function loadPitchSessions(userId: string, limit = 20): Promise<PitchSessionRecord[]> {
    if (pitchSessionsAvailable === false) return [];

    const { data, error } = await supabase
        .from("pitch_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        if (isMissingRelationError(error, "pitch_sessions")) {
            pitchSessionsAvailable = false;
            return [];
        }
        console.error("loadPitchSessions error:", error.message);
        return [];
    }

    pitchSessionsAvailable = true;
    return (data ?? []).map(mapPitchSession);
}

export async function loadPitchSessionById(userId: string, sessionId: string): Promise<PitchSessionRecord | null> {
    if (pitchSessionsAvailable === false) return null;

    const { data, error } = await supabase
        .from("pitch_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("id", sessionId)
        .single();

    if (error || !data) {
        if (error && isMissingRelationError(error, "pitch_sessions")) {
            pitchSessionsAvailable = false;
            return null;
        }
        if (error) console.error("loadPitchSessionById error:", error.message);
        return null;
    }

    pitchSessionsAvailable = true;
    return mapPitchSession(data);
}

export async function deleteJournalEntry(userId: string, entryId: string) {
    const { error } = await supabase
        .from("journal_entries")
        .delete()
        .eq("id", entryId)
        .eq("user_id", userId);

    if (error) console.error("deleteJournalEntry error:", error.message);
}
// ── MARKET INTELLIGENCE ───────────────────────────────────────
// These structured tables will power future Market Intelligence upgrades and
// should not break the existing daily report flow backed by market_reports.

export type Competitor = {
    id: string;
    userId: string;
    name: string;
    description: string;
    website: string | null;
    createdAt: string;
    summary?: string | null;
    strengths?: unknown[];
    weaknesses?: unknown[];
    pricingNotes?: string | null;
    positioning?: string | null;
    timesSpotted?: number;
    firstSeenAt?: string | null;
    latestReportId?: string | null;
};

export type CompetitorSnapshot = {
    id: string;
    competitorId: string;
    reportId: string | null;
    snapshotDate: string | null;
    summary: string;
    strengths: unknown[];
    weaknesses: unknown[];
    pricingNotes: string | null;
    positioning: string | null;
    createdAt: string;
};

export type MarketTrend = {
    id: string;
    userId: string;
    name: string;
    description: string;
    impactLevel: string;
    timeframe: string;
    createdAt: string;
    recurrenceCount?: number;
    firstSeenAt?: string | null;
    latestReportId?: string | null;
};

export type TrendSnapshot = {
    id: string;
    userId: string;
    trendName: string;
    reportId: string | null;
    snapshotDate: string;
    impactLevel: string;
    notes: string;
    createdAt: string;
};

export type IndustryBenchmark = {
    id: string;
    userId: string;
    metric: string;
    value: string;
    unit: string | null;
    description: string;
    createdAt: string;
};

export type MarketBenchmarkSnapshot = {
    id: string;
    userId: string;
    reportId: string;
    metric: string;
    value: string;
    unit: string | null;
    createdAt: string;
};

export type MarketReportSource = {
    id: string;
    reportId: string;
    title: string;
    url: string;
    snippet: string;
    createdAt: string;
};

export type MarketIntelligenceChange = {
    id: string;
    userId: string;
    reportId: string;
    actionId: string | null;
    entityType: MarketIntelligenceChangeEntityType;
    entityName: string;
    changeType: MarketIntelligenceChangeType;
    changeSummary: string;
    changeReason: string | null;
    createdAt: string;
    actionStatus?: string | null;
    actionOutcomeType?: string | null;
    actionOutcomeNotes?: string | null;
};

// This is the bridge between freeform daily market reports and the future
// structured Market Intelligence system. Future versions can use Forge or a
// server-side research API to extract structured data from market_reports
// content. This must not affect the current market_reports generation/save flow.
export type NormalizedCompetitorInsight = {
    name: string;
    description: string;
    website: string | null;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    pricingNotes: string | null;
    positioning: string | null;
};

export type NormalizedTrendInsight = {
    name: string;
    description: string;
    impactLevel: string;
    timeframe: string;
};

export type NormalizedBenchmarkInsight = {
    metric: string;
    value: string;
    unit: string | null;
    description: string;
};

export type NormalizedSourceInsight = {
    title: string;
    url: string;
    snippet: string;
};

type MarketReportSourceReference = {
    title: string;
    url: string;
    snippet?: string | null;
};

export type NormalizedMarketIntelligence = {
    reportId: string;
    userId: string;
    industry: string | null;
    date: string;
    content: string;
    competitors: NormalizedCompetitorInsight[];
    trends: NormalizedTrendInsight[];
    benchmarks: NormalizedBenchmarkInsight[];
    sources: NormalizedSourceInsight[];
};

export type SaveNormalizedMarketIntelligenceResult = {
    competitorsInserted: number;
    competitorSnapshotsInserted: number;
    trendsInserted: number;
    trendSnapshotsInserted: number;
    benchmarksInserted: number;
    benchmarkSnapshotsInserted: number;
    sourcesInserted: number;
    changesInserted: number;
    changeActionsCreated: number;
    skipped: number;
    errors: string[];
};

function mapCompetitor(row: any): Competitor {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description ?? "",
        website: row.website ?? null,
        createdAt: row.created_at,
    };
}

function mapCompetitorSnapshot(row: any): CompetitorSnapshot {
    return {
        id: row.id,
        competitorId: row.competitor_id,
        reportId: row.report_id ?? null,
        snapshotDate: row.snapshot_date ?? null,
        summary: row.summary ?? "",
        strengths: Array.isArray(row.strengths) ? row.strengths : [],
        weaknesses: Array.isArray(row.weaknesses) ? row.weaknesses : [],
        pricingNotes: row.pricing_notes ?? null,
        positioning: row.positioning ?? null,
        createdAt: row.created_at,
    };
}

function mapTrendSnapshot(row: any): TrendSnapshot {
    return {
        id: row.id,
        userId: row.user_id,
        trendName: row.trend_name,
        reportId: row.report_id ?? null,
        snapshotDate: row.snapshot_date,
        impactLevel: row.impact_level ?? "medium",
        notes: row.notes ?? "",
        createdAt: row.created_at,
    };
}

function mapMarketTrend(row: any): MarketTrend {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description ?? "",
        impactLevel: row.impact_level ?? "medium",
        timeframe: row.timeframe ?? "current",
        createdAt: row.created_at,
    };
}

function mapIndustryBenchmark(row: any): IndustryBenchmark {
    return {
        id: row.id,
        userId: row.user_id,
        metric: row.metric,
        value: row.value,
        unit: row.unit ?? null,
        description: row.description ?? "",
        createdAt: row.created_at,
    };
}

function mapMarketBenchmarkSnapshot(row: any): MarketBenchmarkSnapshot {
    return {
        id: row.id,
        userId: row.user_id,
        reportId: row.report_id,
        metric: row.metric,
        value: row.value,
        unit: row.unit ?? null,
        createdAt: row.created_at,
    };
}

function mapMarketIntelligenceChange(row: any): MarketIntelligenceChange {
    const linkedAction = Array.isArray(row.foundry_actions) ? row.foundry_actions[0] : row.foundry_actions;
    return {
        id: row.id,
        userId: row.user_id,
        reportId: row.report_id,
        actionId: row.action_id ?? null,
        entityType: row.entity_type,
        entityName: row.entity_name,
        changeType: row.change_type,
        changeSummary: row.change_summary ?? "",
        changeReason: row.change_reason ?? null,
        createdAt: row.created_at,
        actionStatus: linkedAction?.status ?? null,
        actionOutcomeType: linkedAction?.outcome_type ?? null,
        actionOutcomeNotes: linkedAction?.outcome_notes ?? null,
    };
}

function mapMarketReportSource(row: any): MarketReportSource {
    return {
        id: row.id,
        reportId: row.report_id,
        title: row.title,
        url: row.url,
        snippet: row.snippet ?? "",
        createdAt: row.created_at,
    };
}

export async function loadTodayMarketReport(userId: string) {
    const today = getLocalDateKey();
    const { data, error } = await supabase
        .from("market_reports")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .single();
    if (error || !data) return null;
    return { id: data.id, content: data.content, industry: data.industry, date: data.date, createdAt: data.created_at, searchQueries: Array.isArray(data.search_queries) ? data.search_queries : [] };
}

export async function loadLatestMarketReport(userId: string) {
    const { data, error } = await supabase
        .from("market_reports")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error || !data) return null;
    return { id: data.id, content: data.content, industry: data.industry, date: data.date, createdAt: data.created_at, searchQueries: Array.isArray(data.search_queries) ? data.search_queries : [] };
}

export async function loadMarketReportHistory(userId: string) {
    const { data, error } = await supabase
        .from("market_reports")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });

    if (error || !data) return [];
    return data.map((row) => ({
        id: row.id,
        content: row.content,
        industry: row.industry,
        date: row.date,
        createdAt: row.created_at,
        searchQueries: Array.isArray(row.search_queries) ? row.search_queries : [],
    }));
}

export async function saveMarketReport(
    userId: string,
    content: string,
    industry: string,
    options?: {
        searchQueries?: string[];
        founderContext?: Record<string, unknown> | null;
        sourceReferences?: MarketReportSourceReference[];
    },
) {
    const today = getLocalDateKey();
    const searchQueries = (options?.searchQueries ?? [])
        .filter((query) => typeof query === "string" && query.trim())
        .map((query) => query.trim())
        .slice(0, 5);
    const { data, error } = await supabase
        .from("market_reports")
        .upsert(
            {
                user_id: userId,
                date: today,
                content,
                industry,
                search_queries: searchQueries,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,date" }
        )
        .select()
        .single();
    if (error) { console.error("saveMarketReport error:", error.message); return null; }
    await recordMeaningfulActivity(userId, undefined, { force: true });
    const savedReport = { id: data.id, content: data.content, industry: data.industry, date: data.date, createdAt: data.created_at, searchQueries: Array.isArray(data.search_queries) ? data.search_queries : searchQueries };

    try {
        const { extractAndSaveMarketIntelligenceFromReport } = await import("./lib/marketIntelligencePipeline");
        await extractAndSaveMarketIntelligenceFromReport(
            userId,
            savedReport.id,
            {
                ...(options?.founderContext ?? {}),
                industry,
            },
        );
    } catch (extractionError) {
        console.error("saveMarketReport automatic extraction error:", extractionError);
    }

    await saveMarketReportSourceReferences(userId, savedReport.id, options?.sourceReferences ?? []);

    return savedReport;
}

function normalizeSourceReferences(sources: MarketReportSourceReference[]): MarketReportSourceReference[] {
    const sourcesByUrl = new Map<string, MarketReportSourceReference>();

    for (const source of sources) {
        const title = source.title?.trim();
        const url = source.url?.trim();
        if (!title || !url || sourcesByUrl.has(url)) continue;
        sourcesByUrl.set(url, {
            title,
            url,
            snippet: source.snippet?.trim() || "",
        });
    }

    return Array.from(sourcesByUrl.values()).slice(0, 25);
}

async function saveMarketReportSourceReferences(
    userId: string,
    reportId: string,
    sourceReferences: MarketReportSourceReference[],
) {
    const normalizedSources = normalizeSourceReferences(sourceReferences);
    if (normalizedSources.length === 0) return;

    for (const source of normalizedSources) {
        const { data: existingSourceRows, error: existingSourceError } = await supabase
            .from("market_report_sources")
            .select("id")
            .eq("report_id", reportId)
            .eq("url", source.url)
            .limit(1);

        if (existingSourceError) {
            console.error("saveMarketReportSourceReferences error:", existingSourceError.message);
            continue;
        }

        if ((existingSourceRows?.length ?? 0) > 0) continue;

        await createMarketReportSource(userId, reportId, {
            title: source.title,
            url: source.url,
            snippet: source.snippet ?? "",
        });
    }
}

export async function createCompetitor(
    userId: string,
    payload: { name: string; description?: string; website?: string | null },
): Promise<Competitor | null> {
    const { data, error } = await supabase
        .from("competitors")
        .insert({
            user_id: userId,
            name: payload.name,
            description: payload.description ?? "",
            website: payload.website ?? null,
        })
        .select()
        .single();

    if (error || !data) {
        console.error("createCompetitor error:", error?.message);
        return null;
    }
    return mapCompetitor(data);
}

export async function loadCompetitor(userId: string, competitorId: string): Promise<Competitor | null> {
    const { data, error } = await supabase
        .from("competitors")
        .select("*")
        .eq("user_id", userId)
        .eq("id", competitorId)
        .maybeSingle();

    if (error || !data) return null;
    return mapCompetitor(data);
}

export async function loadCompetitorsByUser(userId: string): Promise<Competitor[]> {
    const { data, error } = await supabase
        .from("competitors")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error || !data) return [];
    const competitors = data.map(mapCompetitor);
    const snapshots = await loadCompetitorSnapshotsByUser(userId);
    const snapshotsByCompetitor = snapshots.reduce<Record<string, CompetitorSnapshot[]>>((groups, snapshot) => {
        groups[snapshot.competitorId] = groups[snapshot.competitorId] || [];
        groups[snapshot.competitorId].push(snapshot);
        return groups;
    }, {});

    return competitors.map((competitor) => {
        const competitorSnapshots = snapshotsByCompetitor[competitor.id] ?? [];
        const latestSnapshot = competitorSnapshots[0] ?? null;
        return {
            ...competitor,
            summary: latestSnapshot?.summary ?? null,
            strengths: latestSnapshot?.strengths ?? [],
            weaknesses: latestSnapshot?.weaknesses ?? [],
            pricingNotes: latestSnapshot?.pricingNotes ?? null,
            positioning: latestSnapshot?.positioning ?? null,
            timesSpotted: competitorSnapshots.length,
            firstSeenAt: competitorSnapshots.length ? competitorSnapshots[competitorSnapshots.length - 1].snapshotDate || competitorSnapshots[competitorSnapshots.length - 1].createdAt : competitor.createdAt,
            latestReportId: latestSnapshot?.reportId ?? null,
        };
    });
}

export async function createCompetitorSnapshot(
    userId: string,
    competitorId: string,
    payload: {
        summary?: string;
        strengths?: unknown[];
        weaknesses?: unknown[];
        pricingNotes?: string | null;
        positioning?: string | null;
        reportId?: string | null;
        snapshotDate?: string | null;
    },
): Promise<CompetitorSnapshot | null> {
    const competitor = await loadCompetitor(userId, competitorId);
    if (!competitor) {
        console.error("createCompetitorSnapshot error:", "Competitor not found or not owned by user.");
        return null;
    }

    const { data, error } = await supabase
        .from("competitor_snapshots")
        .insert({
            competitor_id: competitorId,
            summary: payload.summary ?? "",
            strengths: payload.strengths ?? [],
            weaknesses: payload.weaknesses ?? [],
            pricing_notes: payload.pricingNotes ?? null,
            positioning: payload.positioning ?? null,
            report_id: payload.reportId ?? null,
            snapshot_date: payload.snapshotDate ?? getLocalDateKey(),
        })
        .select()
        .single();

    if (error || !data) {
        console.error("createCompetitorSnapshot error:", error?.message);
        return null;
    }
    return mapCompetitorSnapshot(data);
}

export async function loadCompetitorSnapshot(userId: string, snapshotId: string): Promise<CompetitorSnapshot | null> {
    const { data, error } = await supabase
        .from("competitor_snapshots")
        .select("id, competitor_id, report_id, snapshot_date, summary, strengths, weaknesses, pricing_notes, positioning, created_at, competitors!inner(user_id)")
        .eq("competitors.user_id", userId)
        .eq("id", snapshotId)
        .maybeSingle();

    if (error || !data) return null;
    return mapCompetitorSnapshot(data);
}

export async function loadCompetitorSnapshotsByUser(userId: string): Promise<CompetitorSnapshot[]> {
    const { data, error } = await supabase
        .from("competitor_snapshots")
        .select("id, competitor_id, report_id, snapshot_date, summary, strengths, weaknesses, pricing_notes, positioning, created_at, competitors!inner(user_id)")
        .eq("competitors.user_id", userId)
        .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map(mapCompetitorSnapshot);
}

export async function createMarketTrend(
    userId: string,
    payload: { name: string; description?: string; impactLevel?: string; timeframe?: string },
): Promise<MarketTrend | null> {
    const { data, error } = await supabase
        .from("market_trends")
        .insert({
            user_id: userId,
            name: payload.name,
            description: payload.description ?? "",
            impact_level: payload.impactLevel ?? "medium",
            timeframe: payload.timeframe ?? "current",
        })
        .select()
        .single();

    if (error || !data) {
        console.error("createMarketTrend error:", error?.message);
        return null;
    }
    return mapMarketTrend(data);
}

export async function loadMarketTrend(userId: string, trendId: string): Promise<MarketTrend | null> {
    const { data, error } = await supabase
        .from("market_trends")
        .select("*")
        .eq("user_id", userId)
        .eq("id", trendId)
        .maybeSingle();

    if (error || !data) return null;
    return mapMarketTrend(data);
}

export async function loadMarketTrendsByUser(userId: string): Promise<MarketTrend[]> {
    const { data, error } = await supabase
        .from("market_trends")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error || !data) return [];
    const trends = data.map(mapMarketTrend);
    const snapshots = await loadTrendSnapshotsByUser(userId);
    const snapshotsByName = snapshots.reduce<Record<string, TrendSnapshot[]>>((groups, snapshot) => {
        const key = snapshot.trendName.trim().toLowerCase();
        groups[key] = groups[key] || [];
        groups[key].push(snapshot);
        return groups;
    }, {});

    return trends.map((trend) => {
        const trendSnapshots = snapshotsByName[trend.name.trim().toLowerCase()] ?? [];
        const latestSnapshot = trendSnapshots[0] ?? null;
        return {
            ...trend,
            recurrenceCount: trendSnapshots.length,
            firstSeenAt: trendSnapshots.length ? trendSnapshots[trendSnapshots.length - 1].snapshotDate : trend.createdAt,
            latestReportId: latestSnapshot?.reportId ?? null,
        };
    });
}

export async function createTrendSnapshot(
    userId: string,
    payload: { trendName: string; reportId?: string | null; snapshotDate?: string | null; impactLevel?: string; notes?: string },
): Promise<TrendSnapshot | null> {
    const trendName = payload.trendName.trim();
    if (!trendName) return null;

    const { data, error } = await supabase
        .from("trend_snapshots")
        .insert({
            user_id: userId,
            trend_name: trendName,
            report_id: payload.reportId ?? null,
            snapshot_date: payload.snapshotDate ?? getLocalDateKey(),
            impact_level: payload.impactLevel ?? "medium",
            notes: payload.notes ?? "",
        })
        .select()
        .single();

    if (error || !data) {
        console.error("createTrendSnapshot error:", error?.message);
        return null;
    }

    return mapTrendSnapshot(data);
}

export async function loadTrendSnapshotsByUser(userId: string): Promise<TrendSnapshot[]> {
    const { data, error } = await supabase
        .from("trend_snapshots")
        .select("*")
        .eq("user_id", userId)
        .order("snapshot_date", { ascending: false })
        .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map(mapTrendSnapshot);
}

export async function createIndustryBenchmark(
    userId: string,
    payload: { metric: string; value: string; unit?: string | null; description?: string },
): Promise<IndustryBenchmark | null> {
    const { data, error } = await supabase
        .from("industry_benchmarks")
        .insert({
            user_id: userId,
            metric: payload.metric,
            value: payload.value,
            unit: payload.unit ?? null,
            description: payload.description ?? "",
        })
        .select()
        .single();

    if (error || !data) {
        console.error("createIndustryBenchmark error:", error?.message);
        return null;
    }
    return mapIndustryBenchmark(data);
}

export async function loadIndustryBenchmark(userId: string, benchmarkId: string): Promise<IndustryBenchmark | null> {
    const { data, error } = await supabase
        .from("industry_benchmarks")
        .select("*")
        .eq("user_id", userId)
        .eq("id", benchmarkId)
        .maybeSingle();

    if (error || !data) return null;
    return mapIndustryBenchmark(data);
}

export async function loadIndustryBenchmarksByUser(userId: string): Promise<IndustryBenchmark[]> {
    const { data, error } = await supabase
        .from("industry_benchmarks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map(mapIndustryBenchmark);
}

export async function createMarketBenchmarkSnapshot(
    userId: string,
    reportId: string,
    payload: { metric: string; value: string; unit?: string | null },
): Promise<MarketBenchmarkSnapshot | null> {
    const metric = payload.metric.trim();
    const value = payload.value.trim();
    if (!metric || !value) return null;

    const { data: ownedReport, error: reportError } = await supabase
        .from("market_reports")
        .select("id")
        .eq("user_id", userId)
        .eq("id", reportId)
        .maybeSingle();

    if (reportError || !ownedReport) return null;

    const { data, error } = await supabase
        .from("market_benchmark_snapshots")
        .insert({
            user_id: userId,
            report_id: reportId,
            metric,
            value,
            unit: payload.unit?.trim() || null,
        })
        .select()
        .single();

    if (error || !data) {
        if (error?.code === "23505") {
            const { data: existing } = await supabase
                .from("market_benchmark_snapshots")
                .select("*")
                .eq("user_id", userId)
                .eq("report_id", reportId)
                .ilike("metric", metric)
                .maybeSingle();
            return existing ? mapMarketBenchmarkSnapshot(existing) : null;
        }
        console.error("createMarketBenchmarkSnapshot error:", error?.message);
        return null;
    }

    return mapMarketBenchmarkSnapshot(data);
}

export async function loadMarketBenchmarkSnapshotsByReport(
    userId: string,
    reportId: string,
): Promise<MarketBenchmarkSnapshot[]> {
    const { data, error } = await supabase
        .from("market_benchmark_snapshots")
        .select("*")
        .eq("user_id", userId)
        .eq("report_id", reportId)
        .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map(mapMarketBenchmarkSnapshot);
}

export async function createMarketReportSource(
    userId: string,
    reportId: string,
    payload: { title: string; url: string; snippet?: string },
): Promise<MarketReportSource | null> {
    const report = await supabase
        .from("market_reports")
        .select("id")
        .eq("user_id", userId)
        .eq("id", reportId)
        .maybeSingle();

    if (report.error || !report.data) {
        console.error("createMarketReportSource error:", report.error?.message ?? "Market report not found or not owned by user.");
        return null;
    }

    const { data, error } = await supabase
        .from("market_report_sources")
        .insert({
            report_id: reportId,
            title: payload.title,
            url: payload.url,
            snippet: payload.snippet ?? "",
        })
        .select()
        .single();

    if (error || !data) {
        console.error("createMarketReportSource error:", error?.message);
        return null;
    }
    return mapMarketReportSource(data);
}

export async function loadMarketReportSource(userId: string, sourceId: string): Promise<MarketReportSource | null> {
    const { data, error } = await supabase
        .from("market_report_sources")
        .select("id, report_id, title, url, snippet, created_at, market_reports!inner(user_id)")
        .eq("market_reports.user_id", userId)
        .eq("id", sourceId)
        .maybeSingle();

    if (error || !data) return null;
    return mapMarketReportSource(data);
}

export async function loadMarketReportSourcesByUser(userId: string): Promise<MarketReportSource[]> {
    const { data, error } = await supabase
        .from("market_report_sources")
        .select("id, report_id, title, url, snippet, created_at, market_reports!inner(user_id)")
        .eq("market_reports.user_id", userId)
        .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map(mapMarketReportSource);
}

export async function normalizeMarketReportToStructuredData(
    userId: string,
    reportId: string,
): Promise<NormalizedMarketIntelligence | null> {
    const { data, error } = await supabase
        .from("market_reports")
        .select("id, user_id, industry, date, content")
        .eq("user_id", userId)
        .eq("id", reportId)
        .maybeSingle();

    if (error || !data) return null;

    return {
        reportId: data.id,
        userId: data.user_id,
        industry: data.industry ?? null,
        date: data.date,
        content: data.content ?? "",
        competitors: [],
        trends: [],
        benchmarks: [],
        sources: [],
    };
}

async function loadPreviousMarketIntelligenceForChangeDetection(
    userId: string,
    current: NormalizedMarketIntelligence,
): Promise<Pick<NormalizedMarketIntelligence, "competitors" | "trends" | "benchmarks"> | null> {
    const reportId = current.reportId?.trim();
    if (!reportId) return null;

    let previousReportQuery = supabase
        .from("market_reports")
        .select("id,date")
        .eq("user_id", userId)
        .neq("id", reportId)
        .order("date", { ascending: false })
        .limit(1);

    if (current.date) {
        previousReportQuery = previousReportQuery.lt("date", current.date);
    }

    const { data: previousReports, error: previousReportError } = await previousReportQuery;
    if (previousReportError || !previousReports?.[0]?.id) return null;

    const previousReportId = previousReports[0].id;
    const [competitorSnapshots, trendSnapshots, benchmarkSnapshots] = await Promise.all([
        supabase
            .from("competitor_snapshots")
            .select("summary,strengths,weaknesses,pricing_notes,positioning,competitors!inner(user_id,name,description,website)")
            .eq("competitors.user_id", userId)
            .eq("report_id", previousReportId),
        supabase
            .from("trend_snapshots")
            .select("*")
            .eq("user_id", userId)
            .eq("report_id", previousReportId),
        supabase
            .from("market_benchmark_snapshots")
            .select("*")
            .eq("user_id", userId)
            .eq("report_id", previousReportId),
    ]);

    if (competitorSnapshots.error || trendSnapshots.error || benchmarkSnapshots.error) return null;

    return {
        competitors: (competitorSnapshots.data ?? []).map((row: any) => {
            const competitor = Array.isArray(row.competitors) ? row.competitors[0] : row.competitors;
            return {
                name: competitor?.name ?? "",
                description: competitor?.description ?? "",
                website: competitor?.website ?? null,
                summary: row.summary ?? "",
                strengths: Array.isArray(row.strengths) ? row.strengths : [],
                weaknesses: Array.isArray(row.weaknesses) ? row.weaknesses : [],
                pricingNotes: row.pricing_notes ?? null,
                positioning: row.positioning ?? null,
            };
        }),
        trends: (trendSnapshots.data ?? []).map((row: any) => ({
            name: row.trend_name ?? "",
            description: row.notes ?? "",
            impactLevel: row.impact_level ?? "medium",
            timeframe: "current",
        })),
        benchmarks: (benchmarkSnapshots.data ?? []).map((row: any) => ({
            metric: row.metric ?? "",
            value: row.value ?? "",
            unit: row.unit ?? null,
            description: "",
        })),
    };
}

async function createMarketIntelligenceChange(
    userId: string,
    reportId: string,
    change: MarketIntelligenceDetectedChange,
): Promise<MarketIntelligenceChange | null> {
    const { data, error } = await supabase
        .from("market_intelligence_changes")
        .insert({
            user_id: userId,
            report_id: reportId,
            entity_type: change.entityType,
            entity_name: change.entityName,
            change_type: change.changeType,
            change_summary: change.changeSummary,
            change_reason: change.changeReason ?? null,
        })
        .select("*")
        .single();

    if (error) {
        if (error.code !== "23505") {
            console.error("createMarketIntelligenceChange error:", error.message);
        }
        return null;
    }

    return data ? mapMarketIntelligenceChange(data) : null;
}

async function linkMarketIntelligenceChangeAction(userId: string, changeId: string, actionId: string) {
    const { data: action, error: actionError } = await supabase
        .from("foundry_actions")
        .select("id")
        .eq("user_id", userId)
        .eq("id", actionId)
        .maybeSingle();

    if (actionError || !action) {
        console.error("linkMarketIntelligenceChangeAction error:", actionError?.message ?? "Action not found or not owned by user.");
        return;
    }

    const { error } = await supabase
        .from("market_intelligence_changes")
        .update({ action_id: actionId })
        .eq("user_id", userId)
        .eq("id", changeId);

    if (error) console.error("linkMarketIntelligenceChangeAction error:", error.message);
}

export async function loadMarketIntelligenceChangesByUser(
    userId: string,
    reportId?: string | null,
): Promise<MarketIntelligenceChange[]> {
    let query = supabase
        .from("market_intelligence_changes")
        .select("*,foundry_actions(status,outcome_type,outcome_notes)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

    if (reportId) query = query.eq("report_id", reportId);

    const { data, error } = await query;
    if (error) {
        console.error("loadMarketIntelligenceChangesByUser error:", error.message);
        return [];
    }

    return (data ?? []).map(mapMarketIntelligenceChange);
}

// This helper is the final bridge between extracted structured intelligence
// and the database, but it is intentionally not called yet. Future wiring can
// invoke it after extraction succeeds without changing the current
// market_reports generation/save flow.
export async function saveNormalizedMarketIntelligence(
    userId: string,
    normalized: NormalizedMarketIntelligence,
): Promise<SaveNormalizedMarketIntelligenceResult> {
    const result: SaveNormalizedMarketIntelligenceResult = {
        competitorsInserted: 0,
        competitorSnapshotsInserted: 0,
        trendsInserted: 0,
        trendSnapshotsInserted: 0,
        benchmarksInserted: 0,
        benchmarkSnapshotsInserted: 0,
        sourcesInserted: 0,
        changesInserted: 0,
        changeActionsCreated: 0,
        skipped: 0,
        errors: [],
    };
    const reportId = normalized.reportId?.trim();
    const previousStructured = await loadPreviousMarketIntelligenceForChangeDetection(userId, normalized);
    const detectedChanges = detectMarketIntelligenceChanges(previousStructured, normalized);

    for (const competitor of normalized.competitors ?? []) {
        const name = competitor.name?.trim();
        if (!name) {
            result.skipped += 1;
            continue;
        }

        try {
            const normalizedDescription = competitor.description?.trim() ?? "";
            const normalizedWebsite = competitor.website?.trim() || null;
            const { data: existingCompetitorRows, error: existingCompetitorError } = await supabase
                .from("competitors")
                .select("*")
                .eq("user_id", userId)
                .eq("name", name)
                .limit(1);

            if (existingCompetitorError) {
                result.skipped += 1;
                result.errors.push(`Failed to check existing competitor (${name}): ${existingCompetitorError.message}`);
                continue;
            }

            let targetCompetitor = existingCompetitorRows?.[0] ? mapCompetitor(existingCompetitorRows[0]) : null;
            if (!targetCompetitor) {
                targetCompetitor = await createCompetitor(userId, {
                    name,
                    description: normalizedDescription,
                    website: normalizedWebsite,
                });

                if (!targetCompetitor) {
                    result.skipped += 1;
                    result.errors.push(`Failed to insert competitor: ${name}`);
                    continue;
                }

                result.competitorsInserted += 1;
            } else {
                result.skipped += 1;
            }

            const hasSnapshotData = Boolean(
                competitor.summary?.trim() ||
                (competitor.strengths?.length ?? 0) > 0 ||
                (competitor.weaknesses?.length ?? 0) > 0 ||
                competitor.pricingNotes?.trim() ||
                competitor.positioning?.trim(),
            );

            if (!hasSnapshotData) continue;

            const normalizedSummary = competitor.summary?.trim() ?? "";
            const normalizedStrengths = (competitor.strengths ?? []).filter((value): value is string => Boolean(value?.trim?.())).map((value) => value.trim());
            const normalizedWeaknesses = (competitor.weaknesses ?? []).filter((value): value is string => Boolean(value?.trim?.())).map((value) => value.trim());
            const normalizedPricingNotes = competitor.pricingNotes?.trim() || null;
            const normalizedPositioning = competitor.positioning?.trim() || null;

            const { data: existingSnapshotRows, error: existingSnapshotError } = await supabase
                .from("competitor_snapshots")
                .select("*")
                .eq("competitor_id", targetCompetitor.id)
                .order("created_at", { ascending: false })
                .limit(25);

            if (existingSnapshotError) {
                result.skipped += 1;
                result.errors.push(`Failed to check existing competitor snapshot (${name}): ${existingSnapshotError.message}`);
                continue;
            }

            const duplicateSnapshot = (existingSnapshotRows ?? []).some((row) => {
                const snapshot = mapCompetitorSnapshot(row);
                return snapshot.reportId === reportId
                    && snapshot.summary === normalizedSummary
                    && JSON.stringify(snapshot.strengths) === JSON.stringify(normalizedStrengths)
                    && JSON.stringify(snapshot.weaknesses) === JSON.stringify(normalizedWeaknesses)
                    && snapshot.pricingNotes === normalizedPricingNotes
                    && snapshot.positioning === normalizedPositioning;
            });

            if (duplicateSnapshot) {
                result.skipped += 1;
                continue;
            }

            const snapshot = await createCompetitorSnapshot(userId, targetCompetitor.id, {
                summary: normalizedSummary,
                strengths: normalizedStrengths,
                weaknesses: normalizedWeaknesses,
                pricingNotes: normalizedPricingNotes,
                positioning: normalizedPositioning,
                reportId,
                snapshotDate: normalized.date || getLocalDateKey(),
            });

            if (!snapshot) {
                result.skipped += 1;
                result.errors.push(`Failed to insert competitor snapshot: ${name}`);
                continue;
            }

            result.competitorSnapshotsInserted += 1;
        } catch (error: any) {
            result.skipped += 1;
            result.errors.push(`Competitor save error (${name}): ${error?.message ?? "Unknown error"}`);
        }
    }

    for (const trend of normalized.trends ?? []) {
        const name = trend.name?.trim();
        if (!name) {
            result.skipped += 1;
            continue;
        }

        try {
            const normalizedDescription = trend.description?.trim() ?? "";
            const normalizedImpactLevel = trend.impactLevel?.trim() || "medium";
            const normalizedTimeframe = trend.timeframe?.trim() || "current";
            const { data: existingTrendRows, error: existingTrendError } = await supabase
                .from("market_trends")
                .select("id")
                .eq("user_id", userId)
                .eq("name", name)
                .limit(1);

            if (existingTrendError) {
                result.skipped += 1;
                result.errors.push(`Failed to check existing trend (${name}): ${existingTrendError.message}`);
                continue;
            }

            if ((existingTrendRows?.length ?? 0) === 0) {
                const createdTrend = await createMarketTrend(userId, {
                    name,
                    description: normalizedDescription,
                    impactLevel: normalizedImpactLevel,
                    timeframe: normalizedTimeframe,
                });

                if (!createdTrend) {
                    result.skipped += 1;
                    result.errors.push(`Failed to insert trend: ${name}`);
                    continue;
                }

                result.trendsInserted += 1;
            } else {
                result.skipped += 1;
            }

            const existingTrendSnapshot = await supabase
                .from("trend_snapshots")
                .select("id")
                .eq("user_id", userId)
                .eq("trend_name", name)
                .eq("report_id", normalized.reportId)
                .limit(1);

            if (existingTrendSnapshot.error) {
                result.errors.push(`Failed to check trend snapshot (${name}): ${existingTrendSnapshot.error.message}`);
                continue;
            }

            if ((existingTrendSnapshot.data?.length ?? 0) > 0) {
                continue;
            }

            const trendSnapshot = await createTrendSnapshot(userId, {
                trendName: name,
                reportId: normalized.reportId,
                snapshotDate: normalized.date || getLocalDateKey(),
                impactLevel: normalizedImpactLevel,
                notes: normalizedDescription,
            });

            if (trendSnapshot) {
                result.trendSnapshotsInserted += 1;
            }
        } catch (error: any) {
            result.skipped += 1;
            result.errors.push(`Trend save error (${name}): ${error?.message ?? "Unknown error"}`);
        }
    }

    for (const benchmark of normalized.benchmarks ?? []) {
        const metric = benchmark.metric?.trim();
        const value = benchmark.value?.trim();
        if (!metric || !value) {
            result.skipped += 1;
            continue;
        }

        try {
            const normalizedUnit = benchmark.unit?.trim() || null;
            if (reportId) {
                const benchmarkSnapshot = await createMarketBenchmarkSnapshot(userId, reportId, {
                    metric,
                    value,
                    unit: normalizedUnit,
                });
                if (benchmarkSnapshot) {
                    result.benchmarkSnapshotsInserted += 1;
                }
            }

            const { data: existingBenchmarkRows, error: existingBenchmarkError } = await supabase
                .from("industry_benchmarks")
                .select("id")
                .eq("user_id", userId)
                .eq("metric", metric)
                .eq("value", value)
                .eq("unit", normalizedUnit)
                .limit(1);

            if (existingBenchmarkError) {
                result.skipped += 1;
                result.errors.push(`Failed to check existing benchmark (${metric}): ${existingBenchmarkError.message}`);
                continue;
            }

            if ((existingBenchmarkRows?.length ?? 0) > 0) {
                result.skipped += 1;
                continue;
            }

            const createdBenchmark = await createIndustryBenchmark(userId, {
                metric,
                value,
                unit: normalizedUnit,
                description: benchmark.description?.trim() ?? "",
            });

            if (!createdBenchmark) {
                result.skipped += 1;
                result.errors.push(`Failed to insert benchmark: ${metric}`);
                continue;
            }

            result.benchmarksInserted += 1;
        } catch (error: any) {
            result.skipped += 1;
            result.errors.push(`Benchmark save error (${metric}): ${error?.message ?? "Unknown error"}`);
        }
    }

    for (const source of normalized.sources ?? []) {
        const title = source.title?.trim();
        const url = source.url?.trim();
        if (!reportId || !title || !url) {
            result.skipped += 1;
            continue;
        }

        try {
            const { data: existingSourceRows, error: existingSourceError } = await supabase
                .from("market_report_sources")
                .select("id")
                .eq("report_id", reportId)
                .eq("title", title)
                .eq("url", url)
                .limit(1);

            if (existingSourceError) {
                result.skipped += 1;
                result.errors.push(`Failed to check existing source (${title}): ${existingSourceError.message}`);
                continue;
            }

            if ((existingSourceRows?.length ?? 0) > 0) {
                result.skipped += 1;
                continue;
            }

            const createdSource = await createMarketReportSource(userId, reportId, {
                title,
                url,
                snippet: source.snippet?.trim() ?? "",
            });

            if (!createdSource) {
                result.skipped += 1;
                result.errors.push(`Failed to insert source: ${title}`);
                continue;
            }

            result.sourcesInserted += 1;
        } catch (error: any) {
            result.skipped += 1;
            result.errors.push(`Source save error (${title}): ${error?.message ?? "Unknown error"}`);
        }
    }

    if (reportId) {
        const allDetectedChanges = [
            ...detectedChanges.added,
            ...detectedChanges.removed,
            ...detectedChanges.changed,
        ];

        for (const change of allDetectedChanges) {
            const savedChange = await createMarketIntelligenceChange(userId, reportId, change);
            if (!savedChange) continue;

            result.changesInserted += 1;

            try {
                const { createFoundryAction } = await import("./lib/foundryActions");
                const action = await createFoundryAction(
                    userId,
                    suggestActionFromMarketChange({ ...change, id: savedChange.id }),
                );
                if (action?.id) {
                    result.changeActionsCreated += 1;
                    await linkMarketIntelligenceChangeAction(userId, savedChange.id, action.id);
                }
            } catch (error: any) {
                result.errors.push(`Change action creation failed (${change.entityName}): ${error?.message ?? "Unknown error"}`);
            }
        }
    }

    const insertedCount =
        result.competitorsInserted +
        result.competitorSnapshotsInserted +
        result.trendsInserted +
        result.trendSnapshotsInserted +
        result.benchmarksInserted +
        result.benchmarkSnapshotsInserted +
        result.sourcesInserted +
        result.changesInserted +
        result.changeActionsCreated;

    if (insertedCount === 0 && result.skipped > 0 && result.errors.length === 0) {
        result.errors.push("No structured insights could be saved from the extraction output.");
    }

    return result;
}

// ── BRIEFINGS ─────────────────────────────────────────────────

export type SavedBriefing = {
    id: string;
    content: string;
    stageId: number;
    createdAt: string;
    weekStart: string | null;
    highlights: Record<string, unknown> | null;
    sourceCounts: Record<string, number> | null;
    generatedAt: string | null;
    streakCount: number;
};

export async function loadBriefings(userId: string): Promise<SavedBriefing[]> {
    const { data, error } = await supabase
        .from("briefings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map(row => ({
        id: row.id,
        content: row.content,
        stageId: row.stage_id,
        createdAt: row.created_at,
        weekStart: row.week_start ?? null,
        highlights: (row.highlights ?? null) as Record<string, unknown> | null,
        sourceCounts: (row.source_counts ?? null) as Record<string, number> | null,
        generatedAt: row.generated_at ?? null,
        streakCount: row.streak_count ?? 1,
    }));
}

export async function saveBriefing(
    userId: string,
    content: string,
    stageId: number,
    metadata?: {
        weekStart?: string | null;
        highlights?: Record<string, unknown> | null;
        sourceCounts?: Record<string, number> | null;
        generatedAt?: string | null;
    },
): Promise<SavedBriefing | null> {
    const { data: previousBriefing } = await supabase
        .from("briefings")
        .select("created_at, streak_count")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    const previousCreatedAtMs = previousBriefing?.created_at ? new Date(previousBriefing.created_at).getTime() : NaN;
    const previousStreak = Number(previousBriefing?.streak_count ?? 0);
    const withinEightDays = Number.isFinite(previousCreatedAtMs)
        && Date.now() - previousCreatedAtMs <= 8 * 24 * 60 * 60 * 1000;
    const streakCount = withinEightDays ? Math.max(1, previousStreak) + 1 : 1;

    const { data, error } = await supabase
        .from("briefings")
        .insert({
            user_id: userId,
            content,
            stage_id: stageId,
            week_start: metadata?.weekStart ?? null,
            highlights: metadata?.highlights ?? null,
            source_counts: metadata?.sourceCounts ?? null,
            generated_at: metadata?.generatedAt ?? null,
            streak_count: streakCount,
        })
        .select()
        .single();

    if (error) { console.error("saveBriefing error:", error.message); return null; }
    await recordMeaningfulActivity(userId, undefined, { force: true });
    return {
        id: data.id,
        content: data.content,
        stageId: data.stage_id,
        createdAt: data.created_at,
        weekStart: data.week_start ?? null,
        highlights: (data.highlights ?? null) as Record<string, unknown> | null,
        sourceCounts: (data.source_counts ?? null) as Record<string, number> | null,
        generatedAt: data.generated_at ?? null,
        streakCount: data.streak_count ?? streakCount,
    };
}

// ── PRODUCED DOCUMENTS ───────────────────────────────────────

export type ProducedDocument = {
    id: string;
    userId: string;
    title: string;
    docType: string;
    audience: string;
    tone: string;
    request: string;
    content: string;
    history: Array<{ instruction: string; doc: string }>;
    createdAt: string;
    updatedAt: string;
};

export type DocumentStatus =
    | "draft"
    | "generated"
    | "reviewed"
    | "sent_for_signature"
    | "partially_signed"
    | "signed"
    | "declined"
    | "archived";

export type DocumentFileKind =
    | "source_upload"
    | "generated_pdf"
    | "generated_docx"
    | "generated_html"
    | "signed_pdf"
    | "attachment";

export type SignatureRequestStatus =
    | "draft"
    | "sent"
    | "viewed"
    | "completed"
    | "declined"
    | "expired"
    | "canceled"
    | "error";

export type DocumentVersionSource =
    | "produced_document_generate"
    | "produced_document_refine"
    | "vault_manual"
    | "system_migration"
    | "signature_provider"
    | "restored";

export type VaultDocument = {
    id: string;
    userId: string;
    businessId: string | null;
    folderId: string | null;
    sourceProducedDocumentId: string | null;
    title: string;
    docType: string;
    category: string | null;
    status: DocumentStatus;
    stageId: number | null;
    audience: string | null;
    tone: string | null;
    currentVersionId: string | null;
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
    metadata: Record<string, unknown>;
};

export type DocumentVersion = {
    id: string;
    documentId: string;
    userId: string;
    versionNumber: number;
    title: string;
    content: string;
    changeSummary: string | null;
    source: string;
    createdAt: string;
    metadata: Record<string, unknown>;
};

export type DocumentFile = {
    id: string;
    documentId: string;
    userId: string;
    versionId: string | null;
    storageBucket: string;
    storagePath: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    fileKind: DocumentFileKind;
    createdAt: string;
    metadata: Record<string, unknown>;
};

export type UploadDocumentFileOptions = {
    versionId?: string | null;
    fileKind?: DocumentFileKind;
    metadata?: Record<string, unknown>;
    mimeType?: string;
    filename?: string;
};

export type DocumentFolder = {
    id: string;
    userId: string;
    businessId: string | null;
    parentFolderId: string | null;
    name: string;
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
    metadata: Record<string, unknown>;
};

export type DocumentSignatureRequest = {
    id: string;
    documentId: string;
    userId: string;
    versionId: string | null;
    fileId: string | null;
    provider: string | null;
    providerRequestId: string | null;
    status: SignatureRequestStatus;
    signerName: string | null;
    signerEmail: string | null;
    sentAt: string | null;
    completedAt: string | null;
    declinedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
    metadata: Record<string, unknown>;
};

export type DocumentSignatureEvent = {
    id: string;
    signatureRequestId: string;
    documentId: string;
    userId: string;
    provider: string | null;
    eventType: string;
    eventStatus: SignatureRequestStatus | null;
    payload: Record<string, unknown>;
    occurredAt: string;
    createdAt: string;
};

export type DocumentTemplateField = {
    name: string;
    label: string;
    type: string;
    required?: boolean;
    placeholder?: string;
};

export type DocumentTemplate = {
    id: string;
    documentType: string;
    requiredFields: DocumentTemplateField[];
    clauseGuidelines: string;
    jurisdictionNotes: string;
    createdAt: string;
    updatedAt: string;
};

export type CreateDocumentSignatureRequestInput = {
    documentId: string;
    versionId?: string | null;
    fileId?: string | null;
    provider?: string | null;
    providerRequestId?: string | null;
    signerName?: string | null;
    signerEmail?: string | null;
    status?: SignatureRequestStatus;
    expiresAt?: string | null;
    metadata?: Record<string, unknown>;
};

export type CreateDocumentSignatureEventInput = {
    documentId: string;
    provider?: string | null;
    eventType: string;
    eventStatus?: SignatureRequestStatus | null;
    occurredAt?: string | null;
    payload?: Record<string, unknown>;
};

const DOCUMENT_STATUS_VALUES: DocumentStatus[] = [
    "draft",
    "generated",
    "reviewed",
    "sent_for_signature",
    "partially_signed",
    "signed",
    "declined",
    "archived",
];

const DOCUMENT_TEMPLATE_LOOKUP = (() => {
    const entries = new Map<string, { categoryId: string; templateId: string }>();
    DOC_CATEGORIES.forEach((category) => {
        category.documents.forEach((doc) => {
            entries.set(doc.name.trim().toLowerCase(), { categoryId: category.id, templateId: doc.id });
            entries.set(doc.id.trim().toLowerCase(), { categoryId: category.id, templateId: doc.id });
        });
    });
    return entries;
})();

function mapProducedDocument(row: any): ProducedDocument {
    return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        docType: row.doc_type,
        audience: row.audience,
        tone: row.tone,
        request: row.request ?? "",
        content: row.content,
        history: Array.isArray(row.history) ? row.history : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapVaultDocument(row: any): VaultDocument {
    return {
        id: row.id,
        userId: row.user_id,
        businessId: row.business_id ?? null,
        folderId: row.folder_id ?? null,
        sourceProducedDocumentId: row.source_produced_document_id ?? null,
        title: row.title,
        docType: row.doc_type,
        category: row.category ?? null,
        status: row.status as DocumentStatus,
        stageId: row.stage_id == null ? null : Number(row.stage_id),
        audience: row.audience ?? null,
        tone: row.tone ?? null,
        currentVersionId: row.current_version_id ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        archivedAt: row.archived_at ?? null,
        metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    };
}

function mapDocumentVersion(row: any): DocumentVersion {
    return {
        id: row.id,
        documentId: row.document_id,
        userId: row.user_id,
        versionNumber: Number(row.version_number ?? 0),
        title: row.title,
        content: row.content,
        changeSummary: row.change_summary ?? null,
        source: row.source,
        createdAt: row.created_at,
        metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    };
}

function mapDocumentFile(row: any): DocumentFile {
    return {
        id: row.id,
        documentId: row.document_id,
        userId: row.user_id,
        versionId: row.version_id ?? null,
        storageBucket: row.storage_bucket,
        storagePath: row.storage_path,
        filename: row.filename,
        mimeType: row.mime_type,
        fileSize: Number(row.file_size ?? 0),
        fileKind: row.file_kind as DocumentFileKind,
        createdAt: row.created_at,
        metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    };
}

function mapDocumentSignatureRequest(row: any): DocumentSignatureRequest {
    return {
        id: row.id,
        documentId: row.document_id,
        userId: row.user_id,
        versionId: row.version_id ?? null,
        fileId: row.file_id ?? null,
        provider: row.provider ?? null,
        providerRequestId: row.provider_request_id ?? null,
        status: row.status as SignatureRequestStatus,
        signerName: row.signer_name ?? null,
        signerEmail: row.signer_email ?? null,
        sentAt: row.sent_at ?? null,
        completedAt: row.completed_at ?? null,
        declinedAt: row.declined_at ?? null,
        expiresAt: row.expires_at ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    };
}

function mapDocumentSignatureEvent(row: any): DocumentSignatureEvent {
    return {
        id: row.id,
        signatureRequestId: row.signature_request_id,
        documentId: row.document_id,
        userId: row.user_id,
        provider: row.provider ?? null,
        eventType: row.event_type,
        eventStatus: row.event_status ?? null,
        payload: row.payload && typeof row.payload === "object" ? row.payload : {},
        occurredAt: row.occurred_at,
        createdAt: row.created_at,
    };
}

function mapDocumentFolder(row: any): DocumentFolder {
    return {
        id: row.id,
        userId: row.user_id,
        businessId: row.business_id ?? null,
        parentFolderId: row.parent_folder_id ?? null,
        name: row.name,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        archivedAt: row.archived_at ?? null,
        metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    };
}

function mapDocumentTemplate(row: any): DocumentTemplate {
    const requiredFields = Array.isArray(row.required_fields) ? row.required_fields : [];
    return {
        id: row.id,
        documentType: row.document_type,
        requiredFields: requiredFields
            .filter((field: any) => field && typeof field === "object")
            .map((field: any) => ({
                name: String(field.name ?? ""),
                label: String(field.label ?? field.name ?? ""),
                type: String(field.type ?? "text"),
                required: Boolean(field.required),
                placeholder: typeof field.placeholder === "string" ? field.placeholder : undefined,
            }))
            .filter((field: DocumentTemplateField) => field.name.length > 0),
        clauseGuidelines: row.clause_guidelines ?? "",
        jurisdictionNotes: row.jurisdiction_notes ?? "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function sanitizeStorageFileName(filename: string) {
    const trimmed = String(filename || "document").trim();
    const normalized = trimmed.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
    const collapsed = normalized.replace(/\s+/g, "_");
    const safe = collapsed.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
    return safe || "document";
}

function buildDocumentStoragePath(userId: string, documentId: string, filename: string) {
    const safeName = sanitizeStorageFileName(filename);
    const uniquePrefix = `${Date.now()}-${crypto.randomUUID()}`;
    return `users/${userId}/documents/${documentId}/${uniquePrefix}-${safeName}`;
}

function isDocumentStoragePathForUser(userId: string, path: string) {
    return path.startsWith(`users/${userId}/`);
}

function buildDocumentArtifactMeta(document: VaultDocument | null, exportMeta?: DocumentExportMeta): DocumentExportMeta {
    const metadata = document?.metadata && typeof document.metadata === "object" ? document.metadata : {};
    const businessName = typeof metadata.businessName === "string" ? metadata.businessName : "";
    const state = typeof metadata.state === "string" ? metadata.state : undefined;
    return {
        title: exportMeta?.title || document?.title || "Document",
        businessName: exportMeta?.businessName || businessName,
        docType: exportMeta?.docType || document?.docType || "Document",
        state: exportMeta?.state || state,
        date: exportMeta?.date || new Date().toLocaleDateString("en-US"),
        legalDate: exportMeta?.legalDate || new Date().toLocaleDateString("en-US"),
    };
}

function inferDocumentCategory(docType: string) {
    const normalized = String(docType || "").trim().toLowerCase();
    return DOCUMENT_TEMPLATE_LOOKUP.get(normalized)?.categoryId ?? null;
}

function inferDocumentStageId(categoryId: string | null, fallbackStageId?: number | null) {
    switch (categoryId) {
        case "legal-formation":
        case "contracts-agreements":
        case "compliance-regulatory":
        case "intellectual-property":
            return 3;
        case "business-planning":
            return 2;
        case "tax-federal":
        case "banking-finance":
        case "employment-hr":
        case "real-estate-operations":
            return 4;
        case "fundraising-investment":
            return 6;
        case "communication-marketing":
            return 5;
        default: {
            const fallback = Number(fallbackStageId);
            return Number.isFinite(fallback) && fallback >= 1 && fallback <= 6 ? Math.round(fallback) : null;
        }
    }
}

function inferDocumentTemplateId(docType: string) {
    const normalized = String(docType || "").trim().toLowerCase();
    return DOCUMENT_TEMPLATE_LOOKUP.get(normalized)?.templateId ?? null;
}

function buildProducedDocumentMetadata(document: ProducedDocument, existing?: VaultDocument | null, metadata?: Record<string, unknown>): Record<string, unknown> {
    const existingMetadata = existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {};
    return {
        ...existingMetadata,
        ...(metadata ?? {}),
        compatibilitySource: "produced_documents",
        legacyProducedDocumentId: document.id,
        templateId: inferDocumentTemplateId(document.docType),
        audience: document.audience,
        tone: document.tone,
        request: document.request,
        historyLength: document.history.length,
        lastLegacyUpdatedAt: document.updatedAt,
    };
}

function getPreservedDocumentStatus(existing?: VaultDocument | null): DocumentStatus {
    if (!existing) return "generated";
    if (["sent_for_signature", "partially_signed", "signed", "declined", "archived"].includes(existing.status)) {
        return existing.status;
    }
    return "generated";
}

function buildProducedDocumentChangeSummary(document: ProducedDocument, source: DocumentVersionSource) {
    if (source === "produced_document_generate") {
        return "Initial generated document from Document Production.";
    }

    const latestInstruction = document.history[document.history.length - 1]?.instruction?.trim();
    if (!latestInstruction) return "Updated from Document Production.";

    return latestInstruction.length > 220
        ? `${latestInstruction.slice(0, 217)}...`
        : latestInstruction;
}

async function loadLatestDocumentVersionRow(userId: string, documentId: string) {
    if (documentVaultAvailable === false) return null;

    const { data, error } = await supabase
        .from("document_versions")
        .select("*")
        .eq("user_id", userId)
        .eq("document_id", documentId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("loadLatestDocumentVersionRow error:", error.message);
        return null;
    }

    documentVaultAvailable = true;
    return data ? mapDocumentVersion(data) : null;
}

export async function loadVaultDocuments(userId: string): Promise<VaultDocument[]> {
    if (documentVaultAvailable === false) return [];

    const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return [];
        }
        console.error("loadVaultDocuments error:", error.message);
        return [];
    }

    documentVaultAvailable = true;
    return (data ?? []).map(mapVaultDocument);
}

export async function loadDocumentFolders(userId: string): Promise<DocumentFolder[]> {
    if (documentVaultAvailable === false) return [];

    const { data, error } = await supabase
        .from("document_folders")
        .select("*")
        .eq("user_id", userId)
        .is("archived_at", null)
        .order("name", { ascending: true });

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return [];
        }
        console.error("loadDocumentFolders error:", error.message);
        return [];
    }

    documentVaultAvailable = true;
    return (data ?? []).map(mapDocumentFolder);
}

export async function loadDocumentTemplates(): Promise<DocumentTemplate[]> {
    if (documentTemplatesAvailable === false) return [];

    const { data, error } = await supabase
        .from("document_templates")
        .select("*")
        .order("document_type", { ascending: true });

    if (error) {
        if (isMissingRelationError(error, "document_templates")) {
            documentTemplatesAvailable = false;
            return [];
        }
        console.error("loadDocumentTemplates error:", error.message);
        return [];
    }

    documentTemplatesAvailable = true;
    return (data ?? []).map(mapDocumentTemplate);
}

export async function createDocumentFolder(userId: string, name: string): Promise<DocumentFolder | null> {
    if (documentVaultAvailable === false) return null;

    const trimmed = String(name || "").trim();
    if (!trimmed) return null;

    const { data, error } = await supabase
        .from("document_folders")
        .insert({
            user_id: userId,
            name: trimmed,
        })
        .select("*")
        .single();

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("createDocumentFolder error:", error.message);
        return null;
    }

    documentVaultAvailable = true;
    return mapDocumentFolder(data);
}

export async function updateDocumentFolder(
    userId: string,
    folderId: string,
    updates: { name?: string; archivedAt?: string | null; metadata?: Record<string, unknown> },
): Promise<DocumentFolder | null> {
    if (documentVaultAvailable === false) return null;

    const payload: Record<string, unknown> = {};
    if (typeof updates.name === "string") payload.name = updates.name.trim();
    if ("archivedAt" in updates) payload.archived_at = updates.archivedAt ?? null;
    if (updates.metadata) payload.metadata = updates.metadata;

    const { data, error } = await supabase
        .from("document_folders")
        .update(payload)
        .eq("user_id", userId)
        .eq("id", folderId)
        .select("*")
        .single();

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("updateDocumentFolder error:", error.message);
        return null;
    }

    documentVaultAvailable = true;
    return mapDocumentFolder(data);
}

export async function moveDocumentToFolder(
    userId: string,
    documentId: string,
    folderId: string | null,
): Promise<VaultDocument | null> {
    if (documentVaultAvailable === false) return null;

    const { data, error } = await supabase
        .from("documents")
        .update({
            folder_id: folderId,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("id", documentId)
        .select("*")
        .single();

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("moveDocumentToFolder error:", error.message);
        return null;
    }

    documentVaultAvailable = true;
    return mapVaultDocument(data);
}

export async function deleteDocumentFolder(userId: string, folderId: string): Promise<boolean> {
    if (documentVaultAvailable === false) return false;

    const { error: moveError } = await supabase
        .from("documents")
        .update({
            folder_id: null,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("folder_id", folderId);

    if (moveError) {
        if (isMissingDocumentVaultRelationError(moveError)) {
            documentVaultAvailable = false;
            return false;
        }
        console.error("deleteDocumentFolder unfile documents error:", moveError.message);
        return false;
    }

    const { error } = await supabase
        .from("document_folders")
        .delete()
        .eq("user_id", userId)
        .eq("id", folderId);

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return false;
        }
        console.error("deleteDocumentFolder error:", error.message);
        return false;
    }

    documentVaultAvailable = true;
    return true;
}

export async function loadVaultDocumentById(userId: string, documentId: string): Promise<VaultDocument | null> {
    if (documentVaultAvailable === false) return null;

    const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", userId)
        .eq("id", documentId)
        .maybeSingle();

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("loadVaultDocumentById error:", error.message);
        return null;
    }

    documentVaultAvailable = true;
    return data ? mapVaultDocument(data) : null;
}

export async function createVaultDocumentFromProducedDocument(
    userId: string,
    producedDocument: ProducedDocument,
    fallbackStageId?: number | null,
    metadata?: Record<string, unknown>,
): Promise<VaultDocument | null> {
    if (documentVaultAvailable === false) return null;

    const { data: existingRow, error: existingError } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", userId)
        .eq("source_produced_document_id", producedDocument.id)
        .maybeSingle();

    if (existingError) {
        if (isMissingDocumentVaultRelationError(existingError)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("createVaultDocumentFromProducedDocument lookup error:", existingError.message);
        return null;
    }

    const existing = existingRow ? mapVaultDocument(existingRow) : null;
    const now = new Date().toISOString();
    const category = inferDocumentCategory(producedDocument.docType);
    const payload = {
        user_id: userId,
        source_produced_document_id: producedDocument.id,
        title: producedDocument.title,
        doc_type: producedDocument.docType,
        category,
        status: getPreservedDocumentStatus(existing),
        stage_id: existing?.stageId ?? inferDocumentStageId(category, fallbackStageId),
        audience: producedDocument.audience,
        tone: producedDocument.tone,
        archived_at: existing?.archivedAt ?? null,
        metadata: buildProducedDocumentMetadata(producedDocument, existing, metadata),
        updated_at: now,
    };

    const query = existing?.id
        ? supabase.from("documents").update(payload).eq("id", existing.id).eq("user_id", userId)
        : supabase.from("documents").insert(payload);

    const { data, error } = await query.select("*").single();

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("createVaultDocumentFromProducedDocument error:", error.message);
        return null;
    }

    documentVaultAvailable = true;
    return mapVaultDocument(data);
}

export async function saveDocumentVersion(
    userId: string,
    documentId: string,
    versionPayload: {
        title: string;
        content: string;
        changeSummary?: string | null;
        source: DocumentVersionSource | string;
        metadata?: Record<string, unknown>;
        status?: DocumentStatus;
    }
): Promise<DocumentVersion | null> {
    if (documentVaultAvailable === false) return null;

    const latest = await loadLatestDocumentVersionRow(userId, documentId);
    if (latest && latest.title === versionPayload.title && latest.content === versionPayload.content) {
        if (versionPayload.status) {
            await updateVaultDocumentStatus(userId, documentId, versionPayload.status);
        }
        return latest;
    }

    const nextVersionNumber = latest ? latest.versionNumber + 1 : 1;
    const { data, error } = await supabase
        .from("document_versions")
        .insert({
            document_id: documentId,
            user_id: userId,
            version_number: nextVersionNumber,
            title: versionPayload.title,
            content: versionPayload.content,
            change_summary: versionPayload.changeSummary ?? null,
            source: versionPayload.source,
            metadata: versionPayload.metadata ?? {},
        })
        .select("*")
        .single();

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("saveDocumentVersion error:", error.message);
        return null;
    }

    const version = mapDocumentVersion(data);
    const updatePayload: Record<string, unknown> = {
        title: version.title,
        current_version_id: version.id,
        updated_at: new Date().toISOString(),
    };
    if (versionPayload.status) {
        updatePayload.status = versionPayload.status;
        updatePayload.archived_at = versionPayload.status === "archived" ? new Date().toISOString() : null;
    }

    const { error: documentUpdateError } = await supabase
        .from("documents")
        .update(updatePayload)
        .eq("id", documentId)
        .eq("user_id", userId);

    if (documentUpdateError) {
        if (isMissingDocumentVaultRelationError(documentUpdateError)) {
            documentVaultAvailable = false;
            return version;
        }
        console.error("saveDocumentVersion document update error:", documentUpdateError.message);
    }

    documentVaultAvailable = true;
    return version;
}

export async function restoreVaultDocumentVersion(
    userId: string,
    documentId: string,
    versionId: string,
): Promise<DocumentVersion | null> {
    const version = (await loadDocumentVersions(userId, documentId)).find((entry) => entry.id === versionId) ?? null;
    if (!version) return null;

    await supabase
        .from("documents")
        .update({
            current_version_id: version.id,
            updated_at: new Date().toISOString(),
        })
        .eq("id", documentId)
        .eq("user_id", userId);

    return saveDocumentVersion(userId, documentId, {
        title: version.title,
        content: version.content,
        changeSummary: `Restored from version ${version.versionNumber}`,
        source: "restored",
        status: "generated",
        metadata: {
            restoredFromVersionId: version.id,
            restoredFromVersionNumber: version.versionNumber,
        },
    });
}

export async function loadDocumentVersions(userId: string, documentId: string): Promise<DocumentVersion[]> {
    if (documentVaultAvailable === false) return [];

    const { data, error } = await supabase
        .from("document_versions")
        .select("*")
        .eq("user_id", userId)
        .eq("document_id", documentId)
        .order("version_number", { ascending: false });

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return [];
        }
        console.error("loadDocumentVersions error:", error.message);
        return [];
    }

    documentVaultAvailable = true;
    return (data ?? []).map(mapDocumentVersion);
}

export async function loadDocumentFiles(userId: string, documentId: string): Promise<DocumentFile[]> {
    if (documentVaultAvailable === false) return [];

    const { data, error } = await supabase
        .from("document_files")
        .select("*")
        .eq("user_id", userId)
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return [];
        }
        console.error("loadDocumentFiles error:", error.message);
        return [];
    }

    documentVaultAvailable = true;
    return (data ?? []).map(mapDocumentFile);
}

export async function uploadDocumentFile(
    userId: string,
    documentId: string,
    file: File,
    options: UploadDocumentFileOptions = {},
): Promise<DocumentFile | null> {
    if (documentVaultAvailable === false) return null;

    const filename = options.filename || file.name || "document";
    const storagePath = buildDocumentStoragePath(userId, documentId, filename);
    const contentType = options.mimeType || file.type || "application/octet-stream";
    const fileKind = options.fileKind ?? "attachment";

    const { error: uploadError } = await supabase
        .storage
        .from(DOCUMENT_FILE_BUCKET)
        .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType,
        });

    if (uploadError) {
        console.error("uploadDocumentFile storage error:", uploadError.message);
        return null;
    }

    const { data, error } = await supabase
        .from("document_files")
        .insert({
            document_id: documentId,
            user_id: userId,
            version_id: options.versionId ?? null,
            storage_bucket: DOCUMENT_FILE_BUCKET,
            storage_path: storagePath,
            filename,
            mime_type: contentType,
            file_size: Number(file.size || 0),
            file_kind: fileKind,
            metadata: options.metadata ?? {},
        })
        .select("*")
        .single();

    if (error) {
        console.error("uploadDocumentFile metadata error:", error.message);
        await supabase.storage.from(DOCUMENT_FILE_BUCKET).remove([storagePath]);
        return null;
    }

    documentVaultAvailable = true;
    return mapDocumentFile(data);
}

export async function createSignedDocumentFileUrl(userId: string, fileId: string, expiresIn = 3600): Promise<string | null> {
    if (documentVaultAvailable === false) return null;

    const { data, error } = await supabase
        .from("document_files")
        .select("*")
        .eq("user_id", userId)
        .eq("id", fileId)
        .maybeSingle();

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("createSignedDocumentFileUrl lookup error:", error.message);
        return null;
    }
    if (!data) return null;

    const row = mapDocumentFile(data);
    const { data: signedData, error: signedError } = await supabase
        .storage
        .from(row.storageBucket)
        .createSignedUrl(row.storagePath, expiresIn);

    if (signedError) {
        console.error("createSignedDocumentFileUrl error:", signedError.message);
        return null;
    }

    return signedData?.signedUrl ?? null;
}

export async function deleteDocumentFile(userId: string, fileId: string): Promise<boolean> {
    if (documentVaultAvailable === false) return false;

    const { data, error } = await supabase
        .from("document_files")
        .select("*")
        .eq("user_id", userId)
        .eq("id", fileId)
        .maybeSingle();

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return false;
        }
        console.error("deleteDocumentFile lookup error:", error.message);
        return false;
    }
    if (!data) return false;

    const row = mapDocumentFile(data);
    if (isDocumentStoragePathForUser(userId, row.storagePath)) {
        const { error: storageError } = await supabase.storage.from(row.storageBucket).remove([row.storagePath]);
        if (storageError) {
            console.error("deleteDocumentFile storage error:", storageError.message);
            return false;
        }
    }

    const { error: deleteError } = await supabase
        .from("document_files")
        .delete()
        .eq("id", fileId)
        .eq("user_id", userId);

    if (deleteError) {
        console.error("deleteDocumentFile metadata error:", deleteError.message);
        return false;
    }

    return true;
}

export async function saveGeneratedDocumentArtifact(
    userId: string,
    documentId: string,
    versionId: string | null,
    content: string,
    fileKind: DocumentFileKind,
    options?: {
        exportMeta?: DocumentExportMeta;
        metadata?: Record<string, unknown>;
    },
): Promise<DocumentFile | null> {
    if (fileKind === "generated_pdf") {
        // PDF export currently relies on the browser print dialog, so there is no deterministic PDF binary to persist here yet.
        console.warn("saveGeneratedDocumentArtifact does not support generated_pdf until server-side PDF rendering exists.");
        return null;
    }
    if (fileKind !== "generated_docx" && fileKind !== "generated_html") {
        console.warn(`saveGeneratedDocumentArtifact received unsupported file kind: ${fileKind}`);
        return null;
    }

    const document = await loadVaultDocumentById(userId, documentId);
    const artifactMeta = buildDocumentArtifactMeta(document, options?.exportMeta);
    const artifact = fileKind === "generated_docx"
        ? buildStyledDocxArtifact(content, artifactMeta)
        : buildStyledHtmlArtifact(content, artifactMeta);

    const file = new File([artifact.blob], artifact.fileName, {
        type: artifact.blob.type || (fileKind === "generated_docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "text/html;charset=utf-8"),
        lastModified: Date.now(),
    });

    return uploadDocumentFile(userId, documentId, file, {
        versionId,
        fileKind,
        filename: artifact.fileName,
        mimeType: file.type,
        metadata: {
            ...(options?.metadata ?? {}),
            artifactSource: "vault_export",
        },
    });
}

export async function deleteDocumentVaultStorageForUser(userId: string): Promise<void> {
    if (documentVaultAvailable === false) return;

    const { data, error } = await supabase
        .from("document_files")
        .select("storage_bucket, storage_path")
        .eq("user_id", userId);

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return;
        }
        console.error("deleteDocumentVaultStorageForUser lookup error:", error.message);
        return;
    }

    const files = (data ?? []).filter((row) => typeof row.storage_bucket === "string" && typeof row.storage_path === "string");
    const grouped = new Map<string, string[]>();
    files.forEach((row) => {
        if (!isDocumentStoragePathForUser(userId, row.storage_path)) return;
        const bucketPaths = grouped.get(row.storage_bucket) ?? [];
        bucketPaths.push(row.storage_path);
        grouped.set(row.storage_bucket, bucketPaths);
    });

    await Promise.all(Array.from(grouped.entries()).map(async ([bucket, paths]) => {
        for (let index = 0; index < paths.length; index += 100) {
            const chunk = paths.slice(index, index + 100);
            const { error: removeError } = await supabase.storage.from(bucket).remove(chunk);
            if (removeError) {
                console.error("deleteDocumentVaultStorageForUser remove error:", removeError.message);
                break;
            }
        }
    }));
}

export async function createDocumentSignatureRequest(
    userId: string,
    payload: CreateDocumentSignatureRequestInput,
): Promise<DocumentSignatureRequest | null> {
    if (documentVaultAvailable === false) return null;

    const { data, error } = await supabase
        .from("document_signature_requests")
        .insert({
            document_id: payload.documentId,
            user_id: userId,
            version_id: payload.versionId ?? null,
            file_id: payload.fileId ?? null,
            provider: payload.provider ?? "mock",
            provider_request_id: payload.providerRequestId ?? null,
            status: payload.status ?? "draft",
            signer_name: payload.signerName ?? null,
            signer_email: payload.signerEmail ?? null,
            expires_at: payload.expiresAt ?? null,
            metadata: payload.metadata ?? {},
        })
        .select("*")
        .single();

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("createDocumentSignatureRequest error:", error.message);
        return null;
    }

    documentVaultAvailable = true;
    return mapDocumentSignatureRequest(data);
}

export async function loadDocumentSignatureRequests(userId: string, documentId: string): Promise<DocumentSignatureRequest[]> {
    if (documentVaultAvailable === false) return [];

    const { data, error } = await supabase
        .from("document_signature_requests")
        .select("*")
        .eq("user_id", userId)
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return [];
        }
        console.error("loadDocumentSignatureRequests error:", error.message);
        return [];
    }

    documentVaultAvailable = true;
    return (data ?? []).map(mapDocumentSignatureRequest);
}

export async function createDocumentSignatureEvent(
    userId: string,
    requestId: string,
    eventPayload: CreateDocumentSignatureEventInput,
): Promise<DocumentSignatureEvent | null> {
    if (documentVaultAvailable === false) return null;

    const { data, error } = await supabase
        .from("document_signature_events")
        .insert({
            signature_request_id: requestId,
            document_id: eventPayload.documentId,
            user_id: userId,
            provider: eventPayload.provider ?? null,
            event_type: eventPayload.eventType,
            event_status: eventPayload.eventStatus ?? null,
            occurred_at: eventPayload.occurredAt ?? new Date().toISOString(),
            payload: eventPayload.payload ?? {},
        })
        .select("*")
        .single();

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("createDocumentSignatureEvent error:", error.message);
        return null;
    }

    documentVaultAvailable = true;
    return mapDocumentSignatureEvent(data);
}

export async function loadDocumentSignatureEvents(userId: string, requestId: string): Promise<DocumentSignatureEvent[]> {
    if (documentVaultAvailable === false) return [];

    const { data, error } = await supabase
        .from("document_signature_events")
        .select("*")
        .eq("user_id", userId)
        .eq("signature_request_id", requestId)
        .order("occurred_at", { ascending: false });

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return [];
        }
        console.error("loadDocumentSignatureEvents error:", error.message);
        return [];
    }

    documentVaultAvailable = true;
    return (data ?? []).map(mapDocumentSignatureEvent);
}

export async function updateDocumentSignatureRequestStatus(
    userId: string,
    requestId: string,
    status: SignatureRequestStatus,
    metadata?: Record<string, unknown>,
): Promise<DocumentSignatureRequest | null> {
    if (documentVaultAvailable === false) return null;

    const { data: existingRow, error: existingError } = await supabase
        .from("document_signature_requests")
        .select("*")
        .eq("user_id", userId)
        .eq("id", requestId)
        .maybeSingle();

    if (existingError) {
        if (isMissingDocumentVaultRelationError(existingError)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("updateDocumentSignatureRequestStatus lookup error:", existingError.message);
        return null;
    }
    if (!existingRow) return null;

    const existing = mapDocumentSignatureRequest(existingRow);
    const now = new Date().toISOString();
    const mergedMetadata = {
        ...(existing.metadata ?? {}),
        ...(metadata ?? {}),
    };

    const updates: Record<string, unknown> = {
        status,
        metadata: mergedMetadata,
    };

    if (status === "sent" && !existing.sentAt) updates.sent_at = now;
    if (status === "completed" && !existing.completedAt) updates.completed_at = now;
    if (status === "declined" && !existing.declinedAt) updates.declined_at = now;

    const { data, error } = await supabase
        .from("document_signature_requests")
        .update(updates)
        .eq("user_id", userId)
        .eq("id", requestId)
        .select("*")
        .single();

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("updateDocumentSignatureRequestStatus error:", error.message);
        return null;
    }

    const updated = mapDocumentSignatureRequest(data);
    if (status === "sent") {
        await updateVaultDocumentStatus(userId, updated.documentId, "sent_for_signature");
    } else if (status === "completed") {
        await updateVaultDocumentStatus(userId, updated.documentId, "signed");
    } else if (status === "declined") {
        await updateVaultDocumentStatus(userId, updated.documentId, "declined");
    } else if (status === "canceled") {
        const document = await loadVaultDocumentById(userId, updated.documentId);
        if (document && document.status !== "signed") {
            // Intentionally avoid downgrading already-signed documents.
        }
    }

    documentVaultAvailable = true;
    return updated;
}

export async function updateVaultDocumentStatus(
    userId: string,
    documentId: string,
    status: DocumentStatus
): Promise<VaultDocument | null> {
    if (documentVaultAvailable === false) return null;
    if (!DOCUMENT_STATUS_VALUES.includes(status)) {
        throw new Error(`Invalid document status: ${status}`);
    }

    const { data, error } = await supabase
        .from("documents")
        .update({
            status,
            archived_at: status === "archived" ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", documentId)
        .eq("user_id", userId)
        .select("*")
        .single();

    if (error) {
        if (isMissingDocumentVaultRelationError(error)) {
            documentVaultAvailable = false;
            return null;
        }
        console.error("updateVaultDocumentStatus error:", error.message);
        return null;
    }

    documentVaultAvailable = true;
    return mapVaultDocument(data);
}

export async function archiveVaultDocument(userId: string, documentId: string): Promise<VaultDocument | null> {
    return updateVaultDocumentStatus(userId, documentId, "archived");
}

export async function trackProductUsageEvent(
    userId: string,
    feature: string,
    eventName: string,
    metadata: Record<string, unknown> = {},
): Promise<void> {
    const { error } = await supabase
        .from("product_usage_events")
        .insert({
            user_id: userId,
            feature,
            event_name: eventName,
            metadata,
        });

    if (error) {
        if (isMissingRelationError(error, "product_usage_events")) {
            return;
        }
        console.error("trackProductUsageEvent error:", error.message);
    }
}

async function syncProducedDocumentToVault(
    userId: string,
    producedDocument: ProducedDocument,
    fallbackStageId?: number | null,
    metadata?: Record<string, unknown>,
): Promise<void> {
    if (documentVaultAvailable === false) return;

    const vaultDocument = await createVaultDocumentFromProducedDocument(userId, producedDocument, fallbackStageId, metadata);
    if (!vaultDocument) return;

    const latestVersion = await loadLatestDocumentVersionRow(userId, vaultDocument.id);
    const versionSource: DocumentVersionSource = latestVersion ? "produced_document_refine" : "produced_document_generate";

    await saveDocumentVersion(userId, vaultDocument.id, {
        title: producedDocument.title,
        content: producedDocument.content,
        changeSummary: buildProducedDocumentChangeSummary(producedDocument, versionSource),
        source: versionSource,
        status: getPreservedDocumentStatus(vaultDocument),
        metadata: {
            ...(metadata ?? {}),
            sourceProducedDocumentId: producedDocument.id,
            legacyUpdatedAt: producedDocument.updatedAt,
            legacyHistoryLength: producedDocument.history.length,
            audience: producedDocument.audience,
            tone: producedDocument.tone,
        },
    });
}

export async function loadProducedDocuments(userId: string): Promise<ProducedDocument[]> {
    if (producedDocumentsAvailable === false) return [];

    const { data, error } = await supabase
        .from("produced_documents")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

    if (error) {
        if (isMissingRelationError(error, "produced_documents")) {
            producedDocumentsAvailable = false;
            return [];
        }
        console.error("loadProducedDocuments error:", error.message);
        return [];
    }

    producedDocumentsAvailable = true;
    return (data ?? []).map(mapProducedDocument);
}

export async function saveProducedDocument(
    userId: string,
    document: {
        id?: string | null;
        title: string;
        docType: string;
        audience: string;
        tone: string;
        request: string;
        content: string;
        history: Array<{ instruction: string; doc: string }>;
    },
    options?: { fallbackStageId?: number | null; metadata?: Record<string, unknown> },
): Promise<ProducedDocument | null> {
    if (producedDocumentsAvailable === false) return null;

    const now = new Date().toISOString();
    const payload = {
        ...(document.id ? { id: document.id } : {}),
        user_id: userId,
        title: document.title || document.docType,
        doc_type: document.docType,
        audience: document.audience,
        tone: document.tone,
        request: document.request ?? "",
        content: document.content,
        history: document.history ?? [],
        updated_at: now,
    };

    const query = document.id
        ? supabase.from("produced_documents").upsert(payload, { onConflict: "id" })
        : supabase.from("produced_documents").insert(payload);

    const { data, error } = await query.select().single();

    if (error) {
        if (isMissingRelationError(error, "produced_documents")) {
            producedDocumentsAvailable = false;
            return null;
        }
        console.error("saveProducedDocument error:", error.message);
        return null;
    }

    await recordMeaningfulActivity(userId, undefined, { force: true });
    producedDocumentsAvailable = true;
    const savedDocument = mapProducedDocument(data);

    try {
        await syncProducedDocumentToVault(userId, savedDocument, options?.fallbackStageId, options?.metadata);
    } catch (vaultError) {
        console.error("syncProducedDocumentToVault error:", vaultError);
    }

    return savedDocument;
}

// ── NOTIFICATION PREFERENCES ─────────────────────────────────

export async function ensureNotificationPreferences(userId: string) {
    const { data, error } = await supabase
        .from("user_notification_preferences")
        .upsert({
            user_id: userId,
            reengagement_enabled: DEFAULT_USER_NOTIFICATION_PREFERENCES.reengagementEnabled,
            product_updates_enabled: DEFAULT_USER_NOTIFICATION_PREFERENCES.productUpdatesEnabled,
            email_notifications_enabled: DEFAULT_USER_NOTIFICATION_PREFERENCES.emailNotificationsEnabled,
            in_app_notifications_enabled: DEFAULT_USER_NOTIFICATION_PREFERENCES.inAppNotificationsEnabled,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id", ignoreDuplicates: true })
        .select()
        .maybeSingle();

    if (error && error.code !== "23505") {
        console.error("ensureNotificationPreferences error:", error.message);
    }

    return data ?? null;
}

export async function loadNotificationPreferences(userId: string): Promise<UserNotificationPreferences> {
    const { data, error } = await supabase
        .from("user_notification_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        console.error("loadNotificationPreferences error:", error.message);
        return DEFAULT_USER_NOTIFICATION_PREFERENCES;
    }

    if (!data) {
        await ensureNotificationPreferences(userId);
        return DEFAULT_USER_NOTIFICATION_PREFERENCES;
    }

    return {
        reengagementEnabled: data.reengagement_enabled ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.reengagementEnabled,
        productUpdatesEnabled: data.product_updates_enabled ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.productUpdatesEnabled,
        emailNotificationsEnabled: data.email_notifications_enabled ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.emailNotificationsEnabled,
        inAppNotificationsEnabled: data.in_app_notifications_enabled ?? DEFAULT_USER_NOTIFICATION_PREFERENCES.inAppNotificationsEnabled,
    };
}

export async function saveNotificationPreferences(userId: string, preferences: UserNotificationPreferences) {
    const { error } = await supabase
        .from("user_notification_preferences")
        .upsert({
            user_id: userId,
            reengagement_enabled: preferences.reengagementEnabled,
            product_updates_enabled: preferences.productUpdatesEnabled,
            email_notifications_enabled: preferences.emailNotificationsEnabled,
            in_app_notifications_enabled: preferences.inAppNotificationsEnabled,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

    if (error) {
        console.error("saveNotificationPreferences error:", error.message);
        return false;
    }

    return true;
}

export async function ensureAdminNotificationSettings() {
    const { data, error } = await supabase
        .from("admin_notification_settings")
        .upsert({
            id: DEFAULT_ADMIN_NOTIFICATION_SETTINGS.id,
            reengagement_enabled: DEFAULT_ADMIN_NOTIFICATION_SETTINGS.reengagementEnabled,
            reengagement_delay_days: DEFAULT_ADMIN_NOTIFICATION_SETTINGS.reengagementDelayDays,
            max_reminders_per_user: DEFAULT_ADMIN_NOTIFICATION_SETTINGS.maxRemindersPerUser,
            updated_at: new Date().toISOString(),
        }, { onConflict: "id", ignoreDuplicates: true })
        .select()
        .maybeSingle();

    if (error && error.code !== "23505") {
        console.error("ensureAdminNotificationSettings error:", error.message);
    }

    return data ?? null;
}

export async function loadAdminNotificationSettings(): Promise<AdminNotificationSettings> {
    const { data, error } = await supabase
        .from("admin_notification_settings")
        .select("*")
        .eq("id", DEFAULT_ADMIN_NOTIFICATION_SETTINGS.id)
        .maybeSingle();

    if (error) {
        console.error("loadAdminNotificationSettings error:", error.message);
        return DEFAULT_ADMIN_NOTIFICATION_SETTINGS;
    }

    if (!data) {
        await ensureAdminNotificationSettings();
        return DEFAULT_ADMIN_NOTIFICATION_SETTINGS;
    }

    return {
        id: data.id ?? DEFAULT_ADMIN_NOTIFICATION_SETTINGS.id,
        reengagementEnabled: data.reengagement_enabled ?? DEFAULT_ADMIN_NOTIFICATION_SETTINGS.reengagementEnabled,
        reengagementDelayDays: data.reengagement_delay_days ?? DEFAULT_ADMIN_NOTIFICATION_SETTINGS.reengagementDelayDays,
        maxRemindersPerUser: data.max_reminders_per_user ?? DEFAULT_ADMIN_NOTIFICATION_SETTINGS.maxRemindersPerUser,
    };
}

export async function saveAdminNotificationSettings(settings: AdminNotificationSettings) {
    const { error } = await supabase
        .from("admin_notification_settings")
        .upsert({
            id: settings.id,
            reengagement_enabled: settings.reengagementEnabled,
            reengagement_delay_days: settings.reengagementDelayDays,
            max_reminders_per_user: settings.maxRemindersPerUser,
            updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

    if (error) {
        console.error("saveAdminNotificationSettings error:", error.message);
        return false;
    }

    return true;
}

export async function loadNotifications(userId: string, limit = 12): Promise<AppNotification[]> {
    const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("loadNotifications error:", error.message);
        return [];
    }

    return (data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        type: row.type,
        title: row.title,
        message: row.message,
        channel: row.channel,
        status: row.status,
        sentAt: row.sent_at ?? null,
        readAt: row.read_at ?? null,
        createdAt: row.created_at,
    }));
}

export async function markNotificationRead(notificationId: string) {
    const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .is("read_at", null);

    if (error) {
        console.error("markNotificationRead error:", error.message);
        return false;
    }

    return true;
}

// ── ACCOUNT ACCESS ────────────────────────────────────────────

export async function loadAccountAccess(userId: string) {
    const { data } = await supabase
        .from("account_access")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
    return data ?? null;
}

export async function loadBillingSubscription(userId: string) {
    const { data } = await supabase
        .from("billing_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
    return data ?? null;
}

// Creates a default access record if one doesn't exist yet.
// Safe to call on every login — is a no-op if record exists.
export async function ensureAccountAccess(userId: string) {
    const existing = await loadAccountAccess(userId);
    if (existing) return existing;

    const payload = {
        user_id: userId,
        access_status: "active",
        plan_type: "free",
        subscription_status: "trial",
        is_family_comp: false,
    };

    const { data, error } = await supabase
        .from("account_access")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .maybeSingle();

    if (error) {
        console.error("ensureAccountAccess error:", error.message);
        return await loadAccountAccess(userId);
    }

    if (data) return data;

    const refreshed = await loadAccountAccess(userId);
    return refreshed ?? null;
}

// Updates last_active_at and syncs email so admin dashboard has it.
export async function updateUserActivity(userId: string, email?: string) {
    const updates: Record<string, string> = {
        last_active_at: new Date().toISOString(),
    };
    if (email) updates.email = email;
    await supabase.from("profiles").update(updates).eq("id", userId);
}

export async function recordMeaningfulActivity(
    userId: string,
    email?: string,
    options?: { force?: boolean }
) {
    const now = Date.now();
    const lastTouched = _activityTouchCache.get(userId) ?? 0;
    if (!options?.force && now - lastTouched < MEANINGFUL_ACTIVITY_THROTTLE_MS) {
        return false;
    }

    _activityTouchCache.set(userId, now);
    await updateUserActivity(userId, email);
    return true;
}

export async function ensureOwnerProfileRole(userId: string, email?: string | null) {
    if (normalizeEmail(email) !== OWNER_EMAIL) return false;

    const { error } = await supabase
        .from("profiles")
        .update({
            role: "owner",
            email: email ?? OWNER_EMAIL,
            updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

    if (error) {
        console.warn("ensureOwnerProfileRole warning:", error.message);
        return false;
    }

    return true;
}

// ── LONGITUDINAL MEMORY TYPES ────────────────────────────────

export interface StageSummary {
    stageId: number;
    summary: string;
    summaryDate: string;
    title: string;
}

export interface FounderDecision {
    id: string;
    stageId: number;
    tag: string | null;
    text: string;
    decidedAt: string;
}

// ── FOUNDER DECISIONS ─────────────────────────────────────────

export async function saveDecision(
    userId: string,
    stageId: number,
    tag: string | null,
    text: string
): Promise<FounderDecision | null> {
    const { data, error } = await supabase
        .from("founder_decisions")
        .insert({ user_id: userId, stage_id: stageId, tag: tag ?? null, text })
        .select()
        .single();
    if (error) { console.error("saveDecision error:", error.message); return null; }
    return {
        id: data.id,
        stageId: data.stage_id,
        tag: data.tag ?? null,
        text: data.text,
        decidedAt: data.decided_at,
    };
}

export async function loadDecisions(
    userId: string,
    limit = 30
): Promise<FounderDecision[]> {
    const { data, error } = await supabase
        .from("founder_decisions")
        .select("*")
        .eq("user_id", userId)
        .order("decided_at", { ascending: false })
        .limit(limit);
    if (error) { console.error("loadDecisions error:", error.message); return []; }
    return (data ?? []).map(row => ({
        id: row.id,
        stageId: row.stage_id,
        tag: row.tag ?? null,
        text: row.text,
        decidedAt: row.decided_at,
    }));
}

// ── RECENT SUMMARIES (for longitudinal memory) ────────────────

let recentSummariesAvailable: boolean | null = null;

export async function loadRecentSummaries(
    userId: string,
    daysBack = 30
): Promise<StageSummary[]> {
    if (recentSummariesAvailable === false) return [];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const { data, error } = await supabase
        .from("daily_chat_summaries")
        .select("stage_id, summary, summary_date, title")
        .eq("user_id", userId)
        .gte("summary_date", cutoffStr)
        .order("summary_date", { ascending: false });

    if (error) {
        if (isMissingRelationError(error, "daily_chat_summaries")) {
            recentSummariesAvailable = false;
            return [];
        }
        console.error("loadRecentSummaries error:", error.message);
        return [];
    }

    recentSummariesAvailable = true;
    return (data ?? []).map(row => ({
        stageId: row.stage_id,
        summary: row.summary,
        summaryDate: row.summary_date,
        title: row.title,
    }));
}

// Upserts a coaching summary for today's date into daily_chat_summaries.
// If a row already exists for (user_id, stage_id, today) it is updated in place.
export async function persistStageSummaryToday(
    userId: string,
    stageId: number,
    summary: string,
    messageCount: number
): Promise<void> {
    if (dailyChatSummariesAvailable === false) return;

    const today = getLocalDateKey();
    const title = `Stage ${stageId} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

    const { error } = await supabase
        .from("daily_chat_summaries")
        .upsert(
            {
                user_id: userId,
                stage_id: stageId,
                summary_date: today,
                title,
                summary,
                message_count: messageCount,
                updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,stage_id,summary_date" }
        );

    if (error) {
        if (isMissingRelationError(error, "daily_chat_summaries")) {
            dailyChatSummariesAvailable = false;
            return;
        }
        console.error("persistStageSummaryToday error:", error.message);
    }
}

// ── STAGE PROGRESS DATES ──────────────────────────────────────

export async function loadStageProgressDates(userId: string): Promise<Record<number, string>> {
    const { data, error } = await supabase
        .from("stage_progress")
        .select("stage_id, stage_entered_at")
        .eq("user_id", userId);

    const result: Record<number, string> = {};
    if (error || !data) return result;
    data.forEach(row => {
        if (row.stage_entered_at) result[row.stage_id] = row.stage_entered_at;
    });
    return result;
}

// ── FOUNDER NUDGES ────────────────────────────────────────────

export interface FounderNudge {
    id: string;
    nudgeType: string;
    nudgeText: string;
    signalSource: string;
    seenAt: string | null;
    dismissedAt: string | null;
    actedOnAt: string | null;
    createdAt: string;
}

let founderNudgesAvailable: boolean | null = null;

function mapNudge(row: any): FounderNudge {
    return {
        id: row.id,
        nudgeType: row.nudge_type,
        nudgeText: row.nudge_text,
        signalSource: row.signal_source,
        seenAt: row.seen_at ?? null,
        dismissedAt: row.dismissed_at ?? null,
        actedOnAt: row.acted_on_at ?? null,
        createdAt: row.created_at,
    };
}

export async function saveNudge(
    userId: string,
    nudgeType: string,
    nudgeText: string,
    signalSource: string
): Promise<FounderNudge | null> {
    if (founderNudgesAvailable === false) return null;

    const { data, error } = await supabase
        .from("founder_nudges")
        .insert({ user_id: userId, nudge_type: nudgeType, nudge_text: nudgeText, signal_source: signalSource })
        .select()
        .single();

    if (error) {
        if (isMissingRelationError(error, "founder_nudges")) {
            founderNudgesAvailable = false;
            return null;
        }
        console.error("saveNudge error:", error.message);
        return null;
    }

    founderNudgesAvailable = true;
    return mapNudge(data);
}

// Returns the most recent undismissed nudge created within the last 7 days.
export async function loadActiveNudge(userId: string): Promise<FounderNudge | null> {
    if (founderNudgesAvailable === false) return null;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const { data, error } = await supabase
        .from("founder_nudges")
        .select("*")
        .eq("user_id", userId)
        .is("dismissed_at", null)
        .gte("created_at", cutoff.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        if (isMissingRelationError(error, "founder_nudges")) {
            founderNudgesAvailable = false;
            return null;
        }
        console.error("loadActiveNudge error:", error.message);
        return null;
    }

    founderNudgesAvailable = true;
    return data ? mapNudge(data) : null;
}

export async function dismissNudge(userId: string, nudgeId: string): Promise<void> {
    if (founderNudgesAvailable === false) return;

    const { error } = await supabase
        .from("founder_nudges")
        .update({ dismissed_at: new Date().toISOString() })
        .eq("id", nudgeId)
        .eq("user_id", userId);

    if (error) console.error("dismissNudge error:", error.message);
}

export async function markNudgeActedOn(userId: string, nudgeId: string): Promise<void> {
    if (founderNudgesAvailable === false) return;

    const { error } = await supabase
        .from("founder_nudges")
        .update({ acted_on_at: new Date().toISOString() })
        .eq("id", nudgeId)
        .eq("user_id", userId)
        .is("acted_on_at", null);

    if (error) console.error("markNudgeActedOn error:", error.message);
}

export async function markNudgeSeen(userId: string, nudgeId: string): Promise<void> {
    if (founderNudgesAvailable === false) return;

    const { error } = await supabase
        .from("founder_nudges")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", nudgeId)
        .eq("user_id", userId)
        .is("seen_at", null);

    if (error) console.error("markNudgeSeen error:", error.message);
}

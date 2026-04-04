import { supabase } from "./supabase";
import { OWNER_EMAIL, hasAdminAccess, isOwnerRole, normalizeEmail, normalizeUserRole } from "./lib/roles";
import {
    MEANINGFUL_ACTIVITY_THROTTLE_MS,
    DEFAULT_ADMIN_NOTIFICATION_SETTINGS,
    DEFAULT_USER_NOTIFICATION_PREFERENCES,
    type AdminNotificationSettings,
    type AppNotification,
    type UserNotificationPreferences,
} from "./lib/notifications";

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

function isMissingRelationError(error: any, relationName: string) {
    const message = String(error?.message ?? "").toLowerCase();
    return error?.code === "PGRST205" || message.includes(relationName.toLowerCase()) || message.includes("could not find the table");
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
        .insert({
            id: userId,
            email: user?.email ?? null,
            updated_at: new Date().toISOString(),
        });

    if (error && error.code !== "23505") {
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

// ── MESSAGES ──────────────────────────────────────────────────

export async function loadAllMessages(userId: string) {
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

// Per-stage debounce state — coalesces rapid calls (e.g. during streaming) so
// DELETE + INSERT never races with itself for the same stage.
const _saveTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export function saveMessages(userId: string, stageId: number, messages: any[]) {
    const key = `${userId}:${stageId}`;
    clearTimeout(_saveTimers[key]);
    // Capture the latest messages snapshot; the timer runs after rapid updates settle.
    const snapshot = messages.slice();
    _saveTimers[key] = setTimeout(async () => {
        delete _saveTimers[key];
        await supabase
            .from("messages")
            .delete()
            .eq("user_id", userId)
            .eq("stage_id", stageId);

        if (snapshot.length === 0) return;

        const rows = snapshot.map(m => ({
            user_id: userId,
            stage_id: stageId,
            role: m.role,
            content: m.text || "",
            created_at: m.createdAt ?? new Date().toISOString(),
        }));

        const { error } = await supabase.from("messages").insert(rows);
        if (error) console.error("saveMessages error:", error.message);
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
    }));
}

export async function saveJournalEntry(userId: string, content: string) {
    const { data, error } = await supabase
        .from("journal_entries")
        .insert({ user_id: userId, content })
        .select()
        .single();

    if (error) { console.error("saveJournalEntry error:", error.message); return null; }
    await recordMeaningfulActivity(userId, undefined, { force: true });
    return { id: data.id, content: data.content, createdAt: data.created_at };
}

// ── DAILY CHAT SUMMARIES ─────────────────────────────────────

export async function loadConversationSummaries(userId: string) {
    if (dailyChatSummariesAvailable === false) return [];

    const { data, error } = await supabase
        .from("daily_chat_summaries")
        .select("*")
        .eq("user_id", userId)
        .order("summary_date", { ascending: false });

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
        .upsert({
            user_id: userId,
            stage_id: stageId,
            summary_date: summaryDate,
            title,
            summary,
            message_count: messageCount,
            updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,stage_id,summary_date" })
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

export async function deleteJournalEntry(userId: string, entryId: string) {
    const { error } = await supabase
        .from("journal_entries")
        .delete()
        .eq("id", entryId)
        .eq("user_id", userId);

    if (error) console.error("deleteJournalEntry error:", error.message);
}
// ── MARKET INTELLIGENCE ───────────────────────────────────────

export async function loadTodayMarketReport(userId: string) {
    const today = getLocalDateKey();
    const { data, error } = await supabase
        .from("market_reports")
        .select("*")
        .eq("user_id", userId)
        .eq("date", today)
        .single();
    if (error || !data) return null;
    return { content: data.content, industry: data.industry, date: data.date, createdAt: data.created_at };
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
    return { content: data.content, industry: data.industry, date: data.date, createdAt: data.created_at };
}

export async function loadMarketReportHistory(userId: string) {
    const { data, error } = await supabase
        .from("market_reports")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });

    if (error || !data) return [];
    return data.map((row) => ({
        content: row.content,
        industry: row.industry,
        date: row.date,
        createdAt: row.created_at,
    }));
}

export async function saveMarketReport(userId: string, content: string, industry: string) {
    const today = getLocalDateKey();
    const { data, error } = await supabase
        .from("market_reports")
        .upsert(
            {
                user_id: userId,
                date: today,
                content,
                industry,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,date" }
        )
        .select()
        .single();
    if (error) { console.error("saveMarketReport error:", error.message); return null; }
    await recordMeaningfulActivity(userId, undefined, { force: true });
    return { content: data.content, industry: data.industry, date: data.date, createdAt: data.created_at };
}

// ── BRIEFINGS ─────────────────────────────────────────────────

export async function loadBriefings(userId: string) {
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
    }));
}

export async function saveBriefing(userId: string, content: string, stageId: number) {
    const { data, error } = await supabase
        .from("briefings")
        .insert({ user_id: userId, content, stage_id: stageId })
        .select()
        .single();

    if (error) { console.error("saveBriefing error:", error.message); return null; }
    await recordMeaningfulActivity(userId, undefined, { force: true });
    return { id: data.id, content: data.content, stageId: data.stage_id, createdAt: data.created_at };
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

import { supabase } from "./supabase";
import { OWNER_EMAIL, hasAdminAccess, isOwnerRole, normalizeEmail, normalizeUserRole } from "./lib/roles";

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
            total: data.budget_total ?? 0,
            spent: data.budget_spent ?? 0,
            remaining: data.budget_remaining ?? 0,
            runway: data.budget_runway ?? "TBD",
            expenses: data.expenses ?? [],
        },
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

export async function saveProfile(userId: string, profile: any) {
    if (!profile) return;
    const { error } = await supabase.from("profiles").upsert({
        id: userId,
        name: profile.name,
        idea: profile.idea,
        business_name: profile.businessName,
        industry: profile.industry,
        strategy: profile.strategy,
        strategy_label: profile.strategyLabel,
        experience: profile.experience,
        current_stage: profile.currentStage ?? 1,
        budget_total: profile.budget?.total ?? 0,
        budget_spent: profile.budget?.spent ?? 0,
        budget_remaining: profile.budget?.remaining ?? 0,
        budget_runway: profile.budget?.runway ?? "TBD",
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
        stage.push({ role: row.role, text: row.content });
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
    return { id: data.id, content: data.content, createdAt: data.created_at };
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
        .single();
    if (error || !data) return null;
    return { content: data.content, industry: data.industry, date: data.date, createdAt: data.created_at };
}

export async function saveMarketReport(userId: string, content: string, industry: string) {
    const today = getLocalDateKey();
    const { data, error } = await supabase
        .from("market_reports")
        .upsert(
            { user_id: userId, date: today, content, industry, created_at: new Date().toISOString() },
            { onConflict: "user_id,date" }
        )
        .select()
        .single();
    if (error) { console.error("saveMarketReport error:", error.message); return null; }
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
    return { id: data.id, content: data.content, stageId: data.stage_id, createdAt: data.created_at };
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

// Creates a default access record if one doesn't exist yet.
// Safe to call on every login — is a no-op if record exists.
export async function ensureAccountAccess(userId: string) {
    const existing = await loadAccountAccess(userId);
    if (existing) return existing;
    const { data } = await supabase
        .from("account_access")
        .insert({
            user_id: userId,
            access_status: "active",
            plan_type: "free",
            subscription_status: "trial",
            is_family_comp: false,
        })
        .select()
        .single();
    return data ?? null;
}

// Updates last_active_at and syncs email so admin dashboard has it.
export async function updateUserActivity(userId: string, email?: string) {
    const updates: Record<string, string> = {
        last_active_at: new Date().toISOString(),
    };
    if (email) updates.email = email;
    await supabase.from("profiles").update(updates).eq("id", userId);
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

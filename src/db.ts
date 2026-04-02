import { supabase } from "./supabase";

// ─────────────────────────────────────────────────────────────
// FOUNDRY DATABASE LAYER
// All Supabase reads and writes go through here.
// ─────────────────────────────────────────────────────────────

// ── PROFILE ──────────────────────────────────────────────────

export async function loadProfile(userId: string) {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
    if (error || !data) return null;

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
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
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
    const today = new Date().toISOString().slice(0, 10);
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
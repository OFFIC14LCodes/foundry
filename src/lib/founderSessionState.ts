import { supabase } from "../supabase";

export type FounderSessionState = {
    userId: string;
    lastSeenAt: string | null;
    lastScreen: string | null;
    weeklyJournalSummary: string | null;
    weeklyJournalSummaryGeneratedAt: string | null;
    updatedAt: string | null;
};

type FounderSessionStateUpdate = Partial<{
    lastSeenAt: string | null;
    lastScreen: string | null;
    weeklyJournalSummary: string | null;
    weeklyJournalSummaryGeneratedAt: string | null;
}>;

let founderSessionStateAvailable: boolean | null = null;

function isMissingFounderSessionStateRelationError(error: any) {
    const message = String(error?.message ?? "").toLowerCase();
    return error?.code === "PGRST205" || message.includes("founder_session_state");
}

function mapFounderSessionState(row: any): FounderSessionState {
    return {
        userId: row.user_id,
        lastSeenAt: row.last_seen_at ?? null,
        lastScreen: row.last_screen ?? null,
        weeklyJournalSummary: row.weekly_journal_summary ?? null,
        weeklyJournalSummaryGeneratedAt: row.weekly_journal_summary_generated_at ?? null,
        updatedAt: row.updated_at ?? null,
    };
}

export async function getFounderSessionState(userId: string): Promise<FounderSessionState | null> {
    if (!userId || founderSessionStateAvailable === false) return null;

    const { data, error } = await supabase
        .from("founder_session_state")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        if (isMissingFounderSessionStateRelationError(error)) {
            founderSessionStateAvailable = false;
            return null;
        }
        console.error("getFounderSessionState error:", error.message);
        return null;
    }

    founderSessionStateAvailable = true;
    return data ? mapFounderSessionState(data) : null;
}

export async function upsertFounderSessionState(
    userId: string,
    partialState: FounderSessionStateUpdate
): Promise<FounderSessionState | null> {
    if (!userId || founderSessionStateAvailable === false) return null;

    const payload = {
        user_id: userId,
        ...(partialState.lastSeenAt !== undefined ? { last_seen_at: partialState.lastSeenAt } : {}),
        ...(partialState.lastScreen !== undefined ? { last_screen: partialState.lastScreen } : {}),
        ...(partialState.weeklyJournalSummary !== undefined ? { weekly_journal_summary: partialState.weeklyJournalSummary } : {}),
        ...(partialState.weeklyJournalSummaryGeneratedAt !== undefined ? { weekly_journal_summary_generated_at: partialState.weeklyJournalSummaryGeneratedAt } : {}),
        updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from("founder_session_state")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single();

    if (error) {
        if (isMissingFounderSessionStateRelationError(error)) {
            founderSessionStateAvailable = false;
            return null;
        }
        console.error("upsertFounderSessionState error:", error.message);
        return null;
    }

    founderSessionStateAvailable = true;
    return mapFounderSessionState(data);
}

export async function getLastSeenAt(userId: string) {
    const state = await getFounderSessionState(userId);
    return state?.lastSeenAt ?? null;
}

export async function updateLastSeenAt(userId: string, timestamp: string) {
    const state = await upsertFounderSessionState(userId, { lastSeenAt: timestamp });
    return state?.lastSeenAt ?? null;
}

export async function getLastScreen(userId: string) {
    const state = await getFounderSessionState(userId);
    return state?.lastScreen ?? null;
}

export async function updateLastScreen(userId: string, screen: string) {
    const state = await upsertFounderSessionState(userId, { lastScreen: screen });
    return state?.lastScreen ?? null;
}

export async function getWeeklyJournalSummary(userId: string) {
    const state = await getFounderSessionState(userId);
    if (!state?.weeklyJournalSummary) return null;
    return {
        text: state.weeklyJournalSummary,
        generatedAt: state.weeklyJournalSummaryGeneratedAt,
    };
}

export async function updateWeeklyJournalSummary(userId: string, summary: string, generatedAt: string) {
    const state = await upsertFounderSessionState(userId, {
        weeklyJournalSummary: summary,
        weeklyJournalSummaryGeneratedAt: generatedAt,
    });
    if (!state?.weeklyJournalSummary) return null;
    return {
        text: state.weeklyJournalSummary,
        generatedAt: state.weeklyJournalSummaryGeneratedAt,
    };
}

import { supabase } from "../supabase";

export interface TtsUsageSnapshot {
    provider: string;
    tier: string;
    status: string;
    usedCredits: number;
    totalCredits: number;
    remainingCredits: number;
    billingPeriod: string | null;
    resetAtUnix: number | null;
    currentVoiceName: string | null;
    voiceSlotsUsed: number | null;
    voiceLimit: number | null;
    recentCreditUsage: number[];
    recentUsageTimestamps: number[];
}

export async function loadAdminTtsUsage(): Promise<TtsUsageSnapshot> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
        throw new Error("Missing active session");
    }

    const response = await fetch("/api/tts-usage", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail.slice(0, 200) || `Usage API ${response.status}`);
    }

    return response.json();
}

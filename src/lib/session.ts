export const STORAGE_KEYS = {
    profile: "foundry_profile",
    completedByStage: "foundry_completed",
    messagesByStage: "foundry_messages",
} as const;

export function createEmptyStageProgress() {
    return { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } as Record<number, string[]>;
}

export function createEmptyMessagesByStage() {
    return { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } as Record<number, any[]>;
}

export function clearFoundryClientStorage() {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem("foundry_last_seen");
    localStorage.removeItem("foundry_screen");
    localStorage.removeItem("foundry_journal_weekly_summary");
}

import { supabase } from "../supabase";
import {
    BUSINESS_MODEL_CANVAS_SECTIONS,
    getEmptyBusinessModelCanvas,
    mergeCanvasEntries,
    normalizeCanvasEntries,
    type BusinessModelCanvasEntry,
    type BusinessModelCanvasRecord,
    type BusinessModelCanvasSectionKey,
} from "./businessModelCanvas";

function mapCanvasRow(row: any): BusinessModelCanvasRecord {
    const base = getEmptyBusinessModelCanvas(row.user_id, row.stage_id ?? 2);
    const mapped: BusinessModelCanvasRecord = {
        ...base,
        id: row.id,
        version: Number(row.version ?? 1),
        createdAt: row.created_at ?? null,
        updatedAt: row.updated_at ?? null,
        persisted: true,
    };

    BUSINESS_MODEL_CANVAS_SECTIONS.forEach((section) => {
        mapped[section] = normalizeCanvasEntries(row[section], "forge");
    });

    return mapped;
}

function toRowPayload(canvas: BusinessModelCanvasRecord) {
    const payload: Record<string, any> = {
        id: canvas.persisted ? canvas.id : undefined,
        user_id: canvas.userId,
        stage_id: canvas.stageId,
        version: canvas.version,
    };

    BUSINESS_MODEL_CANVAS_SECTIONS.forEach((section) => {
        payload[section] = canvas[section].map((entry) => ({
            id: entry.id,
            text: entry.text,
            source: entry.source,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
        }));
    });

    return payload;
}

export async function loadBusinessModelCanvas(userId: string, stageId = 2): Promise<BusinessModelCanvasRecord> {
    const { data, error } = await supabase
        .from("business_model_canvas")
        .select("*")
        .eq("user_id", userId)
        .eq("stage_id", stageId)
        .maybeSingle();

    if (error) {
        console.error("loadBusinessModelCanvas error:", error.message);
        return getEmptyBusinessModelCanvas(userId, stageId);
    }

    if (!data) return getEmptyBusinessModelCanvas(userId, stageId);
    return mapCanvasRow(data);
}

export async function saveBusinessModelCanvas(canvas: BusinessModelCanvasRecord): Promise<BusinessModelCanvasRecord | null> {
    const payload = toRowPayload(canvas);
    const { data, error } = await supabase
        .from("business_model_canvas")
        .upsert(payload, { onConflict: "user_id,stage_id" })
        .select("*")
        .single();

    if (error || !data) {
        console.error("saveBusinessModelCanvas error:", error?.message);
        return null;
    }

    return mapCanvasRow(data);
}

export async function updateBusinessModelCanvas(
    userId: string,
    section: BusinessModelCanvasSectionKey,
    content: Array<string | Partial<BusinessModelCanvasEntry>>,
    options?: { source?: string | null; stageId?: number },
) {
    const stageId = options?.stageId ?? 2;
    const current = await loadBusinessModelCanvas(userId, stageId);
    const merged = mergeCanvasEntries(current[section], content, options?.source ?? "forge");
    if (!merged.changed) return current;

    const next: BusinessModelCanvasRecord = {
        ...current,
        persisted: current.persisted,
        [section]: merged.entries,
        version: current.version + 1,
    };
    return (await saveBusinessModelCanvas(next)) ?? current;
}

export async function applyBusinessModelCanvasPatch(
    userId: string,
    patch: Partial<Record<BusinessModelCanvasSectionKey, Array<string | Partial<BusinessModelCanvasEntry>>>>,
    options?: { source?: string | null; stageId?: number },
) {
    const stageId = options?.stageId ?? 2;
    const current = await loadBusinessModelCanvas(userId, stageId);
    let changed = false;
    let next = { ...current };

    BUSINESS_MODEL_CANVAS_SECTIONS.forEach((section) => {
        const incoming = patch[section];
        if (!incoming || !incoming.length) return;
        const merged = mergeCanvasEntries(next[section], incoming, options?.source ?? "forge");
        if (!merged.changed) return;
        next = {
            ...next,
            [section]: merged.entries,
        };
        changed = true;
    });

    if (!changed) return current;
    next.version = current.version + 1;
    return (await saveBusinessModelCanvas(next)) ?? current;
}

export async function updateBusinessModelCanvasEntry(
    userId: string,
    section: BusinessModelCanvasSectionKey,
    entryId: string,
    text: string,
    options?: { stageId?: number },
) {
    const current = await loadBusinessModelCanvas(userId, options?.stageId ?? 2);
    const normalized = text.trim();
    if (!normalized) return current;
    const now = new Date().toISOString();
    let changed = false;

    const nextEntries = current[section].map((entry) => {
        if (entry.id !== entryId) return entry;
        changed = changed || entry.text !== normalized;
        return {
            ...entry,
            text: normalized,
            updatedAt: now,
        };
    });

    if (!changed) return current;
    const deduped = normalizeCanvasEntries(nextEntries, "manual");
    const next = {
        ...current,
        [section]: deduped,
        version: current.version + 1,
    };
    return (await saveBusinessModelCanvas(next)) ?? current;
}

export async function deleteBusinessModelCanvasEntry(
    userId: string,
    section: BusinessModelCanvasSectionKey,
    entryId: string,
    options?: { stageId?: number },
) {
    const current = await loadBusinessModelCanvas(userId, options?.stageId ?? 2);
    const nextEntries = current[section].filter((entry) => entry.id !== entryId);
    if (nextEntries.length === current[section].length) return current;

    const next = {
        ...current,
        [section]: nextEntries,
        version: current.version + 1,
    };
    return (await saveBusinessModelCanvas(next)) ?? current;
}

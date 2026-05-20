import { supabase } from "../supabase";
import { getWorkspacesForUser, type CofounderWorkspaceSummary } from "./cofounderDb";

export type ForgeMemoryScope = "personal" | "workspace" | "hybrid" | "custom";
export type ForgeMemoryVisibility = "private" | "shared" | "role_limited";
export type ForgeMemorySource =
    | "forge_chat"
    | "academy"
    | "stage_chat"
    | "cofounder_chat"
    | "document"
    | "market_intelligence"
    | "business_canvas"
    | "manual";

export type ActiveForgeContext = {
    scope: "personal" | "workspace" | "custom";
    workspaceId?: string | null;
    workspaceName?: string | null;
    customLabel?: string | null;
};

export interface ForgeMemoryItem {
    id: string;
    user_id: string;
    workspace_id: string | null;
    scope: ForgeMemoryScope;
    visibility: ForgeMemoryVisibility;
    source: ForgeMemorySource;
    source_ref_id: string | null;
    title: string | null;
    content: string;
    summary: string | null;
    custom_context_label: string | null;
    confidence: number | null;
    requires_confirmation: boolean;
    confirmed_at: string | null;
    created_at: string;
    updated_at: string;
}

export type CreateForgeMemoryInput = {
    userId: string;
    workspaceId?: string | null;
    scope: ForgeMemoryScope;
    visibility?: ForgeMemoryVisibility;
    source?: ForgeMemorySource;
    sourceRefId?: string | null;
    title?: string | null;
    content: string;
    summary?: string | null;
    customContextLabel?: string | null;
    confidence?: number | null;
    requiresConfirmation?: boolean;
};

export async function getAvailableForgeContexts(userId: string): Promise<{
    personal: true;
    workspaces: CofounderWorkspaceSummary[];
}> {
    return {
        personal: true,
        workspaces: await getWorkspacesForUser(userId),
    };
}

export async function createForgeMemoryItem(input: CreateForgeMemoryInput): Promise<ForgeMemoryItem | null> {
    const payload = {
        user_id: input.userId,
        workspace_id: input.workspaceId ?? null,
        scope: input.scope,
        visibility: input.visibility ?? (input.scope === "workspace" ? "shared" : "private"),
        source: input.source ?? "forge_chat",
        source_ref_id: input.sourceRefId ?? null,
        title: input.title ?? null,
        content: input.content.trim(),
        summary: input.summary ?? null,
        custom_context_label: input.customContextLabel ?? null,
        confidence: input.confidence ?? null,
        requires_confirmation: input.requiresConfirmation ?? false,
        confirmed_at: input.requiresConfirmation ? null : new Date().toISOString(),
    };

    if (!payload.content) return null;

    const { data, error } = await supabase
        .from("forge_memory_items")
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error("createNaviMemoryItem error:", error.message);
        return null;
    }

    return (data as ForgeMemoryItem) ?? null;
}

export async function getForgeMemoryForContext({
    userId,
    workspaceId = null,
    scope = "personal",
    customContextLabel = null,
    limit = 12,
}: {
    userId: string;
    workspaceId?: string | null;
    scope?: ForgeMemoryScope;
    customContextLabel?: string | null;
    limit?: number;
}): Promise<ForgeMemoryItem[]> {
    let query = supabase
        .from("forge_memory_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

    if (scope === "workspace") {
        if (!workspaceId) return [];
        query = query.eq("workspace_id", workspaceId).eq("scope", "workspace").eq("visibility", "shared");
    } else if (scope === "hybrid") {
        if (!workspaceId) return [];
        query = query.eq("user_id", userId).eq("workspace_id", workspaceId).eq("scope", "hybrid");
    } else if (scope === "custom") {
        query = query.eq("user_id", userId).eq("scope", "custom").eq("visibility", "private");
        if (customContextLabel?.trim()) query = query.ilike("custom_context_label", `%${customContextLabel.trim()}%`);
    } else {
        query = query.eq("user_id", userId).eq("scope", "personal").eq("visibility", "private");
    }

    const { data, error } = await query;
    if (error) {
        console.error("getNaviMemoryForContext error:", error.message);
        return [];
    }
    return (data as ForgeMemoryItem[]) ?? [];
}

export async function getRecentWorkspaceMemory(workspaceId: string, limit = 10): Promise<ForgeMemoryItem[]> {
    if (!workspaceId) return [];
    const { data, error } = await supabase
        .from("forge_memory_items")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("scope", "workspace")
        .eq("visibility", "shared")
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) {
        console.error("getRecentWorkspaceMemory error:", error.message);
        return [];
    }
    return (data as ForgeMemoryItem[]) ?? [];
}

export async function getRecentPersonalMemory(userId: string, limit = 10): Promise<ForgeMemoryItem[]> {
    return getForgeMemoryForContext({ userId, scope: "personal", limit });
}

export async function getRelevantForgeMemory({
    userId,
    workspaceId = null,
    activeForgeContext = null,
    query = "",
    limit = 10,
    includePersonalMemory = true,
    includeWorkspaceMemory = false,
}: {
    userId: string;
    workspaceId?: string | null;
    activeForgeContext?: ActiveForgeContext | null;
    query?: string;
    limit?: number;
    includePersonalMemory?: boolean;
    includeWorkspaceMemory?: boolean;
}): Promise<{
    personal: ForgeMemoryItem[];
    workspace: ForgeMemoryItem[];
    hybrid: ForgeMemoryItem[];
    custom: ForgeMemoryItem[];
}> {
    const context = activeForgeContext;
    const selectedWorkspaceId = workspaceId || (context?.scope === "workspace" ? context.workspaceId : null);
    const [personal, workspace, hybrid, custom] = await Promise.all([
        includePersonalMemory ? getRecentPersonalMemory(userId, limit) : Promise.resolve([]),
        includeWorkspaceMemory && selectedWorkspaceId ? getRecentWorkspaceMemory(selectedWorkspaceId, limit) : Promise.resolve([]),
        selectedWorkspaceId ? getForgeMemoryForContext({ userId, workspaceId: selectedWorkspaceId, scope: "hybrid", limit }) : Promise.resolve([]),
        context?.scope === "custom"
            ? getForgeMemoryForContext({ userId, scope: "custom", customContextLabel: context.customLabel ?? null, limit })
            : Promise.resolve([]),
    ]);

    return {
        personal: filterMemoryByQuery(personal, query, limit),
        workspace: filterMemoryByQuery(workspace, query, limit),
        hybrid: filterMemoryByQuery(hybrid, query, limit),
        custom: filterMemoryByQuery(custom, query, limit),
    };
}

export function formatForgeMemoryBlock(label: string, items: ForgeMemoryItem[], note?: string): string {
    if (items.length === 0) return "";
    const lines = items.slice(0, 8).map((item) => {
        const title = item.title?.trim() || item.custom_context_label?.trim() || item.source.replace(/_/g, " ");
        const body = (item.summary || item.content).replace(/\s+/g, " ").trim();
        return `- ${title}: ${body.slice(0, 420)}`;
    });
    return `[${label}]
${note ? `${note}\n` : ""}${lines.join("\n")}
[/${label}]`;
}

export function getForgeContextLabel(context: ActiveForgeContext | null | undefined): string {
    if (!context) return "Ask each time";
    if (context.scope === "workspace") return context.workspaceName || "Workspace";
    if (context.scope === "custom") return `Custom — ${context.customLabel || "Private project"}`;
    return "Personal";
}

function filterMemoryByQuery(items: ForgeMemoryItem[], query: string, limit: number) {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return items.slice(0, limit);

    const words = Array.from(new Set(normalized.split(/[^a-z0-9]+/).filter(word => word.length >= 4))).slice(0, 10);
    if (words.length === 0) return items.slice(0, limit);

    const scored = items.map((item) => {
        const haystack = [
            item.title,
            item.content,
            item.summary,
            item.custom_context_label,
            item.source,
        ].filter(Boolean).join(" ").toLowerCase();
        const score = words.reduce((count, word) => count + (haystack.includes(word) ? 1 : 0), 0);
        return { item, score };
    });

    const directMatches = scored.filter(entry => entry.score > 0).sort((a, b) => b.score - a.score).map(entry => entry.item);
    if (directMatches.length >= Math.min(3, items.length)) return directMatches.slice(0, limit);
    return items.slice(0, limit);
}

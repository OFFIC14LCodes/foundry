export type WorkspaceSourceType = "forge" | "academy" | "market" | "journal" | "bubble" | "pitchpractice" | "chatroom";

export type WorkspaceSource = {
    type: WorkspaceSourceType;
    title?: string | null;
    stageId?: number | null;
    contextId?: string | null;
};

export type WorkspaceGenerated = {
    summary: string;
    notes: string[];
    academyConnections: string[];
    nextSteps: string[];
    decisions: string[];
    openQuestions: string[];
};

export type ConversationWorkspaceSnapshot = {
    version: 1;
    source: WorkspaceSource;
    generated: WorkspaceGenerated;
    user: {
        summaryOverride?: string | null;
        notes: string[];
    };
    updatedAt: string;
};

export const EMPTY_WORKSPACE_GENERATED: WorkspaceGenerated = {
    summary: "",
    notes: [],
    academyConnections: [],
    nextSteps: [],
    decisions: [],
    openQuestions: [],
};

function toStringArray(value: unknown, limit = 12) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, limit);
}

export function createConversationWorkspaceSnapshot(source: WorkspaceSource): ConversationWorkspaceSnapshot {
    return {
        version: 1,
        source,
        generated: { ...EMPTY_WORKSPACE_GENERATED },
        user: { summaryOverride: null, notes: [] },
        updatedAt: new Date().toISOString(),
    };
}

export function normalizeConversationWorkspaceSnapshot(
    value: unknown,
    fallbackSource: WorkspaceSource
): ConversationWorkspaceSnapshot {
    const raw = value && typeof value === "object" ? value as any : null;
    if (!raw) return createConversationWorkspaceSnapshot(fallbackSource);

    const generated = raw.generated && typeof raw.generated === "object"
        ? raw.generated
        : raw;
    const user = raw.user && typeof raw.user === "object" ? raw.user : {};
    const source = raw.source && typeof raw.source === "object" ? raw.source : {};

    return {
        version: 1,
        source: {
            type: source.type || fallbackSource.type,
            title: source.title ?? fallbackSource.title ?? null,
            stageId: typeof source.stageId === "number" ? source.stageId : fallbackSource.stageId ?? null,
            contextId: source.contextId ?? fallbackSource.contextId ?? null,
        },
        generated: {
            summary: String(generated.summary ?? "").trim(),
            notes: toStringArray(generated.notes, 8),
            academyConnections: toStringArray(generated.academyConnections, 6),
            nextSteps: toStringArray(generated.nextSteps, 8),
            decisions: toStringArray(generated.decisions, 6),
            openQuestions: toStringArray(generated.openQuestions, 6),
        },
        user: {
            summaryOverride: typeof user.summaryOverride === "string" ? user.summaryOverride : null,
            notes: toStringArray(user.notes, 20),
        },
        updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    };
}

export function updateWorkspaceGenerated(
    workspace: ConversationWorkspaceSnapshot,
    generated: Partial<WorkspaceGenerated>,
    source?: WorkspaceSource
): ConversationWorkspaceSnapshot {
    return {
        ...workspace,
        source: source ? { ...workspace.source, ...source } : workspace.source,
        generated: {
            summary: generated.summary ?? workspace.generated.summary,
            notes: generated.notes ?? workspace.generated.notes,
            academyConnections: generated.academyConnections ?? workspace.generated.academyConnections,
            nextSteps: generated.nextSteps ?? workspace.generated.nextSteps,
            decisions: generated.decisions ?? workspace.generated.decisions,
            openQuestions: generated.openQuestions ?? workspace.generated.openQuestions,
        },
        updatedAt: new Date().toISOString(),
    };
}

export function updateWorkspaceUser(
    workspace: ConversationWorkspaceSnapshot,
    user: Partial<ConversationWorkspaceSnapshot["user"]>
): ConversationWorkspaceSnapshot {
    return {
        ...workspace,
        user: {
            summaryOverride: user.summaryOverride !== undefined ? user.summaryOverride : workspace.user.summaryOverride,
            notes: user.notes ?? workspace.user.notes,
        },
        updatedAt: new Date().toISOString(),
    };
}

export function getWorkspaceSummary(workspace?: ConversationWorkspaceSnapshot | null) {
    if (!workspace) return "";
    return (workspace.user.summaryOverride || workspace.generated.summary || "").trim();
}

export function getWorkspacePreviewItems(workspace?: ConversationWorkspaceSnapshot | null, limit = 3) {
    if (!workspace) return [];
    return [
        ...workspace.user.notes.map((note) => `Note: ${note}`),
        ...workspace.generated.nextSteps.map((step) => `Next: ${step}`),
        ...workspace.generated.notes,
    ].filter(Boolean).slice(0, limit);
}

export function workspaceHasContent(workspace?: ConversationWorkspaceSnapshot | null) {
    if (!workspace) return false;
    return Boolean(
        getWorkspaceSummary(workspace) ||
        workspace.user.notes.length ||
        workspace.generated.notes.length ||
        workspace.generated.nextSteps.length ||
        workspace.generated.decisions.length ||
        workspace.generated.openQuestions.length
    );
}

export function buildWorkspaceArchiveContext(workspace?: ConversationWorkspaceSnapshot | null) {
    if (!workspace || !workspaceHasContent(workspace)) return "";
    const lines = [
        getWorkspaceSummary(workspace) ? `Focus: ${getWorkspaceSummary(workspace)}` : "",
        workspace.user.notes.length ? `Founder notes: ${workspace.user.notes.join(" | ")}` : "",
        workspace.generated.notes.length ? `Navi notes: ${workspace.generated.notes.join(" | ")}` : "",
        workspace.generated.nextSteps.length ? `Next actions: ${workspace.generated.nextSteps.join(" | ")}` : "",
        workspace.generated.openQuestions.length ? `Open questions: ${workspace.generated.openQuestions.join(" | ")}` : "",
    ].filter(Boolean);
    return lines.join("\n");
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookOpen, CheckCircle2, ClipboardList, HelpCircle, ListChecks, Plus, RefreshCw, Target, Trash2 } from "lucide-react";
import { callForgeAPI } from "../lib/forgeApi";
import type { AcademyTopicLaunch } from "../lib/academy";
import {
    createConversationWorkspaceSnapshot,
    getWorkspaceSummary,
    normalizeConversationWorkspaceSnapshot,
    updateWorkspaceGenerated,
    updateWorkspaceUser,
    type ConversationWorkspaceSnapshot,
    type WorkspaceGenerated,
    type WorkspaceSource,
} from "../lib/conversationWorkspace";

export type ForgeWorkspaceMessage = {
    id?: string;
    role: string;
    text?: string;
    content?: string;
    createdAt?: string;
};

type ForgeConversationWorkspaceProps = {
    messages: ForgeWorkspaceMessage[];
    loading?: boolean;
    title?: string;
    subtitle?: string;
    academyEntry?: AcademyTopicLaunch | null;
    source: WorkspaceSource;
    workspace?: ConversationWorkspaceSnapshot | null;
    onWorkspaceChange?: (workspace: ConversationWorkspaceSnapshot) => void;
    className?: string;
};

function getMessageText(message: ForgeWorkspaceMessage) {
    return (message.text ?? message.content ?? "").trim();
}

function normalizeRole(role: string) {
    return role === "assistant" ? "forge" : role;
}

function cleanJsonCandidate(raw: string) {
    return raw
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
}

function toStringArray(value: unknown, limit = 5) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, limit);
}

function parseWorkspacePayload(raw: string): WorkspaceGenerated | null {
    try {
        const parsed = JSON.parse(cleanJsonCandidate(raw));
        return {
            summary: String(parsed.summary ?? "").trim(),
            notes: toStringArray(parsed.notes, 6),
            academyConnections: toStringArray(parsed.academyConnections, 4),
            nextSteps: toStringArray(parsed.nextSteps, 5),
            decisions: toStringArray(parsed.decisions, 4),
            openQuestions: toStringArray(parsed.openQuestions, 4),
        };
    } catch {
        return null;
    }
}

function sentenceSlice(value: string, limit = 190) {
    const clean = value.replace(/\s+/g, " ").trim();
    if (clean.length <= limit) return clean;
    return `${clean.slice(0, limit).replace(/\s+\S*$/, "")}...`;
}

function buildFallbackGenerated(messages: ForgeWorkspaceMessage[], academyEntry?: AcademyTopicLaunch | null, source?: WorkspaceSource): WorkspaceGenerated {
    const visible = messages.filter((message) => getMessageText(message));
    const lastUser = [...visible].reverse().find((message) => normalizeRole(message.role) === "user");
    const lastForge = [...visible].reverse().find((message) => normalizeRole(message.role) === "forge");
    const userText = lastUser ? getMessageText(lastUser) : "";
    const forgeText = lastForge ? getMessageText(lastForge) : "";

    return {
        summary: academyEntry
            ? `Working through ${academyEntry.title}.`
            : source?.title
                ? `Working inside ${source.title}.`
                : visible.length > 0
                    ? "Forge is building the working summary for this conversation."
                    : "",
        notes: [
            userText ? `User focus: ${sentenceSlice(userText, 150)}` : "",
            forgeText ? `Forge response: ${sentenceSlice(forgeText, 170)}` : "",
        ].filter(Boolean),
        academyConnections: academyEntry
            ? [
                academyEntry.learningGoal || academyEntry.whyThisMatters || `This connects to the ${academyEntry.title} lesson.`,
            ].filter(Boolean)
            : [],
        nextSteps: forgeText ? ["Review Forge's latest response and decide what needs to become an action."] : [],
        decisions: [],
        openQuestions: userText && userText.endsWith("?") ? [sentenceSlice(userText, 130)] : [],
    };
}

function mergeGenerated(primary: WorkspaceGenerated, fallback: WorkspaceGenerated): WorkspaceGenerated {
    return {
        summary: primary.summary || fallback.summary,
        notes: primary.notes.length ? primary.notes : fallback.notes,
        academyConnections: primary.academyConnections.length ? primary.academyConnections : fallback.academyConnections,
        nextSteps: primary.nextSteps.length ? primary.nextSteps : fallback.nextSteps,
        decisions: primary.decisions.length ? primary.decisions : fallback.decisions,
        openQuestions: primary.openQuestions.length ? primary.openQuestions : fallback.openQuestions,
    };
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <section className="forge-conversation-workspace__section">
            <div className="forge-conversation-workspace__section-title">
                {icon}
                <span>{title}</span>
            </div>
            {children}
        </section>
    );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
    if (!items.length) return <div className="forge-conversation-workspace__empty-line">{empty}</div>;
    return (
        <ul className="forge-conversation-workspace__list">
            {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ul>
    );
}

export default function ForgeConversationWorkspace({
    messages,
    loading = false,
    title = "Forge Workspace",
    subtitle = "Live notes, connections, and next steps",
    academyEntry = null,
    source,
    workspace,
    onWorkspaceChange,
    className,
}: ForgeConversationWorkspaceProps) {
    const [internalWorkspace, setInternalWorkspace] = useState(() => createConversationWorkspaceSnapshot(source));
    const [draftNote, setDraftNote] = useState("");
    const [updating, setUpdating] = useState(false);
    const requestedKeyRef = useRef("");

    const activeWorkspace = useMemo(
        () => normalizeConversationWorkspaceSnapshot(workspace ?? internalWorkspace, source),
        [workspace, internalWorkspace, source]
    );

    const commitWorkspace = (next: ConversationWorkspaceSnapshot) => {
        if (onWorkspaceChange) onWorkspaceChange(next);
        else setInternalWorkspace(next);
    };

    const visibleMessages = useMemo(
        () => messages.filter((message) => getMessageText(message)),
        [messages]
    );

    const transcriptKey = useMemo(() => (
        visibleMessages
            .slice(-10)
            .map((message) => `${normalizeRole(message.role)}:${getMessageText(message).slice(0, 700)}`)
            .join("\n---\n")
    ), [visibleMessages]);

    const fallbackGenerated = useMemo(
        () => buildFallbackGenerated(visibleMessages, academyEntry, source),
        [visibleMessages, academyEntry, source]
    );

    useEffect(() => {
        if (visibleMessages.length === 0) {
            if (!workspace) setInternalWorkspace(createConversationWorkspaceSnapshot(source));
            requestedKeyRef.current = "";
            return;
        }
        if (visibleMessages.length < 2 || loading) {
            commitWorkspace(updateWorkspaceGenerated(activeWorkspace, fallbackGenerated, source));
        }
    }, [fallbackGenerated, loading, source, visibleMessages.length]);

    useEffect(() => {
        const lastMessage = visibleMessages[visibleMessages.length - 1];
        const lastRole = lastMessage ? normalizeRole(lastMessage.role) : "";
        if (!transcriptKey || visibleMessages.length < 2 || loading || lastRole !== "forge") return;
        if (requestedKeyRef.current === transcriptKey) return;

        let cancelled = false;
        const timeout = window.setTimeout(async () => {
            requestedKeyRef.current = transcriptKey;
            setUpdating(true);
            const transcript = visibleMessages
                .slice(-12)
                .map((message) => `${normalizeRole(message.role).toUpperCase()}: ${getMessageText(message)}`)
                .join("\n\n");

            const userNotes = activeWorkspace.user.notes.length
                ? activeWorkspace.user.notes.map((note) => `- ${note}`).join("\n")
                : "none";

            const prompt = `Create a live workspace update for this Forge conversation.

Context:
- Source: ${source.type}
- Source title: ${source.title ?? "none"}
- Stage: ${source.stageId ?? "unknown"}
- Academy lesson: ${academyEntry?.title ?? "none"}
- Academy learning goal: ${academyEntry?.learningGoal ?? "none"}

Founder-owned notes, corrections, and additions. Treat these as higher authority than the transcript:
${userNotes}

Transcript:
${transcript}

Return strict JSON only with this shape:
{
  "summary": "one precise sentence about what was discussed",
  "notes": ["2-5 important notes from the conversation"],
  "academyConnections": ["0-3 relevant Academy lesson/concept connections"],
  "nextSteps": ["1-4 concrete actions the founder should take next"],
  "decisions": ["0-3 decisions or commitments made"],
  "openQuestions": ["0-3 unresolved questions Forge should help clarify"]
}`;

            try {
                const raw = await callForgeAPI(
                    [{ role: "user", content: prompt }],
                    "You are Forge's workspace engine. Build a founder learning record, not a transcript. User-owned notes are authoritative. Return strict JSON only.",
                    700
                );
                if (cancelled) return;
                const parsed = parseWorkspacePayload(raw);
                const generated = mergeGenerated(parsed ?? fallbackGenerated, fallbackGenerated);
                commitWorkspace(updateWorkspaceGenerated(activeWorkspace, generated, source));
            } catch (error) {
                console.warn("Forge workspace update failed:", error);
                if (!cancelled) commitWorkspace(updateWorkspaceGenerated(activeWorkspace, fallbackGenerated, source));
            } finally {
                if (!cancelled) setUpdating(false);
            }
        }, 900);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [academyEntry, activeWorkspace, fallbackGenerated, loading, source, transcriptKey, visibleMessages]);

    const focusValue = getWorkspaceSummary(activeWorkspace);
    const isFounderEdited = Boolean(activeWorkspace.user.summaryOverride?.trim());
    const modeLabel = source.type === "academy" ? "Academy" : source.type === "market" ? "Market Intel" : source.stageId ? `Stage ${source.stageId}` : "Forge";
    const openThreads = [...activeWorkspace.generated.decisions, ...activeWorkspace.generated.openQuestions];

    const updateSummaryOverride = (value: string) => {
        commitWorkspace(updateWorkspaceUser(activeWorkspace, { summaryOverride: value.trim() ? value : null }));
    };

    const addUserNote = () => {
        const note = draftNote.trim();
        if (!note) return;
        commitWorkspace(updateWorkspaceUser(activeWorkspace, { notes: [...activeWorkspace.user.notes, note] }));
        setDraftNote("");
    };

    const updateUserNote = (index: number, value: string) => {
        const next = activeWorkspace.user.notes.map((note, noteIndex) => noteIndex === index ? value : note).filter((note) => note.trim());
        commitWorkspace(updateWorkspaceUser(activeWorkspace, { notes: next }));
    };

    const deleteUserNote = (index: number) => {
        commitWorkspace(updateWorkspaceUser(activeWorkspace, { notes: activeWorkspace.user.notes.filter((_, noteIndex) => noteIndex !== index) }));
    };

    return (
        <aside className={`forge-conversation-workspace ${className ?? ""}`.trim()}>
            <div className="forge-conversation-workspace__header">
                <div>
                    <div className="forge-conversation-workspace__eyebrow">{modeLabel}</div>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                </div>
                <div className={`forge-conversation-workspace__status ${updating ? "is-updating" : ""}`} title={updating ? "Forge is updating the workspace" : "Workspace current"}>
                    {updating ? <RefreshCw size={14} /> : <CheckCircle2 size={14} />}
                </div>
            </div>

            <div className="forge-conversation-workspace__body">
                <Section icon={<Target size={14} />} title="Current Focus">
                    <textarea
                        className="forge-conversation-workspace__focus-input"
                        value={focusValue}
                        onChange={(event) => updateSummaryOverride(event.target.value)}
                        placeholder="Forge will summarize the main thread here. You can edit this if it misses the point."
                    />
                    <div className="forge-conversation-workspace__ownership-row">
                        <span>{isFounderEdited ? "Founder-edited focus" : "Forge-generated focus"}</span>
                        {isFounderEdited && (
                            <button onClick={() => updateSummaryOverride("")}>Use Forge version</button>
                        )}
                    </div>
                    {academyEntry && (
                        <div className="forge-conversation-workspace__lesson">
                            <span>{academyEntry.categoryTitle || "Academy"}</span>
                            <strong>{academyEntry.title}</strong>
                        </div>
                    )}
                </Section>

                <Section icon={<ClipboardList size={14} />} title="Founder Notes">
                    <div className="forge-conversation-workspace__user-notes">
                        {activeWorkspace.user.notes.map((note, index) => (
                            <div key={`${index}-${note}`} className="forge-conversation-workspace__user-note">
                                <textarea
                                    value={note}
                                    onChange={(event) => updateUserNote(index, event.target.value)}
                                    aria-label={`Founder note ${index + 1}`}
                                />
                                <button onClick={() => deleteUserNote(index)} title="Delete note">
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))}
                        <div className="forge-conversation-workspace__add-note">
                            <textarea
                                value={draftNote}
                                onChange={(event) => setDraftNote(event.target.value)}
                                placeholder="Add a correction, personal note, or something you want Forge to remember for this chat."
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) addUserNote();
                                }}
                            />
                            <button onClick={addUserNote} disabled={!draftNote.trim()} title="Add note">
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                </Section>

                <Section icon={<ClipboardList size={14} />} title="Forge Notes">
                    <BulletList items={activeWorkspace.generated.notes} empty="Forge will extract useful notes after it has enough conversation context." />
                </Section>

                <Section icon={<BookOpen size={14} />} title="Academy Links">
                    <BulletList items={activeWorkspace.generated.academyConnections} empty="Relevant lessons and concepts will appear here when the conversation connects to Academy." />
                </Section>

                <Section icon={<ListChecks size={14} />} title="Next Actions">
                    <BulletList items={activeWorkspace.generated.nextSteps} empty="Action steps will appear after Forge has enough context to recommend useful movement." />
                </Section>

                <Section icon={<HelpCircle size={14} />} title="Open Threads">
                    <BulletList items={openThreads} empty="Decisions, unresolved questions, and follow-ups will collect here." />
                </Section>
            </div>
        </aside>
    );
}

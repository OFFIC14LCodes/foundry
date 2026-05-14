import { callForgeAPI } from "./forgeApi";
import { getArchiveDisplaySummary } from "./archiveSummary";
import {
    loadFounderBooks,
    recordFounderBookSource,
    upsertFounderBook,
    type FounderBook,
    type FounderBookType,
} from "../db";
import type { ConversationWorkspaceSnapshot } from "./conversationWorkspace";
import type { AcademyTopicLaunch } from "./academy";
import type { MarketTrend } from "../db";

type ArchiveRecord = {
    id: string;
    title: string;
    summary: string;
    stageId?: number | null;
    date?: string | null;
    workspaceSnapshot?: ConversationWorkspaceSnapshot | null;
};

type UpdateInput = {
    userId: string;
    archive: ArchiveRecord;
    sourceType: FounderBookType;
    sourceLabel: string;
    sourceRefId?: string | null;
    stageId?: number | null;
    academyEntry?: AcademyTopicLaunch | null;
    marketEntry?: MarketTrend | null;
    workspace?: ConversationWorkspaceSnapshot | null;
    transcript?: string;
};

const BOOK_TITLES: Record<FounderBookType, string> = {
    business: "Business Book",
    academy: "Academy Book",
    quick_chat: "Quick Chat Book",
    market_intelligence: "Market Intelligence Book",
    pitch_practice: "Pitch Practice Book",
    chat_room: "Chat Room Book",
};

export function getFounderBookTitle(bookType: FounderBookType) {
    return BOOK_TITLES[bookType];
}

export function inferBookTypeFromArchiveTitle(title: string): FounderBookType {
    if (title.startsWith("Academy —")) return "academy";
    if (title.startsWith("Quick Chat")) return "quick_chat";
    if (title.startsWith("Market Intel —")) return "market_intelligence";
    if (title.startsWith("Pitch Practice —")) return "pitch_practice";
    if (title.startsWith("Chat with Forge")) return "chat_room";
    return "business";
}

function formatWorkspace(workspace?: ConversationWorkspaceSnapshot | null) {
    if (!workspace) return "No workspace snapshot was saved.";
    const lines = [
        workspace.user?.summaryOverride || workspace.generated?.summary
            ? `Focus: ${workspace.user?.summaryOverride || workspace.generated?.summary}`
            : "",
        workspace.user?.notes?.length ? `Founder notes:\n${workspace.user.notes.map((note) => `- ${note}`).join("\n")}` : "",
        workspace.generated?.notes?.length ? `Forge notes:\n${workspace.generated.notes.map((note) => `- ${note}`).join("\n")}` : "",
        workspace.generated?.academyConnections?.length ? `Academy connections:\n${workspace.generated.academyConnections.map((note) => `- ${note}`).join("\n")}` : "",
        workspace.generated?.nextSteps?.length ? `Next actions:\n${workspace.generated.nextSteps.map((step) => `- ${step}`).join("\n")}` : "",
        workspace.generated?.decisions?.length ? `Decisions:\n${workspace.generated.decisions.map((decision) => `- ${decision}`).join("\n")}` : "",
        workspace.generated?.openQuestions?.length ? `Open questions:\n${workspace.generated.openQuestions.map((question) => `- ${question}`).join("\n")}` : "",
    ].filter(Boolean);
    return lines.join("\n\n") || "No workspace notes were saved.";
}

function getSourceStageId(input: UpdateInput) {
    if (input.sourceType === "academy") {
        return input.academyEntry?.stageIds?.[0] ?? input.stageId ?? input.archive.stageId ?? null;
    }
    return input.stageId ?? input.archive.stageId ?? input.academyEntry?.stageIds?.[0] ?? null;
}

function buildBookUpdatePrompt(input: UpdateInput, existingBook: FounderBook | null) {
    const isAcademy = input.sourceType === "academy";
    const sourceStage = getSourceStageId(input);
    const sourceStageLabel = isAcademy ? "Academy lesson stage" : "Stage";
    return `Update this founder's private ${getFounderBookTitle(input.sourceType)}.

This book is a living learning document. It should accumulate useful notes from archived Forge conversations. Most recent understanding takes precedence. If the new archive updates, corrects, or improves older notes, rewrite the relevant section so the current version is clean and current. Do not keep stale conflicting notes unless the conflict itself is important.

Required format:
- Use markdown.
- Use bullet points for notes.
- At the bottom of each section include a heading exactly named "Forge Summary" followed by a polished paragraph.
${isAcademy ? '- Organize Academy content by the lesson stage from Academy, then by lesson. Use labels like "Stage 1 Lessons" and never use the founder\'s current business stage unless it is also the lesson stage.' : "- Organize content into practical sections. Use source titles as subsection labels when helpful."}
- Do not include a transcript dump.
- Keep it useful as a reference book, not a chat summary.

Existing book:
${existingBook?.content?.trim() || "(empty book)"}

New archive source:
Book type: ${input.sourceType}
Source label: ${input.sourceLabel}
Archive title: ${input.archive.title}
Archive date: ${input.archive.date || new Date().toISOString().slice(0, 10)}
${sourceStageLabel}: ${sourceStage ?? "unknown"}
Source ref id: ${input.sourceRefId || "none"}

${input.academyEntry ? `Academy lesson:
Title: ${input.academyEntry.title}
Category: ${input.academyEntry.categoryTitle || "Forge Academy"}
Stages: ${input.academyEntry.stageIds.join(", ") || sourceStage || "unknown"}
Learning goal: ${input.academyEntry.learningGoal || "not set"}
Why this matters: ${input.academyEntry.whyThisMatters || "not set"}` : ""}

${input.marketEntry ? `Market intelligence source:
Trend: ${input.marketEntry.name}
Impact: ${input.marketEntry.impactLevel}
Timeframe: ${input.marketEntry.timeframe}
Description: ${input.marketEntry.description}` : ""}

Archive summary:
${getArchiveDisplaySummary(input.archive.summary)}

Workspace notes:
${formatWorkspace(input.workspace ?? input.archive.workspaceSnapshot)}

${input.transcript ? `Conversation transcript:
${input.transcript}` : ""}

Return the full updated book content only.`;
}

export async function updateFounderBookFromArchive(input: UpdateInput): Promise<FounderBook | null> {
    try {
        const books = await loadFounderBooks(input.userId);
        const existingBook = books.find((book) => book.bookType === input.sourceType) ?? null;
        const title = getFounderBookTitle(input.sourceType);
        const content = await callForgeAPI(
            [{ role: "user", content: buildBookUpdatePrompt(input, existingBook) }],
            "You maintain private founder reference books. Rewrite the full book cleanly using the newest archive as the latest source of truth. Return only markdown.",
            2400
        );
        const saved = await upsertFounderBook(input.userId, input.sourceType, title, content, {
            lastArchiveId: input.archive.id,
            lastSourceLabel: input.sourceLabel,
            lastSourceRefId: input.sourceRefId ?? null,
            lastUpdatedByForgeAt: new Date().toISOString(),
        });
        if (saved) {
            await recordFounderBookSource(input.userId, saved.id, {
                archiveSummaryId: input.archive.id,
                sourceType: input.sourceType,
                sourceRefId: input.sourceRefId ?? null,
                sourceTitle: input.archive.title,
                sourceStageId: getSourceStageId(input),
                sourceMetadata: {
                    sourceLabel: input.sourceLabel,
                    academyLessonTitle: input.academyEntry?.title ?? null,
                    marketTrendName: input.marketEntry?.name ?? null,
                },
            });
        }
        return saved;
    } catch (error) {
        console.error("updateFounderBookFromArchive error:", error);
        return null;
    }
}

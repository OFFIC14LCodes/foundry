import { useEffect, useRef, useState } from "react";
import { callForgeAPI, streamForgeAPI } from "../lib/forgeApi";
import { AnimatedChatText, renderText, MessageActions } from "./AnimatedChatText";
import { processFile, buildMessageContent, type AttachedFile } from "../lib/fileAttach";
import { FORGE_SYSTEM_PROMPT } from "../constants/prompts";
import { saveConversationSummary } from "../db";
import { parseArchiveSummaryPayload } from "../lib/archiveSummary";
import { updateFounderBookFromArchive } from "../lib/founderBooks";
import { applyFoundryBookCitations, buildFoundryBookContext } from "../lib/foundryBook";
import { buildVentureModeContext, getVentureModeLabel, isSideHustleMode } from "../lib/ventureMode";
import ForgeAvatar from "./ForgeAvatar";
import TypingDots from "./TypingDots";
import Logo from "./Logo";
import MicButton from "./MicButton";

interface BubbleMessage {
    id: string;
    role: "user" | "forge";
    text: string;
    createdAt: string;
}

interface DocContext {
    phase: string;
    categoryName: string | null;
    documentName: string | null;
    documentContent: string | null;
}

export interface AcademyBubbleContext {
    screen: "ForgeAcademy";
    activeLesson: {
        title: string;
        discipline: string;
        description: string;
        whyItMatters: string;
    } | null;
    currentFilter: string;
    stage: number;
}

interface ForgeBubbleProps {
    profile: any;
    userId: string;
    currentScreen: string;
    screenContext?: DocContext | AcademyBubbleContext | null;
    onBubbleSummaryAdded?: (summary: any) => void;
    universalMemoryContext?: string;
}

const SCREEN_LABELS: Record<string, string> = {
    hub: "the Hub (their main dashboard — shows stage progress, decisions log, and budget)",
    forge: "the Navi chat (their active AI coaching session)",
    journal: "the Journal (personal notes and reflections)",
    settings: "Settings",
    briefings: "the Briefings screen",
    pitchPractice: "the Pitch Practice screen",
    documents: "the Document Production screen",
    marketIntel: "the Market Intelligence screen",
    cofounder: "the Co-Founder Mode screen",
    chatRoom: "the Chat Room (open-ended learning and conversation with Navi)",
    academy: "Navi Academy (the curated founder education section)",
};

const DOC_PHASE_LABELS: Record<string, string> = {
    categories: "browsing document categories",
    documents: "browsing documents within a category",
    configure: "configuring document settings before generation",
    studio: "viewing or refining a produced document in the Studio",
};


const BUBBLE_SIZE = 56;
const BUBBLE_STORAGE_KEY = "forge-bubble-pos";
const SCREEN_TEXT_LIMIT = 6000;

function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val));
}

function loadSavedPos(): { bottom: number; right: number } {
    try {
        const stored = localStorage.getItem(BUBBLE_STORAGE_KEY);
        if (stored) {
            const p = JSON.parse(stored);
            if (typeof p.bottom === "number" && typeof p.right === "number") return p;
        }
    } catch {}
    return { bottom: 24, right: 24 };
}

function collectVisibleScreenText() {
    if (typeof document === "undefined") return "";
    const body = document.body;
    if (!body) return "";

    const lines: string[] = [];
    let totalLength = 0;
    const walker = document.createTreeWalker(
        body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const text = node.textContent?.replace(/\s+/g, " ").trim();
                if (!text) return NodeFilter.FILTER_REJECT;

                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (parent.closest("[data-forge-bubble]")) return NodeFilter.FILTER_REJECT;

                const tagName = parent.tagName.toLowerCase();
                if (["script", "style", "noscript", "svg"].includes(tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }

                let element: HTMLElement | null = parent;
                while (element && element !== body) {
                    const style = window.getComputedStyle(element);
                    if (
                        style.display === "none" ||
                        style.visibility === "hidden" ||
                        style.opacity === "0" ||
                        element.getAttribute("aria-hidden") === "true"
                    ) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    element = element.parentElement;
                }

                const rect = parent.getBoundingClientRect();
                const isInViewport = rect.bottom >= 0 &&
                    rect.right >= 0 &&
                    rect.top <= window.innerHeight &&
                    rect.left <= window.innerWidth;

                return isInViewport ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            },
        },
    );

    while (walker.nextNode() && totalLength < SCREEN_TEXT_LIMIT) {
        const text = walker.currentNode.textContent?.replace(/\s+/g, " ").trim();
        if (!text) continue;
        const previous = lines[lines.length - 1];
        if (previous === text) continue;
        lines.push(text);
        totalLength += text.length + 1;
    }

    return lines.join("\n").slice(0, SCREEN_TEXT_LIMIT).trim();
}

export default function ForgeBubble({ profile, userId, currentScreen, screenContext, onBubbleSummaryAdded, universalMemoryContext = "" }: ForgeBubbleProps) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<BubbleMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [closing, setClosing] = useState(false);
    const [pos, setPos] = useState(loadSavedPos);
    const [dragging, setDragging] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const sessionStartRef = useRef<string | null>(null);
    const posRef = useRef(pos);
    const dragState = useRef<{
        moved: boolean;
        startX: number;
        startY: number;
        startBottom: number;
        startRight: number;
    } | null>(null);

    useEffect(() => { posRef.current = pos; }, [pos]);

    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        dragState.current = {
            moved: false,
            startX: e.clientX,
            startY: e.clientY,
            startBottom: posRef.current.bottom,
            startRight: posRef.current.right,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
        const ds = dragState.current;
        if (!ds) return;
        const dx = e.clientX - ds.startX;
        const dy = e.clientY - ds.startY;
        if (!ds.moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (!ds.moved) { ds.moved = true; setDragging(true); }
        const margin = 8;
        const newRight = clamp(ds.startRight - dx, margin, window.innerWidth - BUBBLE_SIZE - margin);
        const newBottom = clamp(ds.startBottom - dy, margin, window.innerHeight - BUBBLE_SIZE - margin);
        setPos({ bottom: newBottom, right: newRight });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
        const ds = dragState.current;
        dragState.current = null;
        setDragging(false);
        if (ds?.moved) {
            localStorage.setItem(BUBBLE_STORAGE_KEY, JSON.stringify(posRef.current));
        } else if (open) {
            handleClose();
        } else {
            setOpen(true);
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    const buildContext = (currentPrompt: string) => {
        const now = new Date();
        const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
        const visibleScreenText = collectVisibleScreenText();
        const bookContext = buildFoundryBookContext(
            Number(profile.currentStage) || 1,
            [...messages.slice(-4).map((message) => message.text), currentPrompt],
            4
        );

        let screenLabel = SCREEN_LABELS[currentScreen] || currentScreen;
        let documentSection = "";

        if (currentScreen === "documents" && screenContext && "phase" in screenContext) {
            const docCtx = screenContext as DocContext;
            const phaseLabel = DOC_PHASE_LABELS[docCtx.phase] || docCtx.phase;
            const parts: string[] = [`the Document Production screen — currently ${phaseLabel}`];
            if (docCtx.categoryName) parts.push(`Category: ${docCtx.categoryName}`);
            if (docCtx.documentName) parts.push(`Document: ${docCtx.documentName}`);
            screenLabel = parts.join(" | ");

            if (docCtx.documentContent) {
                documentSection = `\n\nCURRENT PRODUCED DOCUMENT ("${docCtx.documentName ?? "Document"}"):\nThe founder has produced the following document and may be asking about it, requesting changes, or seeking clarification. Read it carefully before responding.\n\n${docCtx.documentContent}`;
            }
        }

        if (currentScreen === "academy" && screenContext && "screen" in screenContext) {
            const ctx = screenContext as AcademyBubbleContext;
            const filterLabel = ctx.currentFilter === "all" ? "all disciplines" : ctx.currentFilter;
            if (ctx.activeLesson) {
                screenLabel = `Navi Academy — currently studying: "${ctx.activeLesson.title}" (${ctx.activeLesson.discipline})`;
                documentSection = `\n\nACTIVE ACADEMY LESSON:\nThe founder has this lesson open in Navi Academy. They may be asking about it or want to go deeper.\nTitle: ${ctx.activeLesson.title}\nDiscipline: ${ctx.activeLesson.discipline}\nDescription: ${ctx.activeLesson.description}\nWhy it matters: ${ctx.activeLesson.whyItMatters}\n\nBecause the founder has this lesson open, ground your response in this topic. Do not wait for them to ask a perfectly formed question — if they seem stuck, help them connect the lesson to their actual business situation.`;
            } else {
                screenLabel = `Navi Academy — browsing ${filterLabel}, Stage ${ctx.stage}`;
            }
        }

        return {
            context: `
Current date: ${dateStr}
The founder is currently viewing ${screenLabel}.
${buildVentureModeContext(profile)}

Founder: ${profile.name} | Venture mode: ${getVentureModeLabel(profile)} | ${isSideHustleMode(profile) ? "Side hustle / offer" : "Business"}: ${profile.businessName || profile.idea || "Idea stage"} (${profile.industry || "Early Stage"})
Strategy: ${profile.strategyLabel || profile.strategy} | Current Stage: ${profile.currentStage} | Experience: ${profile.experience || "Not specified"}
Goal / constraints: ${profile.ventureGoal || "Not specified"} | Weekly hours: ${profile.weeklyHoursAvailable ?? "Unknown"} | Target monthly income: ${profile.targetMonthlyIncome ? `$${Number(profile.targetMonthlyIncome).toLocaleString()}` : "Unknown"}
Budget: $${(profile.budget?.remaining || 0).toLocaleString()} remaining of $${(profile.budget?.total || 0).toLocaleString()} | Spent: $${(profile.budget?.spent || 0).toLocaleString()}

You are in a quick-access floating chat bubble. The founder is asking a quick question or needs help with what they're looking at. Be helpful, warm, and concise — this is a quick-assist context, not a deep coaching session. You are still Navi — same personality, same expertise — just more conversational. You can help them understand what they see on the screen, navigate the app, or think through a quick question.${documentSection}
${visibleScreenText ? `\n\nVISIBLE SCREEN TEXT SNAPSHOT:\nThis is text currently visible in the Tekori app viewport, excluding the Navi bubble itself. If the founder asks about "this", "what I'm reading", "this screen", or any visible item, use this as immediate screen context.\n\n${visibleScreenText}` : ""}
${universalMemoryContext ? `\n\n${universalMemoryContext}` : ""}
${bookContext.context ? `\n\n${bookContext.context}` : ""}
        `.trim(),
            bookMatches: bookContext.matches,
        };
    };

    const send = async () => {
        if ((!input.trim() && attachedFiles.length === 0) || loading) return;
        if (!sessionStartRef.current) {
            sessionStartRef.current = new Date().toISOString();
        }

        const text = input.trim();
        const currentFiles = [...attachedFiles];
        setInput("");
        setAttachedFiles([]);

        const attachmentLabel = currentFiles.length > 0
            ? `[Attached: ${currentFiles.map(f => f.name).join(", ")}]`
            : "";
        const displayText = [attachmentLabel, text].filter(Boolean).join("\n");

        const timestamp = new Date().toISOString();
        const userMsg: BubbleMessage = { id: `u-${Date.now()}`, role: "user", text: displayText, createdAt: timestamp };
        const forgeMsg: BubbleMessage = { id: `f-${Date.now()}`, role: "forge", text: "", createdAt: new Date().toISOString() };

        const currentMessages = [...messages, userMsg];
        setMessages([...currentMessages, forgeMsg]);
        setLoading(true);

        try {
            const ctx = buildContext(text);
            const apiMsgs = [
                ...currentMessages.slice(0, -1).map(m => ({
                    role: m.role === "forge" ? "assistant" : "user",
                    content: m.text,
                })),
                {
                    role: "user" as const,
                    content: buildMessageContent(text, currentFiles),
                },
            ];

            await streamForgeAPI(
                apiMsgs,
                FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", ctx.context),
                (chunk) => {
                    const { cleanText } = applyFoundryBookCitations(chunk, ctx.bookMatches);
                    setMessages(prev => prev.map(m => m.id === forgeMsg.id ? { ...m, text: cleanText } : m));
                }
            );
        } catch {
            setMessages(prev => prev.map(m =>
                m.id === forgeMsg.id ? { ...m, text: "Something went wrong. Try again." } : m
            ));
        }

        setLoading(false);
    };

    const handleClose = async () => {
        setOpen(false);
        const msgsToArchive = [...messages];
        if (msgsToArchive.length === 0) return;

        setClosing(true);
        const sessionDate = sessionStartRef.current || new Date().toISOString();
        const dateKey = new Date(sessionDate).toISOString().split("T")[0];

        const transcript = msgsToArchive
            .map(m => `${m.role === "forge" ? "Navi" : profile.name}: ${m.text}`)
            .join("\n");

        const displayDate = new Date(sessionDate).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric"
        });
        const summaryStageId = Math.min(6, Math.max(1, Number(profile.currentStage) || 1));

        try {
            const raw = await callForgeAPI(
                [{
                    role: "user",
                    content: `Summarize this quick Navi chat for ${profile.name} on ${displayDate}.\n\nReturn valid JSON with exactly these keys:\n"title": a concise headline under 80 characters describing the main topic\n"summary": a brief markdown summary of key questions asked and answers given.\n\nConversation:\n${transcript}`
                }],
                "You write clean business conversation summaries. Return only valid JSON."
            );

            const parsed = parseArchiveSummaryPayload(raw, `Quick Chat — ${displayDate}`);
            const { title, summary } = parsed;
            const prefixedTitle = title.startsWith("Quick Chat") ? title : `Quick Chat — ${title}`;

            const saved = await saveConversationSummary(userId, summaryStageId, dateKey, prefixedTitle, summary, msgsToArchive.length);
            if (saved) {
                void updateFounderBookFromArchive({
                    userId,
                    archive: saved,
                    sourceType: "quick_chat",
                    sourceLabel: "Quick Chat",
                    sourceRefId: currentScreen || null,
                    stageId: summaryStageId,
                    transcript,
                });
            }
            if (saved && onBubbleSummaryAdded) {
                onBubbleSummaryAdded(saved);
            }
        } catch (e) {
            console.error("bubble archive error:", e);
        }

        setMessages([]);
        sessionStartRef.current = null;
        setClosing(false);
    };

    const hasMessages = messages.length > 0;

    return (
        <>
            {/* Chat Window */}
            {open && (
                <div
                    data-forge-bubble="true"
                    style={{
                        position: "fixed",
                        bottom: pos.bottom + BUBBLE_SIZE + 12,
                        right: pos.right,
                        zIndex: 200,
                        width: "min(370px, calc(100vw - 32px))",
                        height: "min(520px, calc(100vh - 120px))",
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 18,
                        display: "flex",
                        flexDirection: "column",
                        boxShadow: "var(--shadow-premium)",
                        overflow: "hidden",
                        fontFamily: "var(--tekori-font-ui)",
                        animation: "bubbleSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: "13px 16px",
                            borderBottom: "1px solid rgba(7,26,47,0.06)",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            background: "rgba(7,26,47,0.02)",
                            flexShrink: 0,
                        }}
                    >
                        <ForgeAvatar size={30} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)", lineHeight: 1.2 }}>
                                Ask Navi
                            </div>
                            <div style={{ fontSize: 10, color: "var(--tekori-gold)", marginTop: 1 }}>
                                ● Quick help · always here
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            title={hasMessages ? "Close & archive this chat" : "Close"}
                            style={{
                                background: "rgba(7,26,47,0.05)",
                                border: "1px solid rgba(7,26,47,0.08)",
                                borderRadius: 8,
                                padding: "5px 10px",
                                color: "var(--color-text-muted)",
                                fontSize: 11,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                transition: "all 0.15s",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(7,26,47,0.09)"; e.currentTarget.style.color = "var(--color-text)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(7,26,47,0.05)"; e.currentTarget.style.color = "var(--color-text-muted)"; }}
                        >
                            {hasMessages ? (
                                <>
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                        <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                    Archive
                                </>
                            ) : (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                            )}
                        </button>
                    </div>

                    {/* Messages */}
                    <div
                        ref={scrollRef}
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            padding: "14px 14px 8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                        }}
                    >
                        {messages.length === 0 && (
                            <div
                                style={{
                                    flex: 1,
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    textAlign: "center",
                                    padding: "20px 16px",
                                    gap: 10,
                                }}
                            >
                                <div
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "50%",
                                        background: "linear-gradient(135deg, var(--color-bg-warm), var(--color-bg-warm))",
                                        border: "1px solid rgba(216,155,43,0.2)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Logo variant="forge" style={{ width: 28, height: 28, objectFit: "contain" }} />
                                </div>
                                <div style={{ fontSize: 13, color: "var(--color-text-soft)", fontWeight: 500 }}>
                                    What can I help with?
                                </div>
                                <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", lineHeight: 1.6, maxWidth: 240 }}>
                                    Ask me anything about what you're seeing, or just think out loud. I'm here.
                                </div>
                            </div>
                        )}

                        {messages.filter(msg => !(msg.role === "forge" && !msg.text)).map((msg) => (
                            <div
                                key={msg.id}
                                style={{
                                    display: "flex",
                                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                                    alignItems: "flex-start",
                                    gap: 8,
                                }}
                            >
                                {msg.role === "forge" && <ForgeAvatar size={24} />}
                                <div style={{ display: "flex", flexDirection: "column", maxWidth: "82%" }}>
                                    <div
                                        style={{
                                            padding: "9px 12px",
                                            borderRadius: msg.role === "user"
                                                ? "14px 4px 14px 14px"
                                                : "4px 14px 14px 14px",
                                            background: msg.role === "user"
                                                ? "rgba(216,155,43,0.14)"
                                                : "rgba(7,26,47,0.04)",
                                            border: msg.role === "user"
                                                ? "1px solid rgba(216,155,43,0.22)"
                                                : "1px solid rgba(7,26,47,0.07)",
                                            fontSize: 12.5,
                                            color: msg.role === "user" ? "var(--color-text)" : "var(--color-text-soft)",
                                            lineHeight: 1.65,
                                            textAlign: "left",
                                        }}
                                    >
                                        {msg.role === "forge"
                                            ? <AnimatedChatText text={msg.text} createdAt={msg.createdAt} />
                                            : renderText(msg.text)}
                                    </div>
                                    {msg.role === "forge" && (
                                        <MessageActions
                                            text={msg.text}
                                            feedbackContext={{
                                                surface: "Quick Chat",
                                                conversationTitle: `Quick Chat · ${currentScreen}`,
                                                stageId: Number(profile.currentStage) || null,
                                                messageId: msg.id,
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                <ForgeAvatar size={24} />
                                <div
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: "4px 14px 14px 14px",
                                        background: "rgba(7,26,47,0.04)",
                                        border: "1px solid rgba(7,26,47,0.07)",
                                    }}
                                >
                                    <TypingDots />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div
                        style={{
                            padding: "8px 12px 10px",
                            borderTop: "1px solid rgba(7,26,47,0.05)",
                            background: "rgba(255,252,246,0.92)",
                            flexShrink: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                        }}
                    >
                        {/* Attached file chips */}
                        {attachedFiles.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {attachedFiles.map(file => (
                                    <div
                                        key={file.id}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 4,
                                            background: "rgba(216,155,43,0.08)",
                                            border: "1px solid rgba(216,155,43,0.2)",
                                            borderRadius: 7,
                                            padding: "3px 7px 3px 5px",
                                            maxWidth: 180,
                                        }}
                                    >
                                        {file.isImage && file.previewUrl ? (
                                            <img src={file.previewUrl} alt={file.name} style={{ width: 16, height: 16, borderRadius: 3, objectFit: "cover", flexShrink: 0 }} />
                                        ) : (
                                            <span style={{ fontSize: 11, flexShrink: 0 }}>{file.isPDF ? "📄" : "📝"}</span>
                                        )}
                                        <span style={{ fontSize: 10, color: "var(--color-text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {file.name}
                                        </span>
                                        <button
                                            onClick={() => {
                                                if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
                                                setAttachedFiles(prev => prev.filter(f => f.id !== file.id));
                                            }}
                                            style={{ background: "none", border: "none", color: "var(--foundry-text-muted)", cursor: "pointer", padding: 0, fontSize: 12, lineHeight: 1, flexShrink: 0 }}
                                        >×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Text row */}
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                            {/* Paperclip */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                title="Attach file"
                                style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    color: attachedFiles.length > 0 ? "var(--tekori-gold)" : "var(--color-text-muted)",
                                    padding: "4px",
                                    flexShrink: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition: "color 0.15s",
                                }}
                            >
                                <svg width="18" height="18" viewBox="-1 -1 18 18" fill="none" style={{ overflow: "visible", display: "block" }}>
                                    <path d="M13.5 7.5L7 14c-1.657 1.657-4.343 1.657-6 0-1.657-1.657-1.657-4.343 0-6L8 1c1.105-1.105 2.895-1.105 4 0 1.105 1.105 1.105 2.895 0 4L5.5 11.5C4.948 12.052 4.052 12.052 3.5 11.5 2.948 10.948 2.948 10.052 3.5 9.5L9 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept="image/*,.pdf,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.css,.html,.xml,.yaml,.yml"
                                style={{ display: "none" }}
                                onChange={async (e) => {
                                    const files = Array.from(e.target.files || []);
                                    if (files.length === 0) return;
                                    const processed = await Promise.all(files.map(processFile));
                                    setAttachedFiles(prev => [...prev, ...processed]);
                                    e.target.value = "";
                                }}
                            />

                            <MicButton
                                value={input}
                                onChange={setInput}
                                disabled={loading}
                            />

                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        send();
                                    }
                                }}
                                placeholder="Ask anything..."
                                rows={1}
                                style={{
                                    flex: 1,
                                    background: "rgba(7,26,47,0.05)",
                                    border: "1px solid rgba(7,26,47,0.09)",
                                    borderRadius: 10,
                                    padding: "8px 11px",
                                    color: "var(--color-text)",
                                    fontSize: 12.5,
                                    fontFamily: "var(--tekori-font-ui)",
                                    resize: "none",
                                    outline: "none",
                                    lineHeight: 1.5,
                                    maxHeight: 80,
                                    overflowY: "auto",
                                }}
                            />
                            <button
                                onClick={send}
                                disabled={(!input.trim() && attachedFiles.length === 0) || loading}
                                style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 9,
                                    border: "none",
                                    background: (input.trim() || attachedFiles.length > 0) && !loading
                                        ? "linear-gradient(135deg, var(--tekori-gold), var(--tekori-soft-gold))"
                                        : "rgba(7,26,47,0.06)",
                                    color: (input.trim() || attachedFiles.length > 0) && !loading ? "var(--color-primary)" : "var(--color-text-muted)",
                                    cursor: (input.trim() || attachedFiles.length > 0) && !loading ? "pointer" : "default",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                    transition: "all 0.15s",
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        </div>
                        <div style={{ fontSize: 9.5, color: "var(--color-text)", textAlign: "center" }}>
                            Navi is an AI. Always verify important information before acting on it.
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Bubble Button */}
            <button
                data-forge-bubble="true"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                title="Ask Navi — hold and drag to move"
                style={{
                    position: "fixed",
                    bottom: pos.bottom,
                    right: pos.right,
                    zIndex: 200,
                    width: BUBBLE_SIZE,
                    height: BUBBLE_SIZE,
                    borderRadius: "50%",
                    background: "#ffffff",
                    border: `1.5px solid ${dragging ? "rgba(216,155,43,0.8)" : open ? "rgba(216,155,43,0.6)" : "rgba(216,155,43,0.35)"}`,
                    boxShadow: dragging
                        ? "0 8px 32px rgba(216,155,43,0.55), 0 4px 12px rgba(0,0,0,0.6)"
                        : open
                        ? "0 4px 24px rgba(216,155,43,0.35), 0 2px 8px rgba(7,26,47,0.34)"
                        : "0 4px 20px rgba(216,155,43,0.22), 0 2px 8px rgba(0,0,0,0.4)",
                    cursor: dragging ? "grabbing" : "grab",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: dragging ? "scale(1.1)" : "scale(1)",
                    transition: dragging ? "box-shadow 0.15s, border-color 0.15s" : "all 0.2s ease",
                    userSelect: "none",
                    touchAction: "none",
                }}
                onMouseEnter={e => {
                    if (dragging) return;
                    e.currentTarget.style.boxShadow = "0 6px 28px rgba(216,155,43,0.45), 0 2px 10px rgba(7,26,47,0.34)";
                    e.currentTarget.style.transform = "scale(1.06)";
                }}
                onMouseLeave={e => {
                    if (dragging) return;
                    e.currentTarget.style.boxShadow = open
                        ? "0 4px 24px rgba(216,155,43,0.35), 0 2px 8px rgba(7,26,47,0.34)"
                        : "0 4px 20px rgba(216,155,43,0.22), 0 2px 8px rgba(0,0,0,0.4)";
                    e.currentTarget.style.transform = "scale(1)";
                }}
            >
                {closing ? (
                    <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(216,155,43,0.4)", borderTopColor: "var(--tekori-gold)", animation: "spin 0.8s linear infinite" }} />
                ) : (
                    <Logo
                        variant="forge"
                        style={{
                            width: 36,
                            height: 36,
                            objectFit: "contain",
                            opacity: open ? 1 : 0.85,
                            transition: "opacity 0.2s",
                        }}
                    />
                )}
            </button>

            <style>{`
                @keyframes bubbleSlideUp {
                    from { opacity: 0; transform: translateY(12px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </>
    );
}

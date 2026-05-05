import { useEffect, useRef, useState } from "react";
import { getArchivePreviewText, parseArchiveSummaryPayload } from "../lib/archiveSummary";
import { callForgeAPI, streamForgeAPI } from "../lib/forgeApi";
import { processFile, buildMessageContent, type AttachedFile } from "../lib/fileAttach";
import { FORGE_SYSTEM_PROMPT } from "../constants/prompts";
import { getLanguageWarning, moderateUserText } from "../lib/languageModeration";
import { saveConversationSummary, updateConversationSummary } from "../db";
import { applyFoundryBookCitations, buildFoundryBookContext } from "../lib/foundryBook";
import { evaluateKnowledgeCheckLaunchAnswer, getAcademySessionSubtitle } from "../lib/academyCompletion";
import type { AcademyTopicLaunch } from "../lib/academy";
import type { MarketTrend } from "../db";
import ForgeAvatar from "./ForgeAvatar";
import TypingDots from "./TypingDots";
import Logo from "./Logo";
import { AnimatedChatText, renderText, MessageActions } from "./AnimatedChatText";
import MicButton from "./MicButton";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface ChatMessage {
    id: string;
    role: "user" | "forge";
    text: string;
    createdAt?: string;
}

interface ForgeChatRoomProps {
    userId: string;
    profile: any;
    onBack: () => void;
    onArchiveSaved?: (entry: any) => void;
    initialArchive?: any | null;
    academyEntry?: AcademyTopicLaunch | null;
    onMarkAcademyLessonCompleted?: (contentId: string, options?: { knowledgeCheckedAt?: string; lastCheckResponse?: string | null; lastCheckFeedback?: string | null }) => Promise<void> | void;
    marketIntelEntry?: MarketTrend | null;
}

// ─────────────────────────────────────────────────────────────
// Context for Forge in this chat room
// ─────────────────────────────────────────────────────────────
function buildChatRoomContext(
    profile: any,
    inputs: string[],
    archiveSummary?: string | null,
    archiveTitle?: string | null,
    academyEntry?: AcademyTopicLaunch | null,
    testingMode?: boolean,
    marketIntelEntry?: MarketTrend | null,
) {
    const academyMode = academyEntry?.sessionMode ?? "learn";
    const modeInstruction = !academyEntry ? "" : testingMode
        ? `TESTING MODE: The founder has clicked "Test to Complete". Test their understanding of this lesson through natural conversation. Ask probing questions that reveal whether they truly understand the lesson and can apply it to their own business. Do not lecture — probe for real comprehension. If an answer is shallow or incomplete, explain what is missing and invite a stronger response. Keep it direct but encouraging.`
        : academyMode === "apply"
            ? `This conversation is in APPLY mode. Forge should:
1. state what this lesson was really teaching
2. explain why founders miss it
3. show how it appears in real business situations
4. only then connect it to the founder's current business if useful
5. end with one practical application question`
            : `This conversation is in LEARN mode. Forge should:
1. teach the lesson cleanly
2. explain why it matters
3. expose the weak founder instinct underneath it
4. give one practical mental model
5. invite deeper exploration naturally`;

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const bookContext = buildFoundryBookContext(Number(profile.currentStage) || 1, inputs, 3);
    return {
        context: `
Current date: ${dateStr}
Founder: ${profile.name} | Business: ${profile.businessName || profile.idea || "Idea stage"} (${profile.industry || "Early Stage"})
Strategy: ${profile.strategyLabel || profile.strategy} | Current Stage: ${profile.currentStage} | Experience: ${profile.experience || "Not specified"}
Budget: $${(profile.budget?.remaining || 0).toLocaleString()} remaining of $${(profile.budget?.total || 0).toLocaleString()}

CONTEXT — FORGE CHAT ROOM:
The founder has opened the Chat Room — a dedicated space for open-ended conversation, questions, and learning. This is not a coaching session tied to stage milestones. There is no agenda. The founder might want to think out loud, explore a concept, get a second opinion, discuss something they read, ask about business fundamentals, or just talk through what's on their mind.

Your role here is slightly different from the structured Forge chat: lean into education. When a founder asks a question — even a simple one — look for the natural teaching moment inside it. Not by lecturing, but by giving them the fuller picture behind the answer. If they ask "what's a CAC?", don't just define it — show them why it matters, what a healthy one looks like for their type of business, and what it tells you about your model.

That said, don't turn every exchange into a lesson. Match their energy. If they want a quick answer, give one. If they seem curious and want to go deep, go deep with them. Read the room.

Be the knowledgeable business partner they can talk to freely — about their business, about business in general, about an idea they have, about something that's worrying them, about something that excited them. This is a safe space to think out loud without worrying about what step they're on.
${archiveSummary ? `\n\nARCHIVE CONTEXT:\nThe founder is continuing a prior archived conversation titled "${archiveTitle || "Saved conversation"}". Use this summary as prior context for the current discussion. Build on it naturally and answer follow-up questions as a continuation, not as a fresh topic.\n\n${archiveSummary}` : ""}
${academyEntry ? `\n\nACADEMY ENTRY CONTEXT:\nThe founder opened this conversation from Forge Academy.\nMode: ${academyMode}\nTopic: ${academyEntry.title}\nCategory: ${academyEntry.categoryTitle || "Forge Academy"}\nLearning goal: ${academyEntry.learningGoal || "Help the founder understand the topic deeply and practically."}\nWho this is for: ${academyEntry.whoThisIsFor || "A first-time founder who needs a more grounded understanding before the stakes get higher."}\nWhen this matters: ${academyEntry.whenThisMatters || "Before the founder drifts into weak assumptions or avoidable execution mistakes."}\nCommon mistake: ${academyEntry.commonMistake || "Founders often treat this as obvious until they are forced to make a real decision under pressure."}\nWhy this matters: ${academyEntry.whyThisMatters || "Teach the founder why this topic matters before they need it."}\nWhat to watch for: ${academyEntry.whatToWatchFor || "Surface the subtle mistakes and weak thinking patterns that matter here."}\nKnowledge check prompt: ${academyEntry.knowledgeCheckPrompt || "Not explicitly set"}\nExpected understanding points: ${academyEntry.knowledgeCheckExpectedPoints.join(" | ") || "Use broad founder judgment"}\nConcept tags: ${academyEntry.tags.join(", ") || "None"}\nRelevant stages: ${academyEntry.stageIds.length > 0 ? academyEntry.stageIds.join(", ") : "General"}\nSupporting context: ${academyEntry.forgeContext || "None provided"}\n\n${modeInstruction}` : ""}
${marketIntelEntry ? `\n\nMARKET INTELLIGENCE CONTEXT:\nThe founder opened this conversation from Market Intelligence to explore a specific trend.\nTrend name: ${marketIntelEntry.name}\nImpact level: ${marketIntelEntry.impactLevel}\nTimeframe: ${marketIntelEntry.timeframe}\nDescription: ${marketIntelEntry.description}\n\nForge should help the founder understand this trend deeply and practically — what it means for their business, how to respond or position, and what concrete actions they could take. Ask probing questions to help them think it through. Keep it strategic and grounded.` : ""}
${bookContext.context ? `\n\n${bookContext.context}` : ""}
    `.trim(),
        bookMatches: bookContext.matches,
    };
}

// ─────────────────────────────────────────────────────────────
// Text rendering — see AnimatedChatText.tsx
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function ForgeChatRoom({ userId, profile, onBack, onArchiveSaved, initialArchive = null, academyEntry = null, onMarkAcademyLessonCompleted, marketIntelEntry = null }: ForgeChatRoomProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const [languageWarning, setLanguageWarning] = useState<string | null>(null);
    const [confirmedProfanityInput, setConfirmedProfanityInput] = useState<string | null>(null);
    const [saveArchiveModalOpen, setSaveArchiveModalOpen] = useState(false);
    const [archiveTitleInput, setArchiveTitleInput] = useState("");
    const [savingArchive, setSavingArchive] = useState(false);
    const [academyLessonCompleted, setAcademyLessonCompleted] = useState(false);
    const [testingMode, setTestingMode] = useState(false);
    const [activeArchive, setActiveArchive] = useState<any | null>(initialArchive);
    const [activeAcademyEntry, setActiveAcademyEntry] = useState<AcademyTopicLaunch | null>(academyEntry);
    const [activeTrendEntry, setActiveTrendEntry] = useState<MarketTrend | null>(marketIntelEntry);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const academyBootstrappedRef = useRef(false);
    const trendBootstrappedRef = useRef(false);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 150);
    }, []);

    useEffect(() => {
        setActiveArchive(initialArchive);
    }, [initialArchive]);

    useEffect(() => {
        setActiveAcademyEntry(academyEntry);
        academyBootstrappedRef.current = false;
        setAcademyLessonCompleted(false);
        setTestingMode(false);

        if (academyEntry) {
            const saved = localStorage.getItem(`academy-chat-${academyEntry.id}`);
            if (saved) {
                try {
                    const restored = JSON.parse(saved) as ChatMessage[];
                    if (restored.length > 0) {
                        setMessages(restored);
                        academyBootstrappedRef.current = true;
                    } else {
                        setMessages([]);
                    }
                } catch {
                    setMessages([]);
                }
            } else {
                setMessages([]);
            }
        } else {
            setMessages([]);
        }
    }, [academyEntry]);

    useEffect(() => {
        if (!activeAcademyEntry || activeArchive || academyBootstrappedRef.current) return;
        academyBootstrappedRef.current = true;
        void sendAcademyKickoff();
    }, [activeAcademyEntry?.id, activeArchive?.id]);

    useEffect(() => {
        if (!activeAcademyEntry || messages.length === 0) return;
        localStorage.setItem(`academy-chat-${activeAcademyEntry.id}`, JSON.stringify(messages));
    }, [messages, activeAcademyEntry?.id]);

    // Trend entry effects — mirror academy pattern
    useEffect(() => {
        setActiveTrendEntry(marketIntelEntry ?? null);
        trendBootstrappedRef.current = false;

        if (marketIntelEntry) {
            const saved = localStorage.getItem(`trend-chat-${marketIntelEntry.id}`);
            if (saved) {
                try {
                    const restored = JSON.parse(saved) as ChatMessage[];
                    if (restored.length > 0) {
                        setMessages(restored);
                        trendBootstrappedRef.current = true;
                    } else {
                        setMessages([]);
                    }
                } catch {
                    setMessages([]);
                }
            } else {
                setMessages([]);
            }
        }
    }, [marketIntelEntry]);

    useEffect(() => {
        if (!activeTrendEntry || activeArchive || trendBootstrappedRef.current) return;
        trendBootstrappedRef.current = true;
        void sendTrendKickoff();
    }, [activeTrendEntry?.id, activeArchive?.id]);

    useEffect(() => {
        if (!activeTrendEntry || messages.length === 0) return;
        localStorage.setItem(`trend-chat-${activeTrendEntry.id}`, JSON.stringify(messages));
    }, [messages, activeTrendEntry?.id]);

    const openSaveArchiveModal = () => {
        const defaultTitle = activeArchive?.title
            || (activeAcademyEntry
                ? `Academy — ${activeAcademyEntry.title}`
                : activeTrendEntry
                    ? `Market Intel — ${activeTrendEntry.name}`
                    : `Chat with Forge — ${new Date().toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                    })}`);
        setArchiveTitleInput(defaultTitle);
        setSaveArchiveModalOpen(true);
    };

    const handleSaveArchive = async () => {
        if (savingArchive || messages.length === 0) return;

        const title = archiveTitleInput.trim() || activeAcademyEntry?.title || activeTrendEntry?.name || "Chat with Forge";
        const transcript = messages
            .map((msg) => `${msg.role === "forge" ? "Forge" : profile.name}: ${msg.text}`)
            .join("\n");

        const prompt = activeArchive?.id
            ? `Update this archived Chat with Forge conversation for ${profile.name} in clear markdown.\n\nExisting archive summary:\n${activeArchive.summary}\n\nNew continuation transcript:\n${transcript}\n\nReturn valid JSON with exactly these keys:\n"title": keep exactly this title: "${title}"\n"summary": a refreshed markdown summary with these sections: Main Questions, Key Takeaways, Useful Concepts, Next Moves. Blend the prior archive context with the new continuation so this replaces the old summary cleanly.`
            : `Summarize this Chat with Forge conversation for ${profile.name} in clear markdown.\n\nReturn valid JSON with exactly these keys:\n"title": keep exactly this title: "${title}"\n"summary": a detailed markdown summary with these sections: Main Questions, Key Takeaways, Useful Concepts, Next Moves.\n\nConversation:\n${transcript}`;

        setSavingArchive(true);
        try {
            const raw = await callForgeAPI(
                [{ role: "user", content: prompt }],
                "You write clean business conversation summaries. Return only valid JSON."
            );
            const parsed = parseArchiveSummaryPayload(raw, title);
            const saved = activeArchive?.id
                ? await updateConversationSummary(
                    userId,
                    activeArchive.id,
                    {
                        stageId: Number(activeArchive.stageId) || Number(profile.currentStage) || 1,
                        summaryDate: new Date().toISOString().slice(0, 10),
                        title,
                        summary: parsed.summary,
                        messageCount: (activeArchive.messageCount || 0) + messages.length,
                    }
                )
                : await saveConversationSummary(
                    userId,
                    Number(profile.currentStage) || 1,
                    new Date().toISOString().slice(0, 10),
                    title,
                    parsed.summary,
                    messages.length
                );

            if (!saved) return;
            const wasAcademyEntry = activeAcademyEntry;
            const wasCompleted = academyLessonCompleted;
            const wasTrendEntry = activeTrendEntry;
            onArchiveSaved?.(saved);
            if (activeAcademyEntry) {
                localStorage.removeItem(`academy-chat-${activeAcademyEntry.id}`);
            }
            if (activeTrendEntry) {
                localStorage.removeItem(`trend-chat-${activeTrendEntry.id}`);
            }
            setSaveArchiveModalOpen(false);
            setMessages([]);
            setInput("");
            setAttachedFiles([]);
            setLanguageWarning(null);
            setConfirmedProfanityInput(null);
            setActiveArchive(null);
            setActiveAcademyEntry(null);
            setActiveTrendEntry(null);
            academyBootstrappedRef.current = false;
            trendBootstrappedRef.current = false;
            if ((wasCompleted && wasAcademyEntry) || wasTrendEntry) {
                onBack();
            }
        } catch (error) {
            console.error("chat room archive save error:", error);
        } finally {
            setSavingArchive(false);
        }
    };

    const send = async () => {
        if ((!input.trim() && attachedFiles.length === 0) || loading) return;

        const text = input.trim();
        const warning = getLanguageWarning(text);
        if (warning && confirmedProfanityInput !== text) {
            setLanguageWarning(warning);
            setConfirmedProfanityInput(text);
            return;
        }

        setLanguageWarning(null);
        setConfirmedProfanityInput(null);
        const { censoredText } = moderateUserText(text);
        const currentFiles = [...attachedFiles];
        setInput("");
        setAttachedFiles([]);
        if (inputRef.current) {
            inputRef.current.style.height = "40px";
            inputRef.current.style.overflowY = "hidden";
        }

        const attachmentLabel = currentFiles.length > 0
            ? `[Attached: ${currentFiles.map(f => f.name).join(", ")}]`
            : "";
        const displayText = [attachmentLabel, censoredText].filter(Boolean).join("\n");

        const now = new Date().toISOString();
        const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: displayText, createdAt: now };
        const forgeMsg: ChatMessage = { id: `f-${Date.now()}`, role: "forge", text: "", createdAt: new Date().toISOString() };

        const history = [...messages, userMsg];
        setMessages([...history, forgeMsg]);
        setLoading(true);

        try {
            const ctx = buildChatRoomContext(
                profile,
                [...messages.slice(-6).map((message) => message.text), text],
                activeArchive?.summary || null,
                activeArchive?.title || null,
                activeAcademyEntry,
                testingMode,
                activeTrendEntry,
            );
            const apiMsgs = [
                ...history.slice(0, -1).map(m => ({
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

        if (testingMode && text.trim()) {
            void autoEvaluateKnowledgeCheck(text.trim());
        }
    };

    const sendAcademyKickoff = async (entryOverride?: AcademyTopicLaunch | null) => {
        const entry = entryOverride ?? activeAcademyEntry;
        if (!entry || loading) return;

        const starterPrompt = entry.starterPrompt?.trim()
            || `Open a guided Forge Academy lesson on "${entry.title}".

Teach it like a serious founder educator, not a generic assistant.
Learning goal: ${entry.learningGoal || "Help the founder get practical clarity."}
Who this is for: ${entry.whoThisIsFor || "A first-time founder building judgment."}
When this matters: ${entry.whenThisMatters || "Before avoidable mistakes compound."}
Common mistake: ${entry.commonMistake || "Founders often miss the real issue underneath the surface topic."}
Why this matters: ${entry.whyThisMatters || "The founder needs stronger intuition here before they are under pressure."}
What to watch for: ${entry.whatToWatchFor || "Surface the hidden traps and weak assumptions."}

Start with a confident first lesson message that frames the topic, explains the stakes, names what founders usually get wrong, and gives one practical lens the founder can use right away.`;

        const forgeMsg: ChatMessage = { id: `f-${Date.now()}`, role: "forge", text: "", createdAt: new Date().toISOString() };
        const appendKickoff = messages.length > 0;
        setMessages((prev) => appendKickoff ? [...prev, forgeMsg] : [forgeMsg]);
        setLoading(true);

        try {
            const ctx = buildChatRoomContext(
                profile,
                [starterPrompt],
                null,
                null,
                entry
            );

            await streamForgeAPI(
                [{ role: "user", content: starterPrompt }],
                FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", ctx.context),
                (chunk) => {
                    const { cleanText } = applyFoundryBookCitations(chunk, ctx.bookMatches);
                    setMessages((prev) => prev.map((message) => (
                        message.id === forgeMsg.id ? { ...message, text: cleanText } : message
                    )));
                }
            );
        } catch (error) {
            console.error("academy kickoff error:", error);
            setMessages((prev) => prev.map((message) => (
                message.id === forgeMsg.id
                    ? { ...message, text: "Something went wrong opening this Academy conversation. Try again." }
                    : message
            )));
        } finally {
            setLoading(false);
        }
    };

    const sendTrendKickoff = async (entryOverride?: MarketTrend | null) => {
        const entry = entryOverride ?? activeTrendEntry;
        if (!entry || loading) return;

        const impactLabel = entry.impactLevel?.trim().toLowerCase() === "high"
            ? "high-impact"
            : entry.impactLevel?.trim().toLowerCase() === "medium"
                ? "medium-impact"
                : "emerging";

        const kickoffPrompt = `The founder wants to explore a ${impactLabel} market trend affecting their business.

Trend: "${entry.name}"
Impact level: ${entry.impactLevel}
Timeframe: ${entry.timeframe}
Description: ${entry.description}

Open a focused strategic conversation about this trend. Help them understand:
1. What this trend really means at ground level — not the buzzword version
2. How it specifically threatens or opens doors for their type of business
3. What the smart founder response looks like — position, adapt, or ignore?
4. One concrete thing they could do in the next 30 days to get ahead of it

Start by making the trend real and concrete for them. No vague advice — be direct and specific to their situation.`;

        const forgeMsg: ChatMessage = { id: `f-${Date.now()}`, role: "forge", text: "", createdAt: new Date().toISOString() };
        setMessages([forgeMsg]);
        setLoading(true);

        try {
            const ctx = buildChatRoomContext(profile, [kickoffPrompt], null, null, null, false, entry);
            await streamForgeAPI(
                [{ role: "user", content: kickoffPrompt }],
                FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", ctx.context),
                (chunk) => {
                    const { cleanText } = applyFoundryBookCitations(chunk, ctx.bookMatches);
                    setMessages((prev) => prev.map((message) => (
                        message.id === forgeMsg.id ? { ...message, text: cleanText } : message
                    )));
                }
            );
        } catch (error) {
            console.error("trend kickoff error:", error);
            setMessages((prev) => prev.map((message) => (
                message.id === forgeMsg.id
                    ? { ...message, text: "Something went wrong opening this conversation. Try again." }
                    : message
            )));
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    const sendLessonCompletionMessage = async (entry: AcademyTopicLaunch) => {
        const completionPrompt = `The founder just successfully demonstrated real understanding of "${entry.title}" through our conversation. Their lesson is now marked complete in Forge Academy. Send them a brief, warm congratulation. Let them know the lesson is complete. Tell them: to save this conversation and return to Academy, just press "Archive Chat" above — or they can keep chatting to go even deeper on this topic. Keep it short and encouraging.`;
        const forgeMsg: ChatMessage = { id: `f-${Date.now()}`, role: "forge", text: "", createdAt: new Date().toISOString() };
        setMessages((prev) => [...prev, forgeMsg]);
        setLoading(true);
        try {
            const ctx = buildChatRoomContext(profile, [completionPrompt], null, null, entry);
            await streamForgeAPI(
                [{ role: "user", content: completionPrompt }],
                FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", ctx.context),
                (chunk) => {
                    const { cleanText } = applyFoundryBookCitations(chunk, ctx.bookMatches);
                    setMessages((prev) => prev.map((m) => m.id === forgeMsg.id ? { ...m, text: cleanText } : m));
                }
            );
        } catch {
            setMessages((prev) => prev.map((m) =>
                m.id === forgeMsg.id ? { ...m, text: `Well done — "${entry.title}" is now marked complete. Press Archive Chat above to save this conversation and head back to Academy, or keep going if you want to dig deeper.` } : m
            ));
        } finally {
            setLoading(false);
        }
    };

    const startTesting = async () => {
        if (!activeAcademyEntry || loading || testingMode || academyLessonCompleted) return;
        setTestingMode(true);
        const entry = activeAcademyEntry;
        const kickoffPrompt = `The founder has clicked "Test to Complete" for the Forge Academy lesson "${entry.title}". Begin conversationally testing their understanding. Ask natural questions that probe whether they genuinely understand this lesson and can apply it to their own business. Don't announce you are testing — just start asking. Keep it conversational.

Learning goal: ${entry.learningGoal || "Core understanding of " + entry.title}
Knowledge check: ${entry.knowledgeCheckPrompt || "What is the core founder judgment this lesson was trying to build?"}
Common mistake founders make: ${entry.commonMistake || "Not specified"}`;

        const forgeMsg: ChatMessage = { id: `f-${Date.now()}`, role: "forge", text: "", createdAt: new Date().toISOString() };
        setMessages((prev) => [...prev, forgeMsg]);
        setLoading(true);
        try {
            const ctx = buildChatRoomContext(profile, [kickoffPrompt], null, null, entry, true);
            await streamForgeAPI(
                [{ role: "user", content: kickoffPrompt }],
                FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", ctx.context),
                (chunk) => {
                    const { cleanText } = applyFoundryBookCitations(chunk, ctx.bookMatches);
                    setMessages((prev) => prev.map((m) => m.id === forgeMsg.id ? { ...m, text: cleanText } : m));
                }
            );
        } catch {
            setMessages((prev) => prev.map((m) =>
                m.id === forgeMsg.id ? { ...m, text: `Let's see where you're at with "${entry.title}". Tell me in your own words — what's the core judgment this lesson was trying to build, and how does it apply to your business right now?` } : m
            ));
        } finally {
            setLoading(false);
        }
    };

    const autoEvaluateKnowledgeCheck = async (userAnswer: string) => {
        if (!activeAcademyEntry || !onMarkAcademyLessonCompleted || academyLessonCompleted) return;
        try {
            const evaluation = await evaluateKnowledgeCheckLaunchAnswer(activeAcademyEntry, userAnswer);
            if (evaluation.passed) {
                setTestingMode(false);
                await Promise.resolve(onMarkAcademyLessonCompleted(activeAcademyEntry.id, {
                    knowledgeCheckedAt: new Date().toISOString(),
                    lastCheckResponse: userAnswer,
                    lastCheckFeedback: evaluation.feedback,
                }));
                setAcademyLessonCompleted(true);
                void sendLessonCompletionMessage(activeAcademyEntry);
            } else {
                setTestingMode(false);
            }
        } catch (error) {
            console.error("auto knowledge check error:", error);
            setTestingMode(false);
        }
    };

    const hasMessages = messages.length > 0;
    const chatTitle = activeAcademyEntry
        ? `Forge Academy · ${activeAcademyEntry.title}`
        : activeTrendEntry
            ? `Market Intel · ${activeTrendEntry.name}`
            : "Chat with Forge";
    const chatSubtitle = activeAcademyEntry
        ? getAcademySessionSubtitle(activeAcademyEntry.sessionMode)
        : activeTrendEntry
            ? "Trend deep-dive · strategic analysis"
            : "Ask anything · learn freely";

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "#080809",
            display: "flex",
            flexDirection: "column",
            fontFamily: "'Lora', Georgia, serif",
            color: "#F0EDE8",
        }}>
            {/* Header */}
            <div style={{
                padding: "max(16px, calc(12px + env(safe-area-inset-top))) 20px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#0C0C0E",
                flexShrink: 0,
            }}>
                <button
                    onClick={onBack}
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#666",
                        padding: "4px 2px",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        transition: "color 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#F0EDE8"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "#666"; }}
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back
                </button>
                <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />
                <ForgeAvatar size={30} />
                <div className="forge-chat-room__title-wrap" style={{ flex: 1, minWidth: 0 }}>
                    <div
                        className="forge-chat-room__title"
                        title={chatTitle}
                        style={{ fontSize: 15, fontWeight: 600, color: "#F0EDE8", fontFamily: "'Lora', Georgia, serif" }}
                    >
                        {chatTitle}
                    </div>
                    <div className="forge-chat-room__subtitle" style={{ fontSize: 11, color: "#4CAF8A", marginTop: 1 }}>
                        {chatSubtitle}
                    </div>
                </div>
                {activeAcademyEntry && onMarkAcademyLessonCompleted && (
                    <button
                        className="forge-chat-room__action"
                        onClick={() => { if (!academyLessonCompleted && !testingMode) void startTesting(); }}
                        disabled={academyLessonCompleted || testingMode || loading}
                        style={{
                            background: academyLessonCompleted
                                ? "rgba(76,175,138,0.08)"
                                : testingMode
                                    ? "rgba(232,98,42,0.06)"
                                    : "rgba(232,98,42,0.10)",
                            border: academyLessonCompleted
                                ? "1px solid rgba(76,175,138,0.22)"
                                : testingMode
                                    ? "1px solid rgba(232,98,42,0.15)"
                                    : "1px solid rgba(232,98,42,0.22)",
                            borderRadius: 8,
                            padding: "5px 12px",
                            color: academyLessonCompleted
                                ? "#4CAF8A"
                                : testingMode
                                    ? "rgba(232,98,42,0.65)"
                                    : "#E8622A",
                            fontSize: 11,
                            cursor: academyLessonCompleted || testingMode ? "default" : "pointer",
                            transition: "all 0.15s",
                        }}
                    >
                        {academyLessonCompleted ? "Completed" : testingMode ? "Testing..." : "Test to Complete"}
                    </button>
                )}
                {hasMessages && (
                    <button
                        className="forge-chat-room__action"
                        onClick={openSaveArchiveModal}
                        style={{
                            background: "rgba(76,175,138,0.08)",
                            border: "1px solid rgba(76,175,138,0.22)",
                            borderRadius: 8,
                            padding: "5px 12px",
                            color: "#4CAF8A",
                            fontSize: 11,
                            cursor: "pointer",
                            transition: "all 0.15s",
                        }}
                    >
                        Archive Chat
                    </button>
                )}
                {hasMessages && (
                    <button
                        className="forge-chat-room__action"
                        onClick={() => setMessages([])}
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 8,
                            padding: "5px 12px",
                            color: "#555",
                            fontSize: 11,
                            cursor: "pointer",
                            transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = "#F0EDE8"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#555"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                    >
                        New chat
                    </button>
                )}
            </div>

            {/* Messages */}
            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "24px 20px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    maxWidth: 760,
                    width: "100%",
                    margin: "0 auto",
                    boxSizing: "border-box",
                }}
            >
                {activeArchive && (
                    <div style={{
                        background: "rgba(76,175,138,0.05)",
                        border: "1px solid rgba(76,175,138,0.16)",
                        borderRadius: 14,
                        padding: "14px 16px",
                    }}>
                        <div style={{ fontSize: 10, color: "#4CAF8A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
                            Continuing Archive
                        </div>
                        <div style={{ fontSize: 18, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", marginBottom: 8 }}>
                            {activeArchive.title}
                        </div>
                        <div style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}>
                            {getArchivePreviewText(activeArchive.summary).slice(0, 220)}...
                        </div>
                        <div style={{ fontSize: 11, color: "#888", lineHeight: 1.6, marginTop: 10 }}>
                            Ask follow-up questions normally. Saving will update this same archive card instead of creating a new one.
                        </div>
                    </div>
                )}

                {messages.length === 0 && (
                    <div style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        padding: "60px 24px",
                        gap: 16,
                        minHeight: 300,
                    }}>
                        <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #2D221C, #1a120e)",
                            border: "1px solid rgba(232,98,42,0.2)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}>
                            <Logo variant="forge" style={{ width: 36, height: 36, objectFit: "contain" }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 20, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 8 }}>
                                {activeAcademyEntry ? activeAcademyEntry.title : "What's on your mind?"}
                            </div>
                            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7, maxWidth: 380 }}>
                                {activeAcademyEntry
                                    ? activeAcademyEntry.learningGoal || "Forge is opening this Academy topic with context already loaded. Keep going by asking follow-up questions, pressure-testing the ideas, or applying them directly to your business."
                                    : "This is your open space to talk through anything — business questions, ideas, concepts you're learning, or things you're unsure about. No agenda. Just a conversation."}
                            </div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
                            {(
                                activeAcademyEntry
                                    ? [
                                        "Give me the high-level founder version first",
                                        "What do founders usually get wrong here?",
                                        "Apply this to my business specifically",
                                        "What should I do next with this?",
                                    ]
                                    : [
                                        "What's the difference between revenue and profit?",
                                        "How do I know if my idea is worth pursuing?",
                                        "What makes a pitch deck compelling?",
                                        "Explain unit economics simply",
                                    ]
                            ).map(prompt => (
                                <button
                                    key={prompt}
                                    onClick={() => { setInput(prompt); setTimeout(() => inputRef.current?.focus(), 50); }}
                                    style={{
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                        borderRadius: 20,
                                        padding: "7px 14px",
                                        color: "#888",
                                        fontSize: 12,
                                        cursor: "pointer",
                                        transition: "all 0.15s",
                                        fontFamily: "'Lora', Georgia, serif",
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.color = "#C8C4BE"; e.currentTarget.style.borderColor = "rgba(232,98,42,0.3)"; e.currentTarget.style.background = "rgba(232,98,42,0.05)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = "#888"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.filter(msg => !(msg.role === "forge" && !msg.text)).map(msg => (
                    <div
                        key={msg.id}
                        style={{
                            display: "flex",
                            flexDirection: msg.role === "user" ? "row-reverse" : "row",
                            alignItems: "flex-start",
                            gap: 10,
                        }}
                    >
                        {msg.role === "forge" && <ForgeAvatar size={28} />}
                        <div style={{ display: "flex", flexDirection: "column", maxWidth: "78%" }}>
                            <div style={{
                                padding: "11px 15px",
                                borderRadius: msg.role === "user"
                                    ? "16px 4px 16px 16px"
                                    : "4px 16px 16px 16px",
                                background: msg.role === "user"
                                    ? "rgba(232,98,42,0.12)"
                                    : "rgba(255,255,255,0.04)",
                                border: msg.role === "user"
                                    ? "1px solid rgba(232,98,42,0.2)"
                                    : "1px solid rgba(255,255,255,0.07)",
                                fontSize: 13.5,
                                color: msg.role === "user" ? "#F0EDE8" : "#C8C4BE",
                                lineHeight: 1.7,
                                textAlign: "left",
                            }}>
                                {msg.role === "forge"
                                    ? (msg.text ? <AnimatedChatText text={msg.text} createdAt={msg.createdAt} /> : <TypingDots />)
                                    : renderText(msg.text)}
                            </div>
                            {msg.role === "forge" && <MessageActions text={msg.text} />}
                        </div>
                    </div>
                ))}

            </div>

            {/* Input Area */}
            <div style={{
                padding: "12px 20px max(16px, calc(12px + env(safe-area-inset-bottom)))",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                background: "#0C0C0E",
                flexShrink: 0,
            }}>
                <div style={{
                    maxWidth: 760,
                    margin: "0 auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                }}>
                    {attachedFiles.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {attachedFiles.map(file => (
                                <div
                                    key={file.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        background: "rgba(232,98,42,0.08)",
                                        border: "1px solid rgba(232,98,42,0.2)",
                                        borderRadius: 8,
                                        padding: "4px 9px 4px 6px",
                                        maxWidth: 200,
                                    }}
                                >
                                    {file.isImage && file.previewUrl ? (
                                        <img src={file.previewUrl} alt={file.name} style={{ width: 18, height: 18, borderRadius: 3, objectFit: "cover", flexShrink: 0 }} />
                                    ) : (
                                        <span style={{ fontSize: 12, flexShrink: 0 }}>{file.isPDF ? "📄" : "📝"}</span>
                                    )}
                                    <span style={{ fontSize: 11, color: "#C8C4BE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {file.name}
                                    </span>
                                    <button
                                        onClick={() => {
                                            if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
                                            setAttachedFiles(prev => prev.filter(f => f.id !== file.id));
                                        }}
                                        style={{ background: "none", border: "none", color: "#777", cursor: "pointer", padding: 0, fontSize: 14, lineHeight: 1, flexShrink: 0 }}
                                    >×</button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                        {/* Attach */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            title="Attach a file"
                            style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: attachedFiles.length > 0 ? "#E8622A" : "#444",
                                padding: "6px 4px",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "color 0.15s",
                            }}
                            onMouseEnter={e => { if (attachedFiles.length === 0) e.currentTarget.style.color = "#888"; }}
                            onMouseLeave={e => { if (attachedFiles.length === 0) e.currentTarget.style.color = "#444"; }}
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
                            onChange={(v) => {
                                setInput(v);
                                if (!v.trim()) {
                                    setLanguageWarning(null);
                                    setConfirmedProfanityInput(null);
                                }
                            }}
                            disabled={loading}
                        />

                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => {
                                const nextValue = e.target.value;
                                setInput(nextValue);
                                if (!nextValue.trim()) {
                                    setLanguageWarning(null);
                                    setConfirmedProfanityInput(null);
                                } else if (confirmedProfanityInput && nextValue.trim() !== confirmedProfanityInput) {
                                    setLanguageWarning(null);
                                    setConfirmedProfanityInput(null);
                                }
                                const el = e.target;
                                el.style.height = "auto";
                                el.style.height = Math.min(el.scrollHeight, 120) + "px";
                                el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything — business, concepts, ideas, whatever's on your mind..."
                            style={{
                                flex: 1,
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 12,
                                padding: "10px 14px",
                                color: "#F0EDE8",
                                fontSize: 13.5,
                                fontFamily: "'Lora', Georgia, serif",
                                resize: "none",
                                outline: "none",
                                lineHeight: 1.5,
                                height: 40,
                                overflowY: "hidden",
                            }}
                        />

                        <button
                            onClick={send}
                            disabled={(!input.trim() && attachedFiles.length === 0) || loading}
                            style={{
                                width: 38,
                                height: 38,
                                borderRadius: 10,
                                border: "none",
                                background: (input.trim() || attachedFiles.length > 0) && !loading
                                    ? "linear-gradient(135deg, #E8622A, #c9521e)"
                                    : "rgba(255,255,255,0.06)",
                                color: (input.trim() || attachedFiles.length > 0) && !loading ? "#fff" : "#444",
                                cursor: (input.trim() || attachedFiles.length > 0) && !loading ? "pointer" : "default",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                transition: "all 0.15s",
                            }}
                        >
                            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
                                <path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                    {languageWarning && (
                        <div style={{ fontSize: 11, color: "#D3A48D", textAlign: "center", lineHeight: 1.5 }}>
                            {languageWarning}
                        </div>
                    )}
                    <div style={{ fontSize: 10, color: "#333", textAlign: "center" }}>
                        Shift + Enter for new line
                    </div>
                    <div style={{ fontSize: 10, color: "#2b2b2b", textAlign: "center" }}>
                        Forge is an AI. Always verify important information before acting on it.
                    </div>
                </div>
            </div>

            {saveArchiveModalOpen && (
                <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(4,4,5,0.84)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
                    <div style={{ width: "min(520px, 100%)", background: "#0E0E10", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "20px 18px 18px" }}>
                        <div style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 6 }}>
                            {activeArchive?.id ? "Update Chat Archive" : "Archive Chat with Forge"}
                        </div>
                        <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6, marginBottom: 14 }}>
                            {activeArchive?.id
                                ? "Update this existing archive card with the new continuation."
                                : "Save this conversation into your archive and clear the current chat."}
                        </div>
                        <input
                            value={archiveTitleInput}
                            onChange={(e) => setArchiveTitleInput(e.target.value)}
                            placeholder="Archive title"
                            style={{
                                width: "100%",
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 12,
                                padding: "12px 14px",
                                color: "#F0EDE8",
                                fontSize: 14,
                                fontFamily: "'Lora', Georgia, serif",
                                outline: "none",
                                boxSizing: "border-box",
                                marginBottom: 14,
                            }}
                        />
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                            <button
                                onClick={() => setSaveArchiveModalOpen(false)}
                                style={{
                                    background: "rgba(255,255,255,0.04)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: 10,
                                    padding: "10px 14px",
                                    color: "#888",
                                    cursor: "pointer",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveArchive}
                                disabled={savingArchive}
                                style={{
                                    background: savingArchive ? "rgba(76,175,138,0.18)" : "linear-gradient(135deg, #4CAF8A, #3b8f70)",
                                    border: "none",
                                    borderRadius: 10,
                                    padding: "10px 14px",
                                    color: "#fff",
                                    cursor: savingArchive ? "default" : "pointer",
                                    fontWeight: 600,
                                }}
                            >
                                {savingArchive ? "Saving..." : activeArchive?.id ? "Update Archive" : "Save Archive"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

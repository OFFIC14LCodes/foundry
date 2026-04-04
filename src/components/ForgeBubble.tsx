import { useEffect, useRef, useState } from "react";
import { callForgeAPI, streamForgeAPI } from "../lib/forgeApi";
import { FORGE_SYSTEM_PROMPT } from "../constants/prompts";
import { saveConversationSummary } from "../db";
import ForgeAvatar from "./ForgeAvatar";
import TypingDots from "./TypingDots";
import Logo from "./Logo";

interface BubbleMessage {
    id: string;
    role: "user" | "forge";
    text: string;
    createdAt: string;
}

interface ForgeBubbleProps {
    profile: any;
    userId: string;
    currentScreen: string;
    onBubbleSummaryAdded?: (summary: any) => void;
}

const SCREEN_LABELS: Record<string, string> = {
    hub: "the Hub (their main dashboard — shows stage progress, decisions log, and budget)",
    forge: "the Forge chat (their active AI coaching session)",
    journal: "the Journal (personal notes and reflections)",
    settings: "Settings",
    briefings: "the Briefings screen",
    pitchPractice: "the Pitch Practice screen",
    documents: "the Document Production screen",
    marketIntel: "the Market Intelligence screen",
    cofounder: "the Co-Founder Mode screen",
};

function renderBubbleText(text: string) {
    if (!text) return null;
    return text.split(/\n\n+/).map((para, pi) => (
        <p key={pi} style={{ margin: pi === 0 ? 0 : "8px 0 0 0" }}>
            {para.split(/(\*\*.*?\*\*)/).map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                    return <strong key={i} style={{ color: "#F0EDE8", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
                }
                return part.split("\n").map((line, j) => (
                    <span key={`${i}-${j}`}>{j > 0 && <br />}{line}</span>
                ));
            })}
        </p>
    ));
}

export default function ForgeBubble({ profile, userId, currentScreen, onBubbleSummaryAdded }: ForgeBubbleProps) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<BubbleMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [closing, setClosing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const sessionStartRef = useRef<string | null>(null);

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

    const buildContext = () => {
        const screenLabel = SCREEN_LABELS[currentScreen] || currentScreen;
        const now = new Date();
        const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
        return `
Current date: ${dateStr}
The founder is currently viewing ${screenLabel}.
Founder: ${profile.name} | Business: ${profile.businessName || profile.idea || "Idea stage"} (${profile.industry || "Early Stage"})
Strategy: ${profile.strategyLabel || profile.strategy} | Current Stage: ${profile.currentStage} | Experience: ${profile.experience || "Not specified"}
Budget: $${(profile.budget?.remaining || 0).toLocaleString()} remaining of $${(profile.budget?.total || 0).toLocaleString()} | Spent: $${(profile.budget?.spent || 0).toLocaleString()}

You are in a quick-access floating chat bubble. The founder is asking a quick question or needs help with what they're looking at. Be helpful, warm, and concise — this is a quick-assist context, not a deep coaching session. You are still Forge — same personality, same expertise — just more conversational. You can help them understand what they see on the screen, navigate the app, or think through a quick question.
        `.trim();
    };

    const send = async () => {
        if (!input.trim() || loading) return;
        if (!sessionStartRef.current) {
            sessionStartRef.current = new Date().toISOString();
        }

        const text = input.trim();
        setInput("");
        const timestamp = new Date().toISOString();
        const userMsg: BubbleMessage = { id: `u-${Date.now()}`, role: "user", text, createdAt: timestamp };
        const forgeMsg: BubbleMessage = { id: `f-${Date.now()}`, role: "forge", text: "", createdAt: new Date().toISOString() };

        const currentMessages = [...messages, userMsg];
        setMessages([...currentMessages, forgeMsg]);
        setLoading(true);

        try {
            const ctx = buildContext();
            const apiMsgs = currentMessages.map(m => ({
                role: m.role === "forge" ? "assistant" : "user",
                content: m.text,
            }));

            await streamForgeAPI(
                apiMsgs,
                FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", ctx),
                (chunk) => {
                    setMessages(prev => prev.map(m => m.id === forgeMsg.id ? { ...m, text: chunk } : m));
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
            .map(m => `${m.role === "forge" ? "Forge" : profile.name}: ${m.text}`)
            .join("\n");

        const displayDate = new Date(sessionDate).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric"
        });

        try {
            const raw = await callForgeAPI(
                [{
                    role: "user",
                    content: `Summarize this quick Forge chat for ${profile.name} on ${displayDate}.\n\nReturn valid JSON with exactly these keys:\n"title": a concise headline under 80 characters describing the main topic\n"summary": a brief markdown summary of key questions asked and answers given.\n\nConversation:\n${transcript}`
                }],
                "You write clean business conversation summaries. Return only valid JSON."
            );

            let title = `Quick Chat · ${displayDate}`;
            let summary = raw;
            try {
                const parsed = JSON.parse(raw);
                title = parsed.title?.trim() || title;
                summary = parsed.summary?.trim() || raw;
            } catch { /* use raw fallbacks */ }

            const saved = await saveConversationSummary(userId, 0, dateKey, title, summary, msgsToArchive.length);
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
                    style={{
                        position: "fixed",
                        bottom: 92,
                        right: 24,
                        zIndex: 200,
                        width: "min(370px, calc(100vw - 32px))",
                        height: "min(520px, calc(100vh - 120px))",
                        background: "#0D0D0F",
                        border: "1px solid rgba(255,255,255,0.09)",
                        borderRadius: 18,
                        display: "flex",
                        flexDirection: "column",
                        boxShadow: "0 24px 64px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.4)",
                        overflow: "hidden",
                        fontFamily: "'DM Sans', sans-serif",
                        animation: "bubbleSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            padding: "13px 16px",
                            borderBottom: "1px solid rgba(255,255,255,0.06)",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            background: "rgba(255,255,255,0.02)",
                            flexShrink: 0,
                        }}
                    >
                        <ForgeAvatar size={30} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#F0EDE8", lineHeight: 1.2 }}>
                                Ask Forge
                            </div>
                            <div style={{ fontSize: 10, color: "#4CAF8A", marginTop: 1 }}>
                                ● Quick help · always here
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            title={hasMessages ? "Close & archive this chat" : "Close"}
                            style={{
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 8,
                                padding: "5px 10px",
                                color: "#888",
                                fontSize: 11,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                transition: "all 0.15s",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.color = "#F0EDE8"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#888"; }}
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
                                        background: "linear-gradient(135deg, #2D221C, #171214)",
                                        border: "1px solid rgba(232,98,42,0.2)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <Logo variant="forge" style={{ width: 28, height: 28, objectFit: "contain" }} />
                                </div>
                                <div style={{ fontSize: 13, color: "#C8C4BE", fontWeight: 500 }}>
                                    What can I help with?
                                </div>
                                <div style={{ fontSize: 11, color: "#555", lineHeight: 1.6, maxWidth: 240 }}>
                                    Ask me anything about what you're seeing, or just think out loud. I'm here.
                                </div>
                            </div>
                        )}

                        {messages.map((msg) => (
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
                                <div
                                    style={{
                                        maxWidth: "82%",
                                        padding: "9px 12px",
                                        borderRadius: msg.role === "user"
                                            ? "14px 4px 14px 14px"
                                            : "4px 14px 14px 14px",
                                        background: msg.role === "user"
                                            ? "rgba(232,98,42,0.14)"
                                            : "rgba(255,255,255,0.04)",
                                        border: msg.role === "user"
                                            ? "1px solid rgba(232,98,42,0.22)"
                                            : "1px solid rgba(255,255,255,0.07)",
                                        fontSize: 12.5,
                                        color: msg.role === "user" ? "#F0EDE8" : "#C8C4BE",
                                        lineHeight: 1.65,
                                    }}
                                >
                                    {renderBubbleText(msg.text)}
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
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.07)",
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
                            padding: "10px 12px",
                            borderTop: "1px solid rgba(255,255,255,0.05)",
                            background: "rgba(8,8,9,0.8)",
                            display: "flex",
                            gap: 8,
                            alignItems: "flex-end",
                            flexShrink: 0,
                        }}
                    >
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
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.09)",
                                borderRadius: 10,
                                padding: "8px 11px",
                                color: "#F0EDE8",
                                fontSize: 12.5,
                                fontFamily: "'DM Sans', sans-serif",
                                resize: "none",
                                outline: "none",
                                lineHeight: 1.5,
                                maxHeight: 80,
                                overflowY: "auto",
                            }}
                        />
                        <button
                            onClick={send}
                            disabled={!input.trim() || loading}
                            style={{
                                width: 34,
                                height: 34,
                                borderRadius: 9,
                                border: "none",
                                background: input.trim() && !loading
                                    ? "linear-gradient(135deg, #E8622A, #c9521e)"
                                    : "rgba(255,255,255,0.06)",
                                color: input.trim() && !loading ? "#fff" : "#444",
                                cursor: input.trim() && !loading ? "pointer" : "default",
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
                </div>
            )}

            {/* Floating Bubble Button */}
            <button
                onClick={() => {
                    if (open) {
                        handleClose();
                    } else {
                        setOpen(true);
                    }
                }}
                title="Ask Forge"
                style={{
                    position: "fixed",
                    bottom: 24,
                    right: 24,
                    zIndex: 200,
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: open
                        ? "linear-gradient(135deg, #1a120e, #2D221C)"
                        : "linear-gradient(135deg, #2D221C, #1a120e)",
                    border: `1.5px solid ${open ? "rgba(232,98,42,0.6)" : "rgba(232,98,42,0.35)"}`,
                    boxShadow: open
                        ? "0 4px 24px rgba(232,98,42,0.35), 0 2px 8px rgba(0,0,0,0.5)"
                        : "0 4px 20px rgba(232,98,42,0.22), 0 2px 8px rgba(0,0,0,0.4)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = "0 6px 28px rgba(232,98,42,0.45), 0 2px 10px rgba(0,0,0,0.5)";
                    e.currentTarget.style.transform = "scale(1.06)";
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = open
                        ? "0 4px 24px rgba(232,98,42,0.35), 0 2px 8px rgba(0,0,0,0.5)"
                        : "0 4px 20px rgba(232,98,42,0.22), 0 2px 8px rgba(0,0,0,0.4)";
                    e.currentTarget.style.transform = "scale(1)";
                }}
            >
                {closing ? (
                    <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid rgba(232,98,42,0.4)", borderTopColor: "#E8622A", animation: "spin 0.8s linear infinite" }} />
                ) : (
                    <Logo
                        variant="forge"
                        style={{
                            width: 28,
                            height: 28,
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

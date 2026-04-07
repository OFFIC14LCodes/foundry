import { useEffect, useRef, useState } from "react";
import { cleanAIText } from "../lib/cleanAIText";
import { streamForgeAPI } from "../lib/forgeApi";
import { processFile, buildMessageContent, type AttachedFile } from "../lib/fileAttach";
import { FORGE_SYSTEM_PROMPT } from "../constants/prompts";
import ForgeAvatar from "./ForgeAvatar";
import TypingDots from "./TypingDots";
import Logo from "./Logo";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface ChatMessage {
    id: string;
    role: "user" | "forge";
    text: string;
}

interface ForgeChatRoomProps {
    profile: any;
    onBack: () => void;
}

// ─────────────────────────────────────────────────────────────
// Context for Forge in this chat room
// ─────────────────────────────────────────────────────────────
function buildChatRoomContext(profile: any): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    return `
Current date: ${dateStr}
Founder: ${profile.name} | Business: ${profile.businessName || profile.idea || "Idea stage"} (${profile.industry || "Early Stage"})
Strategy: ${profile.strategyLabel || profile.strategy} | Current Stage: ${profile.currentStage} | Experience: ${profile.experience || "Not specified"}
Budget: $${(profile.budget?.remaining || 0).toLocaleString()} remaining of $${(profile.budget?.total || 0).toLocaleString()}

CONTEXT — FORGE CHAT ROOM:
The founder has opened the Chat Room — a dedicated space for open-ended conversation, questions, and learning. This is not a coaching session tied to stage milestones. There is no agenda. The founder might want to think out loud, explore a concept, get a second opinion, discuss something they read, ask about business fundamentals, or just talk through what's on their mind.

Your role here is slightly different from the structured Forge chat: lean into education. When a founder asks a question — even a simple one — look for the natural teaching moment inside it. Not by lecturing, but by giving them the fuller picture behind the answer. If they ask "what's a CAC?", don't just define it — show them why it matters, what a healthy one looks like for their type of business, and what it tells you about your model.

That said, don't turn every exchange into a lesson. Match their energy. If they want a quick answer, give one. If they seem curious and want to go deep, go deep with them. Read the room.

Be the knowledgeable business partner they can talk to freely — about their business, about business in general, about an idea they have, about something that's worrying them, about something that excited them. This is a safe space to think out loud without worrying about what step they're on.
    `.trim();
}

// ─────────────────────────────────────────────────────────────
// Text rendering
// ─────────────────────────────────────────────────────────────
function renderText(text: string) {
    if (!text) return null;
    return cleanAIText(text).split(/\n\n+/).map((para, pi) => (
        <p key={pi} style={{ margin: pi === 0 ? 0 : "10px 0 0 0" }}>
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

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function ForgeChatRoom({ profile, onBack }: ForgeChatRoomProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, loading]);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 150);
    }, []);

    const send = async () => {
        if ((!input.trim() && attachedFiles.length === 0) || loading) return;

        const text = input.trim();
        const currentFiles = [...attachedFiles];
        setInput("");
        setAttachedFiles([]);

        const attachmentLabel = currentFiles.length > 0
            ? `[Attached: ${currentFiles.map(f => f.name).join(", ")}]`
            : "";
        const displayText = [attachmentLabel, text].filter(Boolean).join("\n");

        const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text: displayText };
        const forgeMsg: ChatMessage = { id: `f-${Date.now()}`, role: "forge", text: "" };

        const history = [...messages, userMsg];
        setMessages([...history, forgeMsg]);
        setLoading(true);

        try {
            const ctx = buildChatRoomContext(profile);
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    const hasMessages = messages.length > 0;

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "#080809",
            display: "flex",
            flexDirection: "column",
            fontFamily: "'DM Sans', sans-serif",
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
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#F0EDE8", fontFamily: "'Lora', Georgia, serif" }}>
                        Chat with Forge
                    </div>
                    <div style={{ fontSize: 11, color: "#4CAF8A", marginTop: 1 }}>
                        Ask anything · learn freely
                    </div>
                </div>
                {hasMessages && (
                    <button
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
                                What's on your mind?
                            </div>
                            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7, maxWidth: 380 }}>
                                This is your open space to talk through anything — business questions, ideas, concepts you're learning, or things you're unsure about. No agenda. Just a conversation.
                            </div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
                            {[
                                "What's the difference between revenue and profit?",
                                "How do I know if my idea is worth pursuing?",
                                "What makes a pitch deck compelling?",
                                "Explain unit economics simply",
                            ].map(prompt => (
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
                                        fontFamily: "'DM Sans', sans-serif",
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

                {messages.map(msg => (
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
                        <div style={{
                            maxWidth: "78%",
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
                        }}>
                            {renderText(msg.text)}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <ForgeAvatar size={28} />
                        <div style={{
                            padding: "10px 14px",
                            borderRadius: "4px 16px 16px 16px",
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.07)",
                        }}>
                            <TypingDots />
                        </div>
                    </div>
                )}
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
                                padding: "6px 2px",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                transition: "color 0.15s",
                            }}
                            onMouseEnter={e => { if (attachedFiles.length === 0) e.currentTarget.style.color = "#888"; }}
                            onMouseLeave={e => { if (attachedFiles.length === 0) e.currentTarget.style.color = "#444"; }}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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

                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask anything — business, concepts, ideas, whatever's on your mind..."
                            rows={1}
                            style={{
                                flex: 1,
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 12,
                                padding: "10px 14px",
                                color: "#F0EDE8",
                                fontSize: 13.5,
                                fontFamily: "'DM Sans', sans-serif",
                                resize: "none",
                                outline: "none",
                                lineHeight: 1.5,
                                maxHeight: 120,
                                overflowY: "auto",
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
                    <div style={{ fontSize: 10, color: "#333", textAlign: "center" }}>
                        Shift + Enter for new line
                    </div>
                </div>
            </div>
        </div>
    );
}

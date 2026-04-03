import { useState, useRef, useEffect } from "react";
import { Icons } from "../icons";
import { useSpeech } from "../hooks/useSpeech";
import { useConversationalTts } from "../hooks/useConversationalTts";
import { streamForgeAPI, callForgeAPI } from "../lib/forgeApi";
import { buildPitchSystemPrompt, buildFeedbackSystemPrompt } from "../constants/pitchPrompt";
import TypingDots from "./TypingDots";
import ForgeAvatar from "./ForgeAvatar";
import Logo from "./Logo";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Phase = "setup" | "session" | "feedback";
type Mode = "text" | "voice";
type Scenario = "investor" | "customer" | "elevator" | "partner";

interface PitchMessage {
    role: "user" | "forge";
    text: string;
    id?: number;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const SCENARIOS: { id: Scenario; label: string; sub: string; emoji: string }[] = [
    { id: "investor", label: "Investor Pitch", sub: "Convince an angel to write a check", emoji: "💼" },
    { id: "customer", label: "Customer Pitch", sub: "Win your first paying customer", emoji: "🛍️" },
    { id: "elevator", label: "Elevator Pitch", sub: "60 seconds — make it count", emoji: "⬆️" },
    { id: "partner", label: "Partner Pitch", sub: "Find the right co-founder or partner", emoji: "🤝" },
];

// ─────────────────────────────────────────────────────────────
// Feedback renderer — handles **bold** and - bullet points
// ─────────────────────────────────────────────────────────────
function renderInline(text: string) {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
        i % 2 === 1
            ? <strong key={i} style={{ color: "#F0EDE8" }}>{part}</strong>
            : part
    );
}

function FeedbackText({ text }: { text: string }) {
    const lines = text.split("\n");
    return (
        <>
            {lines.map((line, i) => {
                const headerMatch = line.match(/^\*\*(.+)\*\*$/);
                if (headerMatch) {
                    return (
                        <div key={i} style={{ fontWeight: 700, color: "#F0EDE8", marginTop: i > 0 ? 20 : 0, marginBottom: 6, fontSize: 13, letterSpacing: "0.02em" }}>
                            {headerMatch[1]}
                        </div>
                    );
                }
                if (line.startsWith("- ")) {
                    return (
                        <div key={i} style={{ fontSize: 13, color: "#C8C4BE", paddingLeft: 14, lineHeight: 1.75, marginBottom: 3 }}>
                            · {renderInline(line.slice(2))}
                        </div>
                    );
                }
                if (line.trim() === "") return <div key={i} style={{ height: 6 }} />;
                return (
                    <div key={i} style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.75, marginBottom: 2 }}>
                        {renderInline(line)}
                    </div>
                );
            })}
        </>
    );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function PitchPracticeScreen({ profile, onBack }: { profile: any; onBack: () => void }) {
    const [phase, setPhase] = useState<Phase>("setup");
    const [mode, setMode] = useState<Mode>("text");
    const [scenario, setScenario] = useState<Scenario>("investor");
    const [messages, setMessages] = useState<PitchMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [forgeVoiceOn, setForgeVoiceOn] = useState(true);
    const [sessionTime, setSessionTime] = useState(0);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const { supported: speechSupported, listening, startListening, stopListening } = useSpeech();
    const {
        speaking,
        cancel: cancelSpeech,
        beginStream: beginVoiceStream,
        ingestStreamText,
        finalizeStream,
        speakText,
    } = useConversationalTts(mode === "voice" && forgeVoiceOn);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    // Session timer
    useEffect(() => {
        if (phase === "session") {
            timerRef.current = setInterval(() => setSessionTime(t => t + 1), 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase]);

    const formatTime = (s: number) =>
        `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

    // ── Start session, stream Forge's opening line ──
    const startSession = async () => {
        setMessages([]);
        setSessionTime(0);
        setPhase("session");
        setLoading(true);

        const openerId = Date.now();
        const openerMsg: PitchMessage = { role: "forge", text: "", id: openerId };
        setMessages([openerMsg]);

        const systemPrompt = buildPitchSystemPrompt(profile, scenario);
        try {
            if (mode === "voice" && forgeVoiceOn) beginVoiceStream();
            const finalText = await streamForgeAPI(
                [{ role: "user", content: "Begin the session. Introduce yourself in one sentence as the audience, then invite me to pitch you. Keep it brief and natural." }],
                systemPrompt,
                (chunk) => {
                    setMessages(prev => prev.map(m => m.id === openerId ? { ...m, text: chunk } : m));
                    if (mode === "voice" && forgeVoiceOn) ingestStreamText(chunk);
                }
            );
            setMessages(prev => prev.map(m => m.id === openerId ? { ...m, text: finalText, id: undefined } : m));
            if (mode === "voice" && forgeVoiceOn) await finalizeStream(finalText);
        } catch {
            const fallback = "Ready when you are. Go ahead and pitch me.";
            setMessages([{ role: "forge", text: fallback }]);
            if (mode === "voice" && forgeVoiceOn) await speakText(fallback);
        }
        setLoading(false);
    };

    // ── Send a user message and stream Forge's reply ──
    const sendMessage = async (text: string) => {
        if (!text.trim() || loading) return;
        setInput("");
        cancelSpeech();

        const userMsg: PitchMessage = { role: "user", text: text.trim() };
        const forgeId = Date.now();
        const forgeMsg: PitchMessage = { role: "forge", text: "", id: forgeId };

        // Capture messages before state update for API call
        const priorMessages = messages;

        setMessages(prev => [...prev, userMsg]);
        setLoading(true);
        await new Promise(r => setTimeout(r, 300));
        setMessages(prev => [...prev, forgeMsg]);

        // Reconstruct full API conversation history
        const apiMessages = [
            { role: "user", content: "Begin the session. Introduce yourself in one sentence as the audience, then invite me to pitch you. Keep it brief and natural." },
            ...priorMessages.map(m => ({
                role: m.role === "user" ? "user" : "assistant",
                content: m.text,
            })),
            { role: "user", content: text.trim() },
        ];

        const systemPrompt = buildPitchSystemPrompt(profile, scenario);
        try {
            if (mode === "voice" && forgeVoiceOn) beginVoiceStream();
            const finalText = await streamForgeAPI(apiMessages, systemPrompt, (chunk) => {
                setMessages(prev => prev.map(m => m.id === forgeId ? { ...m, text: chunk } : m));
                if (mode === "voice" && forgeVoiceOn) ingestStreamText(chunk);
            });
            setMessages(prev => prev.map(m => m.id === forgeId ? { ...m, text: finalText, id: undefined } : m));
            if (mode === "voice" && forgeVoiceOn) await finalizeStream(finalText);
        } catch {
            const fallback = "Something went wrong. Try again.";
            setMessages(prev => prev.map(m => m.id === forgeId ? { ...m, text: fallback } : m));
            if (mode === "voice" && forgeVoiceOn) await speakText(fallback);
        }
        setLoading(false);
    };

    // ── End session, fetch coaching feedback ──
    const endSession = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        cancelSpeech();
        stopListening();
        setPhase("feedback");
        setLoading(true);

        const systemPrompt = buildFeedbackSystemPrompt(profile, scenario, messages);
        try {
            const result = await callForgeAPI(
                [{ role: "user", content: "Please provide the coaching feedback now." }],
                systemPrompt
            );
            setFeedback(result);
        } catch {
            setFeedback("Something went wrong generating your feedback. Review the conversation above and note what felt unclear or unconvincing — that's your starting point.");
        }
        setLoading(false);
    };

    // ── Voice input handler ──
    const handleMicPress = () => {
        if (loading || speaking) return;
        if (listening) {
            stopListening();
            return;
        }
        cancelSpeech();
        startListening(
            (transcript) => sendMessage(transcript),
            () => { /* mic error — silent fail, user can try again */ }
        );
    };

    // ── Reset back to setup ──
    const restart = () => {
        cancelSpeech();
        stopListening();
        setMessages([]);
        setFeedback(null);
        setSessionTime(0);
        setPhase("setup");
    };

    // ═══════════════════════════════════════════════════════════
    // SETUP PHASE
    // ═══════════════════════════════════════════════════════════
    if (phase === "setup") {
        return (
            <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8" }}>
                {/* Header */}
                <div style={{ padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)", zIndex: 10 }}>
                    <button
                        onClick={onBack}
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 12px", color: "#888", fontSize: 13, cursor: "pointer" }}
                    >
                        ← Back
                    </button>
                    <div>
                        <div style={{ fontSize: 16, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700 }}>Pitch Practice</div>
                        <div style={{ fontSize: 10, color: "#555" }}>Rehearse your pitch with Forge</div>
                    </div>
                </div>

                <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px 16px 60px" }}>
                    {/* Intro */}
                    <div style={{ marginBottom: 28, animation: "fadeSlideUp 0.4s ease both" }}>
                        <div style={{ fontSize: 23, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, marginBottom: 8, lineHeight: 1.2 }}>
                            Your rehearsal room.
                        </div>
                        <div style={{ fontSize: 13, color: "#888", lineHeight: 1.75, fontFamily: "'Lora', Georgia, serif", fontStyle: "italic" }}>
                            Forge plays the audience. You pitch. Get honest feedback on your clarity, confidence, and persuasiveness — before the stakes are real.
                        </div>
                    </div>

                    {/* Mode Selector */}
                    <div style={{ marginBottom: 24, animation: "fadeSlideUp 0.4s ease 0.05s both" }}>
                        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Input Mode</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            {(["text", "voice"] as Mode[]).map(m => {
                                const unavailable = m === "voice" && !speechSupported;
                                return (
                                    <button
                                        key={m}
                                        onClick={() => !unavailable && setMode(m)}
                                        style={{
                                            padding: "16px 12px",
                                            borderRadius: 12,
                                            border: mode === m ? "1px solid rgba(232,98,42,0.5)" : "1px solid rgba(255,255,255,0.06)",
                                            background: mode === m ? "rgba(232,98,42,0.1)" : "rgba(255,255,255,0.02)",
                                            cursor: unavailable ? "not-allowed" : "pointer",
                                            opacity: unavailable ? 0.35 : 1,
                                            textAlign: "center",
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        <div style={{ fontSize: 20, marginBottom: 5 }}>{m === "text" ? "⌨️" : "🎤"}</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: mode === m ? "#E8622A" : "#C8C4BE", marginBottom: 3 }}>
                                            {m === "text" ? "Text" : "Voice"}
                                        </div>
                                        <div style={{ fontSize: 10, color: "#555" }}>
                                            {m === "text" ? "Type your pitch" : speechSupported ? "Speak naturally" : "Not supported"}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Scenario Selector */}
                    <div style={{ marginBottom: 24, animation: "fadeSlideUp 0.4s ease 0.1s both" }}>
                        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Scenario</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {SCENARIOS.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setScenario(s.id)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 14,
                                        padding: "12px 14px",
                                        borderRadius: 12,
                                        border: scenario === s.id ? "1px solid rgba(232,98,42,0.5)" : "1px solid rgba(255,255,255,0.06)",
                                        background: scenario === s.id ? "rgba(232,98,42,0.08)" : "rgba(255,255,255,0.02)",
                                        cursor: "pointer",
                                        textAlign: "left",
                                        transition: "all 0.15s",
                                        width: "100%",
                                    }}
                                >
                                    <span style={{ fontSize: 20, flexShrink: 0 }}>{s.emoji}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, color: scenario === s.id ? "#E8622A" : "#C8C4BE", fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
                                        <div style={{ fontSize: 11, color: "#555" }}>{s.sub}</div>
                                    </div>
                                    {scenario === s.id && <span style={{ color: "#E8622A", fontSize: 12, flexShrink: 0 }}>✓</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Forge voice toggle — only in voice mode */}
                    {mode === "voice" && (
                        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, animation: "fadeSlideUp 0.3s ease both" }}>
                            <span style={{ fontSize: 12, color: "#888" }}>Forge speaks responses aloud</span>
                            <button
                                onClick={() => setForgeVoiceOn(v => !v)}
                                style={{ background: forgeVoiceOn ? "rgba(232,98,42,0.18)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 20, padding: "4px 14px", color: forgeVoiceOn ? "#E8622A" : "#555", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                            >
                                {forgeVoiceOn ? "On" : "Off"}
                            </button>
                        </div>
                    )}

                    {/* Start Button */}
                    <button
                        onClick={startSession}
                        style={{ width: "100%", padding: "15px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.02em", animation: "fadeSlideUp 0.4s ease 0.15s both" }}
                    >
                        Start Session →
                    </button>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    // FEEDBACK PHASE
    // ═══════════════════════════════════════════════════════════
    if (phase === "feedback") {
        const scenarioLabel = SCENARIOS.find(s => s.id === scenario)?.label || "Pitch";
        return (
            <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8" }}>
                <div style={{ padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)", zIndex: 10 }}>
                    <button onClick={onBack} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 12px", color: "#888", fontSize: 13, cursor: "pointer" }}>← Hub</button>
                    <div>
                        <div style={{ fontSize: 16, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700 }}>Session Complete</div>
                        <div style={{ fontSize: 10, color: "#555" }}>{formatTime(sessionTime)} · {scenarioLabel}</div>
                    </div>
                </div>

                <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px 16px 60px" }}>
                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "80px 0", color: "#555" }}>
                            <Logo variant="flame" style={{ width: 32, height: 32, objectFit: "contain" }} />
                            <div style={{ fontSize: 14, fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", color: "#666" }}>
                                Forge is reviewing your pitch...
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: 20, animation: "fadeSlideUp 0.4s ease both" }}>
                                <div style={{ fontSize: 22, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, marginBottom: 4 }}>Coaching Feedback</div>
                                <div style={{ fontSize: 12, color: "#555" }}>From your {scenarioLabel.toLowerCase()} · {formatTime(sessionTime)}</div>
                            </div>

                            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px 18px", marginBottom: 16, animation: "fadeSlideUp 0.4s ease 0.05s both" }}>
                                {feedback ? <FeedbackText text={feedback} /> : null}
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, animation: "fadeSlideUp 0.4s ease 0.1s both" }}>
                                <button
                                    onClick={restart}
                                    style={{ padding: "13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#C8C4BE", fontSize: 13, cursor: "pointer", fontWeight: 500 }}
                                >
                                    Practice Again
                                </button>
                                <button
                                    onClick={onBack}
                                    style={{ padding: "13px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
                                >
                                    Back to Hub
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    // SESSION PHASE
    // ═══════════════════════════════════════════════════════════
    const scenarioLabel = SCENARIOS.find(s => s.id === scenario)?.label || "Pitch";

    return (
        <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#080809", fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8", overflow: "hidden" }}>
            {/* Session Header */}
            <div style={{ padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Logo variant="flame" style={{ width: 32, height: 32, objectFit: "contain" }} />
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>{scenarioLabel}</div>
                        <div style={{ fontSize: 10, color: "#555" }}>{formatTime(sessionTime)} · {mode === "voice" ? "Voice" : "Text"}</div>
                    </div>
                </div>
                <button
                    onClick={endSession}
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 14px", color: "#888", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                >
                    End Session
                </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        style={{
                            display: "flex",
                            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                            alignItems: "flex-start",
                            marginBottom: 10,
                            animation: "fadeSlideUp 0.25s ease both",
                        }}
                    >
                        {msg.role === "forge" && (
                            <div style={{ marginRight: 8, flexShrink: 0, marginTop: 1 }}>
                                <ForgeAvatar size={28} />
                            </div>
                        )}
                        <div
                            style={{
                                maxWidth: "78%",
                                padding: "10px 14px",
                                borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                                background: msg.role === "user" ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.04)",
                                border: msg.role === "user" ? "1px solid rgba(232,98,42,0.2)" : "1px solid rgba(255,255,255,0.06)",
                                fontSize: 13,
                                lineHeight: 1.65,
                                color: msg.role === "user" ? "#F0EDE8" : "#C8C4BE",
                            }}
                        >
                            {msg.text
                                ? msg.text.replace(/\[COACH\]\s*/g, "💡 ")
                                : (msg.id ? <TypingDots /> : null)
                            }
                        </div>
                    </div>
                ))}

                {/* Standalone typing indicator when Forge hasn't appeared yet */}
                {loading && !messages.some(m => m.id) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <ForgeAvatar size={28} />
                        <div style={{ padding: "10px 14px", borderRadius: "4px 16px 16px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <TypingDots />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Voice status bar */}
            {mode === "voice" && (listening || speaking) && (
                <div style={{ padding: "7px 16px", background: "rgba(232,98,42,0.07)", borderTop: "1px solid rgba(232,98,42,0.12)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: listening ? "#4CAF8A" : "#E8622A", animation: "forgePulse 1s infinite" }} />
                    <span style={{ fontSize: 11, color: "#777" }}>
                        {listening ? "Listening..." : "Forge is speaking..."}
                    </span>
                    {speaking && (
                        <button onClick={cancelSpeech} style={{ marginLeft: "auto", background: "none", border: "none", color: "#555", fontSize: 11, cursor: "pointer" }}>
                            Skip
                        </button>
                    )}
                </div>
            )}

            {/* Input Area */}
            <div style={{ padding: "10px 12px max(12px, calc(8px + env(safe-area-inset-bottom)))", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0, background: "#080809" }}>
                {mode === "voice" ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingBottom: 4 }}>
                        <button
                            onClick={handleMicPress}
                            disabled={loading || speaking}
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: "50%",
                                border: listening ? "2px solid #4CAF8A" : "2px solid rgba(232,98,42,0.4)",
                                background: listening ? "rgba(76,175,138,0.15)" : loading || speaking ? "rgba(255,255,255,0.04)" : "rgba(232,98,42,0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: loading || speaking ? "not-allowed" : "pointer",
                                opacity: loading || speaking ? 0.4 : 1,
                                transition: "all 0.2s",
                                animation: listening ? "forgePulse 1.5s infinite" : "none",
                            }}
                        >
                            <Icons.sidebar.voice size={26} color={listening ? "#4CAF8A" : "#E8622A"} />
                        </button>
                        <div style={{ fontSize: 11, color: "#555", textAlign: "center" }}>
                            {listening ? "Tap to stop" : speaking ? "Forge is speaking..." : loading ? "Thinking..." : "Tap mic to speak"}
                        </div>
                    </div>
                ) : (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage(input);
                                }
                            }}
                            placeholder="Say your pitch..."
                            rows={2}
                            disabled={loading}
                            style={{
                                flex: 1,
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.09)",
                                borderRadius: 12,
                                padding: "10px 12px",
                                color: "#F0EDE8",
                                fontSize: 14,
                                fontFamily: "'DM Sans', sans-serif",
                                lineHeight: 1.5,
                                resize: "none",
                                outline: "none",
                                opacity: loading ? 0.6 : 1,
                            }}
                        />
                        <button
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim() || loading}
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                border: "none",
                                background: input.trim() && !loading ? "linear-gradient(135deg, #E8622A, #c9521e)" : "rgba(255,255,255,0.06)",
                                color: input.trim() && !loading ? "#fff" : "#444",
                                fontSize: 18,
                                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                                flexShrink: 0,
                                transition: "all 0.15s",
                            }}
                        >
                            →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

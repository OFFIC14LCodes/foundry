import { useState, useRef, useEffect, type ReactNode } from "react";
import { Icons } from "../icons";
import { useSpeech } from "../hooks/useSpeech";
import { useConversationalTts } from "../hooks/useConversationalTts";
import { streamForgeAPI, callForgeAPI } from "../lib/forgeApi";
import { getLanguageWarning, moderateUserText } from "../lib/languageModeration";
import { buildPitchSystemPrompt, buildFeedbackSystemPrompt } from "../constants/pitchPrompt";
import { loadPitchSessions, saveConversationSummary, saveJournalEntry, savePitchSession, type PitchSessionRecord } from "../db";
import TypingDots from "./TypingDots";
import ForgeAvatar from "./ForgeAvatar";
import Logo from "./Logo";
import { MessageActions } from "./AnimatedChatText";
import MicButton from "./MicButton";
import HelpTooltip from "./HelpTooltip";

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

interface ParsedScores {
    clarity: number;
    confidence: number;
    persuasiveness: number;
    brevity: number;
    overall: number;
    strengths: string[];
    improvements: string[];
    fix: string;
    encouragement: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const SCENARIOS: { id: Scenario; label: string; sub: string; icon: any }[] = [
    { id: "investor", label: "Investor Pitch", sub: "Convince an angel to write a check", icon: Icons.onboarding.twentyToHundredK },
    { id: "customer", label: "Customer Pitch", sub: "Win your first paying customer", icon: Icons.onboarding.alreadyRunning },
    { id: "elevator", label: "Elevator Pitch", sub: "60 seconds — make it count", icon: Icons.forge.advance },
    { id: "partner", label: "Partner Pitch", sub: "Find the right co-founder or partner", icon: Icons.sidebar.cofounder },
];

const SCENARIO_CONTEXT: Record<Scenario, { persona: string; tips: string[]; color: string }> = {
    investor: {
        persona: "A seed-stage angel investor deciding whether this is worth a check.",
        tips: ["Lead with the problem, not the product", "Be specific about market size", "Have a clear ask"],
        color: "#E8622A",
    },
    customer: {
        persona: "A skeptical first customer hearing about your product for the first time.",
        tips: ["Focus on their pain, not your features", "Ask questions before pitching", "Name your price confidently"],
        color: "#4CAF8A",
    },
    elevator: {
        persona: "A seasoned entrepreneur with about 60 seconds before the elevator arrives.",
        tips: ["One sentence on what you do", "One sentence on who it's for", "One clear call to action"],
        color: "#9B59B6",
    },
    partner: {
        persona: "A potential business partner evaluating whether this is worth their time.",
        tips: ["Lead with complementary skills", "Be clear on equity expectations", "Show traction or momentum"],
        color: "#3498DB",
    },
};

function parseFeedbackScores(text: string): ParsedScores | null {
    const match = text.match(/SCORES_JSON:(\{.+\})/);
    if (!match) return null;
    try {
        const parsed = JSON.parse(match[1]);
        return {
            clarity: Number(parsed.clarity),
            confidence: Number(parsed.confidence),
            persuasiveness: Number(parsed.persuasiveness),
            brevity: Number(parsed.brevity),
            overall: Number(parsed.overall),
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
            improvements: Array.isArray(parsed.improvements) ? parsed.improvements.map(String) : [],
            fix: String(parsed.fix ?? ""),
            encouragement: String(parsed.encouragement ?? ""),
        };
    } catch {
        return null;
    }
}

function stripScoresJson(text: string) {
    return text.replace(/\n?SCORES_JSON:.+$/s, "").trim();
}

function scoreColor(score?: number | null) {
    if (!score) return "rgba(240,237,232,0.3)";
    if (score >= 4) return "#4CAF8A";
    if (score === 3) return "#E8622A";
    return "rgba(232,98,42,0.7)";
}

function scenarioLabelFor(id: string) {
    return SCENARIOS.find(s => s.id === id)?.label || "Pitch";
}

function formatSessionDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function calcWordCount(text: string) {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

function averagePitchScore(session: PitchSessionRecord) {
    const values = [session.clarityScore, session.confidenceScore, session.persuasivenessScore, session.brevityScore]
        .filter((value): value is number => typeof value === "number");
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

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

function StructuredPitchText({ text }: { text: string }) {
    const cleaned = text.replace(/\[COACH\]\s*/g, "");
    const lines = cleaned.split("\n");
    const blocks: ReactNode[] = [];
    let paragraphLines: string[] = [];
    let i = 0;

    const flushParagraph = () => {
        if (paragraphLines.length === 0) return;
        blocks.push(
            <div key={`p-${blocks.length}`} style={{ lineHeight: 1.75 }}>
                {renderInline(paragraphLines.join("\n"))}
            </div>
        );
        paragraphLines = [];
    };

    while (i < lines.length) {
        const line = lines[i];

        if (!line.trim()) {
            flushParagraph();
            i++;
            continue;
        }

        const numbered = line.match(/^(\d+)\.\s+(.*)$/);
        if (numbered) {
            flushParagraph();
            const items: { value: number; content: string }[] = [];
            while (i < lines.length) {
                const match = lines[i].match(/^(\d+)\.\s+(.*)$/);
                if (!match) break;
                items.push({ value: Number(match[1]), content: match[2] });
                i++;
            }
            blocks.push(
                <ol key={`ol-${blocks.length}`} start={items[0]?.value || 1} style={{ margin: "0 0 0 18px", padding: 0 }}>
                    {items.map((item, index) => (
                        <li key={index} style={{ lineHeight: 1.75, marginBottom: 6 }}>
                            {renderInline(item.content)}
                        </li>
                    ))}
                </ol>
            );
            continue;
        }

        if (line.startsWith("- ") || line.startsWith("* ")) {
            flushParagraph();
            const items: string[] = [];
            while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
                items.push(lines[i].slice(2));
                i++;
            }
            blocks.push(
                <ul key={`ul-${blocks.length}`} style={{ margin: "0 0 0 18px", padding: 0 }}>
                    {items.map((item, index) => (
                        <li key={index} style={{ lineHeight: 1.75, marginBottom: 6 }}>
                            {renderInline(item)}
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        paragraphLines.push(line);
        i++;
    }

    flushParagraph();
    return <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{blocks}</div>;
}

function ScoreCard({ label, value }: { label: string; value?: number | null }) {
    const safeValue = value ?? 0;
    const color = scoreColor(safeValue);
    return (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(240,237,232,0.7)", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>{label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 36, color, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1 }}>{safeValue || "—"}</span>
                <span style={{ fontSize: 14, color: "rgba(240,237,232,0.55)", fontFamily: "'DM Sans', sans-serif" }}>/5</span>
            </div>
            <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
                {[1, 2, 3, 4, 5].map(dot => (
                    <span key={dot} style={{ width: 7, height: 7, borderRadius: "50%", background: dot <= safeValue ? color : "rgba(255,255,255,0.1)" }} />
                ))}
            </div>
        </div>
    );
}

function OverallScoreCard({ value }: { value?: number | null }) {
    const safeValue = value ?? 0;
    const color = scoreColor(safeValue);
    return (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 18, marginBottom: 18 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(240,237,232,0.7)", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Overall</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 12 }}>
                <span style={{ fontSize: 48, color, fontFamily: "'Playfair Display', Georgia, serif", lineHeight: 1 }}>{safeValue || "—"}</span>
                <span style={{ fontSize: 14, color: "rgba(240,237,232,0.55)", fontFamily: "'DM Sans', sans-serif" }}>/5</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${Math.max(0, Math.min(100, (safeValue / 5) * 100))}%`, height: "100%", background: color, borderRadius: 3 }} />
            </div>
        </div>
    );
}

function FeedbackSections({ text, scores }: { text: string; scores: ParsedScores | null }) {
    const withoutScores = text.replace(/\*\*Scores\*\*[\s\S]*$/i, "").trim();
    const sections = withoutScores.split(/\*\*(What worked|What to sharpen|The one most important fix)\*\*/g);
    const rendered: ReactNode[] = [];

    for (let i = 1; i < sections.length; i += 2) {
        const title = sections[i];
        const body = sections[i + 1]?.trim() ?? "";
        const lines = body.split("\n").map(line => line.trim()).filter(Boolean);
        const isFix = title === "The one most important fix";
        rendered.push(
            <div key={title} style={{
                background: isFix ? "rgba(232,98,42,0.08)" : "transparent",
                border: isFix ? "1px solid rgba(232,98,42,0.2)" : "none",
                borderRadius: isFix ? 10 : 0,
                padding: isFix ? 14 : 0,
                marginBottom: 18,
            }}>
                {isFix && <div style={{ fontSize: 11, textTransform: "uppercase", color: "#E8622A", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>🎯 Focus on this</div>}
                <div style={{ fontSize: 15, color: "#F0EDE8", fontWeight: 600, fontFamily: "'Lora', Georgia, serif", marginBottom: 8 }}>{title}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {lines.map((line, index) => {
                        const cleaned = line.replace(/^- /, "");
                        return (
                            <div key={index} style={{ fontSize: 14, color: "rgba(240,237,232,0.8)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.7, paddingLeft: line.startsWith("- ") ? 8 : 0 }}>
                                {line.startsWith("- ") ? `• ${cleaned}` : cleaned}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <>
            {rendered.length ? rendered : <FeedbackText text={withoutScores} />}
            {scores?.encouragement && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 16, marginTop: 4, textAlign: "center", fontSize: 14, fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", color: "rgba(240,237,232,0.7)", lineHeight: 1.7 }}>
                    {scores.encouragement}
                </div>
            )}
        </>
    );
}

function TranscriptReplay({ messages }: { messages: PitchMessage[] }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((msg, index) => (
                <div key={index} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{
                        maxWidth: "82%",
                        background: msg.role === "user" ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.04)",
                        color: msg.role === "user" ? "rgba(240,237,232,0.8)" : "rgba(240,237,232,0.6)",
                        borderRadius: 10,
                        padding: "8px 12px",
                        fontSize: 13,
                        lineHeight: 1.55,
                        fontFamily: "'DM Sans', sans-serif",
                        whiteSpace: "pre-wrap",
                    }}>{msg.text}</div>
                </div>
            ))}
        </div>
    );
}

function PitchMessageBubble({ msg }: { msg: PitchMessage }) {
    const isCoachingNote = msg.role === "forge" && msg.text.trim().startsWith("[COACHING NOTE]:");
    const displayText = isCoachingNote ? msg.text.replace(/^\[COACHING NOTE\]:\s*/i, "") : msg.text;

    if (isCoachingNote) {
        return (
            <div style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(76,175,138,0.08)",
                border: "1px solid rgba(76,175,138,0.2)",
                color: "rgba(240,237,232,0.75)",
                fontSize: 13,
                lineHeight: 1.65,
            }}>
                <div style={{ color: "#4CAF8A", fontSize: 11, fontFamily: "'DM Sans', sans-serif", marginBottom: 5 }}>💡 Quick coaching note</div>
                <StructuredPitchText text={displayText} />
            </div>
        );
    }

    return (
        <div
            style={{
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
                ? msg.role === "forge"
                    ? <StructuredPitchText text={displayText} />
                    : <div style={{ whiteSpace: "pre-wrap" }}>{displayText}</div>
                : (msg.id ? <TypingDots /> : null)
            }
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function PitchPracticeScreen({
    userId,
    profile,
    onBack,
    onOpenNav,
    trialUsesRemaining = null,
    onConsumeTrialUse,
}: {
    userId: string;
    profile: any;
    onBack: () => void;
    onOpenNav?: () => void;
    trialUsesRemaining?: number | null;
    onConsumeTrialUse?: () => void;
}) {
    const [phase, setPhase] = useState<Phase>("setup");
    const [mode, setMode] = useState<Mode>("text");
    const [scenario, setScenario] = useState<Scenario>("investor");
    const [messages, setMessages] = useState<PitchMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [scores, setScores] = useState<ParsedScores | null>(null);
    const [archiveSaved, setArchiveSaved] = useState(false);
    const [archiveSaving, setArchiveSaving] = useState(false);
    const [forgeVoiceOn, setForgeVoiceOn] = useState(true);
    const [sessionTime, setSessionTime] = useState(0);
    const [setupTab, setSetupTab] = useState<"practice" | "history">("practice");
    const [history, setHistory] = useState<PitchSessionRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyModal, setHistoryModal] = useState<PitchSessionRecord | null>(null);
    const [transcriptOpen, setTranscriptOpen] = useState(false);
    const [copiedFeedback, setCopiedFeedback] = useState(false);
    const [journalSaved, setJournalSaved] = useState(false);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [showScenarioContext, setShowScenarioContext] = useState(false);
    const [languageWarning, setLanguageWarning] = useState<string | null>(null);
    const [confirmedProfanityInput, setConfirmedProfanityInput] = useState<string | null>(null);

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

    const voiceSupported = speechSupported;

    useEffect(() => {
        let cancelled = false;
        const loadHistory = async () => {
            setHistoryLoading(true);
            const sessions = await loadPitchSessions(userId, 20);
            if (!cancelled) {
                setHistory(sessions);
                setHistoryLoading(false);
            }
        };
        void loadHistory();
        return () => { cancelled = true; };
    }, [userId]);

    useEffect(() => {
        if (!voiceError) return;
        const timeout = window.setTimeout(() => setVoiceError(null), 5000);
        return () => window.clearTimeout(timeout);
    }, [voiceError]);

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
        if (trialUsesRemaining !== null && trialUsesRemaining <= 0) return;
        onConsumeTrialUse?.();
        setMessages([]);
        setFeedback(null);
        setScores(null);
        setTranscriptOpen(false);
        setCopiedFeedback(false);
        setJournalSaved(false);
        setSessionTime(0);
        setPhase("session");
        setLoading(true);
        setVoiceError(null);
        setShowScenarioContext(true);

        const openerId = Date.now();
        const openerMsg: PitchMessage = { role: "forge", text: "", id: openerId };

        const systemPrompt = buildPitchSystemPrompt(profile, scenario);
        try {
            await new Promise(resolve => window.setTimeout(resolve, 3000));
            setShowScenarioContext(false);
            setMessages([openerMsg]);
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
            setShowScenarioContext(false);
            const fallback = "Ready when you are. Go ahead and pitch me.";
            setMessages([{ role: "forge", text: fallback }]);
            if (mode === "voice" && forgeVoiceOn) await speakText(fallback);
        }
        setLoading(false);
    };

    // ── Send a user message and stream Forge's reply ──
    const sendMessage = async (text: string) => {
        if (!text.trim() || loading) return;
        const cleanText = text.trim();
        const warning = getLanguageWarning(cleanText);
        if (warning && confirmedProfanityInput !== cleanText) {
            setLanguageWarning(warning);
            setConfirmedProfanityInput(cleanText);
            return;
        }

        setLanguageWarning(null);
        setConfirmedProfanityInput(null);
        setInput("");
        cancelSpeech();

        const { censoredText } = moderateUserText(cleanText);
        const userMsg: PitchMessage = { role: "user", text: censoredText };
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
            { role: "user", content: cleanText },
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
            const rawFeedback = await callForgeAPI(
                [{ role: "user", content: "Please provide the coaching feedback now." }],
                systemPrompt,
                1500
            );
            const parsedScores = parseFeedbackScores(rawFeedback);
            const displayFeedback = stripScoresJson(rawFeedback);
            setScores(parsedScores);
            setFeedback(displayFeedback);
            await savePitchSession(userId, {
                scenario,
                mode,
                duration_seconds: sessionTime,
                transcript: messages.map(m => ({ role: m.role, text: m.text })),
                feedback: displayFeedback,
                clarity_score: parsedScores?.clarity ?? null,
                confidence_score: parsedScores?.confidence ?? null,
                persuasiveness_score: parsedScores?.persuasiveness ?? null,
                brevity_score: parsedScores?.brevity ?? null,
                overall_score: parsedScores?.overall ?? null,
                key_strengths: parsedScores?.strengths ?? [],
                key_improvements: parsedScores?.improvements ?? [],
                most_important_fix: parsedScores?.fix ?? null,
                encouragement: parsedScores?.encouragement ?? null,
            }).then(saved => {
                if (saved) setHistory(prev => [saved, ...prev.filter(item => item.id !== saved.id)]);
            });
            await savePitchFeedback(displayFeedback);
        } catch {
            const fallback = "Something went wrong generating your feedback. Review the conversation above and note what felt unclear or unconvincing — that's your starting point.";
            setScores(null);
            setFeedback(fallback);
            await savePitchSession(userId, {
                scenario,
                mode,
                duration_seconds: sessionTime,
                transcript: messages.map(m => ({ role: m.role, text: m.text })),
                feedback: fallback,
            }).then(saved => {
                if (saved) setHistory(prev => [saved, ...prev.filter(item => item.id !== saved.id)]);
            });
            await savePitchFeedback(fallback);
        }
        setLoading(false);
    };

    const savePitchFeedback = async (summaryText: string) => {
        if (!summaryText || archiveSaving) return;
        setArchiveSaving(true);
        try {
            const saved = await saveConversationSummary(
                userId,
                Number(profile?.currentStage) || 1,
                new Date().toISOString().slice(0, 10),
                `Pitch Practice — ${scenarioLabel}`,
                summaryText,
                messages.length
            );
            setArchiveSaved(!!saved);
        } catch {
            setArchiveSaved(false);
        } finally {
            setArchiveSaving(false);
        }
    };

    const handleVoiceRecognitionError = (error?: string) => {
        switch (error) {
            case "not-allowed":
                setVoiceError("Microphone access was denied. Enable it in your browser settings.");
                break;
            case "no-speech":
                setVoiceError("No speech detected. Tap the mic and speak clearly.");
                break;
            case "network":
                setVoiceError("Network error. Check your connection and try again.");
                break;
            default:
                setVoiceError("Microphone error. Try speaking again or switch to text mode.");
        }
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
            (transcript) => setInput(transcript.trim()),
            handleVoiceRecognitionError
        );
    };

    const handleRedoVoiceInput = () => {
        if (loading || speaking) return;
        stopListening();
        setInput("");
        cancelSpeech();
        startListening(
            (transcript) => setInput(transcript.trim()),
            handleVoiceRecognitionError
        );
    };

    // ── Reset back to setup ──
    const restart = () => {
        cancelSpeech();
        stopListening();
        setMessages([]);
        setFeedback(null);
        setScores(null);
        setArchiveSaved(false);
        setArchiveSaving(false);
        setTranscriptOpen(false);
        setCopiedFeedback(false);
        setJournalSaved(false);
        setVoiceError(null);
        setShowScenarioContext(false);
        setSessionTime(0);
        setPhase("setup");
    };

    const copyFeedback = async () => {
        if (!feedback) return;
        await navigator.clipboard.writeText(feedback);
        setCopiedFeedback(true);
        window.setTimeout(() => setCopiedFeedback(false), 2000);
    };

    const saveFeedbackToJournal = async () => {
        if (!feedback || journalSaved) return;
        const title = `Pitch Practice — ${scenarioLabelFor(scenario)} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        const content = `${title}\n\n${feedback}`;
        const saved = await saveJournalEntry(userId, content, Number(profile?.currentStage) || 1, calcWordCount(content));
        if (saved) setJournalSaved(true);
    };

    const latestScenarioComparison = (() => {
        if (history.length < 2) return null;
        const latest = history[0];
        const previousSame = history.slice(1).find(item => item.scenario === latest.scenario);
        if (!latest?.overallScore || !previousSame?.overallScore) return null;
        if (latest.overallScore > previousSame.overallScore) return `📈 Improving on ${scenarioLabelFor(latest.scenario).toLowerCase()} pitches`;
        if (latest.overallScore < previousSame.overallScore) return "Keep practicing — consistency builds confidence";
        return "Holding steady — push for the next level";
    })();

    // ═══════════════════════════════════════════════════════════
    // SETUP PHASE
    // ═══════════════════════════════════════════════════════════
    if (phase === "setup") {
        return (
            <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8" }}>
                {/* Header */}
                <div style={{ padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)", zIndex: 10 }}>
                    <button
                        onClick={onOpenNav}
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "var(--foundry-app-header-button-padding)", color: "rgba(240,237,232,0.62)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3.5" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="11" width="14" height="1.5" rx="0.75" fill="currentColor"/></svg>
                    </button>
                    <div>
                        <div style={{ fontSize: "var(--foundry-app-header-title-font)", fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>Pitch Practice</div>
                        <div style={{ fontSize: "var(--foundry-app-header-meta-font)", color: "var(--foundry-text-muted)" }}>Rehearse your pitch with Forge</div>
                    </div>
                </div>

                <div className="foundry-app-page__content" style={{ maxWidth: 560, margin: "0 auto", padding: "28px 16px 60px" }}>
                    {trialUsesRemaining !== null && (
                        <div style={{
                            marginBottom: 18,
                            padding: "12px 14px",
                            borderRadius: 12,
                            background: trialUsesRemaining > 0 ? "rgba(232,98,42,0.05)" : "rgba(232,98,42,0.07)",
                            border: trialUsesRemaining > 0 ? "1px solid rgba(232,98,42,0.14)" : "1px solid rgba(232,98,42,0.2)",
                            fontSize: 12,
                            color: trialUsesRemaining > 0 ? "#BDAFA2" : "#D9B9A6",
                            lineHeight: 1.65,
                        }}>
                            {trialUsesRemaining > 0
                                ? `Free preview includes 3 Pitch Practice sessions. You have ${trialUsesRemaining} remaining.`
                                : "Free preview includes 3 Pitch Practice sessions. You have used them all."}
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 22 }}>
                        {(["practice", "history"] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setSetupTab(tab)}
                                style={{
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: setupTab === tab ? "1px solid rgba(232,98,42,0.45)" : "1px solid rgba(255,255,255,0.07)",
                                    background: setupTab === tab ? "rgba(232,98,42,0.1)" : "rgba(255,255,255,0.025)",
                                    color: setupTab === tab ? "#E8622A" : "rgba(240,237,232,0.55)",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    fontFamily: "'DM Sans', sans-serif",
                                    cursor: "pointer",
                                }}
                            >
                                {tab === "practice" ? "Practice" : "History"}
                            </button>
                        ))}
                    </div>

                    {setupTab === "practice" ? (
                    <>
                    {/* Intro */}
                    <div style={{ marginBottom: 28, animation: "fadeSlideUp 0.4s ease both", textAlign: "left" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <div style={{ fontSize: 23, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, lineHeight: 1.2 }}>
                                Your rehearsal room.
                            </div>
                            <HelpTooltip content="Forge plays the audience. You pitch. Get honest feedback on your clarity, confidence, and persuasiveness before the stakes are real." />
                        </div>
                    </div>
                    {!voiceSupported && (
                        <div style={{ marginTop: -14, marginBottom: 20 }}>
                            <HelpTooltip content="Voice mode requires Chrome or Edge. Text mode works in all browsers." />
                        </div>
                    )}

                    {/* Mode Selector */}
                    <div style={{ marginBottom: 24, animation: "fadeSlideUp 0.4s ease 0.05s both" }}>
                        <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Input Mode</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            {(["text", "voice"] as Mode[]).map(m => {
                                const unavailable = m === "voice" && !speechSupported;
                                const ModeIcon = m === "text" ? Icons.sidebar.documents : Icons.sidebar.voice;
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
                                            textAlign: "left",
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 34,
                                                height: 34,
                                                borderRadius: 10,
                                                background: mode === m ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.04)",
                                                border: mode === m ? "1px solid rgba(232,98,42,0.24)" : "1px solid rgba(255,255,255,0.08)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                marginBottom: 8,
                                            }}
                                        >
                                            <ModeIcon size={18} color={mode === m ? "#E8622A" : "#888"} />
                                        </div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: mode === m ? "#E8622A" : "#C8C4BE", marginBottom: 3 }}>
                                            {m === "text" ? "Text" : "Voice"}
                                        </div>
                                        <HelpTooltip content={m === "text" ? "Type your pitch" : speechSupported ? "Speak naturally" : "Not supported"} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Scenario Selector */}
                    <div style={{ marginBottom: 24, animation: "fadeSlideUp 0.4s ease 0.1s both" }}>
                        <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Scenario</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {SCENARIOS.map(s => (
                                (() => {
                                    const ScenarioIcon = s.icon;
                                    return (
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
                                    <span
                                        style={{
                                            width: 34,
                                            height: 34,
                                            borderRadius: 10,
                                            background: scenario === s.id ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.04)",
                                            border: scenario === s.id ? "1px solid rgba(232,98,42,0.24)" : "1px solid rgba(255,255,255,0.08)",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                        }}
                                    >
                                        <ScenarioIcon size={18} color={scenario === s.id ? "#E8622A" : "#888"} />
                                    </span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, color: scenario === s.id ? "#E8622A" : "#C8C4BE", fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
                                        <HelpTooltip content={s.sub} />
                                    </div>
                                    {scenario === s.id && <span style={{ color: "#E8622A", fontSize: 12, flexShrink: 0 }}>✓</span>}
                                </button>
                                    );
                                })()
                            ))}
                        </div>
                    </div>

                    {/* Forge voice toggle — only in voice mode */}
                    {mode === "voice" && (
                        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, animation: "fadeSlideUp 0.3s ease both" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 12, color: "#F0EDE8" }}>Forge voice</span>
                                <HelpTooltip content="Forge speaks responses aloud." />
                            </span>
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
                        disabled={trialUsesRemaining !== null && trialUsesRemaining <= 0}
                        style={{ width: "100%", padding: "15px", background: trialUsesRemaining !== null && trialUsesRemaining <= 0 ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 14, color: trialUsesRemaining !== null && trialUsesRemaining <= 0 ? "#555" : "#fff", fontSize: 15, fontWeight: 700, cursor: trialUsesRemaining !== null && trialUsesRemaining <= 0 ? "default" : "pointer", fontFamily: "'Lora', Georgia, serif", letterSpacing: "0.02em", animation: "fadeSlideUp 0.4s ease 0.15s both" }}
                    >
                        {trialUsesRemaining !== null && trialUsesRemaining <= 0 ? "Preview limit reached" : "Start Session →"}
                    </button>
                    </>
                    ) : (
                        <div style={{ animation: "fadeSlideUp 0.35s ease both" }}>
                            {history.length >= 3 && (
                                <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
                                    <div style={{ fontSize: 15, color: "#F0EDE8", fontFamily: "'Lora', Georgia, serif", fontWeight: 600, marginBottom: 14 }}>
                                        {latestScenarioComparison ?? "Your pitch score trend"}
                                    </div>
                                    <div style={{ height: 120, display: "flex", alignItems: "flex-end", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 8 }}>
                                        {history.slice(0, 8).reverse().map(session => {
                                            const value = session.overallScore ?? 0;
                                            const color = SCENARIO_CONTEXT[session.scenario as Scenario]?.color ?? "#E8622A";
                                            return (
                                                <div key={session.id} title={`${scenarioLabelFor(session.scenario)}: ${value}/5`} style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", height: "100%" }}>
                                                    <div style={{ width: "70%", height: `${Math.max(4, (value / 5) * 100)}%`, background: color, borderRadius: "6px 6px 0 0", opacity: value ? 0.85 : 0.25 }} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 14, marginBottom: 16 }}>
                                <div style={{ fontSize: 13, color: "#F0EDE8", fontFamily: "'Lora', Georgia, serif", fontWeight: 600, marginBottom: 10 }}>Your best scores</div>
                                {(["investor", "customer", "elevator", "partner"] as Scenario[]).map(id => {
                                    const best = history
                                        .filter(session => session.scenario === id)
                                        .sort((a, b) => ((averagePitchScore(b) ?? 0) - (averagePitchScore(a) ?? 0)))[0];
                                    const bestAverage = best ? averagePitchScore(best) : null;
                                    return (
                                        <div key={id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "7px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                            <div style={{ fontSize: 12, color: "rgba(240,237,232,0.65)", fontFamily: "'DM Sans', sans-serif" }}>{scenarioLabelFor(id)}</div>
                                            <div style={{ fontSize: 12, color: best ? "#D9B15D" : "rgba(240,237,232,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
                                                {best && bestAverage !== null ? `★ ${bestAverage.toFixed(1)} overall   ${formatSessionDate(best.createdAt)}` : "★ —  No sessions yet"}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {historyLoading ? (
                                <div style={{ color: "var(--foundry-text-muted)", fontSize: 13 }}>Loading pitch history...</div>
                            ) : history.length === 0 ? (
                                <div style={{ color: "var(--foundry-text-secondary)", fontSize: 13, lineHeight: 1.7 }}>No pitch sessions saved yet. Run a practice session and your scores will appear here.</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                    {history.map(session => (
                                        <div key={session.id} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 14 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                                                <div>
                                                    <div style={{ fontSize: 14, color: "#F0EDE8", fontWeight: 600 }}>{scenarioLabelFor(session.scenario)}</div>
                                                    <div style={{ fontSize: 12, color: "rgba(240,237,232,0.58)", fontFamily: "'DM Sans', sans-serif" }}>{formatSessionDate(session.createdAt)} · {session.mode}</div>
                                                </div>
                                                <div style={{ color: scoreColor(session.overallScore), fontSize: 24, fontFamily: "'Playfair Display', Georgia, serif" }}>{session.overallScore ?? "—"}</div>
                                            </div>
                                            <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
                                                {[session.clarityScore, session.confidenceScore, session.persuasivenessScore, session.brevityScore].map((value, index) => (
                                                    <span key={index} style={{ width: 8, height: 8, borderRadius: "50%", background: scoreColor(value) }} />
                                                ))}
                                            </div>
                                            <button onClick={() => setHistoryModal(session)} style={{ background: "transparent", border: "none", color: "#E8622A", fontSize: 12, cursor: "pointer", padding: 0 }}>View Feedback →</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                {historyModal && (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
                        <div style={{ width: "100%", maxWidth: 720, maxHeight: "86vh", overflowY: "auto", background: "rgb(12,12,14)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 16, padding: 20 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                                <div>
                                    <div style={{ fontSize: 18, color: "#F0EDE8", fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>{scenarioLabelFor(historyModal.scenario)}</div>
                                    <div style={{ fontSize: 12, color: "rgba(240,237,232,0.58)", fontFamily: "'DM Sans', sans-serif" }}>{formatSessionDate(historyModal.createdAt)} · {historyModal.mode}</div>
                                </div>
                                <button onClick={() => setHistoryModal(null)} style={{ background: "transparent", border: "none", color: "rgba(240,237,232,0.62)", fontSize: 22, cursor: "pointer" }}>×</button>
                            </div>
                            <OverallScoreCard value={historyModal.overallScore} />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                                <ScoreCard label="Clarity" value={historyModal.clarityScore} />
                                <ScoreCard label="Confidence" value={historyModal.confidenceScore} />
                                <ScoreCard label="Persuasiveness" value={historyModal.persuasivenessScore} />
                                <ScoreCard label="Brevity" value={historyModal.brevityScore} />
                            </div>
                            {historyModal.feedback && (
                                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                                    <FeedbackText text={historyModal.feedback} />
                                </div>
                            )}
                            <div style={{ fontSize: 13, color: "rgba(240,237,232,0.7)", fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>Session Transcript</div>
                            <TranscriptReplay messages={historyModal.transcript} />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    // FEEDBACK PHASE
    // ═══════════════════════════════════════════════════════════
    if (phase === "feedback") {
        const scenarioLabel = SCENARIOS.find(s => s.id === scenario)?.label || "Pitch";
        return (
            <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8" }}>
                <div style={{ padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)", zIndex: 10 }}>
                    <button onClick={onOpenNav} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 10px", color: "rgba(240,237,232,0.62)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3.5" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="11" width="14" height="1.5" rx="0.75" fill="currentColor"/></svg></button>
                    <div>
                        <div style={{ fontSize: 16, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>Session Complete</div>
                        <div style={{ fontSize: 10, color: "var(--foundry-text-muted)" }}>{formatTime(sessionTime)} · {scenarioLabel}</div>
                    </div>
                </div>

                <div style={{ maxWidth: 560, margin: "0 auto", padding: "28px 16px 60px" }}>
                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16, padding: "80px 0", color: "var(--foundry-text-muted)" }}>
                            <Logo variant="flame" style={{ width: 32, height: 32, objectFit: "contain" }} />
                            <div style={{ fontSize: 14, fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", color: "var(--foundry-text-secondary)" }}>
                                Forge is reviewing your pitch...
                            </div>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: 20, animation: "fadeSlideUp 0.4s ease both", textAlign: "left" }}>
                                <div style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 4 }}>Coaching Feedback</div>
                                <div style={{ fontSize: 12, color: "var(--foundry-text-muted)" }}>From your {scenarioLabel.toLowerCase()} · {formatTime(sessionTime)}</div>
                                <div style={{ fontSize: 11, color: archiveSaved ? "#4CAF8A" : archiveSaving ? "#D9B15D" : "#666", marginTop: 8, lineHeight: 1.6 }}>
                                    {archiveSaved
                                        ? "Saved to Archive. You can recap it with Forge, rename it, or delete it from the Archive."
                                        : archiveSaving
                                            ? "Saving this feedback to Archive..."
                                            : "This full feedback will be stored in Archive as a Pitch Practice card."}
                                </div>
                            </div>

                            {scores && (
                                <>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10, animation: "fadeSlideUp 0.4s ease 0.03s both" }}>
                                        <ScoreCard label="Clarity" value={scores.clarity} />
                                        <ScoreCard label="Confidence" value={scores.confidence} />
                                        <ScoreCard label="Persuasiveness" value={scores.persuasiveness} />
                                        <ScoreCard label="Brevity" value={scores.brevity} />
                                    </div>
                                    <OverallScoreCard value={scores.overall} />
                                </>
                            )}

                            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "20px 18px", marginBottom: 16, animation: "fadeSlideUp 0.4s ease 0.05s both" }}>
                                {feedback ? <FeedbackSections text={feedback} scores={scores} /> : null}
                            </div>

                            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, marginBottom: 14, overflow: "hidden" }}>
                                <button onClick={() => setTranscriptOpen(prev => !prev)} style={{ width: "100%", background: "transparent", border: "none", color: "rgba(240,237,232,0.7)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", cursor: "pointer" }}>
                                    <span>Session Transcript</span>
                                    <span>{transcriptOpen ? "↑" : "↓"}</span>
                                </button>
                                {transcriptOpen && (
                                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: 14 }}>
                                        <TranscriptReplay messages={messages} />
                                    </div>
                                )}
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10, animation: "fadeSlideUp 0.4s ease 0.08s both" }}>
                                <button
                                    onClick={saveFeedbackToJournal}
                                    disabled={!feedback || journalSaved}
                                    style={{ padding: "12px", background: journalSaved ? "rgba(76,175,138,0.12)" : "rgba(255,255,255,0.04)", border: journalSaved ? "1px solid rgba(76,175,138,0.25)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: journalSaved ? "#4CAF8A" : "#C8C4BE", fontSize: 12, cursor: journalSaved ? "default" : "pointer", fontWeight: 600 }}
                                >
                                    {journalSaved ? "Saved to Journal ✓" : "Save to Journal"}
                                </button>
                                <button
                                    onClick={copyFeedback}
                                    disabled={!feedback}
                                    style={{ padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: copiedFeedback ? "#4CAF8A" : "#C8C4BE", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                                >
                                    {copiedFeedback ? "Copied ✓" : "Copy Feedback"}
                                </button>
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
    const elevatorRemaining = Math.max(0, 60 - sessionTime);
    const timerDisplay = scenario === "elevator" ? formatTime(elevatorRemaining) : formatTime(sessionTime);
    const timerStateColor = scenario === "elevator" && sessionTime >= 60
        ? "#E8622A"
        : sessionTime >= 600
            ? "rgba(232,98,42,0.7)"
            : sessionTime >= 300
                ? "#E8622A"
                : "#F0EDE8";

    return (
        <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#080809", fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8", overflow: "hidden" }}>
            {/* Session Header */}
            <div style={{ padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Logo variant="flame" style={{ width: 32, height: 32, objectFit: "contain" }} />
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Playfair Display', Georgia, serif" }}>{scenarioLabel}</div>
                        <div style={{ fontSize: 10, color: "var(--foundry-text-muted)" }}>{mode === "voice" ? "Voice" : "Text"}</div>
                    </div>
                </div>
                <div style={{ textAlign: "center", flex: 1 }}>
                    <div style={{ fontSize: 20, color: timerStateColor, fontFamily: "'Playfair Display', Georgia, serif", animation: sessionTime >= 600 ? "forgePulse 1.2s infinite" : "none" }}>{timerDisplay}</div>
                    {scenario === "elevator" && sessionTime >= 60 && (
                        <div style={{ fontSize: 10, color: "#E8622A", fontFamily: "'DM Sans', sans-serif" }}>Time's up — wrap it up!</div>
                    )}
                </div>
                <button
                    onClick={endSession}
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 14px", color: "rgba(240,237,232,0.62)", fontSize: 12, cursor: "pointer", fontWeight: 500 }}
                >
                    End Session
                </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>
                {showScenarioContext && (
                    <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 18, marginBottom: 14, animation: "fadeSlideUp 0.3s ease both" }}>
                        <div style={{ fontSize: 11, color: "rgba(240,237,232,0.58)", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>You're pitching to</div>
                        <div style={{ fontSize: 16, color: "#F0EDE8", fontFamily: "'Lora', Georgia, serif", fontWeight: 600, marginBottom: 14 }}>
                            {SCENARIO_CONTEXT[scenario].persona}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(240,237,232,0.62)", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>Tips for this scenario:</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {SCENARIO_CONTEXT[scenario].tips.map(tip => (
                                <div key={tip} style={{ fontSize: 13, color: "rgba(240,237,232,0.7)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>• {tip}</div>
                            ))}
                        </div>
                    </div>
                )}
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
                        <div style={{ display: "flex", flexDirection: "column", maxWidth: "78%" }}>
                            <PitchMessageBubble msg={msg} />
                            {msg.role === "forge" && msg.text && <MessageActions text={msg.text} />}
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
            {mode === "voice" && (
                <div style={{ padding: "7px 16px", background: "rgba(232,98,42,0.07)", borderTop: "1px solid rgba(232,98,42,0.12)", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <div style={{ width: listening ? 8 : speaking ? 18 : 7, height: 7, borderRadius: listening ? "50%" : speaking ? 999 : "50%", background: listening ? "#D8563A" : speaking ? "#E8622A" : "rgba(240,237,232,0.25)", animation: listening || speaking ? "forgePulse 1s infinite" : "none" }} />
                    <span style={{ fontSize: 13, color: "var(--foundry-text-muted)", fontFamily: "'DM Sans', sans-serif" }}>
                        {listening ? "Listening... speak now" : speaking ? "Forge is responding..." : "Tap to speak"}
                    </span>
                    {speaking && (
                        <button onClick={cancelSpeech} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--foundry-text-muted)", fontSize: 11, cursor: "pointer" }}>
                            Skip
                        </button>
                    )}
                </div>
            )}

            {/* Input Area */}
            <div style={{ padding: "10px 12px max(12px, calc(8px + env(safe-area-inset-bottom)))", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0, background: "#080809" }}>
                {voiceError && (
                    <div style={{ background: "rgba(232,98,42,0.08)", border: "1px solid rgba(232,98,42,0.25)", borderRadius: 8, padding: "10px 14px", color: "rgba(240,237,232,0.8)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>
                        {voiceError}
                    </div>
                )}
                {mode === "voice" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 4 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                            <button
                                onClick={handleMicPress}
                                disabled={loading || speaking}
                                title={listening ? "Stop recording" : "Start recording"}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 14,
                                    border: listening ? "2px solid #4CAF8A" : "1px solid rgba(232,98,42,0.3)",
                                    background: listening ? "rgba(76,175,138,0.15)" : loading || speaking ? "rgba(255,255,255,0.04)" : "rgba(232,98,42,0.1)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: loading || speaking ? "not-allowed" : "pointer",
                                    opacity: loading || speaking ? 0.4 : 1,
                                    transition: "all 0.2s",
                                    animation: listening ? "forgePulse 1.5s infinite" : "none",
                                    flexShrink: 0,
                                }}
                            >
                                <Icons.sidebar.voice size={22} color={listening ? "#4CAF8A" : "#E8622A"} />
                            </button>

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
                                }}
                                placeholder={listening ? "Listening..." : "Your transcript will appear here. Edit it before sending."}
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
                                    fontFamily: "'Lora', Georgia, serif",
                                    lineHeight: 1.5,
                                    resize: "none",
                                    outline: "none",
                                    opacity: loading ? 0.6 : 1,
                                    minHeight: 44,
                                }}
                            />
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontSize: 11, color: languageWarning ? "#D3A48D" : "#555", textAlign: "left", flex: 1, minWidth: 180, lineHeight: 1.5 }}>
                                {languageWarning ? languageWarning : listening
                                    ? "Recording... tap the mic again to stop and review the transcript."
                                    : speaking
                                        ? "Forge is speaking..."
                                        : loading
                                            ? "Thinking..."
                                            : input.trim()
                                                ? "Review the transcript, edit anything that is off, then send or redo."
                                                : "Tap the mic to start recording. Nothing sends until you press Send."}
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                    onClick={handleRedoVoiceInput}
                                    disabled={loading || speaking || listening}
                                    style={{
                                        padding: "10px 14px",
                                        borderRadius: 10,
                                        border: "1px solid rgba(255,255,255,0.08)",
                                        background: "rgba(255,255,255,0.04)",
                                        color: "#C8C4BE",
                                        fontSize: 12,
                                        cursor: loading || speaking || listening ? "not-allowed" : "pointer",
                                        opacity: loading || speaking || listening ? 0.45 : 1,
                                    }}
                                >
                                    Redo
                                </button>
                                <button
                                    onClick={() => sendMessage(input)}
                                    disabled={!input.trim() || loading || listening}
                                    style={{
                                        padding: "10px 16px",
                                        borderRadius: 10,
                                        border: "none",
                                        background: input.trim() && !loading && !listening
                                            ? "linear-gradient(135deg, #E8622A, #c9521e)"
                                            : "rgba(255,255,255,0.06)",
                                        color: input.trim() && !loading && !listening ? "#fff" : "#444",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: input.trim() && !loading && !listening ? "pointer" : "not-allowed",
                                    }}
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
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
                            }}
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
                                fontFamily: "'Lora', Georgia, serif",
                                lineHeight: 1.5,
                                resize: "none",
                                outline: "none",
                                opacity: loading ? 0.6 : 1,
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
                    {languageWarning && (
                        <div style={{ fontSize: 11, color: "#D3A48D", textAlign: "center", lineHeight: 1.5 }}>
                            {languageWarning}
                        </div>
                    )}
                    <div style={{ fontSize: 10, color: "#2b2b2b", textAlign: "center" }}>
                        Forge is an AI. Always verify important information before acting on it.
                    </div>
                    </div>
                )}
            </div>
        </div>
    );
}

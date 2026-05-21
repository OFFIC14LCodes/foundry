import { useEffect, useMemo, useRef, useState } from "react";
import { saveJournalEntry, updateJournalEntry, deleteJournalEntry, loadWeeklySummary, saveWeeklySummary } from "./db";
import { generateWeeklyJournalSummary, summarizeJournalEntry } from "./lib/journalIntelligence";
import { callForgeAPI } from "./lib/forgeApi";
import Logo from "./components/Logo";
import MicButton from "./components/MicButton";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ENTRY_PREVIEW_LENGTH = 400;
const WRITING_PROMPTS = [
    "What's the most important thing you're working through right now?",
    "What decision are you avoiding and why?",
    "What would you tell yourself one month from now?",
    "What's working that you haven't acknowledged yet?",
    "What fear is showing up in your work this week?",
    "What does success look like in 90 days?",
];

const MOOD_OPTIONS = [
    { emoji: "😤", label: "Stressed" },
    { emoji: "😐", label: "Neutral" },
    { emoji: "😊", label: "Good" },
    { emoji: "🔥", label: "Energized" },
    { emoji: "😴", label: "Tired" },
];

const ENTRY_TEMPLATES = [
    {
        name: "Daily Reflection",
        icon: "🌅",
        content: `How did today go?\n\nWhat went well?\n\nWhat was challenging?\n\nWhat's one thing I learned?\n\nWhat do I want to focus on tomorrow?`,
    },
    {
        name: "Weekly Review",
        icon: "📅",
        content: `What were my biggest wins this week?\n\nWhat didn't go as planned?\n\nWhat am I most worried about going into next week?\n\nWhat needs to change?`,
    },
    {
        name: "Milestone Capture",
        icon: "🏁",
        content: `The milestone:\n\nWhat made it possible?\n\nWho contributed?\n\nWhat does this mean for the business?\n\nWhat's the next milestone from here?`,
    },
    {
        name: "Problem Solving",
        icon: "🧩",
        content: `The problem I'm facing:\n\nWhy is this a problem? What's the root cause?\n\nOptions I've considered:\n1.\n2.\n3.\n\nThe option I'm leaning toward and why:\n\nWhat's stopping me?`,
    },
    {
        name: "Gratitude",
        icon: "🙏",
        content: `Today I'm grateful for:\n1.\n2.\n3.\n\nOne person who deserves acknowledgment:\n\nOne thing about this journey I wouldn't trade:`,
    },
];

const JOURNAL_QUICK_CHAT_SYSTEM = `You are Navi, a direct but thoughtful founder coach.
You are responding inside a private journal quick chat. The founder clicked "Ask Navi" on one journal entry.
Respond first. Do not ask what they want to talk about.
If the entry contains a decision, fear, tension, blocker, or pattern, reflect the real issue back and ask one or two focused follow-up questions.
If the entry is mostly a status update, identify the useful signal and suggest one practical next thought.
Keep it under 180 words. Be warm without being therapeutic. Do not diagnose, moralize, or over-explain.`;

type JournalEntryView = {
    id: string;
    content: string;
    createdAt: string;
    stageId?: number | null;
    wordCount?: number | null;
    forgeSummary?: string | null;
    themes?: string[];
    summaryGeneratedAt?: string | null;
    summaryFailed?: boolean;
    mood?: string | null;
};

type JournalQuickChatMessage = {
    id: string;
    role: "user" | "forge";
    text: string;
};

function calcWordCount(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

function buildJournalQuickChatPrompt(entry: JournalEntryView, profile: any) {
    const businessContext = [
        profile?.businessName ? `Business: ${profile.businessName}` : null,
        profile?.industry ? `Industry: ${profile.industry}` : null,
        profile?.currentStage ? `Current stage: ${profile.currentStage}` : null,
        profile?.strategyLabel ? `Strategy: ${profile.strategyLabel}` : null,
    ].filter(Boolean).join("\n");

    return `Founder context:
${businessContext || "No additional business context available."}

Journal entry date: ${new Date(entry.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
Mood: ${entry.mood || "Not recorded"}
Themes: ${(entry.themes ?? []).join(", ") || "None recorded"}

Journal entry:
${entry.content}

Start the quick chat by responding to this entry directly.`;
}

function buildJournalQuickChatFollowupPrompt(entry: JournalEntryView, profile: any) {
    const businessContext = [
        profile?.businessName ? `Business: ${profile.businessName}` : null,
        profile?.industry ? `Industry: ${profile.industry}` : null,
        profile?.currentStage ? `Current stage: ${profile.currentStage}` : null,
        profile?.strategyLabel ? `Strategy: ${profile.strategyLabel}` : null,
    ].filter(Boolean).join("\n");

    return `Keep this private journal entry as the grounding context for the conversation.

Founder context:
${businessContext || "No additional business context available."}

Journal entry:
${entry.content}`;
}

function getReadTimeLabel(wordCount: number) {
    if (wordCount <= 100) return `${wordCount} words`;
    return `${wordCount} words · ${Math.ceil(wordCount / 200)} min read`;
}

function getWeekStartDate(date = new Date()): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    return d.toISOString().slice(0, 10);
}

function getWeekEndDate(weekStart: string): string {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
}

function getWeekRangeLabel(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startLabel = start.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    const endLabel = end.toLocaleDateString("en-US", { month: "long", day: "numeric" });
    return `Week of ${startLabel} – ${endLabel}`;
}

function getRecentEntries(entries: JournalEntryView[]) {
    const cutoff7Days = new Date();
    cutoff7Days.setDate(cutoff7Days.getDate() - 7);
    return entries.filter(e => new Date(e.createdAt) >= cutoff7Days);
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightText({ text, query }: { text: string; query: string }) {
    if (!query.trim()) return <>{text}</>;
    const regex = new RegExp(`(${escapeRegExp(query.trim())})`, "ig");
    const parts = text.split(regex);
    const normalizedQuery = query.trim().toLowerCase();
    return (
        <>
            {parts.map((part, index) => (
                part.toLowerCase() === normalizedQuery
                    ? <mark key={index} style={{ background: "rgba(216,155,43,0.2)", color: "inherit", padding: "0 2px", borderRadius: 3 }}>{part}</mark>
                    : <span key={index}>{part}</span>
            ))}
        </>
    );
}

function ThemePills({ themes }: { themes?: string[] }) {
    const safeThemes = Array.isArray(themes) ? themes.filter(Boolean) : [];
    if (safeThemes.length === 0) return null;
    const visible = safeThemes.length > 3 ? safeThemes.slice(0, 2) : safeThemes.slice(0, 3);
    const moreCount = safeThemes.length - visible.length;

    return (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {visible.map(theme => (
                <span key={theme} style={{
                    fontFamily: "var(--tekori-font-ui)",
                    fontSize: 9,
                    textTransform: "uppercase",
                    background: "rgba(7,26,47,0.06)",
                    border: "1px solid rgba(7,26,47,0.12)",
                    color: "rgba(7,26,47,0.88)",
                    borderRadius: 3,
                    padding: "3px 7px",
                    lineHeight: 1.1,
                }}>
                    {theme}
                </span>
            ))}
            {moreCount > 0 && (
                <span style={{
                    fontFamily: "var(--tekori-font-ui)",
                    fontSize: 9,
                    textTransform: "uppercase",
                    background: "rgba(7,26,47,0.06)",
                    border: "1px solid rgba(7,26,47,0.12)",
                    color: "rgba(7,26,47,0.88)",
                    borderRadius: 3,
                    padding: "3px 7px",
                    lineHeight: 1.1,
                }}>
                    +{moreCount} more
                </span>
            )}
        </div>
    );
}

export default function JournalScreen({ userId, entries, onEntriesChange, onBack, onOpenNav, profile }) {
    const typedEntries = entries as JournalEntryView[];
    const [writing, setWriting] = useState(false);
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [weeklySummary, setWeeklySummary] = useState<string | null>(null);
    const [weeklyExpanded, setWeeklyExpanded] = useState(true);
    const [loadingWeekly, setLoadingWeekly] = useState(false);
    const [journalEntryCount, setJournalEntryCount] = useState(typedEntries.length);
    const [newEntryId, setNewEntryId] = useState<string | null>(null);
    const [copiedEntryId, setCopiedEntryId] = useState<string | null>(null);
    const [writingPrompts, setWritingPrompts] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
    const [quickChatEntry, setQuickChatEntry] = useState<JournalEntryView | null>(null);
    const [quickChatMessages, setQuickChatMessages] = useState<JournalQuickChatMessage[]>([]);
    const [quickChatDraft, setQuickChatDraft] = useState("");
    const [quickChatLoading, setQuickChatLoading] = useState(false);
    const [quickChatError, setQuickChatError] = useState<string | null>(null);

    // Edit mode
    const [editingEntry, setEditingEntry] = useState<JournalEntryView | null>(null);

    // Calendar strip
    const [calendarMonth] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<string | null>(null); // "YYYY-MM-DD"

    // Mood
    const [selectedMood, setSelectedMood] = useState<string | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const quickChatScrollRef = useRef<HTMLDivElement>(null);

    const wordCount = calcWordCount(draft);
    const recentEntries = useMemo(() => getRecentEntries(typedEntries), [typedEntries]);

    useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

    useEffect(() => {
        if (!writing) return;
        textareaRef.current?.focus();
    }, [writing]);

    useEffect(() => {
        if (!quickChatEntry) return;
        quickChatScrollRef.current?.scrollTo({ top: quickChatScrollRef.current.scrollHeight, behavior: "smooth" });
    }, [quickChatEntry, quickChatMessages, quickChatLoading]);

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            const tagName = document.activeElement?.tagName;
            if (event.key === "/" && tagName !== "INPUT" && tagName !== "TEXTAREA") {
                event.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const currentRecentEntries = getRecentEntries(typedEntries);
        if (currentRecentEntries.length < 2) {
            setWeeklySummary(null);
            setLoadingWeekly(false);
            return () => { cancelled = true; };
        }

        const fetchOrGenerateSummary = async () => {
            const weekStart = getWeekStartDate();
            const stored = await loadWeeklySummary(userId, weekStart);
            if (stored?.summaryText) {
                const ageMs = Date.now() - new Date(stored.generatedAt).getTime();
                if (ageMs < SEVEN_DAYS_MS) {
                    if (!cancelled) setWeeklySummary(stored.summaryText);
                    return;
                }
            }

            if (!cancelled) setLoadingWeekly(true);
            try {
                const result = await generateWeeklyJournalSummary(userId, currentRecentEntries);
                if (!result || cancelled) return;
                const weekEnd = getWeekEndDate(weekStart);
                await saveWeeklySummary(userId, weekStart, weekEnd, result, [], currentRecentEntries.length);
                if (!cancelled) setWeeklySummary(result);
            } finally {
                if (!cancelled) setLoadingWeekly(false);
            }
        };

        void fetchOrGenerateSummary();
        return () => { cancelled = true; };
    }, [journalEntryCount]);

    const recurringThemes = useMemo(() => {
        if (typedEntries.length < 5) return [];
        const counts = new Map<string, number>();
        typedEntries.forEach(entry => {
            const unique = new Set((entry.themes ?? []).filter(Boolean));
            unique.forEach(theme => counts.set(theme, (counts.get(theme) ?? 0) + 1));
        });
        return Array.from(counts.entries())
            .filter(([, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    }, [typedEntries]);

    const displayedEntries = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        return typedEntries.filter(entry => {
            const themes = entry.themes ?? [];
            const matchesTheme = selectedTheme ? themes.includes(selectedTheme) : true;
            if (!matchesTheme) return false;
            if (selectedDay) {
                const entryDay = entry.createdAt.slice(0, 10);
                if (entryDay !== selectedDay) return false;
            }
            if (!query) return true;
            return entry.content.toLowerCase().includes(query)
                || String(entry.forgeSummary ?? "").toLowerCase().includes(query)
                || themes.some(theme => theme.toLowerCase().includes(query));
        });
    }, [typedEntries, searchTerm, selectedTheme, selectedDay]);

    const openWritingOverlay = () => {
        setEditingEntry(null);
        setDraft("");
        setSelectedMood(null);
        setWriting(true);
        setWritingPrompts([...WRITING_PROMPTS].sort(() => Math.random() - 0.5).slice(0, 3));
    };

    const openEditOverlay = (entry: JournalEntryView) => {
        setEditingEntry(entry);
        setDraft(entry.content);
        setSelectedMood(entry.mood ?? null);
        setWriting(true);
    };

    const retrySummary = async (entry: JournalEntryView) => {
        onEntriesChange(prev => prev.map(e => e.id === entry.id ? { ...e, summaryFailed: false } : e));
        const result = await summarizeJournalEntry(entry.id, entry.content, userId);
        if (!result) {
            onEntriesChange(prev => prev.map(e => e.id === entry.id ? { ...e, summaryFailed: true } : e));
            return;
        }
        onEntriesChange(prev => prev.map(e =>
            e.id === entry.id
                ? { ...e, forgeSummary: result.summary, themes: result.themes, summaryFailed: false }
                : e
        ));
    };

    const handleSave = async () => {
        if (!draft.trim() || saving) return;
        setSaving(true);
        const wc = calcWordCount(draft);
        const savedContent = draft.trim();

        if (editingEntry) {
            // Edit existing entry
            const updated = await updateJournalEntry(userId, editingEntry.id, savedContent, wc, selectedMood);
            if (updated) {
                onEntriesChange(prev => prev.map(e => e.id === editingEntry.id ? { ...e, ...updated } : e));
                setDraft("");
                setWriting(false);
                setEditingEntry(null);
                setSelectedMood(null);
                summarizeJournalEntry(editingEntry.id, savedContent, userId).then(result => {
                    if (!result) {
                        onEntriesChange(prev => prev.map(e => e.id === editingEntry.id ? { ...e, summaryFailed: true } : e));
                        return;
                    }
                    onEntriesChange(prev => prev.map(e =>
                        e.id === editingEntry.id
                            ? { ...e, forgeSummary: result.summary, themes: result.themes, summaryFailed: false }
                            : e
                    ));
                }).catch(() => {});
            }
        } else {
            // New entry
            const stageId = profile?.currentStage ?? null;
            const entry = await saveJournalEntry(userId, savedContent, stageId, wc, selectedMood);
            if (entry) {
                onEntriesChange([entry, ...typedEntries]);
                setDraft("");
                setWriting(false);
                setSelectedMood(null);
                setJournalEntryCount(prev => prev + 1);
                setNewEntryId(entry.id);
                window.setTimeout(() => setNewEntryId(null), 1000);

                summarizeJournalEntry(entry.id, savedContent, userId).then(result => {
                    if (!result) {
                        onEntriesChange(prev => prev.map(e => e.id === entry.id ? { ...e, summaryFailed: true } : e));
                        return;
                    }
                    onEntriesChange(prev => prev.map(e =>
                        e.id === entry.id
                            ? { ...e, forgeSummary: result.summary, themes: result.themes, summaryFailed: false }
                            : e
                    ));
                }).catch(() => {});
            }
        }
        setSaving(false);
    };

    const handleDelete = async (entryId: string) => {
        setDeletingId(entryId);
        await deleteJournalEntry(userId, entryId);
        onEntriesChange(typedEntries.filter(e => e.id !== entryId));
        setDeletingId(null);
    };

    const regenerateWeeklyReflection = async () => {
        const currentRecentEntries = getRecentEntries(typedEntries);
        if (currentRecentEntries.length < 2) return;
        setLoadingWeekly(true);
        try {
            const result = await generateWeeklyJournalSummary(userId, currentRecentEntries);
            if (!result) return;
            const weekStart = getWeekStartDate();
            const weekEnd = getWeekEndDate(weekStart);
            await saveWeeklySummary(userId, weekStart, weekEnd, result, [], currentRecentEntries.length);
            setWeeklySummary(result);
            setWeeklyExpanded(true);
        } finally {
            setLoadingWeekly(false);
        }
    };

    const handleExport = () => {
        const sorted = [...typedEntries].sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const lines: string[] = [
            "# Founder's Journal",
            `Exported ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
            `${sorted.length} ${sorted.length === 1 ? "entry" : "entries"}`,
            "",
            "---",
            "",
        ];
        for (const entry of sorted) {
            lines.push(`## ${formatDate(entry.createdAt)}`);
            lines.push(`*${formatTime(entry.createdAt)}*`);
            if (entry.mood) lines.push(`Mood: ${entry.mood}`);
            if (entry.themes?.length) lines.push(`Themes: ${entry.themes.join(", ")}`);
            lines.push("");
            lines.push(entry.content);
            if (entry.forgeSummary) {
                lines.push("");
                lines.push(`> **Navi's reflection:** ${entry.forgeSummary}`);
            }
            lines.push("");
            lines.push("---");
            lines.push("");
        }
        const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `founders-journal-${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const copyEntry = async (entry: JournalEntryView) => {
        try {
            await navigator.clipboard.writeText(entry.content);
            setCopiedEntryId(entry.id);
            window.setTimeout(() => setCopiedEntryId(null), 2000);
        } catch (error) {
            console.error("copy journal entry error:", error);
        }
    };

    const openQuickChat = async (entry: JournalEntryView) => {
        setQuickChatEntry(entry);
        setQuickChatMessages([]);
        setQuickChatDraft("");
        setQuickChatError(null);
        setQuickChatLoading(true);

        try {
            const response = await callForgeAPI(
                [{ role: "user", content: buildJournalQuickChatPrompt(entry, profile) }],
                JOURNAL_QUICK_CHAT_SYSTEM,
                700,
            );
            setQuickChatMessages([
                {
                    id: `journal-quick-forge-${Date.now()}`,
                    role: "forge",
                    text: response.trim() || "I read it. What part of this feels most important to unpack first?",
                },
            ]);
        } catch (error) {
            console.error("journal quick chat open error:", error);
            setQuickChatError("Navi could not respond to this entry right now.");
        } finally {
            setQuickChatLoading(false);
        }
    };

    const sendQuickChatMessage = async () => {
        if (!quickChatEntry || !quickChatDraft.trim() || quickChatLoading) return;
        const userText = quickChatDraft.trim();
        const nextMessages: JournalQuickChatMessage[] = [
            ...quickChatMessages,
            {
                id: `journal-quick-user-${Date.now()}`,
                role: "user",
                text: userText,
            },
        ];
        setQuickChatMessages(nextMessages);
        setQuickChatDraft("");
        setQuickChatError(null);
        setQuickChatLoading(true);

        try {
            const apiMessages = [
                { role: "user", content: buildJournalQuickChatFollowupPrompt(quickChatEntry, profile) },
                ...nextMessages.map((message) => ({
                    role: message.role === "forge" ? "assistant" : "user",
                    content: message.text,
                })),
            ];
            const response = await callForgeAPI(apiMessages, JOURNAL_QUICK_CHAT_SYSTEM, 800);
            setQuickChatMessages([
                ...nextMessages,
                {
                    id: `journal-quick-forge-${Date.now()}`,
                    role: "forge",
                    text: response.trim() || "Say a little more about what feels stuck here.",
                },
            ]);
        } catch (error) {
            console.error("journal quick chat send error:", error);
            setQuickChatError("Navi could not send a response. Try again.");
        } finally {
            setQuickChatLoading(false);
        }
    };

    const closeQuickChat = () => {
        setQuickChatEntry(null);
        setQuickChatMessages([]);
        setQuickChatDraft("");
        setQuickChatError(null);
        setQuickChatLoading(false);
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric",
        });
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    };

    const isJustSaved = (isoString: string) =>
        Date.now() - new Date(isoString).getTime() < 2 * 60 * 1000;

    return (
        <div style={{
            position: "fixed", inset: 0, background: "var(--color-bg-soft)",
            display: "flex", flexDirection: "column",
            fontFamily: "var(--tekori-font-ui)", color: "var(--color-text)", zIndex: 200,
        }}>
            <div style={{
                padding: "max(11px, calc(6px + env(safe-area-inset-top))) 16px 11px",
                borderBottom: "1px solid rgba(7,26,47,0.06)",
                background: "rgba(255,252,246,0.94)", backdropFilter: "blur(12px)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={onOpenNav} style={{
                        background: "rgba(7,26,47,0.05)", border: "1px solid rgba(7,26,47,0.08)",
                        borderRadius: 8, padding: "var(--foundry-app-header-button-padding)", color: "var(--color-text)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3.5" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="11" width="14" height="1.5" rx="0.75" fill="currentColor"/></svg></button>
                </div>
                <div style={{ textAlign: "left", flex: 1, marginLeft: 12 }}>
                    <div style={{
                        fontSize: "var(--foundry-app-header-title-font)", fontFamily: "var(--tekori-font-ui)",
                        fontWeight: 600, color: "var(--color-text)",
                    }}>Founder's Journal</div>
                    <div style={{ fontSize: "var(--foundry-app-header-meta-font)", color: "var(--foundry-text-muted)" }}>
                        {typedEntries.length} {typedEntries.length === 1 ? "entry" : "entries"}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    {typedEntries.length > 0 && (
                        <button onClick={handleExport} title="Export journal as Markdown" style={{
                            background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)",
                            borderRadius: 8, padding: "var(--foundry-app-header-button-padding)", color: "rgba(7,26,47,0.88)",
                            fontSize: "var(--foundry-app-header-button-font)", cursor: "pointer",
                        }}>Export</button>
                    )}
                    <button onClick={openWritingOverlay} style={{
                        background: "rgba(216,155,43,0.1)", border: "1px solid rgba(216,155,43,0.25)",
                        borderRadius: 8, padding: "var(--foundry-app-header-button-padding)", color: "var(--tekori-gold)",
                        fontSize: "var(--foundry-app-header-button-font)", fontWeight: 500, cursor: "pointer",
                    }}>+ New</button>
                </div>
            </div>

            <div className="foundry-app-page__content" style={{ flex: 1, overflowY: "auto", padding: "16px", maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

                {/* Calendar strip */}
                {typedEntries.length > 0 && (() => {
                    const today = new Date();
                    const year = calendarMonth.getFullYear();
                    const month = calendarMonth.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const entryDays = new Set(typedEntries.map(e => e.createdAt.slice(0, 10)));
                    const todayStr = today.toISOString().slice(0, 10);
                    return (
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                <span style={{ fontSize: 11, color: "rgba(16,32,51,0.58)", fontFamily: "var(--tekori-font-ui)" }}>
                                    {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                                </span>
                                {selectedDay && (
                                    <button onClick={() => setSelectedDay(null)} style={{ fontSize: 11, color: "var(--tekori-gold)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}>
                                        Clear filter ×
                                    </button>
                                )}
                            </div>
                            <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 }}>
                                {Array.from({ length: daysInMonth }, (_, i) => {
                                    const day = i + 1;
                                    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                    const hasEntry = entryDays.has(dateStr);
                                    const isToday = dateStr === todayStr;
                                    const isSelected = selectedDay === dateStr;
                                    return (
                                        <button
                                            key={day}
                                            onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                                            style={{
                                                flexShrink: 0,
                                                width: 32,
                                                height: 44,
                                                borderRadius: 8,
                                                border: isToday ? "1px solid rgba(216,155,43,0.4)" : isSelected ? "1px solid rgba(216,155,43,0.6)" : "1px solid rgba(7,26,47,0.06)",
                                                background: isSelected ? "rgba(216,155,43,0.15)" : isToday ? "rgba(216,155,43,0.06)" : "rgba(7,26,47,0.02)",
                                                cursor: "pointer",
                                                display: "flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                gap: 3,
                                            }}
                                        >
                                            <span style={{ fontSize: 11, color: isSelected ? "var(--tekori-gold)" : isToday ? "var(--tekori-gold)" : hasEntry ? "rgba(7,26,47,0.88)" : "rgba(7,26,47,0.45)", fontFamily: "var(--tekori-font-ui)", fontWeight: isToday || isSelected ? 600 : 400 }}>{day}</span>
                                            {hasEntry && <div style={{ width: 4, height: 4, borderRadius: "50%", background: isSelected ? "var(--tekori-gold)" : "rgba(216,155,43,0.6)" }} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                <div style={{ position: "relative", marginBottom: 14 }}>
                    <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(7,26,47,0.74)", fontSize: 13 }}>⌕</span>
                    <input
                        ref={searchInputRef}
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        placeholder="Search your journal..."
                        style={{
                            width: "100%",
                            background: "rgba(7,26,47,0.04)",
                            border: "1px solid rgba(7,26,47,0.08)",
                            borderRadius: 10,
                            padding: "10px 34px",
                            color: "var(--color-text)",
                            fontSize: 14,
                            fontFamily: "var(--tekori-font-ui)",
                            boxSizing: "border-box",
                            outline: "none",
                        }}
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "rgba(16,32,51,0.58)", fontSize: 18, cursor: "pointer" }}>×</button>
                    )}
                </div>

                {(weeklySummary || loadingWeekly) && (
                    <div style={{
                        background: "rgba(216,155,43,0.05)",
                        border: "1px solid rgba(216,155,43,0.15)",
                        borderRadius: 14,
                        marginBottom: 16,
                        overflow: "hidden",
                        animation: "fadeSlideUp 0.4s ease",
                    }}>
                        <div style={{ padding: "14px 16px 12px", display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 15, color: "var(--color-text)", fontWeight: 600, fontFamily: "var(--tekori-font-ui)" }}>
                                    🔥 This Week's Reflection
                                </div>
                                <div style={{ marginTop: 3, fontSize: 12, color: "rgba(16,32,51,0.58)", fontFamily: "var(--tekori-font-ui)" }}>
                                    {getWeekRangeLabel()}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                                <button onClick={regenerateWeeklyReflection} disabled={loadingWeekly || recentEntries.length < 2} style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", fontSize: 16, cursor: loadingWeekly ? "default" : "pointer" }}>↻</button>
                                <button onClick={() => setWeeklyExpanded(prev => !prev)} style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", fontSize: 16, cursor: "pointer" }}>{weeklyExpanded ? "↑" : "↓"}</button>
                            </div>
                        </div>
                        {weeklyExpanded && (
                            <div style={{ borderTop: "1px solid rgba(7,26,47,0.05)", padding: "14px 16px 16px" }}>
                                {loadingWeekly ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-text-muted)", fontSize: 13, fontFamily: "var(--tekori-font-ui)" }}>
                                        <span style={{ display: "inline-flex", gap: 4 }}>
                                            {[0, 1, 2].map(index => (
                                                <span key={index} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--tekori-gold)", animation: "forgePulse 1.2s ease-in-out infinite", animationDelay: `${index * 0.18}s` }} />
                                            ))}
                                        </span>
                                        Navi is reflecting on your week...
                                    </div>
                                ) : (
                                    <div style={{ fontSize: 14, color: "rgba(16,32,51,0.8)", lineHeight: 1.8, fontFamily: "var(--tekori-font-ui)", fontStyle: "italic" }}>
                                        {weeklySummary}
                                    </div>
                                )}
                                {(() => {
                                    const moodEntries = [...recentEntries]
                                        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                                        .filter(e => e.mood);
                                    if (moodEntries.length < 2) return null;
                                    return (
                                        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 10, color: "rgba(7,26,47,0.74)", fontFamily: "var(--tekori-font-ui)" }}>Mood this week:</span>
                                            <div style={{ display: "flex", gap: 2 }}>
                                                {moodEntries.map((e, i) => (
                                                    <span key={i} title={new Date(e.createdAt).toLocaleDateString("en-US", { weekday: "short" })} style={{ fontSize: 14 }}>{e.mood}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                                <div style={{ marginTop: 8, fontSize: 11, color: "rgba(16,32,51,0.58)", fontFamily: "var(--tekori-font-ui)" }}>
                                    Based on {recentEntries.length} entries this week
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {recurringThemes.length > 0 && (
                    <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "var(--color-text-muted)", fontFamily: "var(--tekori-font-ui)" }}>Your recurring themes:</span>
                        {recurringThemes.map(([theme, count]) => {
                            const active = selectedTheme === theme;
                            return (
                                <button
                                    key={theme}
                                    onClick={() => setSelectedTheme(active ? null : theme)}
                                    style={{
                                        background: active ? "rgba(216,155,43,0.15)" : "rgba(7,26,47,0.06)",
                                        border: active ? "1px solid rgba(216,155,43,0.4)" : "1px solid rgba(7,26,47,0.12)",
                                        color: active ? "var(--tekori-gold)" : "rgba(7,26,47,0.78)",
                                        borderRadius: 999,
                                        padding: "5px 10px",
                                        fontSize: 11,
                                        fontFamily: "var(--tekori-font-ui)",
                                        cursor: "pointer",
                                    }}
                                >
                                    {theme} ×{count}
                                </button>
                            );
                        })}
                    </div>
                )}

                {typedEntries.length === 0 && !writing && (
                    <div style={{
                        textAlign: "left", padding: "60px 24px",
                        opacity: mounted ? 1 : 0, transition: "opacity 0.5s ease",
                    }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📓</div>
                        <div style={{
                            fontSize: 20, fontFamily: "var(--tekori-font-brand)",
                            fontWeight: 700, color: "var(--color-text)", marginBottom: 10,
                        }}>Your journal is empty</div>
                        <div style={{
                            fontSize: 13, color: "var(--foundry-text-muted)", fontFamily: "var(--tekori-font-ui)",
                            fontStyle: "italic", lineHeight: 1.7, maxWidth: 300, margin: "0 0 24px",
                        }}>
                            This is your private space. Write about wins, fears, decisions, or anything on your mind as you build.
                        </div>
                        <button onClick={openWritingOverlay} style={{
                            background: "linear-gradient(135deg, var(--tekori-gold), var(--tekori-soft-gold))",
                            border: "none", borderRadius: 12, padding: "12px 24px",
                            color: "var(--color-primary)", fontSize: 13, fontFamily: "var(--tekori-font-ui)",
                            fontWeight: 600, cursor: "pointer",
                            boxShadow: "0 4px 20px rgba(216,155,43,0.3)",
                        }}>Write your first entry</button>
                    </div>
                )}

                {(searchTerm.trim() || selectedTheme) && displayedEntries.length === 0 && (
                    <div style={{ padding: "36px 10px", color: "rgba(16,32,51,0.42)", fontSize: 14, fontFamily: "var(--tekori-font-ui)", textAlign: "center" }}>
                        {searchTerm.trim() ? `No entries match "${searchTerm.trim()}"` : `No entries match ${selectedTheme}`}
                    </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {displayedEntries.map((entry, i) => {
                        const isExpanded = expandedId === entry.id;
                        const isLong = entry.content.length > ENTRY_PREVIEW_LENGTH;
                        const preview = isLong && !isExpanded
                            ? entry.content.slice(0, ENTRY_PREVIEW_LENGTH) + "..."
                            : entry.content;
                        const justSaved = isJustSaved(entry.createdAt);
                        const isNew = newEntryId === entry.id;

                        return (
                            <article key={entry.id} style={{
                                background: "rgba(7,26,47,0.025)",
                                border: "1px solid rgba(7,26,47,0.07)",
                                borderRadius: 14,
                                overflow: "hidden",
                                animation: i === 0 && isNew ? "fadeSlideUp 0.4s ease" : "none",
                                opacity: deletingId === entry.id ? 0.4 : 1,
                                transition: "opacity 0.2s",
                            }}>
                                <div style={{
                                    padding: "14px 20px 12px",
                                    borderBottom: "1px solid rgba(7,26,47,0.045)",
                                    display: "grid",
                                    gridTemplateColumns: "1fr auto",
                                    gap: 10,
                                }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 15, color: "var(--color-text)", fontWeight: 600, lineHeight: 1.35 }}>
                                            {formatDate(entry.createdAt)}
                                        </div>
                                        <div style={{ fontSize: 12, color: "rgba(16,32,51,0.58)", marginTop: 4, lineHeight: 1.3, fontFamily: "var(--tekori-font-ui)" }}>
                                            {formatTime(entry.createdAt)}
                                            {entry.wordCount ? ` · ${entry.wordCount} words` : ""}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-end", gap: 8 }}>
                                        {entry.mood && <span title={MOOD_OPTIONS.find(m => m.emoji === entry.mood)?.label} style={{ fontSize: 16 }}>{entry.mood}</span>}
                                        <ThemePills themes={entry.themes} />
                                        <button
                                            onClick={() => openEditOverlay(entry)}
                                            title="Edit entry"
                                            style={{
                                                background: "transparent",
                                                border: "none", color: "rgba(7,26,47,0.50)", fontSize: 12, fontWeight: 500,
                                                cursor: "pointer", padding: "2px 4px", borderRadius: 8,
                                                transition: "color 0.15s", fontFamily: "var(--tekori-font-ui)",
                                            }}
                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--tekori-gold)"}
                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(7,26,47,0.50)"}
                                        >Edit</button>
                                        <button
                                            onClick={() => handleDelete(entry.id)}
                                            disabled={deletingId === entry.id}
                                            style={{
                                                background: "transparent",
                                                border: "none", color: "rgba(7,26,47,0.50)", fontSize: 18, fontWeight: 500,
                                                cursor: "pointer", padding: "0 2px", borderRadius: 8,
                                                transition: "color 0.15s", lineHeight: 1.2,
                                            }}
                                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--color-danger)"}
                                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(7,26,47,0.50)"}
                                        >×</button>
                                    </div>
                                </div>

                                <div style={{ padding: "18px 20px" }}>
                                    <div style={{
                                        fontSize: 15, fontFamily: "var(--tekori-font-ui)",
                                        color: "var(--color-text-soft)", lineHeight: 1.9, whiteSpace: "pre-wrap",
                                    }}>
                                        <HighlightText text={preview} query={searchTerm} />
                                    </div>
                                    {isLong && (
                                        <button onClick={() => setExpandedId(isExpanded ? null : entry.id)} style={{
                                            background: "transparent", border: "none",
                                            color: "var(--tekori-gold)", fontSize: 13, cursor: "pointer",
                                            padding: "10px 0 0", fontFamily: "var(--tekori-font-ui)",
                                        }}>
                                            {isExpanded ? "Show less ↑" : "Read more ↓"}
                                        </button>
                                    )}

                                    {entry.forgeSummary ? (
                                        <div style={{
                                            marginTop: 16,
                                            background: "rgba(216,155,43,0.04)",
                                            borderRadius: 8,
                                            padding: "10px 12px",
                                        }}>
                                            <div style={{
                                                color: "rgba(216,155,43,0.7)",
                                                fontSize: 11,
                                                fontFamily: "var(--tekori-font-ui)",
                                                textTransform: "uppercase",
                                                marginBottom: 5,
                                                letterSpacing: "0.04em",
                                            }}>🔥 Navi read this:</div>
                                            <div style={{
                                                fontSize: 13,
                                                fontStyle: "italic",
                                                color: "rgba(16,32,51,0.65)",
                                                fontFamily: "var(--tekori-font-ui)",
                                                lineHeight: 1.75,
                                            }}>
                                                {entry.forgeSummary}
                                            </div>
                                        </div>
                                    ) : entry.summaryFailed ? (
                                        <button
                                            onClick={() => void retrySummary(entry)}
                                            style={{
                                                marginTop: 14,
                                                width: "100%",
                                                textAlign: "left",
                                                background: "rgba(7,26,47,0.02)",
                                                border: "none",
                                                borderRadius: 8,
                                                padding: "10px 12px",
                                                color: "rgba(7,26,47,0.74)",
                                                fontSize: 12,
                                                fontFamily: "var(--tekori-font-ui)",
                                                fontStyle: "italic",
                                                cursor: "pointer",
                                            }}
                                        >
                                            Navi couldn't read this entry — tap to retry
                                        </button>
                                    ) : justSaved ? (
                                        <div style={{
                                            marginTop: 14,
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            fontSize: 12,
                                            color: "rgba(7,26,47,0.74)",
                                            fontFamily: "var(--tekori-font-ui)",
                                            fontStyle: "italic",
                                        }}>
                                            <span style={{ display: "inline-flex", gap: 4 }}>
                                                {[0, 1, 2].map(index => (
                                                    <span key={index} style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--tekori-gold)", animation: "forgePulse 1.2s ease-in-out infinite", animationDelay: `${index * 0.18}s` }} />
                                                ))}
                                            </span>
                                            Navi is reading this
                                        </div>
                                    ) : null}
                                </div>

                                <div style={{
                                    padding: "8px 20px 16px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    borderTop: "1px solid rgba(7,26,47,0.04)",
                                }}>
                                    <button
                                        onClick={() => void openQuickChat(entry)}
                                        style={{
                                            background: "transparent",
                                            border: "none",
                                            color: "var(--tekori-gold)",
                                            fontSize: 12,
                                            fontFamily: "var(--tekori-font-ui)",
                                            cursor: "pointer",
                                            padding: "4px 0",
                                        }}
                                    >
                                        Ask Navi →
                                    </button>
                                    <button
                                        onClick={() => void copyEntry(entry)}
                                        style={{
                                            background: "transparent",
                                            border: "none",
                                            color: copiedEntryId === entry.id ? "var(--color-success)" : "rgba(7,26,47,0.45)",
                                            fontSize: 12,
                                            fontFamily: "var(--tekori-font-ui)",
                                            cursor: "pointer",
                                            padding: "4px 0",
                                        }}
                                    >
                                        {copiedEntryId === entry.id ? "Copied ✓" : "Copy entry □"}
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>

                <div style={{ height: 40 }} />
            </div>

            {quickChatEntry && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 270,
                    background: "rgba(255,252,246,0.94)",
                    backdropFilter: "blur(16px)",
                    display: "flex",
                    flexDirection: "column",
                    color: "var(--color-text)",
                }}>
                    <div style={{
                        padding: "max(13px, calc(9px + env(safe-area-inset-top))) 16px 13px",
                        borderBottom: "1px solid rgba(7,26,47,0.07)",
                        background: "rgba(255,252,246,0.94)",
                        flexShrink: 0,
                    }}>
                        <div style={{
                            maxWidth: 820,
                            margin: "0 auto",
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) auto",
                            gap: 12,
                            alignItems: "center",
                        }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{
                                    fontSize: 11,
                                    color: "rgba(216,155,43,0.8)",
                                    fontFamily: "var(--tekori-font-ui)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    marginBottom: 3,
                                }}>
                                    Journal quick chat
                                </div>
                                <div style={{
                                    fontSize: 14,
                                    color: "rgba(7,26,47,0.88)",
                                    fontFamily: "var(--tekori-font-ui)",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}>
                                    {formatDate(quickChatEntry.createdAt)}
                                </div>
                            </div>
                            <button
                                onClick={closeQuickChat}
                                style={{
                                    background: "rgba(7,26,47,0.04)",
                                    border: "1px solid rgba(7,26,47,0.08)",
                                    borderRadius: 9,
                                    color: "rgba(16,32,51,0.58)",
                                    fontSize: 13,
                                    fontFamily: "var(--tekori-font-ui)",
                                    cursor: "pointer",
                                    padding: "8px 12px",
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    <div ref={quickChatScrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                        <div style={{ maxWidth: 820, margin: "0 auto", display: "grid", gap: 14 }}>
                            <div style={{
                                background: "rgba(7,26,47,0.025)",
                                border: "1px solid rgba(7,26,47,0.07)",
                                borderRadius: 14,
                                padding: "14px 16px",
                            }}>
                                <div style={{
                                    fontSize: 10,
                                    color: "rgba(7,26,47,0.50)",
                                    fontFamily: "var(--tekori-font-ui)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    marginBottom: 8,
                                }}>
                                    Entry
                                </div>
                                <div style={{
                                    fontSize: 13,
                                    color: "var(--color-text-muted)",
                                    lineHeight: 1.75,
                                    whiteSpace: "pre-wrap",
                                    maxHeight: 170,
                                    overflowY: "auto",
                                }}>
                                    {quickChatEntry.content}
                                </div>
                            </div>

                            {quickChatMessages.map((message) => (
                                <div
                                    key={message.id}
                                    style={{
                                        display: "flex",
                                        justifyContent: message.role === "user" ? "flex-end" : "flex-start",
                                    }}
                                >
                                    <div style={{
                                        maxWidth: "min(680px, 88%)",
                                        background: message.role === "user" ? "rgba(216,155,43,0.12)" : "rgba(7,26,47,0.04)",
                                        border: message.role === "user" ? "1px solid rgba(216,155,43,0.25)" : "1px solid rgba(7,26,47,0.08)",
                                        borderRadius: 14,
                                        padding: "12px 14px",
                                        color: message.role === "user" ? "var(--color-text)" : "rgba(16,32,51,0.82)",
                                        fontSize: 14,
                                        lineHeight: 1.75,
                                        whiteSpace: "pre-wrap",
                                        fontFamily: message.role === "user" ? "var(--tekori-font-ui)" : "var(--tekori-font-ui)",
                                    }}>
                                        {message.text}
                                    </div>
                                </div>
                            ))}

                            {quickChatLoading && (
                                <div style={{ display: "flex", alignItems: "center", gap: 7, color: "rgba(16,32,51,0.42)", fontSize: 12, fontFamily: "var(--tekori-font-ui)", padding: "4px 2px" }}>
                                    <span style={{ display: "inline-flex", gap: 4 }}>
                                        {[0, 1, 2].map(index => (
                                            <span key={index} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--tekori-gold)", animation: "forgePulse 1.2s ease-in-out infinite", animationDelay: `${index * 0.18}s` }} />
                                        ))}
                                    </span>
                                    Navi is reading this
                                </div>
                            )}

                            {quickChatError && (
                                <div style={{ color: "var(--color-warning)", fontSize: 12, lineHeight: 1.6, fontFamily: "var(--tekori-font-ui)" }}>
                                    {quickChatError}
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{
                        flexShrink: 0,
                        borderTop: "1px solid rgba(7,26,47,0.07)",
                        background: "rgba(255,252,246,0.96)",
                        padding: "12px 16px max(12px, env(safe-area-inset-bottom))",
                    }}>
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                void sendQuickChatMessage();
                            }}
                            style={{ maxWidth: 820, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "center" }}
                        >
                            <input
                                value={quickChatDraft}
                                onChange={(event) => setQuickChatDraft(event.target.value)}
                                placeholder="Reply to Navi..."
                                disabled={quickChatLoading}
                                style={{
                                    width: "100%",
                                    background: "rgba(7,26,47,0.04)",
                                    border: "1px solid rgba(7,26,47,0.08)",
                                    borderRadius: 12,
                                    color: "var(--color-text)",
                                    fontSize: 14,
                                    fontFamily: "var(--tekori-font-ui)",
                                    padding: "12px 13px",
                                    outline: "none",
                                    boxSizing: "border-box",
                                }}
                            />
                            <button
                                type="submit"
                                disabled={!quickChatDraft.trim() || quickChatLoading}
                                style={{
                                    background: !quickChatDraft.trim() || quickChatLoading ? "rgba(216,155,43,0.08)" : "linear-gradient(135deg, var(--tekori-gold), var(--tekori-soft-gold))",
                                    border: !quickChatDraft.trim() || quickChatLoading ? "1px solid rgba(216,155,43,0.14)" : "1px solid rgba(216,155,43,0.35)",
                                    borderRadius: 12,
                                    color: !quickChatDraft.trim() || quickChatLoading ? "rgba(216,155,43,0.38)" : "var(--color-primary)",
                                    fontSize: 13,
                                    fontWeight: 700,
                                    fontFamily: "var(--tekori-font-ui)",
                                    cursor: !quickChatDraft.trim() || quickChatLoading ? "default" : "pointer",
                                    padding: "12px 15px",
                                }}
                            >
                                Send
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {writing && (
                <div style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 260,
                    background: "radial-gradient(circle at top, rgba(216,155,43,0.06), transparent 34%), rgb(8,8,9)",
                    display: "flex",
                    flexDirection: "column",
                    color: "var(--color-text)",
                }}>
                    <div style={{
                        padding: "max(14px, calc(10px + env(safe-area-inset-top))) 18px 14px",
                        borderBottom: "1px solid rgba(7,26,47,0.06)",
                        background: "rgba(255,252,246,0.90)",
                        backdropFilter: "blur(14px)",
                    }}>
                        <div style={{
                            maxWidth: 820,
                            margin: "0 auto",
                            display: "grid",
                            gridTemplateColumns: "minmax(0, 1fr) auto auto",
                            alignItems: "center",
                            gap: 12,
                        }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 11, color: "rgba(7,26,47,0.74)", fontFamily: "var(--tekori-font-ui)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                                    {editingEntry ? "Edit entry" : "New journal entry"}
                                </div>
                                <div style={{ fontSize: 15, color: "rgba(7,26,47,0.88)", fontFamily: "var(--tekori-font-ui)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {editingEntry ? formatDate(editingEntry.createdAt) : new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                                </div>
                            </div>
                            <div style={{
                                fontSize: 12,
                                color: "rgba(16,32,51,0.42)",
                                fontFamily: "var(--tekori-font-ui)",
                                background: "rgba(7,26,47,0.04)",
                                border: "1px solid rgba(7,26,47,0.07)",
                                borderRadius: 999,
                                padding: "6px 10px",
                                whiteSpace: "nowrap",
                            }}>
                                {wordCount > 0 ? getReadTimeLabel(wordCount) : "0 words"}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    onClick={() => { setWriting(false); setDraft(""); setEditingEntry(null); setSelectedMood(null); }}
                                    style={{
                                        background: "rgba(7,26,47,0.04)",
                                        border: "1px solid rgba(7,26,47,0.08)",
                                        borderRadius: 9,
                                        color: "rgba(7,26,47,0.74)",
                                        fontSize: 13,
                                        fontFamily: "var(--tekori-font-ui)",
                                        cursor: "pointer",
                                        padding: "8px 12px",
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!draft.trim() || saving}
                                    style={{
                                        background: !draft.trim() || saving ? "rgba(216,155,43,0.08)" : "linear-gradient(135deg, var(--tekori-gold), var(--tekori-soft-gold))",
                                        border: !draft.trim() || saving ? "1px solid rgba(216,155,43,0.14)" : "1px solid rgba(216,155,43,0.35)",
                                        borderRadius: 9,
                                        color: !draft.trim() || saving ? "rgba(216,155,43,0.38)" : "var(--color-primary)",
                                        fontSize: 13,
                                        fontWeight: 700,
                                        fontFamily: "var(--tekori-font-ui)",
                                        cursor: !draft.trim() || saving ? "default" : "pointer",
                                        padding: "8px 14px",
                                        boxShadow: !draft.trim() || saving ? "none" : "0 8px 28px rgba(216,155,43,0.24)",
                                    }}
                                >
                                    {saving ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto" }}>
                        <div style={{ maxWidth: 820, margin: "0 auto", padding: "16px 18px 40px", boxSizing: "border-box" }}>

                            {/* Mood selector */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 11, color: "rgba(7,26,47,0.74)", fontFamily: "var(--tekori-font-ui)" }}>How are you feeling?</span>
                                <div style={{ display: "flex", gap: 6 }}>
                                    {MOOD_OPTIONS.map(m => (
                                        <button
                                            key={m.emoji}
                                            onClick={() => setSelectedMood(selectedMood === m.emoji ? null : m.emoji)}
                                            title={m.label}
                                            style={{
                                                fontSize: 20,
                                                background: selectedMood === m.emoji ? "rgba(216,155,43,0.15)" : "rgba(7,26,47,0.03)",
                                                border: selectedMood === m.emoji ? "1px solid rgba(216,155,43,0.35)" : "1px solid rgba(7,26,47,0.07)",
                                                borderRadius: 8,
                                                width: 36,
                                                height: 36,
                                                cursor: "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                transition: "all 0.15s",
                                            }}
                                        >{m.emoji}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Entry templates */}
                            {!draft.trim() && (
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                                    {ENTRY_TEMPLATES.map(t => (
                                        <button
                                            key={t.name}
                                            onClick={() => setDraft(t.content)}
                                            style={{
                                                display: "flex", alignItems: "center", gap: 5,
                                                background: "rgba(7,26,47,0.03)",
                                                border: "1px solid rgba(7,26,47,0.08)",
                                                borderRadius: 20,
                                                padding: "5px 12px",
                                                fontSize: 11,
                                                color: "rgba(7,26,47,0.74)",
                                                cursor: "pointer",
                                                fontFamily: "var(--tekori-font-ui)",
                                                transition: "all 0.15s",
                                            }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(216,155,43,0.08)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(216,155,43,0.2)"; (e.currentTarget as HTMLElement).style.color = "var(--tekori-gold)"; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(7,26,47,0.03)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(7,26,47,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(7,26,47,0.74)"; }}
                                        >
                                            <span>{t.icon}</span>{t.name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div style={{
                                position: "relative",
                                minHeight: "calc(100vh - 220px)",
                                borderRadius: 18,
                                background: "rgba(7,26,47,0.018)",
                                border: "1px solid rgba(7,26,47,0.055)",
                                boxShadow: "var(--shadow-premium)",
                                overflow: "hidden",
                            }}>
                                <textarea
                                    ref={textareaRef}
                                    value={draft}
                                    onChange={event => setDraft(event.target.value)}
                                    placeholder="What's on your mind today?"
                                    style={{
                                        width: "100%",
                                        minHeight: "62vh",
                                        background: "transparent",
                                        border: "none",
                                        color: "var(--color-text)",
                                        fontSize: 18,
                                        fontFamily: "var(--tekori-font-ui)",
                                        lineHeight: 2,
                                        padding: "30px 30px 110px",
                                        boxSizing: "border-box",
                                        resize: "none",
                                        outline: "none",
                                    }}
                                />
                                {!draft.trim() && (
                                    <div style={{
                                        margin: "-76px 30px 96px",
                                        background: "rgba(7,26,47,0.035)",
                                        border: "1px solid rgba(7,26,47,0.075)",
                                        borderRadius: 14,
                                        padding: "14px 16px",
                                        color: "rgba(16,32,51,0.42)",
                                        fontFamily: "var(--tekori-font-ui)",
                                        position: "relative",
                                        zIndex: 1,
                                    }}>
                                        <div style={{ fontSize: 11, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(7,26,47,0.54)" }}>Try writing about</div>
                                        <div style={{ display: "grid", gap: 8 }}>
                                            {writingPrompts.map(prompt => (
                                                <div key={prompt} style={{ fontSize: 13, lineHeight: 1.5, color: "rgba(7,26,47,0.88)" }}>
                                                    {prompt}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div style={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "14px 18px",
                                    background: "linear-gradient(to top, rgba(255,252,246,0.98), rgba(7,26,47,0.28))",
                                    borderTop: "1px solid rgba(7,26,47,0.055)",
                                }}>
                                    <div style={{ fontSize: 12, color: "rgba(7,26,47,0.54)", fontFamily: "var(--tekori-font-ui)" }}>
                                        Private founder note
                                    </div>
                                    <div style={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: "50%",
                                        background: "rgba(216,155,43,0.1)",
                                        border: "1px solid rgba(216,155,43,0.22)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}>
                                        <MicButton value={draft} onChange={setDraft} size={20} idleColor="var(--tekori-gold)" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import { useState, useEffect, useRef } from "react";
import { saveJournalEntry, deleteJournalEntry } from "./db";
import Logo from "./components/Logo";

// ─────────────────────────────────────────────────────────────
// FOUNDER'S JOURNAL
// ─────────────────────────────────────────────────────────────
export default function JournalScreen({ userId, entries, onEntriesChange, onBack, profile }) {
    const [writing, setWriting] = useState(false);
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { setTimeout(() => setMounted(true), 100); }, []);

    useEffect(() => {
        if (writing && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [writing]);

    const handleSave = async () => {
        if (!draft.trim() || saving) return;
        setSaving(true);
        const entry = await saveJournalEntry(userId, draft.trim());
        if (entry) {
            onEntriesChange([entry, ...entries]);
            setDraft("");
            setWriting(false);
        }
        setSaving(false);
    };

    const handleDelete = async (entryId: string) => {
        setDeletingId(entryId);
        await deleteJournalEntry(userId, entryId);
        onEntriesChange(entries.filter(e => e.id !== entryId));
        setDeletingId(null);
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric"
        });
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    };

    const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0;

    return (
        <div style={{
            position: "fixed", inset: 0, background: "#080809",
            display: "flex", flexDirection: "column",
            fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8", zIndex: 200
        }}>

            {/* Header */}
            <div style={{
                padding: "max(11px, calc(6px + env(safe-area-inset-top))) 16px 11px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={onBack} style={{
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8, padding: "var(--foundry-app-header-button-padding)", color: "#F0EDE8", fontSize: "var(--foundry-app-header-button-font)",
                        fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6
                    }}><Logo variant="flame" style={{ width: "var(--foundry-app-header-icon-size)", height: "var(--foundry-app-header-icon-size)", objectFit: "contain" }} />Hub</button>
                </div>
                <div style={{ textAlign: "left", flex: 1, marginLeft: 12 }}>
                    <div style={{
                        fontSize: "var(--foundry-app-header-title-font)", fontFamily: "'Lora', Georgia, serif",
                        fontWeight: 600, color: "#F0EDE8"
                    }}>Founder's Journal</div>
                    <div style={{ fontSize: "var(--foundry-app-header-meta-font)", color: "#555" }}>
                        {entries.length} {entries.length === 1 ? "entry" : "entries"}
                    </div>
                </div>
                <button onClick={() => { setWriting(true); setDraft(""); }} style={{
                    background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.25)",
                    borderRadius: 8, padding: "var(--foundry-app-header-button-padding)", color: "#E8622A",
                    fontSize: "var(--foundry-app-header-button-font)", fontWeight: 500, cursor: "pointer"
                }}>+ New</button>
            </div>

            {/* Content */}
            <div className="foundry-app-page__content" style={{ flex: 1, overflowY: "auto", padding: "16px", maxWidth: 680, width: "100%", margin: "0 auto" }}>

                {/* Empty state */}
                {entries.length === 0 && !writing && (
                    <div style={{
                        textAlign: "left", padding: "60px 24px",
                        opacity: mounted ? 1 : 0, transition: "opacity 0.5s ease"
                    }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>📓</div>
                        <div style={{
                            fontSize: 20, fontFamily: "'Playfair Display', Georgia, serif",
                            fontWeight: 700, color: "#F0EDE8", marginBottom: 10
                        }}>Your journal is empty</div>
                        <div style={{
                            fontSize: 13, color: "#555", fontFamily: "'Lora', Georgia, serif",
                            fontStyle: "italic", lineHeight: 1.7, maxWidth: 300, margin: "0 0 24px"
                        }}>
                            This is your private space. Write about wins, fears, decisions, or anything on your mind as you build.
                        </div>
                        <button onClick={() => setWriting(true)} style={{
                            background: "linear-gradient(135deg, #E8622A, #c9521e)",
                            border: "none", borderRadius: 12, padding: "12px 24px",
                            color: "#fff", fontSize: 13, fontFamily: "'Lora', Georgia, serif",
                            fontWeight: 600, cursor: "pointer",
                            boxShadow: "0 4px 20px rgba(232,98,42,0.3)"
                        }}>Write your first entry</button>
                    </div>
                )}

                {/* Writing mode */}
                {writing && (
                    <div style={{ animation: "fadeSlideUp 0.3s ease", marginBottom: 20 }}>
                        <div style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(232,98,42,0.3)",
                            borderRadius: 16, overflow: "hidden"
                        }}>
                            <div style={{
                                padding: "12px 16px",
                                borderBottom: "1px solid rgba(255,255,255,0.05)",
                                display: "flex", alignItems: "center", justifyContent: "space-between"
                            }}>
                                <div style={{ fontSize: 11, color: "#555" }}>
                                    {new Date().toLocaleDateString("en-US", {
                                        weekday: "long", month: "long", day: "numeric"
                                    })}
                                </div>
                                <div style={{ fontSize: 11, color: "#444" }}>
                                    {wordCount > 0 ? `${wordCount} words` : "Start writing..."}
                                </div>
                            </div>
                            <textarea
                                ref={textareaRef}
                                value={draft}
                                onChange={e => setDraft(e.target.value)}
                                placeholder="What's on your mind today? Write about a win, a fear, a decision you made, something Forge said that stuck with you..."
                                rows={10}
                                style={{
                                    width: "100%", background: "transparent", border: "none",
                                    color: "#D8D4CE", fontSize: 14,
                                    fontFamily: "'Lora', Georgia, serif",
                                    lineHeight: 1.8, padding: "16px",
                                    boxSizing: "border-box", resize: "none"
                                }}
                            />
                            <div style={{
                                padding: "12px 16px",
                                borderTop: "1px solid rgba(255,255,255,0.05)",
                                display: "flex", gap: 8, justifyContent: "flex-end"
                            }}>
                                <button onClick={() => { setWriting(false); setDraft(""); }} style={{
                                    background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: 8, padding: "8px 16px", color: "#555",
                                    fontSize: 12, cursor: "pointer"
                                }}>Cancel</button>
                                <button onClick={handleSave} disabled={!draft.trim() || saving} style={{
                                    background: !draft.trim() || saving ? "rgba(232,98,42,0.3)" : "linear-gradient(135deg, #E8622A, #c9521e)",
                                    border: "none", borderRadius: 8, padding: "8px 20px",
                                    color: "#fff", fontSize: 12, fontWeight: 600,
                                    cursor: !draft.trim() || saving ? "default" : "pointer",
                                    fontFamily: "'Lora', Georgia, serif",
                                    transition: "all 0.2s"
                                }}>
                                    {saving ? "Saving..." : "Save Entry"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Entries list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {entries.map((entry, i) => {
                        const isExpanded = expandedId === entry.id;
                        const isLong = entry.content.length > 280;
                        const preview = isLong && !isExpanded
                            ? entry.content.slice(0, 280) + "..."
                            : entry.content;

                        return (
                            <div key={entry.id} style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: 14, overflow: "hidden",
                                animation: i === 0 ? "fadeSlideUp 0.3s ease" : "none",
                                opacity: deletingId === entry.id ? 0.4 : 1,
                                transition: "opacity 0.2s"
                            }}>
                                <div style={{
                                    padding: "12px 16px",
                                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                                    display: "flex", alignItems: "center", justifyContent: "space-between"
                                }}>
                                    <div>
                                        <div style={{ fontSize: 14, color: "#A8A4A0", fontWeight: 600, lineHeight: 1.35 }}>
                                            {formatDate(entry.createdAt)}
                                        </div>
                                        <div style={{ fontSize: 12, color: "#68625C", marginTop: 3, lineHeight: 1.3 }}>
                                            {formatTime(entry.createdAt)}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(entry.id)}
                                        disabled={deletingId === entry.id}
                                        style={{
                                            background: "transparent",
                                            border: "none", color: "#5F5952", fontSize: 22, fontWeight: 500,
                                            cursor: "pointer", padding: "4px 8px", borderRadius: 8,
                                            transition: "color 0.15s"
                                        }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#FF6B6B"}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#5F5952"}
                                    >×</button>
                                </div>
                                <div style={{ padding: "14px 16px" }}>
                                    <div style={{
                                        fontSize: 15, fontFamily: "'Lora', Georgia, serif",
                                        color: "#C8C4BE", lineHeight: 1.8, whiteSpace: "pre-wrap"
                                    }}>{preview}</div>
                                    {isLong && (
                                        <button onClick={() => setExpandedId(isExpanded ? null : entry.id)} style={{
                                            background: "transparent", border: "none",
                                            color: "#E8622A", fontSize: 13, cursor: "pointer",
                                            padding: "8px 0 0", fontFamily: "'Lora', Georgia, serif"
                                        }}>
                                            {isExpanded ? "Show less ↑" : "Read more ↓"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom padding */}
                <div style={{ height: 40 }} />
            </div>
        </div>
    );
}

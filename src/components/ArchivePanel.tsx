import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
    loadConversationSummaries,
    updateConversationSummary,
    deleteConversationSummary,
} from "../db";
import { STAGES_DATA } from "../constants/stages";
import {
    getArchiveDisplayTitle,
    getArchiveDisplaySummary,
    getArchivePreviewText,
} from "../lib/archiveSummary";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type SourceType = "forge" | "chatroom" | "academy" | "bubble";
type FilterKey = "all" | SourceType;

const SOURCE_CONFIG: Record<SourceType, { label: string; color: string; bg: string; borderColor: string }> = {
    forge:    { label: "Forge Session",   color: "#E8622A", bg: "rgba(232,98,42,0.06)",   borderColor: "rgba(232,98,42,0.28)" },
    chatroom: { label: "Chat with Forge", color: "#4CAF8A", bg: "rgba(76,175,138,0.06)",  borderColor: "rgba(76,175,138,0.28)" },
    academy:  { label: "Academy",         color: "#9B8DE8", bg: "rgba(155,141,232,0.06)", borderColor: "rgba(155,141,232,0.28)" },
    bubble:   { label: "Quick Chat",      color: "#63B3ED", bg: "rgba(99,179,237,0.06)",  borderColor: "rgba(99,179,237,0.28)" },
};

function getSourceType(entry: any): SourceType {
    const t = String(entry?.title || "");
    if (t.startsWith("Quick Chat")) return "bubble";
    if (t.startsWith("Chat with Forge")) return "chatroom";
    if (t.startsWith("Academy —")) return "academy";
    return "forge";
}

function displayDate(dateLike?: string) {
    if (!dateLike) return "";
    return new Date(`${dateLike}T12:00:00`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

function previewText(summary: string) {
    const plain = getArchivePreviewText(summary || "").replace(/\s+/g, " ").trim();
    return plain.length > 140 ? `${plain.slice(0, 140)}...` : plain;
}

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────
interface ArchivePanelProps {
    userId: string;
    onBack: () => void;
    /** Open the Academy chat room with this entry as the initial archive */
    onContinueChatEntry?: (entry: any) => void;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function ArchivePanel({
    userId,
    onBack,
    onContinueChatEntry,
}: ArchivePanelProps) {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterKey>("all");
    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleInput, setTitleInput] = useState("");
    const [savingTitle, setSavingTitle] = useState(false);

    useEffect(() => {
        loadConversationSummaries(userId).then((rows) => {
            setEntries(
                [...rows].sort((a, b) => {
                    const aT = new Date(a.createdAt || `${a.date}T12:00:00`).getTime();
                    const bT = new Date(b.createdAt || `${b.date}T12:00:00`).getTime();
                    return bT - aT;
                })
            );
            setLoading(false);
        });
    }, [userId]);

    const hasType = (t: SourceType) => entries.some((e) => getSourceType(e) === t);

    const filteredEntries =
        filter === "all" ? entries : entries.filter((e) => getSourceType(e) === filter);

    const filterOptions: { key: FilterKey; label: string; color: string }[] = [
        { key: "all",      label: "All",             color: "#F0EDE8" },
        ...(hasType("forge")    ? [{ key: "forge"    as FilterKey, label: "Forge Sessions",  color: SOURCE_CONFIG.forge.color }]    : []),
        ...(hasType("chatroom") ? [{ key: "chatroom" as FilterKey, label: "Chat with Forge", color: SOURCE_CONFIG.chatroom.color }] : []),
        ...(hasType("academy")  ? [{ key: "academy"  as FilterKey, label: "Academy",         color: SOURCE_CONFIG.academy.color }]  : []),
        ...(hasType("bubble")   ? [{ key: "bubble"   as FilterKey, label: "Quick Chat",      color: SOURCE_CONFIG.bubble.color }]   : []),
    ];

    // ── Actions ─────────────────────────────────────────────
    const handleDelete = (entry: any) => {
        setMenuOpenId(null);
        setConfirmDeleteId(entry.id);
    };

    const confirmAndDelete = async (entry: any) => {
        if (deletingId) return;
        setConfirmDeleteId(null);
        setDeletingId(entry.id);
        const ok = await deleteConversationSummary(userId, entry.id);
        if (ok) {
            setEntries((prev) => prev.filter((e) => e.id !== entry.id));
            if (selectedEntry?.id === entry.id) setSelectedEntry(null);
        }
        setDeletingId(null);
    };

    const handleSaveTitle = async () => {
        if (!selectedEntry?.id || savingTitle || !titleInput.trim()) return;
        setSavingTitle(true);
        const updated = await updateConversationSummary(userId, selectedEntry.id, {
            title: titleInput.trim(),
        });
        if (updated) {
            setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
            setSelectedEntry(updated);
        }
        setEditingTitle(false);
        setSavingTitle(false);
    };

    const openDetail = (entry: any) => {
        setSelectedEntry(entry);
        setTitleInput(getArchiveDisplayTitle(entry.title, entry.summary, `${SOURCE_CONFIG[getSourceType(entry)].label} · ${displayDate(entry.date)}`));
        setEditingTitle(false);
    };

    const handleContinue = (entry: any) => {
        setSelectedEntry(null);
        onContinueChatEntry?.(entry);
    };

    // ── Card renderer ────────────────────────────────────────
    const renderCard = (entry: any) => {
        const type = getSourceType(entry);
        const cfg = SOURCE_CONFIG[type];
        const fallback = `${cfg.label} · ${displayDate(entry.date)}`;
        const stageData =
            type === "forge" ? STAGES_DATA.find((s) => s.id === Number(entry.stageId)) : null;

        return (
            <div
                key={entry.id}
                style={{
                    background: cfg.bg,
                    border: `1px solid ${cfg.borderColor}`,
                    borderLeft: `4px solid ${cfg.color}`,
                    borderRadius: 14,
                    color: "#F0EDE8",
                    position: "relative",
                }}
            >
                {/* Actions menu */}
                <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}>
                    <div style={{ position: "relative" }}>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId((cur) => (cur === entry.id ? null : entry.id));
                            }}
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                border: "1px solid rgba(255,255,255,0.08)",
                                background: "rgba(255,255,255,0.04)",
                                color: "#999",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 17,
                            }}
                        >
                            ⋯
                        </button>
                        {menuOpenId === entry.id && (
                            <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    position: "absolute",
                                    top: 36,
                                    right: 0,
                                    minWidth: 180,
                                    background: "#111214",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    borderRadius: 12,
                                    boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
                                    padding: 6,
                                    zIndex: 10,
                                }}
                            >
                                <button
                                    onClick={() => { setMenuOpenId(null); handleContinue(entry); }}
                                    style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 8, color: "#4CAF8A", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}
                                >
                                    Continue Conversation
                                </button>
                                <button
                                    onClick={() => { openDetail(entry); setEditingTitle(true); setMenuOpenId(null); }}
                                    style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 8, color: "#F0EDE8", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}
                                >
                                    Edit Title
                                </button>
                                <button
                                    onClick={() => handleDelete(entry)}
                                    style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 8, color: "#FF6B6B", padding: "10px 12px", cursor: "pointer", fontSize: 13 }}
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => openDetail(entry)}
                    style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 14, padding: "14px 52px 14px 16px", color: "#F0EDE8", cursor: "pointer" }}
                >
                    {/* Badge row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 9, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`, borderRadius: 5, padding: "2px 7px" }}>
                            {cfg.label}
                        </span>
                        {stageData && (
                            <span style={{ fontSize: 9, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: stageData.color, background: `${stageData.color}15`, border: `1px solid ${stageData.color}28`, borderRadius: 5, padding: "2px 7px" }}>
                                Stage {stageData.id} — {stageData.label}
                            </span>
                        )}
                        <span style={{ fontSize: 10, color: "rgba(240,237,232,0.3)", fontFamily: "'DM Sans', sans-serif", marginLeft: "auto" }}>
                            {displayDate(entry.date)}
                        </span>
                    </div>
                    <div style={{ fontSize: 15, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 5, lineHeight: 1.3 }}>
                        {getArchiveDisplayTitle(entry.title, entry.summary, fallback)}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(240,237,232,0.45)", lineHeight: 1.7 }}>
                        {previewText(entry.summary)}
                    </div>
                </button>
            </div>
        );
    };

    // ── Detail modal ─────────────────────────────────────────
    const renderDetailModal = () => {
        if (!selectedEntry) return null;
        const type = getSourceType(selectedEntry);
        const cfg = SOURCE_CONFIG[type];
        const fallback = `${cfg.label} · ${displayDate(selectedEntry.date)}`;
        const stageData =
            type === "forge" ? STAGES_DATA.find((s) => s.id === Number(selectedEntry.stageId)) : null;

        return (
            <div
                onClick={() => { setSelectedEntry(null); setEditingTitle(false); }}
                style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(4,4,5,0.84)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: "min(720px, 100%)", maxHeight: "85vh", overflowY: "auto", background: "#0E0E10", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "20px 18px 18px" }}
                >
                    {/* Modal header */}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Badges */}
                            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 9, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30`, borderRadius: 5, padding: "2px 7px" }}>{cfg.label}</span>
                                {stageData && (
                                    <span style={{ fontSize: 9, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: stageData.color, background: `${stageData.color}15`, border: `1px solid ${stageData.color}28`, borderRadius: 5, padding: "2px 7px" }}>Stage {stageData.id} — {stageData.label}</span>
                                )}
                                <span style={{ fontSize: 10, color: "rgba(240,237,232,0.3)", fontFamily: "'DM Sans', sans-serif" }}>{displayDate(selectedEntry.date)}</span>
                            </div>
                            {/* Title / edit */}
                            {editingTitle ? (
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <input
                                        value={titleInput}
                                        onChange={(e) => setTitleInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") void handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                                        autoFocus
                                        style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px", color: "#F0EDE8", fontSize: 15, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}
                                    />
                                    <button onClick={() => void handleSaveTitle()} disabled={savingTitle} style={{ padding: "8px 14px", background: "rgba(232,98,42,0.15)", border: "1px solid rgba(232,98,42,0.3)", borderRadius: 8, color: "#E8622A", fontSize: 12, cursor: "pointer" }}>
                                        {savingTitle ? "..." : "Save"}
                                    </button>
                                    <button onClick={() => setEditingTitle(false)} style={{ padding: "8px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#666", fontSize: 12, cursor: "pointer" }}>✕</button>
                                </div>
                            ) : (
                                <div style={{ fontSize: 20, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", lineHeight: 1.2 }}>
                                    {getArchiveDisplayTitle(selectedEntry.title, selectedEntry.summary, fallback)}
                                </div>
                            )}
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                            {!editingTitle && (
                                <button onClick={() => setEditingTitle(true)} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#888", fontSize: 12, cursor: "pointer" }}>Edit</button>
                            )}
                            <button onClick={() => { setSelectedEntry(null); setEditingTitle(false); }} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#888", fontSize: 12, cursor: "pointer" }}>✕</button>
                        </div>
                    </div>

                    {/* Summary content */}
                    <div style={{ fontSize: 14, color: "rgba(240,237,232,0.7)", lineHeight: 1.8, whiteSpace: "pre-wrap", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}>
                        {getArchiveDisplaySummary(selectedEntry.summary) || selectedEntry.summary || "No summary content."}
                    </div>

                    {/* Actions */}
                    <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}>
                        <button
                            onClick={() => handleDelete(selectedEntry)}
                            style={{ padding: "10px 16px", background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.2)", borderRadius: 10, color: "#FF6B6B", fontSize: 13, cursor: "pointer" }}
                        >
                            Delete
                        </button>
                        <button
                            onClick={() => handleContinue(selectedEntry)}
                            style={{ padding: "10px 20px", background: "rgba(232,98,42,0.15)", border: "1px solid rgba(232,98,42,0.3)", borderRadius: 10, color: "#E8622A", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                        >
                            Continue Conversation →
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // ── Main render ──────────────────────────────────────────
    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#080809", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)", flexShrink: 0 }}>
                <button
                    onClick={onBack}
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "7px 10px", color: "#888", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center" }}
                >
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <div style={{ fontSize: 16, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>Archive</div>
                    <div style={{ fontSize: 10, color: "#555" }}>All saved conversations</div>
                </div>
            </div>

            {/* Scrollable list */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16, maxWidth: 720, width: "100%", margin: "0 auto" }}>
                {loading ? (
                    <div style={{ textAlign: "center", padding: 48, color: "#555", fontSize: 13 }}>Loading archive…</div>
                ) : (
                    <>
                        {/* Filter chips */}
                        {entries.length > 0 && filterOptions.length > 1 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                                {filterOptions.map((opt) => {
                                    const active = filter === opt.key;
                                    return (
                                        <button
                                            key={opt.key}
                                            onClick={() => setFilter(opt.key)}
                                            style={{
                                                background: active ? `${opt.color}20` : "rgba(255,255,255,0.04)",
                                                border: `1px solid ${active ? opt.color + "50" : "rgba(255,255,255,0.1)"}`,
                                                borderRadius: 20,
                                                color: active ? opt.color : "rgba(240,237,232,0.45)",
                                                fontSize: 11,
                                                fontFamily: "'DM Sans', sans-serif",
                                                fontWeight: active ? 700 : 500,
                                                padding: "5px 13px",
                                                cursor: "pointer",
                                                letterSpacing: "0.02em",
                                                transition: "all 0.15s ease",
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Cards */}
                        {filteredEntries.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {filteredEntries.map(renderCard)}
                            </div>
                        ) : entries.length === 0 ? (
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "36px 24px", color: "#888", fontSize: 13, lineHeight: 1.7, textAlign: "center" }}>
                                <div style={{ fontSize: 30, marginBottom: 14 }}>📁</div>
                                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, color: "#F0EDE8", marginBottom: 8 }}>No saved archives yet.</div>
                                <div>Use Save Chat in the Forge to store named snapshots of your conversations.</div>
                            </div>
                        ) : (
                            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 16px", color: "#888", fontSize: 13 }}>
                                No {filterOptions.find((o) => o.key === filter)?.label} archives yet.
                            </div>
                        )}
                    </>
                )}
            </div>

            {renderDetailModal()}

            {/* Delete confirmation overlay */}
            {confirmDeleteId && (() => {
                const entry = entries.find((e) => e.id === confirmDeleteId);
                if (!entry) return null;
                const type = getSourceType(entry);
                const cfg = SOURCE_CONFIG[type];
                const title = getArchiveDisplayTitle(entry.title, entry.summary, `${cfg.label} · ${displayDate(entry.date)}`);
                return (
                    <div
                        onClick={() => setConfirmDeleteId(null)}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 400,
                            background: "rgba(4,4,5,0.80)",
                            backdropFilter: "blur(14px)",
                            WebkitBackdropFilter: "blur(14px)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 24,
                        }}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: "min(400px, 100%)",
                                background: "#111214",
                                border: "1px solid rgba(255,107,107,0.2)",
                                borderRadius: 18,
                                padding: "28px 24px 24px",
                                boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
                            }}
                        >
                            <div style={{ fontSize: 28, marginBottom: 14, textAlign: "center" }}>🗑️</div>
                            <div style={{ fontSize: 17, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8", textAlign: "center", marginBottom: 8, lineHeight: 1.3 }}>
                                Delete this archive?
                            </div>
                            <div style={{ fontSize: 13, color: "rgba(240,237,232,0.45)", textAlign: "center", marginBottom: 6, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
                                {title}
                            </div>
                            <div style={{ fontSize: 12, color: "rgba(240,237,232,0.3)", textAlign: "center", marginBottom: 24, fontFamily: "'DM Sans', sans-serif" }}>
                                This cannot be undone.
                            </div>
                            <div style={{ display: "flex", gap: 10 }}>
                                <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    style={{ flex: 1, padding: "13px 0", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "rgba(240,237,232,0.6)", fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, cursor: "pointer" }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => confirmAndDelete(entry)}
                                    disabled={!!deletingId}
                                    style={{ flex: 1, padding: "13px 0", background: "rgba(255,107,107,0.15)", border: "1px solid rgba(255,107,107,0.35)", borderRadius: 12, color: "#FF6B6B", fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, cursor: "pointer", opacity: deletingId ? 0.5 : 1 }}
                                >
                                    {deletingId ? "Deleting…" : "Yes, Delete"}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

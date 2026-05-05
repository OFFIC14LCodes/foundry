import { useMemo, useState } from "react";
import Logo from "./Logo";
import {
    BUSINESS_MODEL_CANVAS_LABELS,
    BUSINESS_MODEL_CANVAS_SECTIONS,
    detectWeakBusinessModelCanvasSections,
    printBusinessModelCanvasPdf,
    type BusinessModelCanvasRecord,
    type BusinessModelCanvasSectionKey,
} from "../lib/businessModelCanvas";
import type { FoundryActionSuggestion } from "../lib/foundryActions";
import { suggestActionFromCanvasWeakness } from "../lib/foundryActions";
import ActionSuggestionCard from "./actions/ActionSuggestionCard";
import HelpTooltip from "./HelpTooltip";

type Props = {
    profile: any;
    canvas: BusinessModelCanvasRecord;
    onBack: () => void;
    onEditEntry: (section: BusinessModelCanvasSectionKey, entryId: string, text: string) => Promise<void> | void;
    onDeleteEntry: (section: BusinessModelCanvasSectionKey, entryId: string) => Promise<void> | void;
    onAddViaForge: (section: BusinessModelCanvasSectionKey) => void;
    onCreateAction?: (suggestion: FoundryActionSuggestion) => Promise<unknown> | void;
    onAskForgeAboutAction?: (suggestion: FoundryActionSuggestion) => void;
};

export default function BusinessModelCanvasScreen({
    profile,
    canvas,
    onBack,
    onEditEntry,
    onDeleteEntry,
    onAddViaForge,
    onCreateAction,
    onAskForgeAboutAction,
}: Props) {
    const [selectedSection, setSelectedSection] = useState<BusinessModelCanvasSectionKey | null>(null);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");
    const [saving, setSaving] = useState(false);

    const weaknessLookup = useMemo(
        () => new Map(detectWeakBusinessModelCanvasSections(canvas).map((item) => [item.section, item])),
        [canvas],
    );

    const selectedEntries = selectedSection ? canvas[selectedSection] || [] : [];
    const selectedLabel = selectedSection ? BUSINESS_MODEL_CANVAS_LABELS[selectedSection] : "";
    const selectedWeakness = selectedSection ? weaknessLookup.get(selectedSection) ?? null : null;
    const [actionNotice, setActionNotice] = useState<string | null>(null);

    const beginEdit = (entryId: string, text: string) => {
        setEditingEntryId(entryId);
        setEditingText(text);
    };

    const handleSave = async () => {
        if (!selectedSection || !editingEntryId || !editingText.trim()) return;
        setSaving(true);
        try {
            await onEditEntry(selectedSection, editingEntryId, editingText.trim());
            setEditingEntryId(null);
            setEditingText("");
        } finally {
            setSaving(false);
        }
    };

    const createWeaknessAction = async (suggestion: FoundryActionSuggestion) => {
        if (!onCreateAction) return;
        await onCreateAction(suggestion);
        setActionNotice("Suggested action saved to Action Center.");
        window.setTimeout(() => setActionNotice(null), 2200);
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "#080809", color: "#F0EDE8", zIndex: 80, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
                <button
                    onClick={onBack}
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 14px", color: "#F0EDE8", cursor: "pointer", fontSize: 12 }}
                >
                    ← Back
                </button>
                <Logo variant="flame" style={{ width: 42, height: 42, objectFit: "contain", flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: 30, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, lineHeight: 1 }}>Business Model Canvas</div>
                        <HelpTooltip content={`Living Stage 2 model for ${profile?.businessName || profile?.idea || "your business"} · Version ${canvas.version}`} side="bottom" />
                    </div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                        onClick={() => printBusinessModelCanvasPdf(canvas, profile)}
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 14px", color: "#F0EDE8", cursor: "pointer", fontSize: 12 }}
                    >
                        Export PDF
                    </button>
                </div>
            </div>

            <div style={{ padding: "18px 20px 22px", overflowY: "auto", flex: 1 }}>
                <div style={{ maxWidth: 1320, margin: "0 auto" }}>
                    <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <div style={{ maxWidth: 780 }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>Forge builds this with you over time</div>
                                <HelpTooltip content="This canvas is a live strategic system, not a blank template. Use Add via Forge whenever a section feels thin, vague, or under pressure." />
                            </div>
                        </div>
                        <div style={{ minWidth: 260, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 14 }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <div style={{ fontSize: 11, color: "#77716A", textTransform: "uppercase", letterSpacing: "0.12em" }}>Weak spots</div>
                                <HelpTooltip content={weaknessLookup.size === 0
                                    ? "No obvious structural gaps right now."
                                    : Array.from(weaknessLookup.values()).slice(0, 4).map((item) => `${BUSINESS_MODEL_CANVAS_LABELS[item.section]}: ${item.message}`).join("\n")} />
                            </div>
                        </div>
                    </div>
                    {actionNotice && (
                        <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(76,175,138,0.08)", border: "1px solid rgba(76,175,138,0.2)", color: "#8BD8A9", fontSize: 12 }}>
                            {actionNotice}
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
                        {BUSINESS_MODEL_CANVAS_SECTIONS.map((section) => {
                            const entries = canvas[section] || [];
                            const weakness = weaknessLookup.get(section);
                            return (
                                <button
                                    key={section}
                                    onClick={() => setSelectedSection(section)}
                                    style={{
                                        textAlign: "left",
                                        minHeight: 188,
                                        background: "rgba(255,255,255,0.025)",
                                        border: weakness
                                            ? "1px solid rgba(232,98,42,0.25)"
                                            : "1px solid rgba(255,255,255,0.07)",
                                        borderRadius: 16,
                                        padding: 16,
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 10,
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: weakness ? "#E8622A" : "#7E766E", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5 }}>
                                                {entries.length} {entries.length === 1 ? "entry" : "entries"}
                                            </div>
                                            <div style={{ fontSize: 20, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, lineHeight: 1.15 }}>{BUSINESS_MODEL_CANVAS_LABELS[section]}</div>
                                        </div>
                                        {weakness && (
                                            <div style={{ fontSize: 10, color: "#E8622A", background: "rgba(232,98,42,0.12)", border: "1px solid rgba(232,98,42,0.22)", borderRadius: 999, padding: "5px 8px", whiteSpace: "nowrap" }}>
                                                Needs work
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignContent: "flex-start" }}>
                                        {entries.slice(0, 5).map((entry) => (
                                            <span key={entry.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 999, padding: "6px 10px", fontSize: 11, color: "#D6D1CA", lineHeight: 1.45 }}>
                                                {entry.text}
                                            </span>
                                        ))}
                                        {entries.length === 0 && (
                                            <div style={{ fontSize: 12, color: "#8C857D", lineHeight: 1.6 }}>
                                                Still empty. Let Forge pressure-test this part of the model.
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                        <div style={{ fontSize: 11, color: "#8C857D" }}>
                                            {weakness ? weakness.message : "Click to refine or clean up entries."}
                                        </div>
                                        <div style={{ fontSize: 12, color: "#E8622A", fontWeight: 600 }}>Open →</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {selectedSection && (
                <>
                    <div onClick={() => { setSelectedSection(null); setEditingEntryId(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.52)", zIndex: 81 }} />
                    <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(760px, calc(100vw - 28px))", maxHeight: "82vh", overflowY: "auto", background: "#0F1012", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18, zIndex: 82 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
                            <div>
                                <div style={{ fontSize: 11, color: "#7E766E", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5 }}>Canvas Section</div>
                                <div style={{ fontSize: 28, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, lineHeight: 1.1 }}>{selectedLabel}</div>
                                <div style={{ fontSize: 13, color: "#9D978E", marginTop: 8, lineHeight: 1.7 }}>
                                    Edit what is here, delete what no longer fits, or push this section forward through Forge.
                                </div>
                            </div>
                            <button
                                onClick={() => onAddViaForge(selectedSection)}
                                style={{ background: "rgba(232,98,42,0.12)", border: "1px solid rgba(232,98,42,0.22)", borderRadius: 10, padding: "10px 14px", color: "#E8622A", cursor: "pointer", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap" }}
                            >
                                Add via Forge
                            </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {selectedWeakness && (onCreateAction || onAskForgeAboutAction) && (
                                <ActionSuggestionCard
                                    action={suggestActionFromCanvasWeakness(selectedWeakness)}
                                    compact
                                    acceptLabel="Create action"
                                    onAccept={onCreateAction ? () => void createWeaknessAction(suggestActionFromCanvasWeakness(selectedWeakness)) : undefined}
                                    onAskForge={onAskForgeAboutAction ? () => onAskForgeAboutAction(suggestActionFromCanvasWeakness(selectedWeakness)) : undefined}
                                />
                            )}
                            {selectedEntries.length === 0 && (
                                <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: "#9D978E", lineHeight: 1.7 }}>
                                    There is nothing solid here yet. Use Forge to pressure-test this section instead of filling it like a worksheet.
                                </div>
                            )}
                            {selectedEntries.map((entry) => (
                                <div key={entry.id} style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                    {editingEntryId === entry.id ? (
                                        <>
                                            <textarea
                                                value={editingText}
                                                onChange={(event) => setEditingText(event.target.value)}
                                                rows={3}
                                                style={{ width: "100%", resize: "vertical", background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#F0EDE8", padding: 12, fontFamily: "inherit", fontSize: 13, lineHeight: 1.6 }}
                                            />
                                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                                <button onClick={handleSave} disabled={saving || !editingText.trim()} style={{ background: "rgba(76,175,138,0.14)", border: "1px solid rgba(76,175,138,0.25)", borderRadius: 8, padding: "8px 12px", color: "#4CAF8A", cursor: saving ? "default" : "pointer", fontSize: 12 }}>
                                                    {saving ? "Saving..." : "Save"}
                                                </button>
                                                <button onClick={() => { setEditingEntryId(null); setEditingText(""); }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 12px", color: "#A8A4A0", cursor: "pointer", fontSize: 12 }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ fontSize: 14, color: "#F0EDE8", lineHeight: 1.7 }}>{entry.text}</div>
                                            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                                                <button onClick={() => beginEdit(entry.id, entry.text)} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 12px", color: "#F0EDE8", cursor: "pointer", fontSize: 12 }}>
                                                    Edit
                                                </button>
                                                <button onClick={() => onDeleteEntry(selectedSection, entry.id)} style={{ background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.2)", borderRadius: 8, padding: "8px 12px", color: "#E8622A", cursor: "pointer", fontSize: 12 }}>
                                                    Delete
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

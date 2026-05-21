import { useEffect, useMemo, useState } from "react";
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
import { isSideHustleMode } from "../lib/ventureMode";

type Props = {
    profile: any;
    canvas: BusinessModelCanvasRecord;
    onBack: () => void;
    onOpenNav?: () => void;
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
    onOpenNav,
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
    const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 640);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 639px)");
        const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);

    const weaknessLookup = useMemo(
        () => new Map(detectWeakBusinessModelCanvasSections(canvas).map((item) => [item.section, item])),
        [canvas],
    );

    const selectedEntries = selectedSection ? canvas[selectedSection] || [] : [];
    const selectedLabel = selectedSection ? BUSINESS_MODEL_CANVAS_LABELS[selectedSection] : "";
    const selectedWeakness = selectedSection ? weaknessLookup.get(selectedSection) ?? null : null;
    const canvasTitle = isSideHustleMode(profile) ? "Side Hustle Canvas" : "Business Model Canvas";
    const canvasSubject = isSideHustleMode(profile) ? "your side hustle or offer" : "your business";
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
        <div style={{ position: "fixed", inset: 0, background: "var(--foundry-bg-app)", color: "var(--foundry-text-primary)", zIndex: 80, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--foundry-border-subtle)", display: "flex", alignItems: "center", gap: 12 }}>
                <button
                    className="foundry-btn foundry-btn--ghost"
                    onClick={onOpenNav}
                    style={{ padding: "8px 11px", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3.5" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="11" width="14" height="1.5" rx="0.75" fill="currentColor"/></svg>
                </button>
                <Logo variant="flame" style={{ width: 42, height: 42, objectFit: "contain", flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontSize: isNarrow ? 20 : 30, fontFamily: "var(--tekori-font-ui)", fontWeight: 600, lineHeight: 1 }}>{canvasTitle}</div>
                        <HelpTooltip content={`Living Stage 2 model for ${profile?.businessName || profile?.idea || canvasSubject} · Version ${canvas.version}`} side="bottom" />
                    </div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                        className="foundry-btn foundry-btn--secondary"
                        onClick={() => printBusinessModelCanvasPdf(canvas, profile)}
                        style={{ padding: "8px 14px", fontSize: 12 }}
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
                                <div style={{ fontSize: 15, fontFamily: "var(--tekori-font-ui)", fontWeight: 600 }}>Navi builds this with you over time</div>
                                <HelpTooltip content="This canvas is a live strategic system, not a blank template. Use Add via Navi whenever a section feels thin, vague, or under pressure." />
                            </div>
                        </div>
                        <div className="foundry-module-card" style={{ minWidth: 260, padding: 14 }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.12em" }}>Weak spots</div>
                                <HelpTooltip content={weaknessLookup.size === 0
                                    ? "No obvious structural gaps right now."
                                    : Array.from(weaknessLookup.values()).slice(0, 4).map((item) => `${BUSINESS_MODEL_CANVAS_LABELS[item.section]}: ${item.message}`).join("\n")} />
                            </div>
                        </div>
                    </div>
                    {actionNotice && (
                        <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(115,135,123,0.10)", border: "1px solid rgba(115,135,123,0.22)", color: "var(--color-success)", fontSize: 12 }}>
                            {actionNotice}
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                        {BUSINESS_MODEL_CANVAS_SECTIONS.map((section) => {
                            const entries = canvas[section] || [];
                            const weakness = weaknessLookup.get(section);
                            return (
                                <button
                                    className="foundry-module-card foundry-interactive"
                                    key={section}
                                    onClick={() => setSelectedSection(section)}
                                    style={{
                                        textAlign: "left",
                                        minHeight: 188,
                                        background: undefined,
                                        border: weakness
                                            ? "1px solid rgba(244,199,106,0.30)"
                                            : undefined,
                                        padding: 16,
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 10,
                                    }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: weakness ? "var(--foundry-semantic-warning)" : "var(--foundry-text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5 }}>
                                                {entries.length} {entries.length === 1 ? "entry" : "entries"}
                                            </div>
                                            <div style={{ fontSize: 20, fontFamily: "var(--tekori-font-ui)", fontWeight: 600, lineHeight: 1.15, color: "var(--foundry-text-primary)" }}>{BUSINESS_MODEL_CANVAS_LABELS[section]}</div>
                                        </div>
                                        {weakness && (
                                            <div style={{ fontSize: 10, color: "var(--foundry-semantic-warning)", background: "rgba(244,199,106,0.14)", border: "1px solid rgba(244,199,106,0.24)", borderRadius: 999, padding: "5px 8px", whiteSpace: "nowrap" }}>
                                                Needs work
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignContent: "flex-start" }}>
                                        {entries.slice(0, 5).map((entry) => (
                                            <span key={entry.id} style={{ background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.07)", borderRadius: 999, padding: "6px 10px", fontSize: 11, color: "var(--color-pill-text)", lineHeight: 1.45 }}>
                                                {entry.text}
                                            </span>
                                        ))}
                                        {entries.length === 0 && (
                                            <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                                                Still empty. Let Navi pressure-test this part of the model.
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                                            {weakness ? weakness.message : "Click to refine or clean up entries."}
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", fontWeight: 600 }}>Open →</div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {selectedSection && (
                <>
                    <div onClick={() => { setSelectedSection(null); setEditingEntryId(null); }} style={{ position: "fixed", inset: 0, background: "rgba(7,26,47,0.52)", zIndex: 81 }} />
                    <div className="foundry-modal-surface foundry-panel-in" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(760px, calc(100vw - 28px))", maxHeight: "82vh", overflowY: "auto", padding: 18, zIndex: 82 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5 }}>Canvas Section</div>
                                <div style={{ fontSize: isNarrow ? 22 : 28, fontFamily: "var(--tekori-font-ui)", fontWeight: 600, lineHeight: 1.1 }}>{selectedLabel}</div>
                                <div style={{ fontSize: 13, color: "rgba(7,26,47,0.78)", marginTop: 8, lineHeight: 1.7 }}>
                                    Edit what is here, delete what no longer fits, or push this section forward through Navi.
                                </div>
                            </div>
                            <button
                                className="foundry-btn foundry-btn--primary"
                                onClick={() => onAddViaForge(selectedSection)}
                                style={{ padding: "10px 14px", fontSize: 12, whiteSpace: "nowrap" }}
                            >
                                Add via Navi
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
                                <div className="foundry-control-surface" style={{ padding: 14, fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
                                    There is nothing solid here yet. Use Navi to pressure-test this section instead of filling it like a worksheet.
                                </div>
                            )}
                            {selectedEntries.map((entry) => (
                                <div className="foundry-control-surface" key={entry.id} style={{ padding: 14 }}>
                                    {editingEntryId === entry.id ? (
                                        <>
                                            <textarea
                                                value={editingText}
                                                onChange={(event) => setEditingText(event.target.value)}
                                                rows={3}
                                                style={{ width: "100%", resize: "vertical", background: "rgba(16,32,51,0.10)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 10, color: "var(--color-text)", padding: 12, fontFamily: "inherit", fontSize: 13, lineHeight: 1.6 }}
                                            />
                                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                                <button className="foundry-btn foundry-btn--success" onClick={handleSave} disabled={saving || !editingText.trim()} style={{ padding: "8px 12px", cursor: saving ? "default" : "pointer", fontSize: 12 }}>
                                                    {saving ? "Saving..." : "Save"}
                                                </button>
                                                <button className="foundry-btn foundry-btn--ghost" onClick={() => { setEditingEntryId(null); setEditingText(""); }} style={{ padding: "8px 12px", fontSize: 12 }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ fontSize: 14, color: "var(--color-text)", lineHeight: 1.7 }}>{entry.text}</div>
                                            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                                                <button className="foundry-btn foundry-btn--secondary" onClick={() => beginEdit(entry.id, entry.text)} style={{ padding: "8px 12px", fontSize: 12 }}>
                                                    Edit
                                                </button>
                                                <button className="foundry-btn foundry-btn--danger" onClick={() => onDeleteEntry(selectedSection, entry.id)} style={{ padding: "8px 12px", fontSize: 12 }}>
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

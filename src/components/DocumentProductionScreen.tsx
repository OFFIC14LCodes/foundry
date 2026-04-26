import { useState, useRef, useEffect } from "react";
import {
    ChartLineUp, Gavel, CurrencyDollar, Bank, ShieldCheck, Handshake,
    Users, TrendUp, Buildings, Shield, Megaphone, Door,
    ArrowLeft, Star, MapPin,
} from "@phosphor-icons/react";
import { streamForgeAPI } from "../lib/forgeApi";
import { buildDocSystemPrompt, buildDocRequest, buildRefinementRequest } from "../constants/docPrompt";
import { loadProducedDocuments, saveProducedDocument, type ProducedDocument } from "../db";
import DocumentFieldsForm from "./DocumentFieldsForm";
import {
    DOCUMENT_PREVIEW_CSS,
    buildOfficialTitleBlockHtml,
    downloadStyledDocx,
    downloadStyledHtml,
    markdownToDocumentHtml,
    printStyledPdf,
    sanitizeDocumentMarkdown,
    type DocumentExportMeta,
} from "../lib/documentExport";
import {
    createDocumentInputDefaults,
    formatDocumentInputsForPrompt,
    getDocumentRequirement,
    getSuggestedDocumentSettings,
    validateDocumentInputs,
} from "../lib/documentRequirements";
import { formatLegalDate, formatLongDate, getIsoDate } from "../lib/legalDate";
import {
    DOC_CATEGORIES, SMART_PROMPTS, DEFAULT_SMART_PROMPTS,
    type DocCategory, type DocItem,
} from "../constants/docCategories";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Phase = "categories" | "documents" | "configure" | "studio";

interface GenRecord {
    instruction: string;
    doc: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const AUDIENCES = [
    "Bank", "Investor", "Partner", "General", "Grant Body", "Internal",
    "Attorney", "Co-Founder", "Media/Press", "Customers", "Government/Regulatory",
];

const TONES = [
    "Professional", "Formal", "Persuasive", "Conservative", "Modern",
    "Premium", "Friendly", "Technical", "Urgent", "Empathetic",
];

// Max tokens for document generation — documents need more space than chat
const DOC_MAX_TOKENS = 4000;

// ─────────────────────────────────────────────────────────────
// Phosphor icon resolver
// ─────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"; color?: string }>> = {
    ChartLineUp, Gavel, CurrencyDollar, Bank, ShieldCheck,
    Handshake, Users, TrendUp, Buildings, Shield, Megaphone, Door,
};

function CategoryIcon({ name, size = 24, color }: { name: string; size?: number; color?: string }) {
    const Comp = ICON_MAP[name];
    if (!Comp) return null;
    return <Comp size={size} weight="regular" color={color} />;
}

// ─────────────────────────────────────────────────────────────
// Document preview renderer - markdown -> shared styled HTML
// ─────────────────────────────────────────────────────────────
function DocPreview({ content, meta }: { content: string; meta: DocumentExportMeta }) {
    if (!content) return null;
    const safeContent = sanitizeDocumentMarkdown(content, meta);
    return (
        <>
            <style>{DOCUMENT_PREVIEW_CSS}</style>
            <div dangerouslySetInnerHTML={{ __html: buildOfficialTitleBlockHtml(meta) }} />
            <div
                className="foundry-document"
                dangerouslySetInnerHTML={{ __html: markdownToDocumentHtml(safeContent, { skipFirstHeading: true }) }}
            />
        </>
    );
}

async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

// ─────────────────────────────────────────────────────────────
// Chip selector — reused for audience / tone
// ─────────────────────────────────────────────────────────────
function ChipRow({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (v: string) => void }) {
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {options.map(opt => (
                <button
                    key={opt}
                    onClick={() => onSelect(opt)}
                    style={{
                        padding: "5px 13px",
                        borderRadius: 20,
                        border: selected === opt ? "1px solid rgba(232,98,42,0.5)" : "1px solid rgba(255,255,255,0.08)",
                        background: selected === opt ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.03)",
                        color: selected === opt ? "#E8622A" : "#888",
                        fontSize: 12,
                        fontWeight: selected === opt ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontFamily: "'Lora', Georgia, serif",
                    }}
                >
                    {opt}
                </button>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Shared header component
// ─────────────────────────────────────────────────────────────
function ScreenHeader({
    onBack,
    backLabel,
    title,
    subtitle,
    right,
}: {
    onBack: () => void;
    backLabel: string;
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
}) {
    return (
        <div style={{
            padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            position: "sticky", top: 0,
            background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)", zIndex: 10,
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                    onClick={onBack}
                    style={{
                        display: "flex", alignItems: "center", gap: 5,
                        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8, padding: "var(--foundry-app-header-button-padding)", color: "#888", fontSize: "var(--foundry-app-header-button-font)", cursor: "pointer",
                        fontFamily: "'Lora', Georgia, serif",
                    }}
                >
                    <ArrowLeft size={"var(--foundry-app-header-icon-size)"} /> {backLabel}
                </button>
                <div>
                    <div style={{ fontSize: "var(--foundry-app-header-title-font)", fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
                    {subtitle && <div style={{ fontSize: "var(--foundry-app-header-meta-font)", color: "#555" }}>{subtitle}</div>}
                </div>
            </div>
            {right}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Badge components
// ─────────────────────────────────────────────────────────────
function StateAwareBadge() {
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "2px 7px", borderRadius: 10,
            background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)",
            fontSize: 9, color: "#EAB308", fontWeight: 600, letterSpacing: "0.04em",
            fontFamily: "'Lora', Georgia, serif", whiteSpace: "nowrap", flexShrink: 0,
        }}>
            <MapPin size={8} weight="fill" /> State-Aware
        </span>
    );
}

function PopularBadge() {
    return (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "2px 7px", borderRadius: 10,
            background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.25)",
            fontSize: 9, color: "#E8622A", fontWeight: 600,
            fontFamily: "'Lora', Georgia, serif", whiteSpace: "nowrap", flexShrink: 0,
        }}>
            <Star size={8} weight="fill" /> Most Popular
        </span>
    );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export interface DocumentScreenContext {
    phase: string;
    categoryName: string | null;
    documentName: string | null;
    documentContent: string | null;
}

export default function DocumentProductionScreen({
    userId,
    profile,
    onBack,
    onContextChange,
    generationLocked = false,
    generationLockMessage = null,
}: {
    userId: string;
    profile: any;
    onBack: () => void;
    onContextChange?: (ctx: DocumentScreenContext) => void;
    generationLocked?: boolean;
    generationLockMessage?: string | null;
}) {
    // ── Navigation ──────────────────────────────────────────
    const [phase, setPhase] = useState<Phase>("categories");
    const [selectedCategory, setSelectedCategory] = useState<DocCategory | null>(null);
    const [selectedDoc, setSelectedDoc] = useState<DocItem | null>(null);

    // ── Config state ─────────────────────────────────────────
    const [docType, setDocType] = useState("");
    const [audience, setAudience] = useState("General");
    const [tone, setTone] = useState("Professional");
    const [request, setRequest] = useState("");
    const [docState, setDocState] = useState("");
    const [docInputs, setDocInputs] = useState<Record<string, any>>({});
    const [showValidation, setShowValidation] = useState(false);
    const [autoFillCurrentDate, setAutoFillCurrentDate] = useState(true);

    // ── Studio state ─────────────────────────────────────────
    const [currentDoc, setCurrentDoc] = useState("");
    const [generating, setGenerating] = useState(false);
    const [refineInput, setRefineInput] = useState("");
    const [refining, setRefining] = useState(false);
    const [history, setHistory] = useState<GenRecord[]>([]);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<"preview" | "refine">("preview");
    const [documents, setDocuments] = useState<ProducedDocument[]>([]);
    const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
    const [documentsLoading, setDocumentsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "unavailable">("idle");

    const previewRef = useRef<HTMLDivElement>(null);
    const refineRef = useRef<HTMLTextAreaElement>(null);
    const saveStatusResetRef = useRef<number | null>(null);
    const currentDocumentIdRef = useRef<string | null>(null);

    useEffect(() => {
        previewRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentDoc]);

    useEffect(() => {
        onContextChange?.({
            phase,
            categoryName: selectedCategory?.name ?? null,
            documentName: selectedDoc?.name ?? null,
            documentContent: currentDoc || null,
        });
    }, [phase, selectedCategory, selectedDoc, currentDoc]);

    useEffect(() => {
        let cancelled = false;
        setDocumentsLoading(true);
        loadProducedDocuments(userId).then((rows) => {
            if (cancelled) return;
            setDocuments(rows);
            setDocumentsLoading(false);
        });
        return () => { cancelled = true; };
    }, [userId]);

    useEffect(() => {
        return () => {
            if (saveStatusResetRef.current) window.clearTimeout(saveStatusResetRef.current);
        };
    }, []);

    const upsertDocumentList = (saved: ProducedDocument) => {
        setDocuments(prev => [saved, ...prev.filter(doc => doc.id !== saved.id)]);
    };

    const getDocTitle = (content: string, fallback = docType) => {
        return content.split("\n")[0].replace(/^#+\s*/, "").trim() || fallback;
    };

    const setActiveDocumentId = (id: string | null) => {
        currentDocumentIdRef.current = id;
        setCurrentDocumentId(id);
    };

    const persistDocument = async (content: string, nextHistory: GenRecord[], existingId = currentDocumentIdRef.current) => {
        if (!content.trim()) return null;
        setSaveStatus("saving");
        const saved = await saveProducedDocument(userId, {
            id: existingId,
            title: getDocTitle(content),
            docType,
            audience,
            tone,
            request,
            content,
            history: nextHistory,
        });
        if (!saved) {
            setSaveStatus("unavailable");
            return null;
        }
        setActiveDocumentId(saved.id);
        upsertDocumentList(saved);
        setSaveStatus("saved");
        if (saveStatusResetRef.current) window.clearTimeout(saveStatusResetRef.current);
        saveStatusResetRef.current = window.setTimeout(() => setSaveStatus("idle"), 2000);
        return saved;
    };

    const openSavedDocument = (doc: ProducedDocument) => {
        setActiveDocumentId(doc.id);
        setDocType(doc.docType);
        setAudience(doc.audience);
        setTone(doc.tone);
        setRequest(doc.request ?? "");
        setCurrentDoc(doc.content);
        setHistory(doc.history?.length ? doc.history : [{ instruction: doc.request || doc.docType, doc: doc.content }]);
        setPhase("studio");
        setActiveTab("preview");
        setSaveStatus("idle");
    };

    // ── Navigate to a category ───────────────────────────────
    const selectCategory = (cat: DocCategory) => {
        setSelectedCategory(cat);
        setPhase("documents");
    };

    // ── Navigate to a document's config ─────────────────────
    const selectDoc = (doc: DocItem) => {
        setSelectedDoc(doc);
        setDocType(doc.name);
        setRequest("");
        setDocState("");
        if (selectedCategory) {
            const suggested = getSuggestedDocumentSettings(doc, selectedCategory);
            setAudience(suggested.audience);
            setTone(suggested.tone);
            setDocInputs(createDocumentInputDefaults(doc, selectedCategory, profile));
        }
        setAutoFillCurrentDate(true);
        setShowValidation(false);
        setPhase("configure");
    };

    // ── Generate document ────────────────────────────────────
    const generate = async () => {
        if (generating || generationLocked) return;
        const requirement = selectedDoc && selectedCategory ? getDocumentRequirement(selectedDoc, selectedCategory) : null;
        const validation = requirement ? validateDocumentInputs(requirement, docInputs) : { valid: true, missingRequired: [], errors: {} };
        if (!validation.valid) {
            setShowValidation(true);
            return;
        }
        setGenerating(true);
        setActiveDocumentId(null);
        setCurrentDoc("");
        setHistory([]);
        setPhase("studio");
        setActiveTab("preview");

        const systemPrompt = buildDocSystemPrompt(profile);
        const structuredInputs = requirement ? formatDocumentInputsForPrompt(requirement, docInputs) : "";
        const useCaseContext = selectedDoc?.whenToUse ? `Document use case:\n- ${selectedDoc.whenToUse}` : "";
        const userContent = buildDocRequest(
            docType,
            audience,
            tone,
            request,
            selectedDoc?.isStateAware ? docState : undefined,
            [useCaseContext, structuredInputs].filter(Boolean).join("\n\n")
        );

        try {
            const final = await streamForgeAPI(
                [{ role: "user", content: userContent }],
                systemPrompt,
                (chunk) => setCurrentDoc(chunk),
                DOC_MAX_TOKENS
            );
            const safeFinal = sanitizeDocumentMarkdown(final, {
                ...exportMeta,
                title: getDocTitle(final),
                legalDate: formatLegalDate(docInputs.documentDate || getIsoDate()),
            });
            const nextHistory = [{ instruction: userContent, doc: safeFinal }];
            setCurrentDoc(safeFinal);
            setHistory(nextHistory);
            await persistDocument(safeFinal, nextHistory, null);
        } catch {
            setCurrentDoc("# Document Generation Failed\n\nSomething went wrong. Try again or adjust your request.");
        }
        setGenerating(false);
    };

    // ── Refine document ──────────────────────────────────────
    const refine = async () => {
        if (!refineInput.trim() || refining || generating) return;
        const instruction = refineInput.trim();
        setRefineInput("");
        setRefining(true);
        setActiveTab("preview");

        const systemPrompt = buildDocSystemPrompt(profile);
        const userContent = buildRefinementRequest(currentDoc, instruction);

        try {
            const final = await streamForgeAPI(
                [{ role: "user", content: userContent }],
                systemPrompt,
                (chunk) => setCurrentDoc(chunk),
                DOC_MAX_TOKENS
            );
            const safeFinal = sanitizeDocumentMarkdown(final, {
                ...exportMeta,
                title: getDocTitle(final),
                legalDate: formatLegalDate(docInputs.documentDate || getIsoDate()),
            });
            const nextHistory = [...history, { instruction, doc: safeFinal }];
            setCurrentDoc(safeFinal);
            setHistory(nextHistory);
            const savedId = currentDocumentIdRef.current;
            await persistDocument(safeFinal, nextHistory, savedId);
        } catch {
            const last = history[history.length - 1];
            if (last) setCurrentDoc(last.doc);
        }
        setRefining(false);
    };

    const resetToCategories = () => {
        setPhase("categories");
        setSelectedCategory(null);
        setSelectedDoc(null);
        setCurrentDoc("");
        setHistory([]);
        setActiveDocumentId(null);
        setRefineInput("");
        setGenerating(false);
        setRefining(false);
        setSaveStatus("idle");
        setDocState("");
        setAutoFillCurrentDate(true);
    };

    const handleCopy = async () => {
        const ok = await copyToClipboard(currentDoc);
        if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    };

    const docTitle = currentDoc.split("\n")[0].replace(/^#+\s*/, "").trim() || docType;
    const businessName = String(docInputs.legalBusinessName || "").trim();
    const todayIso = getIsoDate();
    const effectiveDocumentDate = docInputs.documentDate || todayIso;
    const todayDate = formatLongDate(effectiveDocumentDate);
    const currentRequirement = selectedDoc && selectedCategory ? getDocumentRequirement(selectedDoc, selectedCategory) : null;
    const suggestedSettings = selectedDoc && selectedCategory ? getSuggestedDocumentSettings(selectedDoc, selectedCategory) : null;
    const currentValidation = currentRequirement
        ? validateDocumentInputs(currentRequirement, docInputs)
        : { valid: true, missingRequired: [], errors: {} };
    const requiredFieldCount = currentRequirement
        ? currentRequirement.groups.reduce((count, group) => count + group.fields.filter(field => field.required).length, 0)
        : 0;
    const completedRequiredCount = Math.max(0, requiredFieldCount - currentValidation.missingRequired.length);
    const canExportOfficialDocument = businessName.length > 0;
    const exportMeta: DocumentExportMeta = {
        title: docTitle,
        businessName,
        docType,
        date: todayDate,
        legalDate: formatLegalDate(effectiveDocumentDate),
        state: docState || undefined,
    };
    const saveLabel = saveStatus === "saving"
        ? "Saving..."
        : saveStatus === "saved"
            ? "Saved"
            : saveStatus === "unavailable"
                ? "Save unavailable"
                : "";

    const handleDocInputChange = (fieldId: string, value: any) => {
        setDocInputs(prev => ({ ...prev, [fieldId]: value }));
        if (fieldId === "jurisdictionState") setDocState(String(value || ""));
        const changedField = currentRequirement?.groups.flatMap(group => group.fields).find(field => field.id === fieldId);
        if (changedField?.type === "date") setAutoFillCurrentDate(false);
    };

    const handleAutoFillCurrentDateChange = (enabled: boolean) => {
        setAutoFillCurrentDate(enabled);
        if (!enabled) return;
        const dateFields = currentRequirement?.groups.flatMap(group => group.fields).filter(field => field.type === "date") ?? [];
        setDocInputs(prev => dateFields.reduce(
            (next, field) => ({ ...next, [field.id]: todayIso }),
            { ...prev, documentDate: todayIso, signatureDate: todayIso }
        ));
    };

    // ═══════════════════════════════════════════════════════════
    // SCREEN 1 — CATEGORY SELECTION
    // ═══════════════════════════════════════════════════════════
    if (phase === "categories") {
        return (
            <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8" }}>
                {/* Header */}
                <div style={{
                    padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    display: "flex", alignItems: "center", gap: 12,
                    position: "sticky", top: 0,
                    background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)", zIndex: 10,
                }}>
                    <button
                        onClick={onBack}
                        style={{
                            display: "flex", alignItems: "center", gap: 5,
                            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 8, padding: "var(--foundry-app-header-button-padding)", color: "#888", fontSize: "var(--foundry-app-header-button-font)", cursor: "pointer",
                        }}
                    >
                        <ArrowLeft size={"var(--foundry-app-header-icon-size)"} /> Hub
                    </button>
                    <div>
                        <div style={{ fontSize: "var(--foundry-app-header-title-font)", fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>Document Production</div>
                        <div style={{ fontSize: "var(--foundry-app-header-meta-font)", color: "#555" }}>Professional document studio · {DOC_CATEGORIES.reduce((n, c) => n + c.documents.length, 0)} documents</div>
                    </div>
                </div>

                <div className="foundry-app-page__content" style={{ maxWidth: "var(--foundry-doc-content-width)", margin: "0 auto", padding: "24px 16px 80px" }}>
                    {/* Intro */}
                    <div style={{ marginBottom: 28, animation: "fadeSlideUp 0.4s ease both", textAlign: "center" }}>
                        <div style={{ fontSize: "clamp(22px, 2vw, 24px)", fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 6, lineHeight: 1.25 }}>
                            What do you need?
                        </div>
                        <div style={{ fontSize: "var(--foundry-doc-card-body-font)", color: "#666", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", lineHeight: 1.7 }}>
                            Every document a founder needs, from day one through exit — generated by Forge and tailored to your business.
                        </div>
                    </div>

                    {/* Recent documents */}
                    {(documents.length > 0 || documentsLoading) && (
                        <div style={{ marginBottom: 28, animation: "fadeSlideUp 0.4s ease 0.02s both" }}>
                            <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                                Recent Documents
                            </div>
                            {documentsLoading ? (
                                <div style={{ fontSize: "var(--foundry-doc-card-body-font)", color: "#444" }}>Loading...</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                    {documents.slice(0, 4).map(doc => (
                                        <button
                                            key={doc.id}
                                            onClick={() => openSavedDocument(doc)}
                                            style={{
                                                width: "100%", padding: "12px 15px", borderRadius: 10, textAlign: "left",
                                                border: "1px solid rgba(255,255,255,0.07)",
                                                background: "rgba(255,255,255,0.025)",
                                                cursor: "pointer", fontFamily: "'Lora', Georgia, serif",
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 2 }}>
                                                <span style={{ fontSize: "var(--foundry-doc-card-large-font)", color: "#C8C4BE", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</span>
                                                <span style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "#555", flexShrink: 0 }}>{new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                            </div>
                                            <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "#555" }}>{doc.docType} · {doc.audience} · {doc.tone}</div>
                                        </button>
                                    ))}
                                    {documents.length > 4 && (
                                        <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "#444", textAlign: "center", paddingTop: 4 }}>
                                            +{documents.length - 4} more saved
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Category grid */}
                    <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                        Document Categories
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {DOC_CATEGORIES.map((cat, index) => (
                            <button
                                key={cat.id}
                                onClick={() => selectCategory(cat)}
                                style={{
                                    display: "flex", alignItems: "center", gap: 14,
                                    padding: "14px 16px", borderRadius: 14, textAlign: "left",
                                    border: "1px solid rgba(255,255,255,0.07)",
                                    background: "rgba(255,255,255,0.025)",
                                    cursor: "pointer", width: "100%",
                                    transition: "all 0.15s",
                                    animation: `fadeSlideUp 0.4s ease ${0.03 + index * 0.02}s both`,
                                    fontFamily: "'Lora', Georgia, serif",
                                }}
                            >
                                {/* Icon */}
                                <div style={{
                                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                                    background: "rgba(232,98,42,0.08)", border: "1px solid rgba(232,98,42,0.15)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <CategoryIcon name={cat.icon} size={22} color="#E8622A" />
                                </div>

                                {/* Text */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: "var(--foundry-doc-card-title-font)", color: "#C8C4BE", fontWeight: 600 }}>{cat.name}</span>
                                        {cat.isStateAware && <StateAwareBadge />}
                                    </div>
                                    <div style={{ fontSize: "var(--foundry-doc-card-body-font)", color: "#555", lineHeight: 1.5 }}>{cat.description}</div>
                                </div>

                                {/* Count badge */}
                                <div style={{
                                    flexShrink: 0, padding: "3px 9px", borderRadius: 20,
                                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                                    fontSize: "var(--foundry-doc-card-body-font)", color: "#666", fontWeight: 600,
                                }}>
                                    {cat.documents.length}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    // SCREEN 2 — DOCUMENT SELECTION
    // ═══════════════════════════════════════════════════════════
    if (phase === "documents" && selectedCategory) {
        return (
            <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8" }}>
                <ScreenHeader
                    onBack={() => setPhase("categories")}
                    backLabel="Categories"
                    title={selectedCategory.name}
                    subtitle={`${selectedCategory.documents.length} documents${selectedCategory.isStateAware ? " · State-Aware" : ""}`}
                    right={
                        selectedCategory.isStateAware ? (
                            <StateAwareBadge />
                        ) : undefined
                    }
                />

                <div className="foundry-app-page__content" style={{ maxWidth: "var(--foundry-doc-content-width)", margin: "0 auto", padding: "20px 16px 80px" }}>
                    {/* Category context */}
                    <div style={{ marginBottom: 20, animation: "fadeSlideUp 0.3s ease both" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 12, background: "rgba(232,98,42,0.05)", border: "1px solid rgba(232,98,42,0.1)" }}>
                            <CategoryIcon name={selectedCategory.icon} size={22} color="#E8622A" />
                            <div style={{ fontSize: "var(--foundry-doc-card-large-font)", color: "#888", lineHeight: 1.55 }}>{selectedCategory.description}</div>
                        </div>
                    </div>

                    {/* State-aware notice */}
                    {selectedCategory.isStateAware && (
                        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(234,179,8,0.05)", border: "1px solid rgba(234,179,8,0.15)", animation: "fadeSlideUp 0.3s ease 0.05s both" }}>
                            <div style={{ fontSize: "var(--foundry-doc-card-body-font)", color: "#d4a017", lineHeight: 1.55 }}>
                                Documents in this category vary by state. You will be asked to confirm your state before configuration.
                            </div>
                        </div>
                    )}

                    {/* Document list */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {selectedCategory.documents.map((doc, index) => (
                            <button
                                key={doc.id}
                                onClick={() => selectDoc(doc)}
                                style={{
                                    padding: "14px 16px", borderRadius: 12, textAlign: "left",
                                    border: "1px solid rgba(255,255,255,0.07)",
                                    background: "rgba(255,255,255,0.025)",
                                    cursor: "pointer", width: "100%",
                                    transition: "all 0.15s",
                                    animation: `fadeSlideUp 0.35s ease ${0.05 + index * 0.02}s both`,
                                    fontFamily: "'Lora', Georgia, serif",
                                }}
                            >
                                {/* Name + badges */}
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                                    <span style={{ fontSize: "var(--foundry-doc-card-title-font)", color: "#D0CCC6", fontWeight: 600, lineHeight: 1.35 }}>{doc.name}</span>
                                    <div style={{ display: "flex", gap: 5, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                        {doc.isMostPopular && <PopularBadge />}
                                        {doc.isStateAware && <StateAwareBadge />}
                                    </div>
                                </div>
                                {/* When to use */}
                                <div style={{ fontSize: "var(--foundry-doc-card-body-font)", color: "#666", lineHeight: 1.6 }}>
                                    {doc.whenToUse}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    // SCREEN 3 — CONFIGURE
    // ═══════════════════════════════════════════════════════════
    if (phase === "configure" && selectedDoc && selectedCategory) {
        const smartPrompts = SMART_PROMPTS[selectedDoc.id] ?? DEFAULT_SMART_PROMPTS;
        const canGenerate = currentValidation.valid && !generationLocked;

        return (
            <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8" }}>
                <ScreenHeader
                    onBack={() => setPhase("documents")}
                    backLabel={selectedCategory.name}
                    title={selectedDoc.name}
                    subtitle="Configure and generate"
                />

                <div className="foundry-app-page__content" style={{ maxWidth: "var(--foundry-doc-content-width)", margin: "0 auto", padding: "20px 16px 100px" }}>
                    {generationLocked && generationLockMessage && (
                        <div style={{
                            marginBottom: 18,
                            padding: "14px 16px",
                            borderRadius: 12,
                            background: "rgba(232,98,42,0.06)",
                            border: "1px solid rgba(232,98,42,0.18)",
                            fontSize: "var(--foundry-doc-card-body-font)",
                            color: "#D8C9BC",
                            lineHeight: 1.65,
                        }}>
                            {generationLockMessage}
                        </div>
                    )}

                    {/* Document identity block */}
                    <div style={{ marginBottom: 24, padding: "16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", animation: "fadeSlideUp 0.3s ease both" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <CategoryIcon name={selectedCategory.icon} size={16} color="#E8622A" />
                            <span style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>{selectedCategory.name}</span>
                        </div>
                        <div style={{ fontSize: "calc(var(--foundry-doc-card-title-font) + 1px)", color: "#C8C4BE", fontWeight: 600, marginBottom: 8 }}>{selectedDoc.name}</div>
                        <div style={{ fontSize: "var(--foundry-doc-card-body-font)", color: "#666", lineHeight: 1.6 }}>{selectedDoc.whenToUse}</div>
                        <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                            {selectedDoc.isMostPopular && <PopularBadge />}
                            {selectedDoc.isStateAware && <StateAwareBadge />}
                        </div>
                    </div>

                    {/* Audience */}
                    <div style={{ marginBottom: 20, animation: "fadeSlideUp 0.3s ease 0.08s both" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                            <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Audience</div>
                            {suggestedSettings && (
                                <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "#E8622A" }}>Suggested: {suggestedSettings.audience}</div>
                            )}
                        </div>
                        <ChipRow options={AUDIENCES} selected={audience} onSelect={setAudience} />
                    </div>

                    {/* Tone */}
                    <div style={{ marginBottom: 22, animation: "fadeSlideUp 0.3s ease 0.11s both" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                            <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Tone</div>
                            {suggestedSettings && (
                                <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "#E8622A" }}>Suggested: {suggestedSettings.tone}</div>
                            )}
                        </div>
                        <ChipRow options={TONES} selected={tone} onSelect={setTone} />
                    </div>

                    {currentRequirement && (
                        <div style={{ marginBottom: 22, animation: "fadeSlideUp 0.3s ease 0.13s both" }}>
                            <div style={{
                                marginBottom: 12,
                                padding: "12px 14px",
                                borderRadius: 12,
                                background: "rgba(76,175,138,0.06)",
                                border: "1px solid rgba(76,175,138,0.18)",
                                fontSize: "var(--foundry-doc-card-body-font)",
                                color: "#A8A4A0",
                                lineHeight: 1.65,
                            }}>
                                <strong style={{ color: "#D8D4CE" }}>One-time use:</strong> these fill-in fields are used for this document and are not saved as reusable profile memory. The finished generated document may still be saved in your document history and can contain the details you choose to include.
                            </div>
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                marginBottom: 12,
                                padding: "12px 14px",
                                borderRadius: 12,
                                background: currentValidation.valid ? "rgba(76,175,138,0.08)" : "rgba(232,98,42,0.07)",
                                border: currentValidation.valid ? "1px solid rgba(76,175,138,0.2)" : "1px solid rgba(232,98,42,0.18)",
                            }}>
                                <div>
                                    <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 700, marginBottom: 3 }}>
                                        Document readiness
                                    </div>
                                    <div style={{ fontSize: 11, color: "#777", lineHeight: 1.5 }}>
                                        {completedRequiredCount} of {requiredFieldCount} required fields complete
                                    </div>
                                </div>
                                <div style={{ fontSize: 11, color: currentValidation.valid ? "#4CAF8A" : "#E8622A", fontWeight: 700, flexShrink: 0 }}>
                                    {currentValidation.valid ? "Ready to generate" : "Missing info"}
                                </div>
                            </div>

                            {showValidation && !currentValidation.valid && (
                                <div style={{ marginBottom: 12, fontSize: 11, color: "#D65037", lineHeight: 1.6 }}>
                                    Complete these before generation: {currentValidation.missingRequired.join(", ")}
                                </div>
                            )}

                            <label style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                marginBottom: 12,
                                padding: "11px 13px",
                                borderRadius: 12,
                                background: "rgba(255,255,255,0.025)",
                                border: "1px solid rgba(255,255,255,0.07)",
                                cursor: "pointer",
                            }}>
                                <span>
                                    <span style={{ display: "block", fontSize: 12, color: "#D8D4CE", fontWeight: 700, marginBottom: 2 }}>
                                        Auto-fill current date
                                    </span>
                                    <span style={{ display: "block", fontSize: 10, color: "#666", lineHeight: 1.5 }}>
                                        Uses {formatLongDate(todayIso)} for document and signature dates unless you override it.
                                    </span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={autoFillCurrentDate}
                                    onChange={(event) => handleAutoFillCurrentDateChange(event.target.checked)}
                                    style={{ accentColor: "#E8622A", width: 17, height: 17, flexShrink: 0 }}
                                />
                            </label>

                            <DocumentFieldsForm
                                requirement={currentRequirement}
                                values={docInputs}
                                errors={showValidation ? currentValidation.errors : {}}
                                onChange={handleDocInputChange}
                            />
                        </div>
                    )}

                    {/* Smart prompt suggestions */}
                    <div style={{ marginBottom: 22, animation: "fadeSlideUp 0.3s ease 0.14s both" }}>
                        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Quick Instructions</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                            {smartPrompts.map(p => (
                                <button
                                    key={p}
                                    onClick={() => setRequest(prev => prev ? `${prev} ${p}` : p)}
                                    style={{
                                        padding: "5px 12px", borderRadius: 20,
                                        border: request.includes(p) ? "1px solid rgba(232,98,42,0.4)" : "1px solid rgba(255,255,255,0.08)",
                                        background: request.includes(p) ? "rgba(232,98,42,0.08)" : "rgba(255,255,255,0.025)",
                                        color: request.includes(p) ? "#E8622A" : "#777",
                                        fontSize: 11, cursor: "pointer", fontFamily: "'Lora', Georgia, serif",
                                        transition: "all 0.15s",
                                    }}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={request}
                            onChange={e => setRequest(e.target.value)}
                            placeholder={`Or describe anything specific:\n— key points to include\n— special requirements\n— purpose or context\n\nLeave blank to let Forge decide based on your profile.`}
                            rows={4}
                            style={{
                                width: "100%", background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12,
                                padding: "12px 14px", color: "#F0EDE8", fontSize: 13,
                                fontFamily: "'Lora', Georgia, serif", lineHeight: 1.6, boxSizing: "border-box",
                            }}
                        />
                    </div>

                    {/* Generate button */}
                    <button
                        onClick={generate}
                        disabled={generating || generationLocked}
                        style={{
                            width: "100%", padding: "15px",
                            background: canGenerate ? "linear-gradient(135deg, #E8622A, #c9521e)" : "rgba(255,255,255,0.06)",
                            border: "none", borderRadius: 14,
                            color: canGenerate ? "#fff" : "#444",
                            fontSize: 15, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer",
                            fontFamily: "'Lora', Georgia, serif",
                            animation: "fadeSlideUp 0.3s ease 0.18s both",
                            transition: "all 0.15s",
                        }}
                    >
                        {generationLocked ? "Document generation unlocks after Stage 1" : canGenerate ? "Generate Document →" : "Complete Required Info →"}
                    </button>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    // SCREEN 4 — STUDIO (preview + refine)
    // ═══════════════════════════════════════════════════════════
    return (
        <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8", display: "flex", flexDirection: "column" }}>
            {/* Studio Header */}
            <div style={{
                padding: "max(12px, calc(6px + env(safe-area-inset-top))) 16px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)",
                zIndex: 10, position: "sticky", top: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                        onClick={resetToCategories}
                        style={{
                            display: "flex", alignItems: "center", gap: 5,
                            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 8, padding: "5px 11px", color: "#888", fontSize: 12, cursor: "pointer",
                        }}
                    >
                        <ArrowLeft size={12} /> Hub
                    </button>
                    <div>
                        <div style={{ fontSize: 14, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, lineHeight: 1.2 }}>Document Studio</div>
                        <div style={{ fontSize: 10, color: "#555" }}>
                            {docType} · {audience} · {tone}{docState ? ` · ${docState}` : ""}{saveLabel ? ` · ${saveLabel}` : ""}
                        </div>
                    </div>
                </div>
                <button
                    onClick={resetToCategories}
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "5px 12px", color: "#666", fontSize: 11, cursor: "pointer" }}
                >
                    New Doc
                </button>
            </div>

            {/* Tab bar */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
                {(["preview", "refine"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1, padding: "10px", background: "none", border: "none",
                            borderBottom: activeTab === tab ? "2px solid #E8622A" : "2px solid transparent",
                            color: activeTab === tab ? "#E8622A" : "#555",
                            fontSize: 12, fontWeight: activeTab === tab ? 600 : 400,
                            cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s",
                            fontFamily: "'Lora', Georgia, serif",
                        }}
                    >
                        {tab === "preview" ? "Document Preview" : `Refine${history.length > 1 ? ` (${history.length - 1})` : ""}`}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }} ref={previewRef}>
                {/* ── PREVIEW TAB ── */}
                {activeTab === "preview" && (
                    <>
                        {generating && !currentDoc && (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "80px 0", color: "#555" }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                    {[0, 1, 2].map(i => (
                                        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#E8622A", animation: "forgePulse 1.4s infinite ease-in-out", animationDelay: `${i * 0.2}s` }} />
                                    ))}
                                </div>
                                <div style={{ fontSize: 13, color: "#555", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic" }}>Forge is drafting your document...</div>
                            </div>
                        )}

                        {currentDoc && (
                            <div style={{ maxWidth: 680, margin: "0 auto" }}>
                                {/* Paper */}
                                <div style={{
                                    background: "#F8F5F0", borderRadius: 12,
                                    padding: "36px 40px", boxShadow: "0 4px 40px rgba(0,0,0,0.5)",
                                    marginBottom: 16,
                                    animation: generating ? "none" : "fadeSlideUp 0.4s ease both",
                                    position: "relative",
                                }}>
                                    {generating && (
                                        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 5, background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.3)", borderRadius: 20, padding: "3px 10px" }}>
                                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8622A", animation: "forgePulse 1.2s infinite" }} />
                                            <span style={{ fontSize: 10, color: "#E8622A", fontFamily: "'Lora', Georgia, serif" }}>Writing</span>
                                        </div>
                                    )}

                                    <DocPreview content={currentDoc} meta={exportMeta} />

                                </div>

                                {/* Download controls */}
                                {!generating && (
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, animation: "fadeSlideUp 0.3s ease 0.1s both" }}>
                                        <button
                                            onClick={handleCopy}
                                            style={{ flex: 1, minWidth: 80, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: copied ? "#4CAF8A" : "#C8C4BE", fontSize: 12, cursor: "pointer", transition: "all 0.2s", fontFamily: "'Lora', Georgia, serif" }}
                                        >
                                            {copied ? "✓ Copied" : "Copy"}
                                        </button>
                                        <button
                                            onClick={() => printStyledPdf(currentDoc, exportMeta)}
                                            disabled={!canExportOfficialDocument}
                                            title={!canExportOfficialDocument ? "Legal Business Name is required before export." : undefined}
                                            style={{ flex: 1, minWidth: 110, padding: "10px 14px", background: canExportOfficialDocument ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: canExportOfficialDocument ? "#C8C4BE" : "#555", fontSize: 12, cursor: canExportOfficialDocument ? "pointer" : "not-allowed", fontFamily: "'Lora', Georgia, serif" }}
                                        >
                                            Download PDF
                                        </button>
                                        <button
                                            onClick={() => downloadStyledDocx(currentDoc, exportMeta)}
                                            disabled={!canExportOfficialDocument}
                                            title={!canExportOfficialDocument ? "Legal Business Name is required before export." : undefined}
                                            style={{ flex: 1, minWidth: 120, padding: "10px 14px", background: canExportOfficialDocument ? "rgba(232,98,42,0.08)" : "rgba(255,255,255,0.025)", border: canExportOfficialDocument ? "1px solid rgba(232,98,42,0.2)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: canExportOfficialDocument ? "#E8622A" : "#555", fontSize: 12, cursor: canExportOfficialDocument ? "pointer" : "not-allowed", fontWeight: 600, fontFamily: "'Lora', Georgia, serif" }}
                                        >
                                            Download DOCX
                                        </button>
                                        <button
                                            onClick={() => downloadStyledHtml(currentDoc, exportMeta)}
                                            disabled={!canExportOfficialDocument}
                                            title={!canExportOfficialDocument ? "Legal Business Name is required before export." : undefined}
                                            style={{ flex: 1, minWidth: 110, padding: "10px 14px", background: canExportOfficialDocument ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: canExportOfficialDocument ? "#C8C4BE" : "#555", fontSize: 12, cursor: canExportOfficialDocument ? "pointer" : "not-allowed", fontFamily: "'Lora', Georgia, serif" }}
                                        >
                                            Styled HTML
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* ── REFINE TAB ── */}
                {activeTab === "refine" && (
                    <div style={{ maxWidth: 600, margin: "0 auto" }}>
                        <div style={{ marginBottom: 20, animation: "fadeSlideUp 0.3s ease both" }}>
                            <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 4 }}>Refine your document</div>
                            <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>
                                Give Forge a direction and it will revise the entire document. Your previous version is preserved in history.
                            </div>
                        </div>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, animation: "fadeSlideUp 0.3s ease 0.05s both" }}>
                            {[
                                "Make it more formal",
                                "Make it more persuasive",
                                "Make it shorter",
                                "Expand the market section",
                                "Make it more investor-friendly",
                                "Make it bank-ready",
                                "Add a stronger executive summary",
                                "Make the language more premium",
                                "Make it more concise",
                                "Improve the structure",
                            ].map(chip => (
                                <button
                                    key={chip}
                                    onClick={() => setRefineInput(chip)}
                                    style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", background: refineInput === chip ? "rgba(232,98,42,0.1)" : "rgba(255,255,255,0.02)", color: refineInput === chip ? "#E8622A" : "#666", fontSize: 11, cursor: "pointer", fontFamily: "'Lora', Georgia, serif", transition: "all 0.15s" }}
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>

                        <textarea
                            ref={refineRef}
                            value={refineInput}
                            onChange={e => setRefineInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); refine(); } }}
                            placeholder="Or describe your own refinement instruction..."
                            rows={4}
                            disabled={refining}
                            style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", color: "#F0EDE8", fontSize: 13, fontFamily: "'Lora', Georgia, serif", lineHeight: 1.6, boxSizing: "border-box", opacity: refining ? 0.5 : 1, marginBottom: 10, animation: "fadeSlideUp 0.3s ease 0.1s both" }}
                        />

                        <div style={{ display: "flex", gap: 8, animation: "fadeSlideUp 0.3s ease 0.15s both" }}>
                            <button
                                onClick={() => setActiveTab("preview")}
                                style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#666", fontSize: 13, cursor: "pointer" }}
                            >
                                View Current
                            </button>
                            <button
                                onClick={refine}
                                disabled={!refineInput.trim() || refining}
                                style={{ flex: 2, padding: "12px", background: refineInput.trim() && !refining ? "linear-gradient(135deg, #E8622A, #c9521e)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 10, color: refineInput.trim() && !refining ? "#fff" : "#444", fontSize: 13, fontWeight: 600, cursor: refineInput.trim() && !refining ? "pointer" : "not-allowed", transition: "all 0.15s", fontFamily: "'Lora', Georgia, serif" }}
                            >
                                {refining ? "Refining..." : "Refine Document"}
                            </button>
                        </div>

                        {history.length > 1 && (
                            <div style={{ marginTop: 28 }}>
                                <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Refinement History</div>
                                {history.slice(1).map((rec, i) => (
                                    <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                        <div style={{ fontSize: 12, color: "#666", flex: 1 }}>"{rec.instruction}"</div>
                                        <button
                                            onClick={() => {
                                                setCurrentDoc(rec.doc);
                                                const nextHistory = history.slice(0, i + 2);
                                                setHistory(nextHistory);
                                                persistDocument(rec.doc, nextHistory);
                                            }}
                                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, padding: "3px 10px", color: "#555", fontSize: 10, cursor: "pointer", flexShrink: 0 }}
                                        >
                                            Restore
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ height: 40 }} />
                    </div>
                )}
            </div>
        </div>
    );
}

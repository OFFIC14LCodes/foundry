import { useState, useRef, useEffect } from "react";
import {
    ChartLineUp, Gavel, CurrencyDollar, Bank, ShieldCheck, Handshake,
    Users, TrendUp, Buildings, Shield, Megaphone, Door,
    ArrowLeft, Star, MapPin, MagnifyingGlass,
} from "@phosphor-icons/react";
import { callForgeAPI, streamForgeAPI } from "../lib/forgeApi";
import { buildDocSystemPrompt, buildDocRequest, buildRefinementRequest } from "../constants/docPrompt";
import {
    archiveVaultDocument,
    createDocumentFolder,
    createDocumentSignatureEvent,
    createDocumentSignatureRequest,
    createSignedDocumentFileUrl,
    deleteDocumentFile,
    deleteDocumentFolder,
    loadDocumentFolders,
    loadDocumentSignatureEvents,
    loadDocumentSignatureRequests,
    loadDocumentTemplates,
    loadDocumentVersions,
    loadDocumentFiles,
    loadProducedDocuments,
    loadVaultDocumentById,
    loadVaultDocuments,
    saveGeneratedDocumentArtifact,
    saveProducedDocument,
    restoreVaultDocumentVersion,
    trackProductUsageEvent,
    uploadDocumentFile,
    type DocumentFile,
    type DocumentFolder,
    type DocumentSignatureEvent,
    type DocumentSignatureRequest,
    type DocumentTemplate,
    type DocumentVersion,
    type ProducedDocument,
    type VaultDocument,
    moveDocumentToFolder,
    updateDocumentFolder,
    updateDocumentSignatureRequestStatus,
} from "../db";
import DocumentFieldsForm from "./DocumentFieldsForm";
import {
    DOCUMENT_PREVIEW_CSS,
    applyTypedSignatureToMarkdown,
    buildOfficialTitleBlockHtml,
    downloadStyledDocx,
    downloadStyledHtml,
    markdownToDocumentHtml,
    printStyledPdf,
    sanitizeDocumentMarkdown,
    type DocumentExportMeta,
} from "../lib/documentExport";
import {
    getProviderConfigurationStatus,
    getSignatureProviderAdapter,
    isProviderActive,
    type SignatureProviderId,
} from "../lib/documentSignatureProviders";
import {
    buildDocumentNeedFallbackRecommendations,
    buildDocumentNeedWizardPrompt,
    parseDocumentNeedRecommendationResponse,
    type DocumentNeedGoal,
    type DocumentNeedRecommendationResult,
} from "../lib/documentNeedRecommendations";
import {
    createDocumentInputDefaults,
    computeDocumentCompleteness,
    applyDocumentRequirementDefaults,
    findStructuredDocumentTemplate,
    formatDocumentInputsForPrompt,
    getDocumentRequirement,
    getSuggestedDocumentSettings,
    mergeDocumentTemplateIntoRequirement,
    validateDocumentInputs,
} from "../lib/documentRequirements";
import { formatLegalDate, formatLongDate, getIsoDate } from "../lib/legalDate";
import {
    DOC_CATEGORIES, SMART_PROMPTS, DEFAULT_SMART_PROMPTS,
    type DocCategory, type DocItem,
} from "../constants/docCategories";
import DocumentNeedsWizard from "./document-vault/DocumentNeedsWizard";
import DocumentFilesPanel from "./document-vault/DocumentFilesPanel";
import DocumentSignaturesPanel from "./document-vault/DocumentSignaturesPanel";
import VaultDetailPanel from "./document-vault/VaultDetailPanel";
import VaultDocumentList from "./document-vault/VaultDocumentList";
import VaultFolderSidebar from "./document-vault/VaultFolderSidebar";
import HelpTooltip from "./HelpTooltip";
import {
    DOCUMENT_STATUS_LABELS,
    STAGE_LABELS,
    type FolderFilter,
    type StageFilter,
    type VaultStatusFilter,
} from "./document-vault/shared";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Phase = "categories" | "documents" | "configure" | "studio";
type DocumentSurfaceMode = "vault" | "generate";

interface GenRecord {
    instruction: string;
    doc: string;
}

function ModeTabs({
    mode,
    onChange,
}: {
    mode: DocumentSurfaceMode;
    onChange: (mode: DocumentSurfaceMode) => void;
}) {
    return (
        <div style={{
            display: "flex",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "1px solid rgba(7,26,47,0.05)",
            background: "rgba(255,252,246,0.94)",
            position: "sticky",
            top: 69,
            zIndex: 9,
            backdropFilter: "blur(12px)",
        }}>
            {([
                { id: "vault", label: "Vault" },
                { id: "generate", label: "Generate" },
            ] as const).map((tab) => (
                <button
                    key={tab.id}
                    className="foundry-interactive"
                    onClick={() => onChange(tab.id)}
                    style={{
                        padding: "8px 14px",
                        borderRadius: 999,
                        border: mode === tab.id ? "1px solid rgba(216,155,43,0.28)" : "1px solid rgba(7,26,47,0.08)",
                        background: mode === tab.id ? "rgba(216,155,43,0.1)" : "rgba(7,26,47,0.025)",
                        color: mode === tab.id ? "var(--tekori-gold)" : "var(--color-text-muted)",
                        fontSize: 12,
                        fontWeight: mode === tab.id ? 700 : 500,
                        cursor: "pointer",
                        fontFamily: "var(--tekori-font-ui)",
                    }}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
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

const DOCUMENT_NEED_GOALS: Array<{ id: DocumentNeedGoal; label: string }> = [
    { id: "starting_a_business", label: "Starting a business" },
    { id: "preparing_to_launch", label: "Preparing to launch" },
    { id: "hiring", label: "Hiring" },
    { id: "getting_funding", label: "Getting funding" },
    { id: "working_with_clients", label: "Working with clients" },
    { id: "protecting_ip", label: "Protecting IP" },
    { id: "taxes_finance", label: "Taxes / finance" },
    { id: "other", label: "Other" },
];

// Max tokens for document generation — documents need more space than chat
const DOC_MAX_TOKENS = 4000;

function getCurrentStageId(profile: any) {
    const stage = Number(profile?.currentStage);
    return Number.isFinite(stage) && stage >= 1 && stage <= 6 ? Math.round(stage) : 1;
}

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
                        border: selected === opt ? "1px solid rgba(216,155,43,0.5)" : "1px solid rgba(7,26,47,0.08)",
                        background: selected === opt ? "rgba(216,155,43,0.12)" : "rgba(7,26,47,0.03)",
                        color: selected === opt ? "var(--tekori-gold)" : "var(--color-text-muted)",
                        fontSize: 12,
                        fontWeight: selected === opt ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontFamily: "var(--tekori-font-ui)",
                    }}
                >
                    {opt}
                </button>
            ))}
        </div>
    );
}

function TypedSignaturePanel({
    value,
    onChange,
}: {
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div style={{
            border: "1px solid rgba(48,70,95,0.16)",
            background: "rgba(48,70,95,0.06)",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 12,
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 8 }}>
                <div>
                    <div style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 700 }}>Typed Signature</div>
                    <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", lineHeight: 1.5, marginTop: 2 }}>
                        Local only. This fills the document signature line in a handwriting-style font for preview and export.
                    </div>
                </div>
                <div style={{ fontSize: 10, color: "var(--tekori-slate-navy)", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    Coming soon: e-sign
                </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "center" }}>
                <input
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder="Type legal name to sign"
                    style={{
                        minWidth: 0,
                        width: "100%",
                        background: "rgba(7,26,47,0.045)",
                        border: "1px solid rgba(7,26,47,0.1)",
                        borderRadius: 10,
                        padding: "9px 11px",
                        color: "var(--color-text)",
                        fontSize: 13,
                        outline: "none",
                        boxSizing: "border-box",
                    }}
                />
                <div style={{
                    minWidth: 132,
                    padding: "4px 10px 7px",
                    borderBottom: "1px solid rgba(16,32,51,0.5)",
                    color: value.trim() ? "var(--color-text)" : "rgba(7,26,47,0.42)",
                    fontFamily: "'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive",
                    fontSize: 21,
                    lineHeight: 1.15,
                    whiteSpace: "nowrap",
                    textAlign: "center",
                }}>
                    {value.trim() || "Signature"}
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Shared header component
// ─────────────────────────────────────────────────────────────
function ScreenHeader({
    onBack,
    onOpenNav,
    backLabel,
    title,
    subtitle,
    right,
}: {
    onBack: () => void;
    onOpenNav?: () => void;
    backLabel: string;
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
}) {
    return (
        <div className="foundry-mobile-header-scroll" style={{
            padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px",
            borderBottom: "1px solid rgba(7,26,47,0.05)",
            position: "sticky", top: 0,
            background: "rgba(255,252,246,0.94)", backdropFilter: "blur(12px)", zIndex: 10,
        }}>
            <div style={{ minWidth: "max-content", width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {onOpenNav ? (
                        <button
                            onClick={onOpenNav}
                            style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)",
                                borderRadius: 8, padding: "var(--foundry-app-header-button-padding)", color: "var(--color-text-muted)", cursor: "pointer",
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3.5" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="7.25" width="14" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="11" width="14" height="1.5" rx="0.75" fill="currentColor"/></svg>
                        </button>
                    ) : (
                    <button
                        onClick={onBack}
                        style={{
                            display: "flex", alignItems: "center", gap: 5,
                            background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)",
                            borderRadius: 8, padding: "var(--foundry-app-header-button-padding)", color: "var(--color-text-muted)", fontSize: "var(--foundry-app-header-button-font)", cursor: "pointer",
                            fontFamily: "var(--tekori-font-ui)",
                            flexShrink: 0,
                        }}
                    >
                        <ArrowLeft size={"var(--foundry-app-header-icon-size)"} /> {backLabel}
                    </button>
                    )}
                    <div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <div style={{ fontSize: "var(--foundry-app-header-title-font)", fontFamily: "var(--tekori-font-brand)", fontWeight: 700, lineHeight: 1.2, whiteSpace: "nowrap" }}>{title}</div>
                            {subtitle && <HelpTooltip content={subtitle} side="bottom" />}
                        </div>
                    </div>
                </div>
                {right}
            </div>
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
            fontFamily: "var(--tekori-font-ui)", whiteSpace: "nowrap", flexShrink: 0,
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
            background: "rgba(216,155,43,0.1)", border: "1px solid rgba(216,155,43,0.25)",
            fontSize: 9, color: "var(--tekori-gold)", fontWeight: 600,
            fontFamily: "var(--tekori-font-ui)", whiteSpace: "nowrap", flexShrink: 0,
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
    onOpenNav,
    onContextChange,
    generationLocked = false,
    generationLockMessage = null,
}: {
    userId: string;
    profile: any;
    onBack: () => void;
    onOpenNav?: () => void;
    onContextChange?: (ctx: DocumentScreenContext) => void;
    generationLocked?: boolean;
    generationLockMessage?: string | null;
}) {
    const [surfaceMode, setSurfaceMode] = useState<DocumentSurfaceMode>("vault");

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
    const [typedSignatureName, setTypedSignatureName] = useState("");

    // ── Studio state ─────────────────────────────────────────
    const [currentDoc, setCurrentDoc] = useState("");
    const [generating, setGenerating] = useState(false);
    const [refineInput, setRefineInput] = useState("");
    const [refining, setRefining] = useState(false);
    const [history, setHistory] = useState<GenRecord[]>([]);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<"preview" | "refine">("preview");
    const [documents, setDocuments] = useState<ProducedDocument[]>([]);
    const [documentsLoading, setDocumentsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "unavailable">("idle");
    const [vaultDocuments, setVaultDocuments] = useState<VaultDocument[]>([]);
    const [vaultLoading, setVaultLoading] = useState(true);
    const [vaultError, setVaultError] = useState<string | null>(null);
    const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplate[]>([]);
    const [vaultFolders, setVaultFolders] = useState<DocumentFolder[]>([]);
    const [vaultFoldersLoading, setVaultFoldersLoading] = useState(false);
    const [vaultFoldersError, setVaultFoldersError] = useState<string | null>(null);
    const [vaultFolderFilter, setVaultFolderFilter] = useState<FolderFilter>("all");
    const [newFolderName, setNewFolderName] = useState("");
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [folderActionId, setFolderActionId] = useState<string | null>(null);
    const [vaultSearch, setVaultSearch] = useState("");
    const [vaultStatusFilter, setVaultStatusFilter] = useState<VaultStatusFilter>("active");
    const [vaultStageFilter, setVaultStageFilter] = useState<StageFilter>("all");
    const [vaultCategoryFilter, setVaultCategoryFilter] = useState("all");
    const [catalogSearch, setCatalogSearch] = useState("");
    const [selectedVaultDocumentId, setSelectedVaultDocumentId] = useState<string | null>(null);
    const [selectedVaultDocument, setSelectedVaultDocument] = useState<VaultDocument | null>(null);
    const [vaultDetailLoading, setVaultDetailLoading] = useState(false);
    const [vaultVersions, setVaultVersions] = useState<DocumentVersion[]>([]);
    const [vaultVersionsLoading, setVaultVersionsLoading] = useState(false);
    const [vaultVersionsError, setVaultVersionsError] = useState<string | null>(null);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [archivingDocumentId, setArchivingDocumentId] = useState<string | null>(null);
    const [vaultFiles, setVaultFiles] = useState<DocumentFile[]>([]);
    const [vaultFilesLoading, setVaultFilesLoading] = useState(false);
    const [vaultFilesError, setVaultFilesError] = useState<string | null>(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [fileActionId, setFileActionId] = useState<string | null>(null);
    const [artifactSavingKind, setArtifactSavingKind] = useState<"generated_docx" | "generated_html" | null>(null);
    const [signatureRequests, setSignatureRequests] = useState<DocumentSignatureRequest[]>([]);
    const [signatureRequestsLoading, setSignatureRequestsLoading] = useState(false);
    const [signatureRequestsError, setSignatureRequestsError] = useState<string | null>(null);
    const [selectedSignatureRequestId, setSelectedSignatureRequestId] = useState<string | null>(null);
    const [signatureEvents, setSignatureEvents] = useState<DocumentSignatureEvent[]>([]);
    const [signatureEventsLoading, setSignatureEventsLoading] = useState(false);
    const [signatureEventsError, setSignatureEventsError] = useState<string | null>(null);
    const [signatureSignerName, setSignatureSignerName] = useState("");
    const [signatureSignerEmail, setSignatureSignerEmail] = useState("");
    const [signatureProvider, setSignatureProvider] = useState<SignatureProviderId>(() => {
        // Default to the real active provider when one is configured, so the
        // dropdown does not silently fall back to mock in a production environment.
        const statuses = getProviderConfigurationStatus();
        return statuses.find((p) => p.id !== "mock" && p.availableNow)?.id ?? "mock";
    });
    const [signatureFileId, setSignatureFileId] = useState("none");
    const [signatureVersionId, setSignatureVersionId] = useState("none");
    const [signatureExpiresAt, setSignatureExpiresAt] = useState("");
    const [creatingSignatureRequest, setCreatingSignatureRequest] = useState(false);
    const [signatureActionId, setSignatureActionId] = useState<string | null>(null);
    const [showNeedsWizard, setShowNeedsWizard] = useState(false);
    const [needsEntityType, setNeedsEntityType] = useState(() => String(
        profile?.entityType
        || profile?.businessType
        || profile?.legalStructure
        || ""
    ));
    const [needsState, setNeedsState] = useState(() => String(
        profile?.state
        || profile?.businessState
        || profile?.locationState
        || ""
    ));
    const [needsGoal, setNeedsGoal] = useState<DocumentNeedGoal>("starting_a_business");
    const [needsNotes, setNeedsNotes] = useState("");
    const [needsLoading, setNeedsLoading] = useState(false);
    const [needsError, setNeedsError] = useState<string | null>(null);
    const [needsResult, setNeedsResult] = useState<DocumentNeedRecommendationResult | null>(null);
    const [dismissedRecommendationKeys, setDismissedRecommendationKeys] = useState<string[]>([]);
    const [studioLaunchNotice, setStudioLaunchNotice] = useState<string | null>(null);
    const [movingDocumentId, setMovingDocumentId] = useState<string | null>(null);
    const [vaultHealthSummary, setVaultHealthSummary] = useState<string | null>(null);
    const [vaultHealthLoading, setVaultHealthLoading] = useState(false);
    const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
    const [versionRestoreMessage, setVersionRestoreMessage] = useState<string | null>(null);
    const [legalDisclaimerDismissed, setLegalDisclaimerDismissed] = useState(false);

    const previewRef = useRef<HTMLDivElement>(null);
    const refineRef = useRef<HTMLTextAreaElement>(null);
    const saveStatusResetRef = useRef<number | null>(null);
    const currentDocumentIdRef = useRef<string | null>(null);
    const vaultFileInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const catalogMatches = catalogSearch.trim()
        ? DOC_CATEGORIES.flatMap((category) => (
            category.documents
                .filter((document) => {
                    const query = catalogSearch.trim().toLowerCase();
                    const haystack = [
                        category.name,
                        category.description,
                        document.name,
                        document.whenToUse,
                    ].join(" ").toLowerCase();
                    return haystack.includes(query);
                })
                .map((document) => ({ category, document }))
        ))
        : [];

    useEffect(() => {
        previewRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentDoc]);

    useEffect(() => {
        const selectedVersion = vaultVersions.find((version) => version.id === selectedVersionId) ?? vaultVersions[0] ?? null;
        onContextChange?.({
            phase: surfaceMode === "vault" ? "vault" : phase,
            categoryName: surfaceMode === "vault"
                ? (selectedVaultDocument?.category ?? null)
                : (selectedCategory?.name ?? null),
            documentName: surfaceMode === "vault"
                ? (selectedVaultDocument?.title ?? null)
                : (selectedDoc?.name ?? null),
            documentContent: surfaceMode === "vault"
                ? (selectedVersion?.content ?? null)
                : (currentDoc || null),
        });
    }, [surfaceMode, phase, selectedCategory, selectedDoc, currentDoc, selectedVaultDocument, vaultVersions, selectedVersionId]);

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
        let cancelled = false;
        loadDocumentTemplates().then((templates) => {
            if (!cancelled) setDocumentTemplates(templates);
        }).catch((error) => {
            console.error("loadDocumentTemplates error:", error);
        });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!needsEntityType && (profile?.entityType || profile?.businessType || profile?.legalStructure)) {
            setNeedsEntityType(String(profile.entityType || profile.businessType || profile.legalStructure || ""));
        }
        if (!needsState) {
            const profileState = String(profile?.state || profile?.businessState || profile?.locationState || "");
            if (profileState) {
                setNeedsState(profileState);
                return;
            }
            const documentState = vaultDocuments.find((document) => {
                const metadata = document.metadata && typeof document.metadata === "object" ? document.metadata as Record<string, unknown> : {};
                return typeof metadata.state === "string" && metadata.state.trim().length > 0;
            });
            const metadata = documentState?.metadata && typeof documentState.metadata === "object" ? documentState.metadata as Record<string, unknown> : {};
            if (typeof metadata.state === "string") {
                setNeedsState(metadata.state);
            }
        }
    }, [needsEntityType, needsState, profile, vaultDocuments]);

    useEffect(() => {
        let cancelled = false;
        setVaultFoldersLoading(true);
        setVaultFoldersError(null);
        loadDocumentFolders(userId).then((rows) => {
            if (cancelled) return;
            setVaultFolders(rows);
            if (vaultFolderFilter !== "all" && vaultFolderFilter !== "unfiled" && !rows.some((folder) => folder.id === vaultFolderFilter)) {
                setVaultFolderFilter("all");
            }
        }).catch((error) => {
            if (cancelled) return;
            setVaultFoldersError(error instanceof Error ? error.message : "Failed to load folders.");
        }).finally(() => {
            if (cancelled) return;
            setVaultFoldersLoading(false);
        });
        return () => { cancelled = true; };
    }, [userId]);

    useEffect(() => {
        let cancelled = false;
        setVaultLoading(true);
        setVaultError(null);
        loadVaultDocuments(userId).then((rows) => {
            if (cancelled) return;
            setVaultDocuments(rows);
            if (!selectedVaultDocumentId && rows[0]?.id) {
                setSelectedVaultDocumentId(rows[0].id);
            }
            if (selectedVaultDocumentId && !rows.some((doc) => doc.id === selectedVaultDocumentId)) {
                setSelectedVaultDocumentId(rows[0]?.id ?? null);
            }
        }).catch((error) => {
            if (cancelled) return;
            setVaultError(error instanceof Error ? error.message : "Failed to load vault documents.");
        }).finally(() => {
            if (cancelled) return;
            setVaultLoading(false);
        });
        return () => { cancelled = true; };
    }, [userId]);

    useEffect(() => {
        if (!selectedVaultDocumentId) {
            setSelectedVaultDocument(null);
            setVaultVersions([]);
            setVaultFiles([]);
            setSignatureRequests([]);
            setSelectedVersionId(null);
            setSelectedSignatureRequestId(null);
            setSignatureEvents([]);
            setVaultFilesError(null);
            setSignatureRequestsError(null);
            setSignatureEventsError(null);
            return;
        }

        let cancelled = false;
        setVaultDetailLoading(true);
        setVaultVersionsLoading(true);
        setVaultFilesLoading(true);
        setSignatureRequestsLoading(true);
        setVaultVersionsError(null);
        setVaultFilesError(null);
        setSignatureRequestsError(null);

        Promise.all([
            loadVaultDocumentById(userId, selectedVaultDocumentId),
            loadDocumentVersions(userId, selectedVaultDocumentId),
            loadDocumentFiles(userId, selectedVaultDocumentId),
            loadDocumentSignatureRequests(userId, selectedVaultDocumentId),
        ]).then(([doc, versions, files, requests]) => {
            if (cancelled) return;
            setSelectedVaultDocument(doc);
            setVaultVersions(versions);
            setVaultFiles(files);
            setSignatureRequests(requests);
            setSelectedVersionId((prev) => (
                prev && versions.some((version) => version.id === prev)
                    ? prev
                    : (versions[0]?.id ?? null)
            ));
            setSelectedSignatureRequestId((prev) => (
                prev && requests.some((request) => request.id === prev)
                    ? prev
                    : (requests[0]?.id ?? null)
            ));
        }).catch((error) => {
            if (cancelled) return;
            setVaultVersionsError(error instanceof Error ? error.message : "Failed to load document detail.");
            setVaultFilesError(error instanceof Error ? error.message : "Failed to load document files.");
            setSignatureRequestsError(error instanceof Error ? error.message : "Failed to load signature requests.");
        }).finally(() => {
            if (cancelled) return;
            setVaultDetailLoading(false);
            setVaultVersionsLoading(false);
            setVaultFilesLoading(false);
            setSignatureRequestsLoading(false);
        });

        return () => { cancelled = true; };
    }, [userId, selectedVaultDocumentId]);

    useEffect(() => {
        if (!selectedSignatureRequestId) {
            setSignatureEvents([]);
            setSignatureEventsError(null);
            return;
        }

        let cancelled = false;
        setSignatureEventsLoading(true);
        setSignatureEventsError(null);
        loadDocumentSignatureEvents(userId, selectedSignatureRequestId).then((rows) => {
            if (cancelled) return;
            setSignatureEvents(rows);
        }).catch((error) => {
            if (cancelled) return;
            setSignatureEventsError(error instanceof Error ? error.message : "Failed to load signature events.");
        }).finally(() => {
            if (cancelled) return;
            setSignatureEventsLoading(false);
        });

        return () => { cancelled = true; };
    }, [userId, selectedSignatureRequestId]);

    useEffect(() => {
        return () => {
            if (saveStatusResetRef.current) window.clearTimeout(saveStatusResetRef.current);
        };
    }, []);

    useEffect(() => {
        setLegalDisclaimerDismissed(false);
        setVersionRestoreMessage(null);
    }, [selectedVaultDocumentId]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (
                surfaceMode === "vault"
                && e.key === "/"
                && document.activeElement?.tagName !== "INPUT"
                && document.activeElement?.tagName !== "TEXTAREA"
            ) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [surfaceMode]);

    const upsertDocumentList = (saved: ProducedDocument) => {
        setDocuments(prev => [saved, ...prev.filter(doc => doc.id !== saved.id)]);
    };

    const getDocTitle = (content: string, fallback = docType) => {
        return content.split("\n")[0].replace(/^#+\s*/, "").trim() || fallback;
    };

    const setActiveDocumentId = (id: string | null) => {
        currentDocumentIdRef.current = id;
    };

    const persistDocument = async (content: string, nextHistory: GenRecord[], existingId = currentDocumentIdRef.current) => {
        if (!content.trim()) return null;
        setSaveStatus("saving");
        const completeness = currentRequirement ? computeDocumentCompleteness(currentRequirement, docInputs) : null;
        const templateMetadata = currentTemplate ? {
            templateDocumentType: currentTemplate.documentType,
            templateId: currentTemplate.id,
        } : {};
        const saved = await saveProducedDocument(userId, {
            id: existingId,
            title: getDocTitle(content),
            docType,
            audience,
            tone,
            request,
            content,
            history: nextHistory,
        }, {
            fallbackStageId: currentStageId,
            metadata: {
                ...templateMetadata,
                businessName: businessName || undefined,
                state: docState || docInputs.jurisdictionState || undefined,
                documentHealthScore: completeness ? {
                    score: completeness.score,
                    filledRequired: completeness.filledRequired,
                    totalRequired: completeness.totalRequired,
                    computedAt: new Date().toISOString(),
                } : undefined,
            },
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
        refreshVaultDocuments();
        return saved;
    };

    const openSavedDocument = (doc: ProducedDocument) => {
        setSurfaceMode("generate");
        setStudioLaunchNotice(null);
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

    const refreshVaultDocuments = async (preferredDocumentId?: string | null) => {
        setVaultLoading(true);
        setVaultError(null);
        try {
            const rows = await loadVaultDocuments(userId);
            setVaultDocuments(rows);
            if (preferredDocumentId) {
                setSelectedVaultDocumentId(preferredDocumentId);
            } else if (!selectedVaultDocumentId && rows[0]?.id) {
                setSelectedVaultDocumentId(rows[0].id);
            } else if (selectedVaultDocumentId && !rows.some((doc) => doc.id === selectedVaultDocumentId)) {
                setSelectedVaultDocumentId(rows[0]?.id ?? null);
            }
        } catch (error) {
            setVaultError(error instanceof Error ? error.message : "Failed to load vault documents.");
        } finally {
            setVaultLoading(false);
        }
    };

    const refreshVaultFolders = async () => {
        setVaultFoldersLoading(true);
        setVaultFoldersError(null);
        try {
            const rows = await loadDocumentFolders(userId);
            setVaultFolders(rows);
            if (vaultFolderFilter !== "all" && vaultFolderFilter !== "unfiled" && !rows.some((folder) => folder.id === vaultFolderFilter)) {
                setVaultFolderFilter("all");
            }
        } catch (error) {
            setVaultFoldersError(error instanceof Error ? error.message : "Failed to load folders.");
        } finally {
            setVaultFoldersLoading(false);
        }
    };

    const refreshVaultFiles = async (documentId?: string | null) => {
        const targetDocumentId = documentId ?? selectedVaultDocumentId;
        if (!targetDocumentId) {
            setVaultFiles([]);
            return;
        }
        setVaultFilesLoading(true);
        setVaultFilesError(null);
        try {
            const rows = await loadDocumentFiles(userId, targetDocumentId);
            setVaultFiles(rows);
        } catch (error) {
            setVaultFilesError(error instanceof Error ? error.message : "Failed to load document files.");
        } finally {
            setVaultFilesLoading(false);
        }
    };

    const refreshSignatureRequests = async (documentId?: string | null) => {
        const targetDocumentId = documentId ?? selectedVaultDocumentId;
        if (!targetDocumentId) {
            setSignatureRequests([]);
            return;
        }
        setSignatureRequestsLoading(true);
        setSignatureRequestsError(null);
        try {
            const rows = await loadDocumentSignatureRequests(userId, targetDocumentId);
            setSignatureRequests(rows);
            setSelectedSignatureRequestId((prev) => (
                prev && rows.some((request) => request.id === prev)
                    ? prev
                    : (rows[0]?.id ?? null)
            ));
        } catch (error) {
            setSignatureRequestsError(error instanceof Error ? error.message : "Failed to load signature requests.");
        } finally {
            setSignatureRequestsLoading(false);
        }
    };

    const refreshSignatureEvents = async (requestId?: string | null) => {
        const targetRequestId = requestId ?? selectedSignatureRequestId;
        if (!targetRequestId) {
            setSignatureEvents([]);
            return;
        }
        setSignatureEventsLoading(true);
        setSignatureEventsError(null);
        try {
            const rows = await loadDocumentSignatureEvents(userId, targetRequestId);
            setSignatureEvents(rows);
        } catch (error) {
            setSignatureEventsError(error instanceof Error ? error.message : "Failed to load signature events.");
        } finally {
            setSignatureEventsLoading(false);
        }
    };

    const openVaultVersionInStudio = (vaultDoc: VaultDocument, version?: DocumentVersion | null) => {
        const activeVersion = version ?? vaultVersions.find((entry) => entry.id === selectedVersionId) ?? vaultVersions[0] ?? null;
        if (!activeVersion) return;

        setSurfaceMode("generate");
        setDocType(vaultDoc.docType);
        setAudience(vaultDoc.audience || "General");
        setTone(vaultDoc.tone || "Professional");
        setRequest("");
        setDocState("");
        setCurrentDoc(activeVersion.content);
        setHistory([{ instruction: activeVersion.changeSummary || activeVersion.source, doc: activeVersion.content }]);
        setPhase("studio");
        setActiveTab("preview");
        setSaveStatus("idle");
        setStudioLaunchNotice(
            activeVersion.id === vaultVersions[0]?.id
                ? "Opened the latest vault snapshot in Studio. Refining here will create a new saved document instead of overwriting the vault record."
                : `Opened Version ${activeVersion.versionNumber} from vault history. Refining here will create a new saved document instead of overwriting the current vault record.`
        );

        const linkedProducedDocument = vaultDoc.sourceProducedDocumentId
            ? documents.find((doc) => doc.id === vaultDoc.sourceProducedDocumentId) ?? null
            : null;
        setActiveDocumentId(null);
        if (linkedProducedDocument) {
            setRequest(linkedProducedDocument.request ?? "");
        }
    };

    const handleArchiveVaultDocument = async (documentId: string) => {
        const confirmed = window.confirm("Archive this document? It will be hidden from the default vault view but kept in your history.");
        if (!confirmed) return;
        setArchivingDocumentId(documentId);
        try {
            const updated = await archiveVaultDocument(userId, documentId);
            if (!updated) {
                setVaultError("Unable to archive that document right now.");
                return;
            }
            await refreshVaultDocuments();
            if (selectedVaultDocument?.id === updated.id && vaultStatusFilter === "active") {
                setSelectedVaultDocument(null);
                setSelectedVaultDocumentId(null);
            } else if (selectedVaultDocument?.id === updated.id) {
                setSelectedVaultDocument(updated);
            }
        } finally {
            setArchivingDocumentId(null);
        }
    };

    const handleCreateFolder = async () => {
        const trimmed = newFolderName.trim();
        if (!trimmed) return;
        setCreatingFolder(true);
        setVaultFoldersError(null);
        try {
            const created = await createDocumentFolder(userId, trimmed);
            if (!created) {
                setVaultFoldersError("Unable to create that folder right now.");
                return;
            }
            setVaultFolders((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
            setNewFolderName("");
            setVaultFolderFilter(created.id);
        } finally {
            setCreatingFolder(false);
        }
    };

    const handleRenameFolder = async (folder: DocumentFolder) => {
        const nextName = window.prompt("Rename folder", folder.name)?.trim();
        if (!nextName || nextName === folder.name) return;
        setFolderActionId(folder.id);
        setVaultFoldersError(null);
        try {
            const updated = await updateDocumentFolder(userId, folder.id, { name: nextName });
            if (!updated) {
                setVaultFoldersError("Unable to rename that folder right now.");
                return;
            }
            setVaultFolders((prev) => prev.map((entry) => entry.id === updated.id ? updated : entry).sort((a, b) => a.name.localeCompare(b.name)));
        } finally {
            setFolderActionId(null);
        }
    };

    const handleDeleteFolder = async (folder: DocumentFolder) => {
        const confirmed = window.confirm(`Delete "${folder.name}"? Documents inside it will move back to Unfiled.`);
        if (!confirmed) return;
        setFolderActionId(folder.id);
        setVaultFoldersError(null);
        try {
            const deleted = await deleteDocumentFolder(userId, folder.id);
            if (!deleted) {
                setVaultFoldersError("Unable to delete that folder right now.");
                return;
            }
            setVaultFolders((prev) => prev.filter((entry) => entry.id !== folder.id));
            setVaultDocuments((prev) => prev.map((document) => document.folderId === folder.id ? { ...document, folderId: null } : document));
            if (selectedVaultDocument?.folderId === folder.id) {
                setSelectedVaultDocument({ ...selectedVaultDocument, folderId: null });
            }
            if (vaultFolderFilter === folder.id) {
                setVaultFolderFilter("unfiled");
            }
        } finally {
            setFolderActionId(null);
        }
    };

    const handleMoveDocumentToFolder = async (documentId: string, folderId: string | null) => {
        setMovingDocumentId(documentId);
        setVaultError(null);
        try {
            const updated = await moveDocumentToFolder(userId, documentId, folderId);
            if (!updated) {
                setVaultError("Unable to move that document right now.");
                return;
            }
            setVaultDocuments((prev) => prev.map((document) => document.id === updated.id ? updated : document));
            if (selectedVaultDocument?.id === updated.id) {
                setSelectedVaultDocument(updated);
            }
        } finally {
            setMovingDocumentId(null);
        }
    };

    const handleRestoreVaultVersion = async (version: DocumentVersion) => {
        if (!effectiveSelectedVaultDocument) return;
        setRestoringVersionId(version.id);
        setVersionRestoreMessage(null);
        try {
            const restored = await restoreVaultDocumentVersion(userId, effectiveSelectedVaultDocument.id, version.id);
            if (!restored) {
                setVaultVersionsError("Unable to restore that version right now.");
                return;
            }
            const versions = await loadDocumentVersions(userId, effectiveSelectedVaultDocument.id);
            setVaultVersions(versions);
            setSelectedVersionId(restored.id);
            await refreshVaultDocuments(effectiveSelectedVaultDocument.id);
            setVersionRestoreMessage(`Version ${version.versionNumber} restored as the latest version`);
        } finally {
            setRestoringVersionId(null);
        }
    };

    const handleOpenVaultFile = async (fileId: string) => {
        setFileActionId(fileId);
        try {
            const signedUrl = await createSignedDocumentFileUrl(userId, fileId);
            if (!signedUrl) {
                setVaultFilesError("Unable to open that file right now.");
                return;
            }
            window.open(signedUrl, "_blank", "noopener,noreferrer");
        } finally {
            setFileActionId(null);
        }
    };

    const handleDeleteVaultFile = async (fileId: string) => {
        setFileActionId(fileId);
        try {
            const deleted = await deleteDocumentFile(userId, fileId);
            if (!deleted) {
                setVaultFilesError("Unable to delete that file right now.");
                return;
            }
            setVaultFiles((prev) => prev.filter((file) => file.id !== fileId));
        } finally {
            setFileActionId(null);
        }
    };

    const handleUploadVaultAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || !selectedVaultDocumentId) return;

        setUploadingFile(true);
        setVaultFilesError(null);
        try {
            const uploaded = await uploadDocumentFile(userId, selectedVaultDocumentId, file, {
                versionId: selectedVaultVersion?.id ?? effectiveSelectedVaultDocument?.currentVersionId ?? null,
                fileKind: "attachment",
                metadata: {
                    uploadedFrom: "vault_panel",
                },
            });
            if (!uploaded) {
                setVaultFilesError("Unable to upload that file right now.");
                return;
            }
            setVaultFiles((prev) => [uploaded, ...prev]);
        } finally {
            setUploadingFile(false);
        }
    };

    const handleSaveVaultArtifact = async (fileKind: "generated_docx" | "generated_html") => {
        if (!effectiveSelectedVaultDocument || !signedLatestVaultContent) return;

        setArtifactSavingKind(fileKind);
        setVaultFilesError(null);
        try {
            const saved = await saveGeneratedDocumentArtifact(
                userId,
                effectiveSelectedVaultDocument.id,
                selectedVaultVersion?.id ?? effectiveSelectedVaultDocument.currentVersionId ?? null,
                signedLatestVaultContent,
                fileKind,
                {
                    exportMeta: latestVaultMeta,
                    metadata: {
                        versionNumber: selectedVaultVersion?.versionNumber ?? null,
                        source: selectedVaultVersion?.source ?? null,
                    },
                },
            );
            if (!saved) {
                setVaultFilesError(fileKind === "generated_docx"
                    ? "Unable to save the DOCX artifact right now."
                    : "Unable to save the HTML artifact right now.");
                return;
            }
            setVaultFiles((prev) => [saved, ...prev.filter((file) => file.id !== saved.id)]);
        } finally {
            setArtifactSavingKind(null);
        }
    };

    const handleCreateSignatureRequest = async () => {
        if (!effectiveSelectedVaultDocument) return;
        if (!signatureSignerName.trim() || !signatureSignerEmail.trim()) {
            setSignatureRequestsError("Signer name and email are required.");
            return;
        }

        // Helper: reset to the real provider when one is active, else mock.
        const resetProvider = () => {
            const next = getProviderConfigurationStatus().find((p) => p.id !== "mock" && p.availableNow)?.id ?? "mock";
            setSignatureProvider(next);
        };

        setCreatingSignatureRequest(true);
        setSignatureRequestsError(null);
        try {
            if (signatureProvider === "mock") {
                // ── Mock path: local DB-only flow for development ──────────
                const created = await createDocumentSignatureRequest(userId, {
                    documentId: effectiveSelectedVaultDocument.id,
                    versionId: signatureVersionId !== "none" ? signatureVersionId : (selectedVaultVersion?.id ?? effectiveSelectedVaultDocument.currentVersionId ?? null),
                    fileId: signatureFileId !== "none" ? signatureFileId : null,
                    provider: "mock",
                    signerName: signatureSignerName.trim(),
                    signerEmail: signatureSignerEmail.trim(),
                    status: "draft",
                    expiresAt: signatureExpiresAt || null,
                    metadata: { createdFrom: "vault_signature_panel" },
                });
                if (!created) {
                    setSignatureRequestsError("Unable to create a signature request right now.");
                    return;
                }
                await createDocumentSignatureEvent(userId, created.id, {
                    documentId: effectiveSelectedVaultDocument.id,
                    provider: created.provider,
                    eventType: "request_created",
                    eventStatus: created.status,
                    payload: {
                        signerName: created.signerName,
                        signerEmail: created.signerEmail,
                        fileId: created.fileId,
                        versionId: created.versionId,
                    },
                });
                setSignatureSignerName("");
                setSignatureSignerEmail("");
                resetProvider();
                setSignatureFileId("none");
                setSignatureVersionId("none");
                setSignatureExpiresAt("");
                await refreshSignatureRequests(effectiveSelectedVaultDocument.id);
                setSelectedSignatureRequestId(created.id);
                await refreshSignatureEvents(created.id);
                await refreshVaultDocuments(effectiveSelectedVaultDocument.id);
                return;
            }

            // ── Real provider path: call via Edge Function adapter ─────────
            if (!isProviderActive(signatureProvider)) {
                setSignatureRequestsError(
                    `Provider "${signatureProvider}" is not active. Set VITE_SIGNATURE_PROVIDER=${signatureProvider} in your .env to activate it.`
                );
                return;
            }

            const adapter = getSignatureProviderAdapter(signatureProvider);
            const result = await adapter.createSignatureRequest({
                requestId: crypto.randomUUID(),
                documentId: effectiveSelectedVaultDocument.id,
                versionId: signatureVersionId !== "none" ? signatureVersionId : (selectedVaultVersion?.id ?? effectiveSelectedVaultDocument.currentVersionId ?? null),
                fileId: signatureFileId !== "none" ? signatureFileId : null,
                signerName: signatureSignerName.trim(),
                signerEmail: signatureSignerEmail.trim(),
                metadata: { createdFrom: "vault_signature_panel" },
            });

            if (!result.ok) {
                setSignatureRequestsError(
                    result.error?.message ?? `Failed to create signature request via ${signatureProvider}.`
                );
                return;
            }

            const signatureRequestId = result.metadata?.signatureRequestId as string | null;
            if (!signatureRequestId) {
                setSignatureRequestsError("Provider returned success but did not supply a signature request ID. Check Edge Function logs.");
                return;
            }

            // Record a local creation event so the timeline is populated.
            await createDocumentSignatureEvent(userId, signatureRequestId, {
                documentId: effectiveSelectedVaultDocument.id,
                provider: signatureProvider,
                eventType: "request_created",
                eventStatus: result.status ?? "draft",
                payload: {
                    signerName: signatureSignerName.trim(),
                    signerEmail: signatureSignerEmail.trim(),
                    fileId: signatureFileId !== "none" ? signatureFileId : null,
                    versionId: signatureVersionId !== "none" ? signatureVersionId : null,
                    providerRequestId: result.providerRequestId,
                    _mock: result.metadata?._mock,
                },
            });

            setSignatureSignerName("");
            setSignatureSignerEmail("");
            resetProvider();
            setSignatureFileId("none");
            setSignatureVersionId("none");
            setSignatureExpiresAt("");
            await refreshSignatureRequests(effectiveSelectedVaultDocument.id);
            setSelectedSignatureRequestId(signatureRequestId);
            await refreshSignatureEvents(signatureRequestId);
            await refreshVaultDocuments(effectiveSelectedVaultDocument.id);
        } finally {
            setCreatingSignatureRequest(false);
        }
    };

    const handleSignatureStatusAction = async (
        request: DocumentSignatureRequest,
        status: SignatureRequestStatus,
        eventType: string,
    ) => {
        setSignatureActionId(request.id);
        setSignatureRequestsError(null);
        try {
            const updated = await updateDocumentSignatureRequestStatus(userId, request.id, status, {
                mockLifecycle: true,
                lastAction: eventType,
            });
            if (!updated) {
                setSignatureRequestsError("Unable to update that signature request right now.");
                return;
            }
            await createDocumentSignatureEvent(userId, request.id, {
                documentId: request.documentId,
                provider: updated.provider,
                eventType,
                eventStatus: status,
                payload: {
                    signerName: updated.signerName,
                    signerEmail: updated.signerEmail,
                    fileId: updated.fileId,
                    versionId: updated.versionId,
                },
            });
            setSignatureRequests((prev) => prev.map((entry) => entry.id === updated.id ? updated : entry));
            await refreshSignatureEvents(updated.id);
            await refreshVaultDocuments(request.documentId);
            if (selectedVaultDocumentId === request.documentId) {
                const refreshed = await loadVaultDocumentById(userId, request.documentId);
                if (refreshed) setSelectedVaultDocument(refreshed);
            }
        } finally {
            setSignatureActionId(null);
        }
    };

    const openTemplateInGenerate = (categoryId: string, documentId: string) => {
        const category = DOC_CATEGORIES.find((entry) => entry.id === categoryId);
        const document = category?.documents.find((entry) => entry.id === documentId);
        if (!category || !document) return;
        setSurfaceMode("generate");
        setShowNeedsWizard(false);
        setNeedsError(null);
        setSelectedCategory(category);
        setSelectedDoc(document);
        setDocType(document.name);
        const suggested = getSuggestedDocumentSettings(document, category);
        setAudience(suggested.audience);
        setTone(suggested.tone);
        setRequest("");
        setDocState("");
        setDocInputs(createDocumentInputDefaults(document, category, profile));
        setAutoFillCurrentDate(true);
        setShowValidation(false);
        setPhase("configure");
        window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
    };

    const handleReviewExistingRecommendation = (documentId: string | null) => {
        if (!documentId) return;
        const document = vaultDocuments.find((entry) => entry.id === documentId) ?? null;
        if (document?.status === "archived") {
            setVaultStatusFilter("all");
        }
        setSurfaceMode("vault");
        setShowNeedsWizard(false);
        setSelectedVaultDocumentId(documentId);
    };

    const handleDismissRecommendation = (key: string) => {
        setDismissedRecommendationKeys((prev) => prev.includes(key) ? prev : [...prev, key]);
    };

    const runNeedsWizard = async () => {
        const wizardInput = {
            entityType: needsEntityType.trim(),
            state: needsState.trim(),
            currentStage: Math.max(1, Number(profile?.currentStage) || 1),
            goal: needsGoal,
            notes: needsNotes.trim(),
            businessName: profile?.businessName || profile?.idea || "",
            industry: profile?.industry || "",
        };

        setNeedsLoading(true);
        setNeedsError(null);
        setDismissedRecommendationKeys([]);
        void trackProductUsageEvent(userId, "document_vault", "needs_wizard_run", {
            goal: wizardInput.goal,
            stage: wizardInput.currentStage,
            entityType: wizardInput.entityType || null,
            state: wizardInput.state || null,
            vaultDocumentCount: vaultDocuments.length,
        });
        try {
            const prompt = buildDocumentNeedWizardPrompt(wizardInput, vaultDocuments);
            const raw = await callForgeAPI(
                [{ role: "user", content: prompt }],
                "Return JSON only. Do not add markdown fences. Do not give legal or tax advice. Identify common founder documents only.",
                1800
            );
            const parsed = parseDocumentNeedRecommendationResponse(raw, wizardInput, vaultDocuments);
            if (parsed) {
                setNeedsResult(parsed);
            } else {
                setNeedsResult(buildDocumentNeedFallbackRecommendations(wizardInput, vaultDocuments));
            }
        } catch {
            setNeedsResult(buildDocumentNeedFallbackRecommendations(wizardInput, vaultDocuments));
            setNeedsError("Navi could not finish the recommendation pass, so Tekori used its built-in document checklist instead.");
        } finally {
            setNeedsLoading(false);
        }
    };

    // ── Navigate to a category ───────────────────────────────
    const selectCategory = (cat: DocCategory) => {
        setSelectedCategory(cat);
        setPhase("documents");
    };

    // ── Navigate to a document's config ─────────────────────
    const selectDoc = (doc: DocItem, categoryOverride?: DocCategory | null) => {
        const activeCategory = categoryOverride ?? selectedCategory;
        setSelectedDoc(doc);
        setDocType(doc.name);
        setRequest("");
        setDocState("");
        if (activeCategory) {
            if (categoryOverride) setSelectedCategory(activeCategory);
            const suggested = getSuggestedDocumentSettings(doc, activeCategory);
            const template = findStructuredDocumentTemplate(doc.name, documentTemplates);
            const requirement = mergeDocumentTemplateIntoRequirement(getDocumentRequirement(doc, activeCategory), template);
            setAudience(suggested.audience);
            setTone(suggested.tone);
            setDocInputs(applyDocumentRequirementDefaults(requirement, createDocumentInputDefaults(doc, activeCategory, profile)));
        }
        setAutoFillCurrentDate(true);
        setShowValidation(false);
        setPhase("configure");
    };

    // ── Generate document ────────────────────────────────────
    const generate = async () => {
        if (generating || generationLocked) return;
        setStudioLaunchNotice(null);
        const template = findStructuredDocumentTemplate(docType || selectedDoc?.name || "", documentTemplates);
        const requirement = selectedDoc && selectedCategory
            ? mergeDocumentTemplateIntoRequirement(getDocumentRequirement(selectedDoc, selectedCategory), template)
            : null;
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
            [useCaseContext, structuredInputs].filter(Boolean).join("\n\n"),
            template ? {
                documentType: template.documentType,
                clauseGuidelines: template.clauseGuidelines,
                jurisdictionNotes: template.jurisdictionNotes,
                requiredFields: template.requiredFields,
            } : null,
        );

        const genController = new AbortController();
        const genTimeout = setTimeout(() => genController.abort(), 90000);
        let streamedDraft = "";
        try {
            const final = await streamForgeAPI(
                [{ role: "user", content: userContent }],
                systemPrompt,
                (chunk) => {
                    streamedDraft = chunk;
                    setCurrentDoc(chunk);
                },
                DOC_MAX_TOKENS,
                genController.signal
            );
            clearTimeout(genTimeout);
            const safeFinal = sanitizeDocumentMarkdown(final, {
                ...exportMeta,
                title: getDocTitle(final),
                legalDate: formatLegalDate(docInputs.documentDate || getIsoDate()),
            });
            const nextHistory = [{ instruction: userContent, doc: safeFinal }];
            setCurrentDoc(safeFinal);
            setHistory(nextHistory);
            await persistDocument(safeFinal, nextHistory, null);
        } catch (err) {
            clearTimeout(genTimeout);
            const isTimeout = err instanceof Error && err.name === "AbortError";
            const interruptedDraft = streamedDraft.trim();
            if (interruptedDraft) {
                const safePartial = sanitizeDocumentMarkdown(interruptedDraft, {
                    ...exportMeta,
                    title: getDocTitle(interruptedDraft),
                    legalDate: formatLegalDate(docInputs.documentDate || getIsoDate()),
                });
                const nextHistory = [{
                    instruction: `${userContent}\n\n[Generation interrupted before Navi finished.]`,
                    doc: safePartial,
                }];
                setCurrentDoc(safePartial);
                setHistory(nextHistory);
                await persistDocument(safePartial, nextHistory, null);
                setStudioLaunchNotice(
                    isTimeout
                        ? "Navi timed out before finishing, but your partial draft was preserved and saved. You can copy, download, or refine it from here."
                        : "Navi stopped before finishing, but your partial draft was preserved and saved. You can copy, download, or refine it from here."
                );
            } else {
                setCurrentDoc("");
                setStudioLaunchNotice(
                    isTimeout
                        ? "Navi timed out before any draft text came back. Your setup details are still here; go back and try again with a narrower request."
                        : "Navi could not generate this document. Your setup details are still here; go back and try again or adjust your request."
                );
            }
        }
        setGenerating(false);
    };

    // ── Refine document ──────────────────────────────────────
    const refine = async () => {
        if (!refineInput.trim() || refining || generating) return;
        setStudioLaunchNotice(null);
        const instruction = refineInput.trim();
        setRefineInput("");
        setRefining(true);
        setActiveTab("preview");

        const systemPrompt = buildDocSystemPrompt(profile);
        const userContent = buildRefinementRequest(currentDoc, instruction);

        const refineController = new AbortController();
        const refineTimeout = setTimeout(() => refineController.abort(), 90000);
        const previousDoc = currentDoc;
        let streamedRevision = "";
        try {
            const final = await streamForgeAPI(
                [{ role: "user", content: userContent }],
                systemPrompt,
                (chunk) => {
                    streamedRevision = chunk;
                    setCurrentDoc(chunk);
                },
                DOC_MAX_TOKENS,
                refineController.signal
            );
            clearTimeout(refineTimeout);
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
        } catch (err) {
            clearTimeout(refineTimeout);
            const isTimeout = err instanceof Error && err.name === "AbortError";
            const interruptedRevision = streamedRevision.trim();
            if (interruptedRevision) {
                const safePartial = sanitizeDocumentMarkdown(interruptedRevision, {
                    ...exportMeta,
                    title: getDocTitle(interruptedRevision),
                    legalDate: formatLegalDate(docInputs.documentDate || getIsoDate()),
                });
                const nextHistory = [...history, {
                    instruction: `${instruction}\n\n[Refinement interrupted before Navi finished.]`,
                    doc: safePartial,
                }];
                setCurrentDoc(safePartial);
                setHistory(nextHistory);
                const savedId = currentDocumentIdRef.current;
                await persistDocument(safePartial, nextHistory, savedId);
                setStudioLaunchNotice(
                    isTimeout
                        ? "Navi timed out during refinement, but the partial revision was preserved and saved. Your previous version is still in refinement history."
                        : "Navi stopped during refinement, but the partial revision was preserved and saved. Your previous version is still in refinement history."
                );
            } else {
                setCurrentDoc(previousDoc);
                setStudioLaunchNotice(
                    isTimeout
                        ? "Navi timed out before producing a revision. Your previous document was preserved."
                        : "Navi could not complete the refinement. Your previous document was preserved."
                );
            }
        }
        setRefining(false);
    };

    const resetToCategories = () => {
        setStudioLaunchNotice(null);
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
        const copyText = typedSignatureName.trim()
            ? signedCurrentDoc.replace(/FOUNDRY_TYPED_SIGNATURE:\S+/g, typedSignatureName.trim())
            : currentDoc;
        const ok = await copyToClipboard(copyText);
        if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    };

    const docTitle = currentDoc.split("\n")[0].replace(/^#+\s*/, "").trim() || docType;
    const businessName = String(docInputs.legalBusinessName || "").trim();
    const todayIso = getIsoDate();
    const effectiveDocumentDate = docInputs.documentDate || todayIso;
    const todayDate = formatLongDate(effectiveDocumentDate);
    const currentTemplate = findStructuredDocumentTemplate(docType || selectedDoc?.name || "", documentTemplates);
    const currentRequirement = selectedDoc && selectedCategory
        ? mergeDocumentTemplateIntoRequirement(getDocumentRequirement(selectedDoc, selectedCategory), currentTemplate)
        : null;
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
    const signatureDateLabel = formatLongDate(docInputs.signatureDate || effectiveDocumentDate);
    const signedCurrentDoc = typedSignatureName.trim()
        ? applyTypedSignatureToMarkdown(currentDoc, typedSignatureName, signatureDateLabel)
        : currentDoc;
    const saveLabel = saveStatus === "saving"
        ? "Saving..."
        : saveStatus === "saved"
            ? "Saved"
            : saveStatus === "unavailable"
                ? "Save unavailable"
                : "";
    const currentStageId = getCurrentStageId(profile);
    const currentStageLabel = STAGE_LABELS[currentStageId] ?? "Idea";
    const folderNameById = new Map(vaultFolders.map((folder) => [folder.id, folder.name]));
    const folderNameByIdRecord = Object.fromEntries(vaultFolders.map((folder) => [folder.id, folder.name])) as Record<string, string>;
    const vaultCategories = Array.from(new Set(vaultDocuments.map((doc) => doc.category || doc.docType).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const filteredVaultDocuments = vaultDocuments.filter((doc) => {
        const searchValue = vaultSearch.trim().toLowerCase();
        const matchesSearch = !searchValue
            || doc.title.toLowerCase().includes(searchValue)
            || doc.docType.toLowerCase().includes(searchValue)
            || (doc.category || "").toLowerCase().includes(searchValue)
            || (doc.folderId ? (folderNameById.get(doc.folderId) || "").toLowerCase().includes(searchValue) : false);
        const matchesStatus = vaultStatusFilter === "all"
            ? true
            : vaultStatusFilter === "active"
                ? doc.status !== "archived"
                : doc.status === vaultStatusFilter;
        const categoryValue = doc.category || doc.docType;
        const matchesCategory = vaultCategoryFilter === "all" || categoryValue === vaultCategoryFilter;
        const matchesStage = vaultStageFilter === "all" || doc.stageId === Number(vaultStageFilter);
        const matchesFolder = vaultFolderFilter === "all"
            ? true
            : vaultFolderFilter === "unfiled"
                ? !doc.folderId
                : doc.folderId === vaultFolderFilter;
        return matchesSearch && matchesStatus && matchesCategory && matchesStage && matchesFolder;
    });
    const effectiveSelectedVaultDocument = selectedVaultDocumentId
        ? filteredVaultDocuments.find((doc) => doc.id === selectedVaultDocumentId) ?? selectedVaultDocument
        : selectedVaultDocument;
    const selectedVaultVersion = vaultVersions.find((version) => version.id === selectedVersionId) ?? vaultVersions[0] ?? null;
    const selectedSignatureRequest = signatureRequests.find((request) => request.id === selectedSignatureRequestId) ?? signatureRequests[0] ?? null;
    const selectedSignatureFile = selectedSignatureRequest?.fileId
        ? vaultFiles.find((file) => file.id === selectedSignatureRequest.fileId) ?? null
        : null;
    const selectedSignatureVersion = selectedSignatureRequest?.versionId
        ? vaultVersions.find((version) => version.id === selectedSignatureRequest.versionId) ?? null
        : null;
    const linkedProducedDocumentForVault = effectiveSelectedVaultDocument?.sourceProducedDocumentId
        ? documents.find((document) => document.id === effectiveSelectedVaultDocument.sourceProducedDocumentId) ?? null
        : null;
    const selectedVaultMetadata = effectiveSelectedVaultDocument?.metadata && typeof effectiveSelectedVaultDocument.metadata === "object"
        ? effectiveSelectedVaultDocument.metadata as Record<string, unknown>
        : {};
    const providerConfigurationStatus = getProviderConfigurationStatus();
    const visibleNeedsResult = needsResult ? {
        ...needsResult,
        mustHave: needsResult.mustHave.filter((item) => !dismissedRecommendationKeys.includes(item.key)),
        shouldHave: needsResult.shouldHave.filter((item) => !dismissedRecommendationKeys.includes(item.key)),
        optionalFuture: needsResult.optionalFuture.filter((item) => !dismissedRecommendationKeys.includes(item.key)),
    } : null;
    const latestVaultContent = selectedVaultVersion?.content ?? "";
    const signedLatestVaultContent = typedSignatureName.trim() && latestVaultContent
        ? applyTypedSignatureToMarkdown(latestVaultContent, typedSignatureName, signatureDateLabel)
        : latestVaultContent;
    const latestVaultMeta: DocumentExportMeta = {
        title: selectedVaultVersion?.title || effectiveSelectedVaultDocument?.title || "Document",
        businessName: businessName || String(selectedVaultMetadata.businessName || "") || profile.businessName || profile.idea || "",
        docType: effectiveSelectedVaultDocument?.docType || docType || "Document",
        date: formatLongDate(todayIso),
        legalDate: formatLegalDate(todayIso),
        state: typeof selectedVaultMetadata.state === "string" ? selectedVaultMetadata.state : undefined,
    };
    const selectedVaultRiskNote = (() => {
        const text = String(effectiveSelectedVaultDocument?.docType || "").toLowerCase();
        if (text.includes("nda")) return "Review confidentiality scope, exclusions, duration, remedies, and state limits on restrictive covenants before signing.";
        if (text.includes("operating agreement")) return "Review state LLC default rules, member voting, transfer limits, buyout mechanics, fiduciary duties, and dissolution terms.";
        if (text.includes("privacy")) return "Review state privacy rights, GDPR exposure, cookies, sensitive data, children, retention, and vendor data sharing.";
        if (text.includes("terms")) return "Review subscription, refund, arbitration, consumer protection, user content, limitation of liability, and platform-policy terms.";
        if (text.includes("founder")) return "Review equity issuance, vesting, IP assignment, founder departures, tax elections, and securities implications.";
        if (text.includes("consulting")) return "Review scope, payment timing, independent contractor classification, deliverable acceptance, IP assignment, and liability caps.";
        if (text.includes("ip")) return "Review prior employer claims, excluded background IP, open-source obligations, moral rights, and recordable assignment needs.";
        if (text.includes("employment") || text.includes("offer")) return "Review wage/hour classification, at-will language, state notices, equity documents, background checks, and non-compete limits.";
        return "Review enforceability, missing deal terms, signature authority, notices, and state-specific requirements before relying on this draft.";
    })();

    const generateVaultHealthSummary = async () => {
        if (vaultDocuments.length < 3 || vaultHealthLoading) return;
        setVaultHealthLoading(true);
        try {
            const categoriesCovered = Array.from(new Set(vaultDocuments.map((document) => document.category || document.docType).filter(Boolean)));
            const signedCount = vaultDocuments.filter((document) => document.status === "signed").length;
            const unstagedCount = vaultDocuments.filter((document) => !document.stageId).length;
            const prompt = [
                "In 2 sentences maximum, give this founder a plain-English summary of their document vault. Be specific about what they have and what might be missing for their stage.",
                "Do not use generic advice. Start with the most useful observation.",
                "",
                `Current stage: ${currentStageLabel}`,
                `Total documents: ${vaultDocuments.length}`,
                `Categories covered: ${categoriesCovered.join(", ") || "none"}`,
                `Has any signed documents: ${signedCount > 0 ? "yes" : "no"}`,
                `Documents without stage assignment: ${unstagedCount}`,
            ].join("\n");
            const summary = await callForgeAPI(
                [{ role: "user", content: prompt }],
                "You are Navi, a concise founder operating partner. Return only the summary text.",
                120,
            );
            setVaultHealthSummary(summary.trim());
        } catch (error) {
            console.error("Vault health summary error:", error);
        } finally {
            setVaultHealthLoading(false);
        }
    };

    useEffect(() => {
        if (surfaceMode === "vault" && vaultDocuments.length >= 3 && !vaultHealthSummary && !vaultHealthLoading) {
            void generateVaultHealthSummary();
        }
    }, [surfaceMode, vaultDocuments.length, vaultHealthSummary, vaultHealthLoading]);

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

    if (surfaceMode === "vault") {
        const hasSearchOrFilter = vaultSearch.trim().length > 0 || vaultStatusFilter !== "active" || vaultCategoryFilter !== "all" || vaultStageFilter !== "all";

        return (
            <div style={{ minHeight: "100vh", background: "var(--color-bg-soft)", fontFamily: "var(--tekori-font-ui)", color: "var(--color-text)" }}>
                <ScreenHeader
                    onBack={onBack}
                    onOpenNav={onOpenNav}
                    backLabel="Hub"
                    title="Document Vault"
                    subtitle="Generated documents, version history, and local typed signatures"
                />
                <ModeTabs mode={surfaceMode} onChange={setSurfaceMode} />

                <div className="foundry-app-page__content" style={{ maxWidth: "min(1180px, 100%)", margin: "0 auto", padding: "18px 16px 80px" }}>
                    <DocumentNeedsWizard
                        show={showNeedsWizard}
                        onToggle={() => setShowNeedsWizard((prev) => !prev)}
                        needsEntityType={needsEntityType}
                        setNeedsEntityType={setNeedsEntityType}
                        needsState={needsState}
                        setNeedsState={setNeedsState}
                        currentStage={Math.max(1, Number(profile?.currentStage) || 1)}
                        needsGoal={needsGoal}
                        setNeedsGoal={setNeedsGoal}
                        needsNotes={needsNotes}
                        setNeedsNotes={setNeedsNotes}
                        goals={DOCUMENT_NEED_GOALS}
                        needsLoading={needsLoading}
                        needsError={needsError}
                        visibleNeedsResult={visibleNeedsResult}
                        vaultDocuments={vaultDocuments}
                        onRun={runNeedsWizard}
                        onGenerate={openTemplateInGenerate}
                        onReview={handleReviewExistingRecommendation}
                        onDismiss={handleDismissRecommendation}
                    />

                    {vaultDocuments.length >= 3 && (
                        <div style={{ marginBottom: 18, padding: 16, borderRadius: 12, background: "rgba(216,155,43,0.06)", border: "1px solid rgba(216,155,43,0.15)", position: "relative" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--tekori-font-ui)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(16,32,51,0.58)" }}>
                                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(216,155,43,0.16)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--tekori-gold)", fontSize: 11 }}>F</span>
                                    Navi
                                </div>
                                <button
                                    onClick={() => {
                                        setVaultHealthSummary(null);
                                        void generateVaultHealthSummary();
                                    }}
                                    disabled={vaultHealthLoading}
                                    aria-label="Refresh vault summary"
                                    style={{ background: "transparent", border: "none", color: "rgba(7,26,47,0.74)", cursor: vaultHealthLoading ? "wait" : "pointer", fontSize: 18, lineHeight: 1 }}
                                >
                                    ↻
                                </button>
                            </div>
                            <div style={{ fontFamily: "var(--tekori-font-ui)", fontSize: 14, color: "var(--color-text)", lineHeight: 1.7 }}>
                                {vaultHealthSummary || (vaultHealthLoading ? "Navi is reading your vault..." : "Refresh to generate a vault summary.")}
                            </div>
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 0.95fr) minmax(0, 1.35fr)", gap: 18, alignItems: "start" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            <VaultFolderSidebar
                                folders={vaultFolders}
                                loading={vaultFoldersLoading}
                                error={vaultFoldersError}
                                selectedFolderFilter={vaultFolderFilter}
                                onSelectFolder={setVaultFolderFilter}
                                folderActionId={folderActionId}
                                onRenameFolder={handleRenameFolder}
                                onDeleteFolder={handleDeleteFolder}
                                newFolderName={newFolderName}
                                onNewFolderNameChange={setNewFolderName}
                                onCreateFolder={handleCreateFolder}
                                creatingFolder={creatingFolder}
                                search={vaultSearch}
                                onSearchChange={setVaultSearch}
                                statusFilter={vaultStatusFilter}
                                onStatusFilterChange={setVaultStatusFilter}
                                stageFilter={vaultStageFilter}
                                onStageFilterChange={setVaultStageFilter}
                                categoryFilter={vaultCategoryFilter}
                                onCategoryFilterChange={setVaultCategoryFilter}
                                searchInputRef={searchInputRef}
                                categories={vaultCategories}
                                documentStatusLabels={DOCUMENT_STATUS_LABELS}
                            />

                            <VaultDocumentList
                                documents={vaultDocuments}
                                filteredDocuments={filteredVaultDocuments}
                                loading={vaultLoading}
                                error={vaultError}
                                selectedDocumentId={effectiveSelectedVaultDocument?.id ?? null}
                                onSelectDocument={setSelectedVaultDocumentId}
                                onRefresh={() => refreshVaultDocuments()}
                                onArchive={handleArchiveVaultDocument}
                                archivingDocumentId={archivingDocumentId}
                                hasSearchOrFilter={hasSearchOrFilter}
                                folderNameById={folderNameByIdRecord}
                                onOpenNeedsWizard={() => setShowNeedsWizard(true)}
                                onGenerateDocument={() => setSurfaceMode("generate")}
                            />
                        </div>

                        <VaultDetailPanel
                            document={effectiveSelectedVaultDocument}
                            loading={vaultDetailLoading}
                            folderNameById={folderNameByIdRecord}
                            versionCount={vaultVersions.length}
                            folders={vaultFolders}
                            movingDocumentId={movingDocumentId}
                            onMoveToFolder={handleMoveDocumentToFolder}
                            selectedVersion={selectedVaultVersion}
                            versions={vaultVersions}
                            versionsLoading={vaultVersionsLoading}
                            versionsError={vaultVersionsError}
                            onSelectVersion={setSelectedVersionId}
                            onRestoreVersion={handleRestoreVaultVersion}
                            restoringVersionId={restoringVersionId}
                            previewNode={(
                                <div style={{ border: "1px solid rgba(7,26,47,0.06)", borderRadius: 14, background: "rgba(7,26,47,0.018)", overflow: "hidden" }}>
                                    <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(7,26,47,0.05)", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                        <div>
                                            <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>Latest Content Preview</div>
                                            <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", marginTop: 2 }}>
                                                {selectedVaultVersion ? `Version ${selectedVaultVersion.versionNumber} · ${selectedVaultVersion.source}` : "No linked version selected yet"}
                                            </div>
                                        </div>
                                        {selectedVaultVersion && effectiveSelectedVaultDocument && (
                                            <button
                                                onClick={() => openVaultVersionInStudio(effectiveSelectedVaultDocument, selectedVaultVersion)}
                                                style={{ background: "rgba(216,155,43,0.08)", border: "1px solid rgba(216,155,43,0.18)", borderRadius: 8, padding: "7px 10px", color: "var(--tekori-gold)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}
                                            >
                                                {selectedVaultVersion.id === vaultVersions[0]?.id ? "Open Latest in Studio" : `Open Version ${selectedVaultVersion.versionNumber} in Studio`}
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ padding: 16 }}>
                                        {!legalDisclaimerDismissed && (
                                            <div style={{ marginBottom: 12, background: "rgba(216,155,43,0.08)", border: "1px solid rgba(216,155,43,0.25)", borderRadius: 8, padding: "12px 14px", color: "rgba(7,26,47,0.88)", fontFamily: "var(--tekori-font-ui)", fontSize: 12, lineHeight: 1.6, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                                                <div>
                                                    <strong style={{ color: "var(--color-text)" }}>⚠ AI-Generated Document</strong>
                                                    <div>{selectedVaultRiskNote} This document was created by Navi and has not been reviewed by an attorney.</div>
                                                </div>
                                                <button
                                                    onClick={() => setLegalDisclaimerDismissed(true)}
                                                    style={{ background: "transparent", border: "none", color: "rgba(7,26,47,0.88)", cursor: "pointer", fontSize: 13 }}
                                                >
                                                    X
                                                </button>
                                            </div>
                                        )}
                                        {versionRestoreMessage && (
                                            <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(115,135,123,0.10)", border: "1px solid rgba(115,135,123,0.22)", color: "var(--color-success)", fontSize: 12, fontFamily: "var(--tekori-font-ui)" }}>
                                                {versionRestoreMessage}
                                            </div>
                                        )}
                                        {latestVaultContent ? (
                                            <>
                                                <TypedSignaturePanel
                                                    value={typedSignatureName}
                                                    onChange={setTypedSignatureName}
                                                />
                                                <div style={{
                                                    maxHeight: 430,
                                                    overflowY: "auto",
                                                    background: "#F8F5F0",
                                                    borderRadius: 12,
                                                    padding: "28px 28px 24px",
                                                    boxShadow: "0 4px 30px rgba(7,26,47,0.18)",
                                                }}>
                                                    <DocPreview content={signedLatestVaultContent} meta={latestVaultMeta} />
                                                </div>
                                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                                                    <button
                                                        onClick={() => printStyledPdf(signedLatestVaultContent, latestVaultMeta)}
                                                        style={{ padding: "9px 12px", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 10, color: "var(--color-text-soft)", fontSize: 12, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}
                                                    >
                                                        Download PDF
                                                    </button>
                                                    <button
                                                        onClick={() => downloadStyledDocx(signedLatestVaultContent, latestVaultMeta)}
                                                        style={{ padding: "9px 12px", background: "rgba(216,155,43,0.08)", border: "1px solid rgba(216,155,43,0.18)", borderRadius: 10, color: "var(--tekori-gold)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}
                                                    >
                                                        Download DOCX
                                                    </button>
                                                    <button
                                                        onClick={() => downloadStyledHtml(signedLatestVaultContent, latestVaultMeta)}
                                                        style={{ padding: "9px 12px", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 10, color: "var(--color-text-soft)", fontSize: 12, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}
                                                    >
                                                        Styled HTML
                                                    </button>
                                                </div>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" }}>
                                                    <button
                                                        onClick={() => handleSaveVaultArtifact("generated_docx")}
                                                        disabled={artifactSavingKind !== null}
                                                        style={{ padding: "8px 11px", background: "rgba(216,155,43,0.08)", border: "1px solid rgba(216,155,43,0.16)", borderRadius: 10, color: artifactSavingKind === "generated_docx" ? "var(--color-text)" : "var(--tekori-gold)", fontSize: 11, fontWeight: 600, cursor: artifactSavingKind ? "wait" : "pointer", fontFamily: "var(--tekori-font-ui)" }}
                                                    >
                                                        {artifactSavingKind === "generated_docx" ? "Saving DOCX..." : "Save DOCX Artifact"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleSaveVaultArtifact("generated_html")}
                                                        disabled={artifactSavingKind !== null}
                                                        style={{ padding: "8px 11px", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 10, color: artifactSavingKind === "generated_html" ? "var(--color-text)" : "var(--color-text-soft)", fontSize: 11, cursor: artifactSavingKind ? "wait" : "pointer", fontFamily: "var(--tekori-font-ui)" }}
                                                    >
                                                        {artifactSavingKind === "generated_html" ? "Saving HTML..." : "Save HTML Artifact"}
                                                    </button>
                                                    <span style={{ fontSize: 10, color: "var(--foundry-text-secondary)", lineHeight: 1.5 }}>
                                                        PDF stays browser-controlled for now, so only DOCX and HTML artifacts are saved to the vault.
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--foundry-text-secondary)", fontSize: 12, lineHeight: 1.6 }}>
                                                <div style={{ marginBottom: linkedProducedDocumentForVault ? 10 : 0 }}>
                                                    No version content is linked yet for this vault record. If this is an older mirrored document, open the original saved document from Generate or create a fresh version from Studio.
                                                </div>
                                                {linkedProducedDocumentForVault && (
                                                    <button
                                                        onClick={() => openSavedDocument(linkedProducedDocumentForVault)}
                                                        style={{ padding: "8px 11px", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 10, color: "var(--color-text-soft)", fontSize: 11, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}
                                                    >
                                                        Open original saved document
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            filesPanel={(
                                <DocumentFilesPanel
                                    files={vaultFiles}
                                    loading={vaultFilesLoading}
                                    error={vaultFilesError}
                                    uploadingFile={uploadingFile}
                                    fileActionId={fileActionId}
                                    onOpenUploadPicker={() => vaultFileInputRef.current?.click()}
                                    onRefresh={() => refreshVaultFiles(effectiveSelectedVaultDocument?.id ?? null)}
                                    fileInputRef={vaultFileInputRef}
                                    onUploadChange={handleUploadVaultAttachment}
                                    onOpenFile={handleOpenVaultFile}
                                    onDeleteFile={handleDeleteVaultFile}
                                    disabled={!effectiveSelectedVaultDocument}
                                />
                            )}
                            signaturesPanel={(
                                <DocumentSignaturesPanel
                                    providerConfigurationStatus={providerConfigurationStatus}
                                    signatureProvider={signatureProvider}
                                    onSignatureProviderChange={setSignatureProvider}
                                    signatureSignerName={signatureSignerName}
                                    onSignatureSignerNameChange={setSignatureSignerName}
                                    signatureSignerEmail={signatureSignerEmail}
                                    onSignatureSignerEmailChange={setSignatureSignerEmail}
                                    signatureExpiresAt={signatureExpiresAt}
                                    onSignatureExpiresAtChange={setSignatureExpiresAt}
                                    signatureFileId={signatureFileId}
                                    onSignatureFileIdChange={setSignatureFileId}
                                    signatureVersionId={signatureVersionId}
                                    onSignatureVersionIdChange={setSignatureVersionId}
                                    onCreateSignatureRequest={handleCreateSignatureRequest}
                                    creatingSignatureRequest={creatingSignatureRequest}
                                    requests={signatureRequests}
                                    requestsLoading={signatureRequestsLoading}
                                    requestsError={signatureRequestsError}
                                    selectedRequest={selectedSignatureRequest}
                                    onSelectRequest={setSelectedSignatureRequestId}
                                    events={signatureEvents}
                                    eventsLoading={signatureEventsLoading}
                                    eventsError={signatureEventsError}
                                    files={vaultFiles}
                                    versions={vaultVersions}
                                    selectedFile={selectedSignatureFile}
                                    selectedVersion={selectedSignatureVersion}
                                    onRefresh={() => refreshSignatureRequests(effectiveSelectedVaultDocument?.id ?? null)}
                                    onStatusAction={handleSignatureStatusAction}
                                    signatureActionId={signatureActionId}
                                />
                            )}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    // SCREEN 1 — CATEGORY SELECTION
    // ═══════════════════════════════════════════════════════════
    if (phase === "categories") {
        return (
            <div style={{ minHeight: "100vh", background: "var(--color-bg-soft)", fontFamily: "var(--tekori-font-ui)", color: "var(--color-text)" }}>
                {/* Header */}
                <div style={{
                    padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px",
                    borderBottom: "1px solid rgba(7,26,47,0.05)",
                    display: "flex", alignItems: "center", gap: 12,
                    position: "sticky", top: 0,
                    background: "rgba(255,252,246,0.94)", backdropFilter: "blur(12px)", zIndex: 10,
                }}>
                    <button
                        onClick={onBack}
                        style={{
                            display: "flex", alignItems: "center", gap: 5,
                            background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)",
                            borderRadius: 8, padding: "var(--foundry-app-header-button-padding)", color: "var(--color-text-muted)", fontSize: "var(--foundry-app-header-button-font)", cursor: "pointer",
                        }}
                    >
                        <ArrowLeft size={"var(--foundry-app-header-icon-size)"} /> Hub
                    </button>
                    <div>
                        <div style={{ fontSize: "var(--foundry-app-header-title-font)", fontFamily: "var(--tekori-font-brand)", fontWeight: 700 }}>Document Vault</div>
                        <div style={{ fontSize: "var(--foundry-app-header-meta-font)", color: "var(--foundry-text-muted)" }}>Vault dashboard plus Navi generation · {DOC_CATEGORIES.reduce((n, c) => n + c.documents.length, 0)} documents</div>
                    </div>
                </div>
                <ModeTabs mode={surfaceMode} onChange={setSurfaceMode} />

                <div className="foundry-app-page__content" style={{ maxWidth: "var(--foundry-doc-content-width)", margin: "0 auto", padding: "24px 16px 80px" }}>
                    {/* Intro */}
                    <div style={{ marginBottom: 28, animation: "fadeSlideUp 0.4s ease both", textAlign: "center" }}>
                        <div style={{ fontSize: "clamp(22px, 2vw, 24px)", fontFamily: "var(--tekori-font-brand)", fontWeight: 700, marginBottom: 6, lineHeight: 1.25 }}>
                            What do you need?
                        </div>
                        <div style={{ fontSize: "var(--foundry-doc-card-body-font)", color: "var(--foundry-text-secondary)", fontFamily: "var(--tekori-font-ui)", fontStyle: "italic", lineHeight: 1.7 }}>
                            Every document a founder needs, from day one through exit — generated by Navi and tailored to your business.
                        </div>
                    </div>

                    <div style={{ marginBottom: 22, animation: "fadeSlideUp 0.4s ease 0.01s both" }}>
                        <div style={{ position: "relative" }}>
                            <MagnifyingGlass size={16} color="var(--color-text-muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                            <input
                                value={catalogSearch}
                                onChange={(event) => setCatalogSearch(event.target.value)}
                                placeholder="Look up a document by name, category, or use case"
                                style={{
                                    width: "100%",
                                    background: "rgba(7,26,47,0.03)",
                                    border: "1px solid rgba(7,26,47,0.08)",
                                    borderRadius: 12,
                                    padding: "12px 14px 12px 38px",
                                    color: "var(--color-text)",
                                    fontSize: 13,
                                    fontFamily: "var(--tekori-font-ui)",
                                }}
                            />
                        </div>
                        {catalogSearch.trim() && (
                            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                                {catalogMatches.length > 0 ? catalogMatches.slice(0, 8).map(({ category, document }) => (
                                    <button
                                        key={`${category.id}:${document.id}`}
                                        onClick={() => {
                                            setCatalogSearch("");
                                            selectDoc(document, category);
                                        }}
                                        style={{
                                            width: "100%",
                                            textAlign: "left",
                                            padding: "12px 14px",
                                            borderRadius: 12,
                                            border: "1px solid rgba(7,26,47,0.07)",
                                            background: "rgba(7,26,47,0.022)",
                                            cursor: "pointer",
                                            fontFamily: "var(--tekori-font-ui)",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                                            <span style={{ fontSize: 14, color: "var(--color-text)", fontWeight: 600 }}>{document.name}</span>
                                            <span style={{ fontSize: 11, color: "var(--foundry-text-muted)", whiteSpace: "nowrap" }}>{category.name}</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>
                                            {document.whenToUse}
                                        </div>
                                    </button>
                                )) : (
                                    <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(7,26,47,0.022)", border: "1px solid rgba(7,26,47,0.06)", fontSize: 12, color: "var(--foundry-text-secondary)" }}>
                                        No documents match that search yet.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Recent documents */}
                    {(documents.length > 0 || documentsLoading) && (
                        <div style={{ marginBottom: 28, animation: "fadeSlideUp 0.4s ease 0.02s both" }}>
                            <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "var(--foundry-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                                Recent Documents
                            </div>
                            {documentsLoading ? (
                                <div style={{ fontSize: "var(--foundry-doc-card-body-font)", color: "var(--foundry-text-secondary)" }}>Loading...</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                                    {documents.slice(0, 4).map(doc => (
                                        <button
                                            key={doc.id}
                                            onClick={() => openSavedDocument(doc)}
                                            style={{
                                                width: "100%", padding: "12px 15px", borderRadius: 10, textAlign: "left",
                                                border: "1px solid rgba(7,26,47,0.07)",
                                                background: "rgba(7,26,47,0.025)",
                                                cursor: "pointer", fontFamily: "var(--tekori-font-ui)",
                                            }}
                                        >
                                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 2 }}>
                                                <span style={{ fontSize: "var(--foundry-doc-card-large-font)", color: "var(--color-text-soft)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</span>
                                                <span style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "var(--foundry-text-muted)", flexShrink: 0 }}>{new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                            </div>
                                            <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "var(--foundry-text-muted)" }}>{doc.docType} · {doc.audience} · {doc.tone}</div>
                                        </button>
                                    ))}
                                    {documents.length > 4 && (
                                        <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "var(--foundry-text-secondary)", textAlign: "center", paddingTop: 4 }}>
                                            +{documents.length - 4} more saved
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Category grid */}
                    <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "var(--foundry-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
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
                                    border: "1px solid rgba(7,26,47,0.07)",
                                    background: "rgba(7,26,47,0.025)",
                                    cursor: "pointer", width: "100%",
                                    transition: "all 0.15s",
                                    animation: `fadeSlideUp 0.4s ease ${0.03 + index * 0.02}s both`,
                                    fontFamily: "var(--tekori-font-ui)",
                                }}
                            >
                                {/* Icon */}
                                <div style={{
                                    width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                                    background: "rgba(216,155,43,0.08)", border: "1px solid rgba(216,155,43,0.15)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <CategoryIcon name={cat.icon} size={22} color="var(--tekori-gold)" />
                                </div>

                                {/* Text */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                                        <span style={{ fontSize: "var(--foundry-doc-card-title-font)", color: "var(--color-text-soft)", fontWeight: 600 }}>{cat.name}</span>
                                        {cat.isStateAware && <StateAwareBadge />}
                                    </div>
                                    <div style={{ marginTop: 6 }}>
                                        <HelpTooltip content={cat.description} />
                                    </div>
                                </div>

                                {/* Count badge */}
                                <div style={{
                                    flexShrink: 0, padding: "3px 9px", borderRadius: 20,
                                    background: "rgba(7,26,47,0.05)", border: "1px solid rgba(7,26,47,0.08)",
                                    fontSize: "var(--foundry-doc-card-body-font)", color: "var(--foundry-text-secondary)", fontWeight: 600,
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
            <div style={{ minHeight: "100vh", background: "var(--color-bg-soft)", fontFamily: "var(--tekori-font-ui)", color: "var(--color-text)" }}>
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
                <ModeTabs mode={surfaceMode} onChange={setSurfaceMode} />

                <div className="foundry-app-page__content" style={{ maxWidth: "var(--foundry-doc-content-width)", margin: "0 auto", padding: "20px 16px 80px" }}>
                    {/* Category context */}
                    <div style={{ marginBottom: 20, animation: "fadeSlideUp 0.3s ease both" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 12, background: "rgba(216,155,43,0.05)", border: "1px solid rgba(216,155,43,0.1)" }}>
                            <CategoryIcon name={selectedCategory.icon} size={22} color="var(--tekori-gold)" />
                            <HelpTooltip content={selectedCategory.description} />
                        </div>
                    </div>

                    <div style={{ marginBottom: 16, animation: "fadeSlideUp 0.3s ease 0.03s both" }}>
                        <div style={{ position: "relative" }}>
                            <MagnifyingGlass size={16} color="var(--color-text-muted)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                            <input
                                value={catalogSearch}
                                onChange={(event) => setCatalogSearch(event.target.value)}
                                placeholder={`Search ${selectedCategory.name.toLowerCase()} documents`}
                                style={{
                                    width: "100%",
                                    background: "rgba(7,26,47,0.03)",
                                    border: "1px solid rgba(7,26,47,0.08)",
                                    borderRadius: 12,
                                    padding: "12px 14px 12px 38px",
                                    color: "var(--color-text)",
                                    fontSize: 13,
                                    fontFamily: "var(--tekori-font-ui)",
                                }}
                            />
                        </div>
                    </div>

                    {/* State-aware notice */}
                    {selectedCategory.isStateAware && (
                        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 10, background: "rgba(234,179,8,0.05)", border: "1px solid rgba(234,179,8,0.15)", animation: "fadeSlideUp 0.3s ease 0.05s both" }}>
                            <HelpTooltip content="Documents in this category vary by state. You will be asked to confirm your state before configuration." />
                        </div>
                    )}

                    {/* Document list */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {selectedCategory.documents
                            .filter((doc) => {
                                const query = catalogSearch.trim().toLowerCase();
                                if (!query) return true;
                                return [doc.name, doc.whenToUse].join(" ").toLowerCase().includes(query);
                            })
                            .map((doc, index) => (
                            <button
                                key={doc.id}
                                onClick={() => selectDoc(doc)}
                                style={{
                                    padding: "14px 16px", borderRadius: 12, textAlign: "left",
                                    border: "1px solid rgba(7,26,47,0.07)",
                                    background: "rgba(7,26,47,0.025)",
                                    cursor: "pointer", width: "100%",
                                    transition: "all 0.15s",
                                    animation: `fadeSlideUp 0.35s ease ${0.05 + index * 0.02}s both`,
                                    fontFamily: "var(--tekori-font-ui)",
                                }}
                            >
                                {/* Name + badges */}
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                                    <span style={{ fontSize: "var(--foundry-doc-card-title-font)", color: "var(--color-text-muted)", fontWeight: 600, lineHeight: 1.35 }}>{doc.name}</span>
                                    <div style={{ display: "flex", gap: 5, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                        {doc.isMostPopular && <PopularBadge />}
                                        {doc.isStateAware && <StateAwareBadge />}
                                    </div>
                                </div>
                                {/* When to use */}
                                <HelpTooltip content={doc.whenToUse} />
                            </button>
                        ))}
                        {selectedCategory.documents.filter((doc) => {
                            const query = catalogSearch.trim().toLowerCase();
                            if (!query) return true;
                            return [doc.name, doc.whenToUse].join(" ").toLowerCase().includes(query);
                        }).length === 0 && (
                            <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(7,26,47,0.06)", background: "rgba(7,26,47,0.022)", fontSize: 12, color: "var(--foundry-text-secondary)" }}>
                                No documents in this category match that search.
                            </div>
                        )}
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
            <div style={{ minHeight: "100vh", background: "var(--color-bg-soft)", fontFamily: "var(--tekori-font-ui)", color: "var(--color-text)" }}>
                <ScreenHeader
                    onBack={() => setPhase("documents")}
                    backLabel={selectedCategory.name}
                    title={selectedDoc.name}
                    subtitle="Configure and generate"
                />
                <ModeTabs mode={surfaceMode} onChange={setSurfaceMode} />

                <div className="foundry-app-page__content" style={{ maxWidth: "var(--foundry-doc-content-width)", margin: "0 auto", padding: "20px 16px 100px" }}>
                    {generationLocked && generationLockMessage && (
                        <div style={{
                            marginBottom: 18,
                            padding: "14px 16px",
                            borderRadius: 12,
                            background: "rgba(216,155,43,0.06)",
                            border: "1px solid rgba(216,155,43,0.18)",
                            fontSize: "var(--foundry-doc-card-body-font)",
                            color: "var(--color-text-soft)",
                            lineHeight: 1.65,
                        }}>
                            {generationLockMessage}
                        </div>
                    )}

                    {/* Document identity block */}
                    <div style={{ marginBottom: 24, padding: "16px", borderRadius: 12, border: "1px solid rgba(7,26,47,0.07)", background: "rgba(7,26,47,0.02)", animation: "fadeSlideUp 0.3s ease both" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <CategoryIcon name={selectedCategory.icon} size={16} color="var(--tekori-gold)" />
                            <span style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "var(--foundry-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{selectedCategory.name}</span>
                        </div>
                        <div style={{ fontSize: "calc(var(--foundry-doc-card-title-font) + 1px)", color: "var(--color-text-soft)", fontWeight: 600, marginBottom: 8 }}>{selectedDoc.name}</div>
                        <div style={{ fontSize: "var(--foundry-doc-card-body-font)", color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>{selectedDoc.whenToUse}</div>
                        <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                            {selectedDoc.isMostPopular && <PopularBadge />}
                            {selectedDoc.isStateAware && <StateAwareBadge />}
                        </div>
                    </div>

                    {/* Audience */}
                    <div style={{ marginBottom: 20, animation: "fadeSlideUp 0.3s ease 0.08s both" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                            <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "var(--foundry-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Audience</div>
                            {suggestedSettings && (
                                <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "var(--tekori-gold)" }}>Suggested: {suggestedSettings.audience}</div>
                            )}
                        </div>
                        <ChipRow options={AUDIENCES} selected={audience} onSelect={setAudience} />
                    </div>

                    {/* Tone */}
                    <div style={{ marginBottom: 22, animation: "fadeSlideUp 0.3s ease 0.11s both" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                            <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "var(--foundry-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Tone</div>
                            {suggestedSettings && (
                                <div style={{ fontSize: "var(--foundry-doc-card-meta-font)", color: "var(--tekori-gold)" }}>Suggested: {suggestedSettings.tone}</div>
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
                                background: "rgba(115,135,123,0.08)",
                                border: "1px solid rgba(115,135,123,0.18)",
                                fontSize: "var(--foundry-doc-card-body-font)",
                                color: "var(--color-text-muted)",
                                lineHeight: 1.65,
                            }}>
                                <strong style={{ color: "var(--color-text)" }}>One-time use:</strong> these fill-in fields are used for this document and are not saved as reusable profile memory. The finished generated document may still be saved in your document history and can contain the details you choose to include.
                            </div>
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                marginBottom: 12,
                                padding: "12px 14px",
                                borderRadius: 12,
                                background: currentValidation.valid ? "rgba(115,135,123,0.10)" : "rgba(216,155,43,0.07)",
                                border: currentValidation.valid ? "1px solid rgba(115,135,123,0.22)" : "1px solid rgba(216,155,43,0.18)",
                            }}>
                                <div>
                                    <div style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 700, marginBottom: 3 }}>
                                        Document readiness
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", lineHeight: 1.5 }}>
                                        {completedRequiredCount} of {requiredFieldCount} required fields complete
                                    </div>
                                </div>
                                <div style={{ fontSize: 11, color: currentValidation.valid ? "var(--color-success)" : "var(--tekori-gold)", fontWeight: 700, flexShrink: 0 }}>
                                    {currentValidation.valid ? "Ready to generate" : "Missing info"}
                                </div>
                            </div>

                            {showValidation && !currentValidation.valid && (
                                <div style={{ marginBottom: 12, fontSize: 11, color: "var(--color-danger)", lineHeight: 1.6 }}>
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
                                background: "rgba(7,26,47,0.025)",
                                border: "1px solid rgba(7,26,47,0.07)",
                                cursor: "pointer",
                            }}>
                                <span>
                                    <span style={{ display: "block", fontSize: 12, color: "var(--color-text)", fontWeight: 700, marginBottom: 2 }}>
                                        Auto-fill current date
                                    </span>
                                    <span style={{ display: "block", fontSize: 10, color: "var(--foundry-text-secondary)", lineHeight: 1.5 }}>
                                        Uses {formatLongDate(todayIso)} for document and signature dates unless you override it.
                                    </span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={autoFillCurrentDate}
                                    onChange={(event) => handleAutoFillCurrentDateChange(event.target.checked)}
                                    style={{ accentColor: "var(--tekori-gold)", width: 17, height: 17, flexShrink: 0 }}
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
                        <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Quick Instructions</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                            {smartPrompts.map(p => (
                                <button
                                    key={p}
                                    onClick={() => setRequest(prev => prev ? `${prev} ${p}` : p)}
                                    style={{
                                        padding: "5px 12px", borderRadius: 20,
                                        border: request.includes(p) ? "1px solid rgba(216,155,43,0.4)" : "1px solid rgba(7,26,47,0.08)",
                                        background: request.includes(p) ? "rgba(216,155,43,0.08)" : "rgba(7,26,47,0.025)",
                                        color: request.includes(p) ? "var(--tekori-gold)" : "var(--color-text-muted)",
                                        fontSize: 11, cursor: "pointer", fontFamily: "var(--tekori-font-ui)",
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
                            placeholder={`Or describe anything specific:\n— key points to include\n— special requirements\n— purpose or context\n\nLeave blank to let Navi decide based on your profile.`}
                            rows={4}
                            style={{
                                width: "100%", background: "rgba(7,26,47,0.03)",
                                border: "1px solid rgba(7,26,47,0.08)", borderRadius: 12,
                                padding: "12px 14px", color: "var(--color-text)", fontSize: 13,
                                fontFamily: "var(--tekori-font-ui)", lineHeight: 1.6, boxSizing: "border-box",
                            }}
                        />
                    </div>

                    {/* Generate button */}
                    <button
                        onClick={generate}
                        disabled={generating || generationLocked}
                        style={{
                            width: "100%", padding: "15px",
                            background: canGenerate ? "linear-gradient(135deg, var(--tekori-gold), var(--tekori-soft-gold))" : "rgba(7,26,47,0.06)",
                            border: "none", borderRadius: 14,
                            color: canGenerate ? "var(--color-primary)" : "var(--color-text-muted)",
                            fontSize: 15, fontWeight: 800, cursor: generating ? "not-allowed" : "pointer",
                            fontFamily: "var(--tekori-font-ui)",
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
        <div style={{ minHeight: "100vh", background: "var(--color-bg-soft)", fontFamily: "var(--tekori-font-ui)", color: "var(--color-text)", display: "flex", flexDirection: "column" }}>
            {/* Studio Header */}
            <div style={{
                padding: "max(12px, calc(6px + env(safe-area-inset-top))) 16px 12px",
                borderBottom: "1px solid rgba(7,26,47,0.05)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexShrink: 0, background: "rgba(255,252,246,0.94)", backdropFilter: "blur(12px)",
                zIndex: 10, position: "sticky", top: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                        onClick={resetToCategories}
                        style={{
                            display: "flex", alignItems: "center", gap: 5,
                            background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)",
                            borderRadius: 8, padding: "5px 11px", color: "var(--color-text-muted)", fontSize: 12, cursor: "pointer",
                        }}
                    >
                        <ArrowLeft size={12} /> Hub
                    </button>
                    <div>
                        <div style={{ fontSize: 14, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, lineHeight: 1.2 }}>Document Studio</div>
                        <div style={{ fontSize: 10, color: "var(--foundry-text-muted)" }}>
                            {docType} · {audience} · {tone}{docState ? ` · ${docState}` : ""}{saveLabel ? ` · ${saveLabel}` : ""}
                        </div>
                    </div>
                </div>
                <button
                    onClick={resetToCategories}
                    style={{ background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.07)", borderRadius: 8, padding: "5px 12px", color: "var(--foundry-text-secondary)", fontSize: 11, cursor: "pointer" }}
                >
                    New Doc
                </button>
            </div>

            <ModeTabs mode={surfaceMode} onChange={setSurfaceMode} />

            {studioLaunchNotice && (
                <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(48,70,95,0.14)", background: "rgba(48,70,95,0.08)", fontSize: 11, color: "#CFE5F5", lineHeight: 1.6 }}>
                    {studioLaunchNotice}
                </div>
            )}

            {/* Tab bar */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(7,26,47,0.05)", flexShrink: 0 }}>
                {(["preview", "refine"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            flex: 1, padding: "10px", background: "none", border: "none",
                            borderBottom: activeTab === tab ? "2px solid var(--tekori-gold)" : "2px solid transparent",
                            color: activeTab === tab ? "var(--tekori-gold)" : "var(--color-text-muted)",
                            fontSize: 12, fontWeight: activeTab === tab ? 600 : 400,
                            cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s",
                            fontFamily: "var(--tekori-font-ui)",
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
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "80px 0", color: "var(--foundry-text-muted)" }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                    {[0, 1, 2].map(i => (
                                        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--tekori-gold)", animation: "forgePulse 1.4s infinite ease-in-out", animationDelay: `${i * 0.2}s` }} />
                                    ))}
                                </div>
                                <div style={{ fontSize: 13, color: "var(--foundry-text-muted)", fontFamily: "var(--tekori-font-ui)", fontStyle: "italic" }}>Navi is drafting your document...</div>
                            </div>
                        )}

                        {currentDoc && (
                            <div style={{ maxWidth: 680, margin: "0 auto" }}>
                                {!generating && (
                                    <TypedSignaturePanel
                                        value={typedSignatureName}
                                        onChange={setTypedSignatureName}
                                    />
                                )}
                                {/* Paper */}
                                <div style={{
                                    background: "#F8F5F0", borderRadius: 12,
                                    padding: "36px 40px", boxShadow: "0 4px 40px rgba(7,26,47,0.34)",
                                    marginBottom: 16,
                                    animation: generating ? "none" : "fadeSlideUp 0.4s ease both",
                                    position: "relative",
                                }}>
                                    {generating && (
                                        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 5, background: "rgba(216,155,43,0.1)", border: "1px solid rgba(216,155,43,0.3)", borderRadius: 20, padding: "3px 10px" }}>
                                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--tekori-gold)", animation: "forgePulse 1.2s infinite" }} />
                                            <span style={{ fontSize: 10, color: "var(--tekori-gold)", fontFamily: "var(--tekori-font-ui)" }}>Writing</span>
                                        </div>
                                    )}

                                    <DocPreview content={signedCurrentDoc} meta={exportMeta} />

                                </div>

                                {/* Download controls */}
                                {!generating && (
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, animation: "fadeSlideUp 0.3s ease 0.1s both" }}>
                                        <button
                                            onClick={handleCopy}
                                            style={{ flex: 1, minWidth: 80, padding: "10px 14px", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 10, color: copied ? "var(--color-success)" : "var(--color-text-soft)", fontSize: 12, cursor: "pointer", transition: "all 0.2s", fontFamily: "var(--tekori-font-ui)" }}
                                        >
                                            {copied ? "✓ Copied" : "Copy"}
                                        </button>
                                        <button
                                            onClick={() => printStyledPdf(signedCurrentDoc, exportMeta)}
                                            disabled={!canExportOfficialDocument}
                                            title={!canExportOfficialDocument ? "Legal Business Name is required before export." : undefined}
                                            style={{ flex: 1, minWidth: 110, padding: "10px 14px", background: canExportOfficialDocument ? "rgba(7,26,47,0.04)" : "rgba(7,26,47,0.025)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 10, color: canExportOfficialDocument ? "var(--color-text-soft)" : "var(--color-text-muted)", fontSize: 12, cursor: canExportOfficialDocument ? "pointer" : "not-allowed", fontFamily: "var(--tekori-font-ui)" }}
                                        >
                                            Download PDF
                                        </button>
                                        <button
                                            onClick={() => downloadStyledDocx(signedCurrentDoc, exportMeta)}
                                            disabled={!canExportOfficialDocument}
                                            title={!canExportOfficialDocument ? "Legal Business Name is required before export." : undefined}
                                            style={{ flex: 1, minWidth: 120, padding: "10px 14px", background: canExportOfficialDocument ? "rgba(216,155,43,0.08)" : "rgba(7,26,47,0.025)", border: canExportOfficialDocument ? "1px solid rgba(216,155,43,0.2)" : "1px solid rgba(7,26,47,0.08)", borderRadius: 10, color: canExportOfficialDocument ? "var(--tekori-gold)" : "var(--color-text-muted)", fontSize: 12, cursor: canExportOfficialDocument ? "pointer" : "not-allowed", fontWeight: 600, fontFamily: "var(--tekori-font-ui)" }}
                                        >
                                            Download DOCX
                                        </button>
                                        <button
                                            onClick={() => downloadStyledHtml(signedCurrentDoc, exportMeta)}
                                            disabled={!canExportOfficialDocument}
                                            title={!canExportOfficialDocument ? "Legal Business Name is required before export." : undefined}
                                            style={{ flex: 1, minWidth: 110, padding: "10px 14px", background: canExportOfficialDocument ? "rgba(7,26,47,0.04)" : "rgba(7,26,47,0.025)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 10, color: canExportOfficialDocument ? "var(--color-text-soft)" : "var(--color-text-muted)", fontSize: 12, cursor: canExportOfficialDocument ? "pointer" : "not-allowed", fontFamily: "var(--tekori-font-ui)" }}
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
                            <div style={{ fontSize: 15, fontFamily: "var(--tekori-font-ui)", fontWeight: 600, color: "var(--color-text)", marginBottom: 4 }}>Refine your document</div>
                            <div style={{ fontSize: 12, color: "var(--foundry-text-muted)", lineHeight: 1.6 }}>
                                Give Navi a direction and it will revise the entire document. Your previous version is preserved in history.
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
                                    style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(7,26,47,0.07)", background: refineInput === chip ? "rgba(216,155,43,0.1)" : "rgba(7,26,47,0.02)", color: refineInput === chip ? "var(--tekori-gold)" : "var(--color-pill-text)", fontSize: 11, cursor: "pointer", fontFamily: "var(--tekori-font-ui)", transition: "all 0.15s" }}
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
                            style={{ width: "100%", background: "rgba(7,26,47,0.03)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 12, padding: "12px 14px", color: "var(--color-text)", fontSize: 13, fontFamily: "var(--tekori-font-ui)", lineHeight: 1.6, boxSizing: "border-box", opacity: refining ? 0.5 : 1, marginBottom: 10, animation: "fadeSlideUp 0.3s ease 0.1s both" }}
                        />

                        <div style={{ display: "flex", gap: 8, animation: "fadeSlideUp 0.3s ease 0.15s both" }}>
                            <button
                                onClick={() => setActiveTab("preview")}
                                style={{ flex: 1, padding: "12px", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 10, color: "var(--foundry-text-secondary)", fontSize: 13, cursor: "pointer" }}
                            >
                                View Current
                            </button>
                            <button
                                onClick={refine}
                                disabled={!refineInput.trim() || refining}
                                style={{ flex: 2, padding: "12px", background: refineInput.trim() && !refining ? "linear-gradient(135deg, var(--tekori-gold), var(--tekori-soft-gold))" : "rgba(7,26,47,0.06)", border: "none", borderRadius: 10, color: refineInput.trim() && !refining ? "var(--color-primary)" : "var(--color-text-muted)", fontSize: 13, fontWeight: 800, cursor: refineInput.trim() && !refining ? "pointer" : "not-allowed", transition: "all 0.15s", fontFamily: "var(--tekori-font-ui)" }}
                            >
                                {refining ? "Refining..." : "Refine Document"}
                            </button>
                        </div>

                        {history.length > 1 && (
                            <div style={{ marginTop: 28 }}>
                                <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Refinement History</div>
                                {history.slice(1).map((rec, i) => (
                                    <div key={i} style={{ padding: "10px 12px", background: "rgba(7,26,47,0.02)", border: "1px solid rgba(7,26,47,0.05)", borderRadius: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                        <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", flex: 1 }}>"{rec.instruction}"</div>
                                        <button
                                            onClick={() => {
                                                setCurrentDoc(rec.doc);
                                                const nextHistory = history.slice(0, i + 2);
                                                setHistory(nextHistory);
                                                persistDocument(rec.doc, nextHistory);
                                            }}
                                            style={{ background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.07)", borderRadius: 6, padding: "3px 10px", color: "var(--foundry-text-muted)", fontSize: 10, cursor: "pointer", flexShrink: 0 }}
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

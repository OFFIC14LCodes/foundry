import { FolderOpen, MagnifyingGlass } from "@phosphor-icons/react";
import type { VaultDocument } from "../../db";
import { StageBadge, StatusBadge, formatShortDate } from "./shared";

function getDocumentHealthScore(doc: VaultDocument) {
    const metadata = doc.metadata && typeof doc.metadata === "object" ? doc.metadata as Record<string, any> : {};
    const health = metadata.documentHealthScore && typeof metadata.documentHealthScore === "object"
        ? metadata.documentHealthScore as Record<string, any>
        : null;
    const score = Number(health?.score);
    return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
}

function healthColor(score: number) {
    if (score >= 90) return { color: "var(--color-success)", background: "rgba(76,175,138,0.1)", border: "1px solid rgba(76,175,138,0.22)" };
    if (score >= 70) return { color: "#D6A84F", background: "rgba(214,168,79,0.1)", border: "1px solid rgba(214,168,79,0.22)" };
    return { color: "#D65037", background: "rgba(214,80,55,0.1)", border: "1px solid rgba(214,80,55,0.22)" };
}

export default function VaultDocumentList(props: {
    documents: VaultDocument[];
    filteredDocuments: VaultDocument[];
    loading: boolean;
    error: string | null;
    selectedDocumentId: string | null;
    onSelectDocument: (documentId: string) => void;
    onRefresh: () => void;
    onArchive: (documentId: string) => void;
    archivingDocumentId: string | null;
    hasSearchOrFilter: boolean;
    folderNameById: Record<string, string>;
    onOpenNeedsWizard: () => void;
    onGenerateDocument: () => void;
}) {
    const {
        documents, filteredDocuments, loading, error, selectedDocumentId, onSelectDocument, onRefresh,
        onArchive, archivingDocumentId, hasSearchOrFilter, folderNameById, onOpenNeedsWizard, onGenerateDocument,
    } = props;

    return (
        <div style={{
            borderRadius: 16,
            border: "1px solid rgba(7,26,47,0.07)",
            background: "rgba(7,26,47,0.02)",
            overflow: "hidden",
        }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(7,26,47,0.06)", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                    <div style={{ fontSize: 15, fontFamily: "var(--tekori-font-brand)", fontWeight: 700 }}>Vault Documents</div>
                    <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", marginTop: 2 }}>{filteredDocuments.length} visible</div>
                </div>
                <button
                    onClick={onRefresh}
                    style={{ background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 8, padding: "7px 10px", color: "var(--color-text-muted)", fontSize: 11, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}
                >
                    Refresh
                </button>
            </div>

            <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto", padding: 12 }}>
                {loading && (
                    <div style={{ padding: "22px 10px", color: "var(--foundry-text-secondary)", fontSize: 12 }}>Loading vault documents...</div>
                )}
                {!loading && error && (
                    <div style={{ padding: "18px 12px", color: "#D28B76", fontSize: 12, lineHeight: 1.6 }}>
                        {error}
                    </div>
                )}
                {!loading && !error && documents.length === 0 && (
                    <div style={{ padding: "28px 14px", textAlign: "center" }}>
                        <FolderOpen size={40} color="rgba(7,26,47,0.18)" style={{ marginBottom: 12 }} />
                        <div style={{ fontSize: 18, color: "rgba(7,26,47,0.88)", fontFamily: "var(--tekori-font-ui)", marginBottom: 8 }}>Your vault is empty</div>
                        <div style={{ fontSize: 13, color: "rgba(16,32,51,0.58)", lineHeight: 1.6, fontFamily: "var(--tekori-font-ui)", margin: "0 auto 16px", maxWidth: 330 }}>
                            Every document Navi generates lives here — organized, versioned, and ready when you need it. Start by telling Navi what you need.
                        </div>
                        <div style={{ display: "grid", gap: 8, maxWidth: 260, margin: "0 auto" }}>
                            <button
                                onClick={onOpenNeedsWizard}
                                style={{ padding: "10px 13px", background: "rgba(216,155,43,0.08)", border: "1px solid rgba(216,155,43,0.18)", borderRadius: 10, color: "var(--tekori-gold)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}
                            >
                                What documents do I need? →
                            </button>
                            <button
                                onClick={onGenerateDocument}
                                style={{ padding: "10px 13px", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 10, color: "var(--color-text-soft)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}
                            >
                                Generate a document →
                            </button>
                        </div>
                    </div>
                )}
                {!loading && !error && documents.length > 0 && filteredDocuments.length === 0 && (
                    <div style={{ padding: "28px 14px", textAlign: "center" }}>
                        <MagnifyingGlass size={24} color="var(--color-text-muted)" style={{ marginBottom: 10 }} />
                        <div style={{ fontSize: 14, color: "var(--color-text-muted)", marginBottom: 4 }}>No matching documents</div>
                        <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>
                            {hasSearchOrFilter ? "Try widening your search, category, or status filters." : "No results right now."}
                        </div>
                    </div>
                )}
                {!loading && !error && filteredDocuments.map((doc) => {
                    const isActive = doc.id === selectedDocumentId;
                    const healthScore = getDocumentHealthScore(doc);
                    const healthStyle = healthScore == null ? null : healthColor(healthScore);
                    return (
                        <button
                            key={doc.id}
                            onClick={() => onSelectDocument(doc.id)}
                            style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "14px 14px 13px",
                                borderRadius: 12,
                                border: isActive ? "1px solid rgba(216,155,43,0.24)" : "1px solid rgba(7,26,47,0.06)",
                                background: isActive ? "rgba(216,155,43,0.08)" : "rgba(7,26,47,0.018)",
                                marginBottom: 8,
                                cursor: "pointer",
                                fontFamily: "var(--tekori-font-ui)",
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
                                    <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", marginTop: 3 }}>
                                        {doc.docType}{doc.category ? ` · ${doc.category}` : ""}{doc.folderId ? ` · ${folderNameById[doc.folderId] || "Folder"}` : " · Unfiled"}
                                    </div>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                                    <StatusBadge status={doc.status} />
                                    {healthScore != null && healthStyle && (
                                        <span style={{ padding: "3px 7px", borderRadius: 999, fontSize: 9, fontWeight: 700, color: healthStyle.color, background: healthStyle.background, border: healthStyle.border, whiteSpace: "nowrap" }}>
                                            {healthScore}% health
                                        </span>
                                    )}
                                    <StageBadge stageId={doc.stageId} />
                                </div>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                <div style={{ fontSize: 10, color: "var(--foundry-text-muted)" }}>Updated {formatShortDate(doc.updatedAt)} · {doc.currentVersionId ? "Version ready" : "Legacy record without a linked vault version yet"}</div>
                                {doc.status !== "archived" && (
                                    <span
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onArchive(doc.id);
                                        }}
                                        style={{ fontSize: 10, color: archivingDocumentId === doc.id ? "var(--color-text-soft)" : "var(--color-text-muted)", cursor: "pointer", whiteSpace: "nowrap" }}
                                    >
                                        {archivingDocumentId === doc.id ? "Archiving..." : "Archive"}
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

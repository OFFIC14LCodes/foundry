import { useState, type ReactNode } from "react";
import { FolderOpen } from "@phosphor-icons/react";
import type { DocumentFolder, DocumentVersion, VaultDocument } from "../../db";
import { StatusBadge, formatShortDate, getVersionPreviewLabel } from "./shared";

export default function VaultDetailPanel(props: {
    document: VaultDocument | null;
    loading: boolean;
    folderNameById: Record<string, string>;
    versionCount: number;
    folders: DocumentFolder[];
    movingDocumentId: string | null;
    onMoveToFolder: (documentId: string, folderId: string | null) => void;
    selectedVersion: DocumentVersion | null;
    versions: DocumentVersion[];
    versionsLoading: boolean;
    versionsError: string | null;
    onSelectVersion: (versionId: string) => void;
    onRestoreVersion: (version: DocumentVersion) => void;
    restoringVersionId: string | null;
    previewNode: ReactNode;
    filesPanel: ReactNode;
    signaturesPanel: ReactNode;
}) {
    const {
        document, loading, folderNameById, versionCount, folders, movingDocumentId, onMoveToFolder,
        selectedVersion, versions, versionsLoading, versionsError, onSelectVersion, onRestoreVersion, restoringVersionId,
        previewNode, filesPanel, signaturesPanel,
    } = props;
    const [compareVersion, setCompareVersion] = useState<DocumentVersion | null>(null);
    const latestVersion = versions[0] ?? null;

    const renderParagraphs = (content: string, compareContent: string, mode: "old" | "new") => {
        const ownParas = content.split("\n\n").map((p) => p.trim()).filter(Boolean);
        const otherParas = compareContent.split("\n\n").map((p) => p.trim()).filter(Boolean);
        const changed = new Set(ownParas.filter((p) => !otherParas.includes(p)));

        return ownParas.map((paragraph, index) => {
            const isChanged = changed.has(paragraph);
            return (
                <p
                    key={`${mode}-${index}`}
                    style={{
                        margin: "0 0 12px",
                        padding: isChanged ? "8px 10px" : "0",
                        background: isChanged ? (mode === "old" ? "rgba(232,98,42,0.08)" : "rgba(76,175,138,0.08)") : "transparent",
                        borderLeft: isChanged ? (mode === "old" ? "2px solid rgba(232,98,42,0.4)" : "2px solid rgba(76,175,138,0.4)") : "none",
                        color: "#F0EDE8",
                        fontFamily: "'DM Sans', system-ui, sans-serif",
                        fontSize: 13,
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                    }}
                >
                    {paragraph}
                </p>
            );
        });
    };

    return (
        <div style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.025)",
            minHeight: 520,
            overflow: "hidden",
        }}>
            {!document && !loading ? (
                <div style={{ padding: "40px 28px", textAlign: "center" }}>
                    <FolderOpen size={30} color="#555" style={{ marginBottom: 10 }} />
                    <div style={{ fontSize: 15, color: "#D0CCC6", marginBottom: 4 }}>Select a document</div>
                    <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
                        Choose a vault document to inspect its content, versions, files, and future signature state.
                    </div>
                </div>
            ) : (
                <>
                    <div style={{ padding: "18px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {loading || !document ? (
                            <div style={{ color: "#666", fontSize: 12 }}>Loading document detail...</div>
                        ) : (
                            <>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 20, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, lineHeight: 1.25 }}>{document.title}</div>
                                        <div style={{ fontSize: 12, color: "#777", marginTop: 5 }}>
                                            {document.docType}
                                            {document.category ? ` · ${document.category}` : ""}
                                            {document.folderId ? ` · ${folderNameById[document.folderId] || "Folder"}` : " · Unfiled"}
                                        </div>
                                    </div>
                                    <StatusBadge status={document.status} />
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11, color: "#666" }}>
                                    <span>Created {formatShortDate(document.createdAt)}</span>
                                    <span>Updated {formatShortDate(document.updatedAt)}</span>
                                    <span>{getVersionPreviewLabel(versionCount)}</span>
                                    {!document.currentVersionId && <span>Legacy mirror pending full version linkage</span>}
                                </div>
                                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 11, color: "#777" }}>Folder</span>
                                    <select
                                        value={document.folderId ?? "unfiled"}
                                        onChange={(event) => onMoveToFolder(document.id, event.target.value === "unfiled" ? null : event.target.value)}
                                        disabled={movingDocumentId === document.id}
                                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "7px 10px", color: "#F0EDE8", fontSize: 11, fontFamily: "'Lora', Georgia, serif", colorScheme: "dark" }}
                                    >
                                        <option value="unfiled">Unfiled</option>
                                        {folders.map((folder) => (
                                            <option key={folder.id} value={folder.id}>{folder.name}</option>
                                        ))}
                                    </select>
                                    {movingDocumentId === document.id && <span style={{ fontSize: 11, color: "#666" }}>Moving...</span>}
                                </div>
                            </>
                        )}
                    </div>

                    {!loading && document && (
                        <div style={{ padding: 18, display: "grid", gap: 18 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 0.9fr)", gap: 18, alignItems: "start" }}>
                                {previewNode}

                                <div style={{ display: "grid", gap: 14 }}>
                                    <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, background: "rgba(255,255,255,0.018)", overflow: "hidden" }}>
                                        <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                            <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 600 }}>Version History</div>
                                            <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>Immutable snapshots from the normalized vault</div>
                                        </div>
                                        <div style={{ maxHeight: 290, overflowY: "auto", padding: 12 }}>
                                            {versionsLoading && <div style={{ fontSize: 12, color: "#666", padding: "8px 4px" }}>Loading versions...</div>}
                                            {!versionsLoading && versionsError && <div style={{ fontSize: 12, color: "#D28B76", lineHeight: 1.6, padding: "8px 4px" }}>{versionsError}</div>}
                                            {!versionsLoading && !versionsError && versions.length === 0 && (
                                                <div style={{ padding: "20px 8px", textAlign: "center", fontSize: 12, color: "#666", lineHeight: 1.6 }}>
                                                    No versions found for this document yet.
                                                </div>
                                            )}
                                            {!versionsLoading && !versionsError && versions.map((version) => {
                                                const active = version.id === selectedVersion?.id;
                                                const isLatest = version.id === latestVersion?.id;
                                                return (
                                                    <button
                                                        key={version.id}
                                                        onClick={() => onSelectVersion(version.id)}
                                                        style={{
                                                            width: "100%",
                                                            textAlign: "left",
                                                            padding: "12px 12px 11px",
                                                            borderRadius: 12,
                                                            border: active ? "1px solid rgba(232,98,42,0.24)" : "1px solid rgba(255,255,255,0.06)",
                                                            background: active ? "rgba(232,98,42,0.08)" : "rgba(255,255,255,0.018)",
                                                            marginBottom: 8,
                                                            cursor: "pointer",
                                                            fontFamily: "'Lora', Georgia, serif",
                                                        }}
                                                    >
                                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                                                            <span style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600 }}>Version {version.versionNumber}</span>
                                                            <span style={{ fontSize: 10, color: "#666" }}>{formatShortDate(version.createdAt)}</span>
                                                        </div>
                                                        <div style={{ fontSize: 11, color: "#777", marginBottom: 4 }}>{version.source}</div>
                                                        <div style={{ fontSize: 11, color: "#666", lineHeight: 1.55 }}>
                                                            {version.changeSummary || "No change summary provided."}
                                                        </div>
                                                        {!isLatest && (
                                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 9 }}>
                                                                <span
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setCompareVersion(version);
                                                                    }}
                                                                    style={{ padding: "6px 9px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#C8C4BE", fontSize: 10, cursor: "pointer" }}
                                                                >
                                                                    Compare with Latest
                                                                </span>
                                                                <span
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        onRestoreVersion(version);
                                                                    }}
                                                                    style={{ padding: "6px 9px", borderRadius: 8, background: "rgba(232,98,42,0.08)", border: "1px solid rgba(232,98,42,0.18)", color: "#E8622A", fontSize: 10, cursor: restoringVersionId === version.id ? "wait" : "pointer", fontWeight: 600 }}
                                                                >
                                                                    {restoringVersionId === version.id ? "Restoring..." : "Restore this version"}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {filesPanel}
                                    {signaturesPanel}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
            {compareVersion && latestVersion && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
                    <div style={{ width: "min(900px, 100%)", maxHeight: "88vh", background: "rgb(12,12,14)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, boxSizing: "border-box" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
                            <div style={{ fontSize: 18, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>Compare Versions</div>
                            <button
                                onClick={() => setCompareVersion(null)}
                                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#888", padding: "6px 10px", cursor: "pointer" }}
                            >
                                Close
                            </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div>
                                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "rgba(240,237,232,0.45)", marginBottom: 8 }}>
                                    Version {compareVersion.versionNumber} — {formatShortDate(compareVersion.createdAt)}
                                </div>
                                <div style={{ maxHeight: "62vh", overflowY: "auto", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14, background: "rgba(255,255,255,0.02)" }}>
                                    {renderParagraphs(compareVersion.content, latestVersion.content, "old")}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 12, color: "rgba(240,237,232,0.45)", marginBottom: 8 }}>
                                    Latest — {formatShortDate(latestVersion.createdAt)}
                                </div>
                                <div style={{ maxHeight: "62vh", overflowY: "auto", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14, background: "rgba(255,255,255,0.02)" }}>
                                    {renderParagraphs(latestVersion.content, compareVersion.content, "new")}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

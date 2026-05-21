import { useState, type ReactNode } from "react";
import { FolderOpen } from "@phosphor-icons/react";
import type { DocumentFolder, DocumentVersion, VaultDocument } from "../../db";
import { StatusBadge, formatShortDate, getVersionPreviewLabel } from "./shared";

type ParsedClause = { name: string; content: string };

function normalizeDocType(value: string) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getLegalRiskNotes(docType: string) {
    const text = normalizeDocType(docType);
    if (text.includes("nda")) return "NDA risk areas: overbroad confidentiality definitions, trade secret treatment, permitted disclosures, duration, remedies, and state limits on restrictive covenants.";
    if (text.includes("operating agreement")) return "Operating agreement risk areas: state LLC default rules, member voting thresholds, fiduciary duties, transfer limits, buyout mechanics, and dissolution rights.";
    if (text.includes("founder")) return "Founder agreement risk areas: equity issuance, vesting, IP chain of title, founder departures, tax elections, securities compliance, and non-compete limits.";
    if (text.includes("consulting")) return "Consulting agreement risk areas: worker classification, deliverable acceptance, payment timing, IP assignment, confidentiality, and liability caps.";
    if (text.includes("terms")) return "Terms of Service risk areas: auto-renewal rules, refund disclosures, consumer protection law, arbitration enforceability, user content rights, and platform policies.";
    if (text.includes("privacy")) return "Privacy policy risk areas: CCPA/CPRA and other state privacy rights, GDPR exposure, cookies, sensitive data, children, retention, and vendor sharing.";
    if (text.includes("ip assignment") || text.includes("intellectual property")) return "IP assignment risk areas: prior employer claims, excluded background IP, open-source obligations, moral rights, invention assignment statutes, and recordable patent or trademark transfers.";
    if (text.includes("employment") || text.includes("offer")) return "Offer letter risk areas: wage/hour classification, at-will language, required state notices, equity plan documents, background checks, and non-compete restrictions.";
    return "Legal risk areas vary by document type, state, parties, and transaction context. Review enforceability, missing deal terms, signatures, notices, and regulated-industry requirements before relying on this draft.";
}

function getDocumentHealthScore(document: VaultDocument) {
    const metadata = document.metadata && typeof document.metadata === "object" ? document.metadata as Record<string, any> : {};
    const health = metadata.documentHealthScore && typeof metadata.documentHealthScore === "object"
        ? metadata.documentHealthScore as Record<string, any>
        : null;
    const score = Number(health?.score);
    const filledRequired = Number(health?.filledRequired);
    const totalRequired = Number(health?.totalRequired);
    return Number.isFinite(score)
        ? { score: Math.max(0, Math.min(100, Math.round(score))), filledRequired, totalRequired }
        : null;
}

function parseClauseMarkers(content: string): ParsedClause[] {
    const clauses: ParsedClause[] = [];
    const regex = /<!--\s*FOUNDRY_CLAUSE:\s*([^>]+?)\s*-->([\s\S]*?)<!--\s*\/FOUNDRY_CLAUSE\s*-->/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
        clauses.push({
            name: match[1].trim(),
            content: match[2].replace(/\s+/g, " ").trim(),
        });
    }
    return clauses;
}

function changedClauseNames(oldContent: string, newContent: string) {
    const oldClauses = parseClauseMarkers(oldContent);
    const newClauses = parseClauseMarkers(newContent);
    const oldByName = new Map(oldClauses.map((clause) => [clause.name.toLowerCase(), clause]));
    const newByName = new Map(newClauses.map((clause) => [clause.name.toLowerCase(), clause]));
    const names = new Set([...oldByName.keys(), ...newByName.keys()]);
    return Array.from(names)
        .filter((name) => oldByName.get(name)?.content !== newByName.get(name)?.content)
        .map((name) => newByName.get(name)?.name || oldByName.get(name)?.name || name);
}

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
    const healthScore = document ? getDocumentHealthScore(document) : null;

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
                        background: isChanged ? (mode === "old" ? "rgba(216,155,43,0.08)" : "rgba(115,135,123,0.10)") : "transparent",
                        borderLeft: isChanged ? (mode === "old" ? "2px solid rgba(216,155,43,0.4)" : "2px solid rgba(115,135,123,0.40)") : "none",
                        color: "var(--color-text)",
                        fontFamily: "var(--tekori-font-ui)",
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
            border: "1px solid rgba(7,26,47,0.07)",
            background: "rgba(7,26,47,0.025)",
            minHeight: 520,
            overflow: "hidden",
        }}>
            {!document && !loading ? (
                <div style={{ padding: "40px 28px", textAlign: "center" }}>
                    <FolderOpen size={30} color="var(--color-text-muted)" style={{ marginBottom: 10 }} />
                    <div style={{ fontSize: 15, color: "var(--color-text-muted)", marginBottom: 4 }}>Select a document</div>
                    <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>
                        Choose a vault document to inspect its content, versions, files, and future signature state.
                    </div>
                </div>
            ) : (
                <>
                    <div style={{ padding: "18px 18px 16px", borderBottom: "1px solid rgba(7,26,47,0.06)" }}>
                        {loading || !document ? (
                            <div style={{ color: "var(--foundry-text-secondary)", fontSize: 12 }}>Loading document detail...</div>
                        ) : (
                            <>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 20, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, lineHeight: 1.25 }}>{document.title}</div>
                                        <div style={{ fontSize: 12, color: "var(--foundry-text-muted)", marginTop: 5 }}>
                                            {document.docType}
                                            {document.category ? ` · ${document.category}` : ""}
                                            {document.folderId ? ` · ${folderNameById[document.folderId] || "Folder"}` : " · Unfiled"}
                                        </div>
                                    </div>
                                    <StatusBadge status={document.status} />
                                </div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11, color: "var(--foundry-text-secondary)" }}>
                                    <span>Created {formatShortDate(document.createdAt)}</span>
                                    <span>Updated {formatShortDate(document.updatedAt)}</span>
                                    <span>{getVersionPreviewLabel(versionCount)}</span>
                                    {healthScore && Number.isFinite(healthScore.totalRequired) && (
                                        <span>{healthScore.score}% health ({healthScore.filledRequired}/{healthScore.totalRequired} required)</span>
                                    )}
                                    {!document.currentVersionId && <span>Legacy mirror pending full version linkage</span>}
                                </div>
                                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 11, color: "var(--foundry-text-muted)" }}>Folder</span>
                                    <select
                                        value={document.folderId ?? "unfiled"}
                                        onChange={(event) => onMoveToFolder(document.id, event.target.value === "unfiled" ? null : event.target.value)}
                                        disabled={movingDocumentId === document.id}
                                        style={{ background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.09)", borderRadius: 10, padding: "7px 10px", color: "var(--color-text)", fontSize: 11, fontFamily: "var(--tekori-font-ui)", colorScheme: "light" }}
                                    >
                                        <option value="unfiled">Unfiled</option>
                                        {folders.map((folder) => (
                                            <option key={folder.id} value={folder.id}>{folder.name}</option>
                                        ))}
                                    </select>
                                    {movingDocumentId === document.id && <span style={{ fontSize: 11, color: "var(--foundry-text-secondary)" }}>Moving...</span>}
                                </div>
                            </>
                        )}
                    </div>

                    {!loading && document && (
                        <div style={{ padding: 18, display: "grid", gap: 18 }}>
                            <div style={{ border: "1px solid rgba(216,155,43,0.18)", borderRadius: 12, background: "rgba(216,155,43,0.06)", padding: "12px 14px" }}>
                                <div style={{ fontSize: 11, color: "var(--tekori-gold)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>Document-specific legal review</div>
                                <div style={{ fontSize: 12, color: "var(--color-text-soft)", lineHeight: 1.65 }}>
                                    {getLegalRiskNotes(document.docType)} Tekori drafts are working documents, not legal advice.
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 0.9fr)", gap: 18, alignItems: "start" }}>
                                {previewNode}

                                <div style={{ display: "grid", gap: 14 }}>
                                    <div style={{ border: "1px solid rgba(7,26,47,0.06)", borderRadius: 14, background: "rgba(7,26,47,0.018)", overflow: "hidden" }}>
                                        <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(7,26,47,0.05)" }}>
                                            <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>Version History</div>
                                            <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", marginTop: 2 }}>Immutable snapshots from the normalized vault</div>
                                        </div>
                                        <div style={{ maxHeight: 290, overflowY: "auto", padding: 12 }}>
                                            {versionsLoading && <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", padding: "8px 4px" }}>Loading versions...</div>}
                                            {!versionsLoading && versionsError && <div style={{ fontSize: 12, color: "var(--color-danger)", lineHeight: 1.6, padding: "8px 4px" }}>{versionsError}</div>}
                                            {!versionsLoading && !versionsError && versions.length === 0 && (
                                                <div style={{ padding: "20px 8px", textAlign: "center", fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>
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
                                                            border: active ? "1px solid rgba(216,155,43,0.24)" : "1px solid rgba(7,26,47,0.06)",
                                                            background: active ? "rgba(216,155,43,0.08)" : "rgba(7,26,47,0.018)",
                                                            marginBottom: 8,
                                                            cursor: "pointer",
                                                            fontFamily: "var(--tekori-font-ui)",
                                                        }}
                                                    >
                                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                                                            <span style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 600 }}>Version {version.versionNumber}</span>
                                                            <span style={{ fontSize: 10, color: "var(--foundry-text-secondary)" }}>{formatShortDate(version.createdAt)}</span>
                                                        </div>
                                                        <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", marginBottom: 4 }}>{version.source}</div>
                                                        <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", lineHeight: 1.55 }}>
                                                            {version.changeSummary || "No change summary provided."}
                                                        </div>
                                                        {!isLatest && (
                                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 9 }}>
                                                                <span
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        setCompareVersion(version);
                                                                    }}
                                                                    style={{ padding: "6px 9px", borderRadius: 8, background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", color: "var(--color-text-soft)", fontSize: 10, cursor: "pointer" }}
                                                                >
                                                                    Compare with Latest
                                                                </span>
                                                                <span
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        onRestoreVersion(version);
                                                                    }}
                                                                    style={{ padding: "6px 9px", borderRadius: 8, background: "rgba(216,155,43,0.08)", border: "1px solid rgba(216,155,43,0.18)", color: "var(--tekori-gold)", fontSize: 10, cursor: restoringVersionId === version.id ? "wait" : "pointer", fontWeight: 600 }}
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
                <div style={{ position: "fixed", inset: 0, background: "rgba(7,26,47,0.72)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
                    <div style={{ width: "min(900px, 100%)", maxHeight: "88vh", background: "var(--color-surface)", border: "1px solid rgba(7,26,47,0.1)", borderRadius: 16, padding: 24, boxSizing: "border-box" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
                            <div style={{ fontSize: 18, fontFamily: "var(--tekori-font-brand)", fontWeight: 700 }}>Compare Versions</div>
                            <button
                                onClick={() => setCompareVersion(null)}
                                style={{ background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 8, color: "var(--color-text-muted)", padding: "6px 10px", cursor: "pointer" }}
                            >
                                Close
                            </button>
                        </div>
                        {changedClauseNames(compareVersion.content, latestVersion.content).length > 0 && (
                            <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(216,155,43,0.14)", background: "rgba(216,155,43,0.06)" }}>
                                <div style={{ fontFamily: "var(--tekori-font-ui)", fontSize: 11, color: "var(--tekori-gold)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Changed clauses</div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {changedClauseNames(compareVersion.content, latestVersion.content).map((name) => (
                                        <span key={name} style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(7,26,47,0.045)", border: "1px solid rgba(7,26,47,0.08)", color: "var(--color-pill-text)", fontSize: 11 }}>
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div>
                                <div style={{ fontFamily: "var(--tekori-font-ui)", fontSize: 12, color: "var(--color-text-muted)", marginBottom: 8 }}>
                                    Version {compareVersion.versionNumber} — {formatShortDate(compareVersion.createdAt)}
                                </div>
                                <div style={{ maxHeight: "62vh", overflowY: "auto", border: "1px solid rgba(7,26,47,0.06)", borderRadius: 12, padding: 14, background: "rgba(7,26,47,0.02)" }}>
                                    {renderParagraphs(compareVersion.content, latestVersion.content, "old")}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontFamily: "var(--tekori-font-ui)", fontSize: 12, color: "var(--color-text-muted)", marginBottom: 8 }}>
                                    Latest — {formatShortDate(latestVersion.createdAt)}
                                </div>
                                <div style={{ maxHeight: "62vh", overflowY: "auto", border: "1px solid rgba(7,26,47,0.06)", borderRadius: 12, padding: 14, background: "rgba(7,26,47,0.02)" }}>
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

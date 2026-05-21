import type { ChangeEvent, RefObject } from "react";
import type { DocumentFile } from "../../db";
import { FILE_KIND_LABELS, NeutralBadge, formatFileSize, formatShortDate } from "./shared";

export default function DocumentFilesPanel(props: {
    files: DocumentFile[];
    loading: boolean;
    error: string | null;
    uploadingFile: boolean;
    fileActionId: string | null;
    onOpenUploadPicker: () => void;
    onRefresh: () => void;
    fileInputRef: RefObject<HTMLInputElement | null>;
    onUploadChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onOpenFile: (fileId: string) => void;
    onDeleteFile: (fileId: string) => void;
    disabled: boolean;
}) {
    const {
        files, loading, error, uploadingFile, fileActionId, onOpenUploadPicker, onRefresh, fileInputRef,
        onUploadChange, onOpenFile, onDeleteFile, disabled,
    } = props;

    return (
        <div style={{ border: "1px solid rgba(7,26,47,0.06)", borderRadius: 14, background: "rgba(7,26,47,0.018)", overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(7,26,47,0.05)", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                    <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>Files</div>
                    <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", marginTop: 2 }}>Attachments plus saved vault artifacts</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                        onClick={onOpenUploadPicker}
                        disabled={disabled || uploadingFile}
                        style={{ padding: "7px 10px", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 8, color: "var(--color-text-soft)", fontSize: 11, cursor: uploadingFile ? "wait" : "pointer", fontFamily: "var(--tekori-font-ui)" }}
                    >
                        {uploadingFile ? "Uploading..." : "Upload Attachment"}
                    </button>
                    <button
                        onClick={onRefresh}
                        style={{ padding: "7px 10px", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 8, color: "var(--color-text-muted)", fontSize: 11, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}
                    >
                        Refresh
                    </button>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={onUploadChange}
                    style={{ display: "none" }}
                />
            </div>
            <div style={{ padding: 12 }}>
                {loading && <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", padding: "8px 4px" }}>Loading files...</div>}
                {!loading && error && <div style={{ fontSize: 12, color: "var(--color-danger)", lineHeight: 1.6, padding: "8px 4px" }}>{error}</div>}
                {!loading && !error && files.length === 0 && (
                    <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6, padding: "14px 4px" }}>
                        No files saved yet. Upload an attachment or save a DOCX/HTML artifact from the preview panel so this document is ready for sharing.
                    </div>
                )}
                {!loading && !error && files.map((file) => (
                    <div
                        key={file.id}
                        style={{
                            padding: "11px 12px",
                            borderRadius: 12,
                            border: "1px solid rgba(7,26,47,0.06)",
                            background: "rgba(7,26,47,0.018)",
                            marginBottom: 8,
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4, alignItems: "flex-start" }}>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.filename}</div>
                                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 3 }}>
                                    <NeutralBadge label={FILE_KIND_LABELS[file.fileKind]} />
                                    <span style={{ fontSize: 10, color: "var(--foundry-text-muted)" }}>{formatFileSize(file.fileSize)}</span>
                                </div>
                            </div>
                            <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", whiteSpace: "nowrap" }}>{formatShortDate(file.createdAt)}</div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                            <div style={{ fontSize: 10, color: "var(--foundry-text-muted)" }}>{file.mimeType}</div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    onClick={() => onOpenFile(file.id)}
                                    disabled={fileActionId === file.id}
                                    style={{ padding: "5px 9px", background: "rgba(216,155,43,0.08)", border: "1px solid rgba(216,155,43,0.18)", borderRadius: 8, color: "var(--tekori-gold)", fontSize: 10, cursor: fileActionId === file.id ? "wait" : "pointer", fontFamily: "var(--tekori-font-ui)" }}
                                >
                                    {fileActionId === file.id ? "Opening..." : "Open"}
                                </button>
                                <button
                                    onClick={() => onDeleteFile(file.id)}
                                    disabled={fileActionId === file.id}
                                    style={{ padding: "5px 9px", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 8, color: "var(--color-text-muted)", fontSize: 10, cursor: fileActionId === file.id ? "wait" : "pointer", fontFamily: "var(--tekori-font-ui)" }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

import type { DocumentFile, DocumentStatus, SignatureRequestStatus } from "../../db";

export type VaultStatusFilter = "active" | "all" | DocumentStatus;
export type FolderFilter = "all" | "unfiled" | string;
export type StageFilter = "all" | "1" | "2" | "3" | "4" | "5" | "6";

export const STAGE_LABELS: Record<number, string> = {
    1: "Idea",
    2: "Plan",
    3: "Legal",
    4: "Finance",
    5: "Launch",
    6: "Growth",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
    draft: "Draft",
    generated: "Ready to Use",
    reviewed: "Ready to Use",
    sent_for_signature: "Sent for Signature",
    partially_signed: "Awaiting Signature",
    signed: "Signed ✓",
    declined: "Signature Declined",
    archived: "Archived",
};

const DOCUMENT_STATUS_STYLES: Record<DocumentStatus, { color: string; background: string; border: string }> = {
    draft: { color: "var(--tekori-slate)", background: "rgba(241,232,216,0.55)", border: "1px solid rgba(48,70,95,0.14)" },
    generated: { color: "var(--tekori-gold)", background: "rgba(216,155,43,0.1)", border: "1px solid rgba(216,155,43,0.22)" },
    reviewed: { color: "var(--tekori-slate)", background: "rgba(48,70,95,0.08)", border: "1px solid rgba(48,70,95,0.18)" },
    sent_for_signature: { color: "var(--tekori-gold)", background: "rgba(244,199,106,0.14)", border: "1px solid rgba(244,199,106,0.30)" },
    partially_signed: { color: "var(--tekori-gold)", background: "rgba(244,199,106,0.14)", border: "1px solid rgba(244,199,106,0.30)" },
    signed: { color: "var(--color-success)", background: "rgba(115,135,123,0.14)", border: "1px solid rgba(115,135,123,0.26)" },
    declined: { color: "var(--color-danger)", background: "rgba(184,92,75,0.10)", border: "1px solid rgba(184,92,75,0.24)" },
    archived: { color: "var(--color-text-muted)", background: "rgba(48,70,95,0.08)", border: "1px solid rgba(48,70,95,0.16)" },
};

export const SIGNATURE_STATUS_LABELS: Record<SignatureRequestStatus, string> = {
    draft: "Draft",
    sent: "Sent",
    viewed: "Viewed",
    completed: "Completed",
    declined: "Declined",
    expired: "Expired",
    canceled: "Canceled",
    error: "Error",
};

const SIGNATURE_STATUS_STYLES: Record<SignatureRequestStatus, { color: string; background: string; border: string }> = {
    draft: { color: "var(--tekori-slate)", background: "rgba(241,232,216,0.55)", border: "1px solid rgba(48,70,95,0.14)" },
    sent: { color: "var(--tekori-gold)", background: "rgba(244,199,106,0.14)", border: "1px solid rgba(244,199,106,0.30)" },
    viewed: { color: "var(--tekori-slate)", background: "rgba(48,70,95,0.08)", border: "1px solid rgba(48,70,95,0.18)" },
    completed: { color: "var(--color-success)", background: "rgba(115,135,123,0.14)", border: "1px solid rgba(115,135,123,0.26)" },
    declined: { color: "var(--color-danger)", background: "rgba(184,92,75,0.10)", border: "1px solid rgba(184,92,75,0.24)" },
    expired: { color: "var(--tekori-slate)", background: "rgba(241,232,216,0.52)", border: "1px solid rgba(48,70,95,0.16)" },
    canceled: { color: "var(--color-text-muted)", background: "rgba(48,70,95,0.08)", border: "1px solid rgba(48,70,95,0.16)" },
    error: { color: "var(--color-danger)", background: "rgba(184,92,75,0.10)", border: "1px solid rgba(184,92,75,0.24)" },
};

export const FILE_KIND_LABELS: Record<DocumentFile["fileKind"], string> = {
    source_upload: "Source Upload",
    generated_pdf: "Generated PDF",
    generated_docx: "Generated DOCX",
    generated_html: "Generated HTML",
    signed_pdf: "Signed PDF",
    attachment: "Attachment",
};

export const RECOMMENDATION_ACTION_LABELS: Record<"generate" | "review_existing" | "upload" | "send_for_signature", string> = {
    generate: "Generate next",
    review_existing: "Review existing",
    upload: "Upload if ready",
    send_for_signature: "Prepare to sign",
};

export function formatShortDate(value?: string | null) {
    if (!value) return "Unknown";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown";
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatFileSize(bytes?: number | null) {
    const value = Number(bytes ?? 0);
    if (!Number.isFinite(value) || value <= 0) return "0 B";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function getVersionPreviewLabel(versionCount: number) {
    return versionCount > 0 ? `v${versionCount}` : "No versions";
}

export function StatusBadge({ status }: { status: DocumentStatus }) {
    const style = DOCUMENT_STATUS_STYLES[status];
    return (
        <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: style.color,
            background: style.background,
            border: style.border,
            whiteSpace: "nowrap",
        }}>
            {DOCUMENT_STATUS_LABELS[status]}
        </span>
    );
}

export function StageBadge({ stageId }: { stageId: number | null }) {
    if (!stageId || !STAGE_LABELS[stageId]) return null;

    return (
        <span style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 8px",
            borderRadius: 4,
            border: "1px solid rgba(7,26,47,0.15)",
            background: "rgba(7,26,47,0.06)",
            color: "rgba(7,26,47,0.88)",
            fontFamily: "var(--tekori-font-ui)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
        }}>
            Stage {stageId}: {STAGE_LABELS[stageId]}
        </span>
    );
}

export function SignatureStatusBadge({ status }: { status: SignatureRequestStatus }) {
    const style = SIGNATURE_STATUS_STYLES[status];
    return (
        <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: style.color,
            background: style.background,
            border: style.border,
            whiteSpace: "nowrap",
        }}>
            {SIGNATURE_STATUS_LABELS[status]}
        </span>
    );
}

export function NeutralBadge({ label }: { label: string }) {
    return (
        <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: "#B8B1A7",
            background: "rgba(7,26,47,0.04)",
            border: "1px solid rgba(7,26,47,0.08)",
            whiteSpace: "nowrap",
        }}>
            {label}
        </span>
    );
}

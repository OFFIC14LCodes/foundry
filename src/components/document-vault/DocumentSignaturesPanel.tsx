import type { DocumentFile, DocumentSignatureEvent, DocumentSignatureRequest, DocumentVersion, SignatureRequestStatus } from "../../db";
import type { SignatureProviderConfigurationStatus, SignatureProviderId } from "../../lib/documentSignatureProviders";
import { SIGNATURE_STATUS_LABELS, SignatureStatusBadge, formatShortDate } from "./shared";

export default function DocumentSignaturesPanel(props: {
    providerConfigurationStatus: SignatureProviderConfigurationStatus[];
    signatureProvider: SignatureProviderId;
    onSignatureProviderChange: (value: SignatureProviderId) => void;
    signatureSignerName: string;
    onSignatureSignerNameChange: (value: string) => void;
    signatureSignerEmail: string;
    onSignatureSignerEmailChange: (value: string) => void;
    signatureExpiresAt: string;
    onSignatureExpiresAtChange: (value: string) => void;
    signatureFileId: string;
    onSignatureFileIdChange: (value: string) => void;
    signatureVersionId: string;
    onSignatureVersionIdChange: (value: string) => void;
    onCreateSignatureRequest: () => void;
    creatingSignatureRequest: boolean;
    requests: DocumentSignatureRequest[];
    requestsLoading: boolean;
    requestsError: string | null;
    selectedRequest: DocumentSignatureRequest | null;
    onSelectRequest: (requestId: string) => void;
    events: DocumentSignatureEvent[];
    eventsLoading: boolean;
    eventsError: string | null;
    files: DocumentFile[];
    versions: DocumentVersion[];
    selectedFile: DocumentFile | null;
    selectedVersion: DocumentVersion | null;
    onRefresh: () => void;
    onStatusAction: (request: DocumentSignatureRequest, status: SignatureRequestStatus, eventType: string) => void;
    signatureActionId: string | null;
}) {
    const selectedFile = props.selectedRequest?.fileId
        ? props.files.find((file) => file.id === props.selectedRequest?.fileId) ?? null
        : null;
    const selectedVersion = props.selectedRequest?.versionId
        ? props.versions.find((version) => version.id === props.selectedRequest?.versionId) ?? null
        : null;

    return (
        <div style={{ border: "1px solid rgba(7,26,47,0.06)", borderRadius: 14, background: "rgba(7,26,47,0.018)", overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(7,26,47,0.05)", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                    <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>Signing</div>
                    <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", marginTop: 2 }}>Local typed signatures for launch</div>
                </div>
                <button
                    onClick={props.onRefresh}
                    style={{ padding: "7px 10px", background: "rgba(7,26,47,0.04)", border: "1px solid rgba(7,26,47,0.08)", borderRadius: 8, color: "var(--color-text-muted)", fontSize: 11, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}
                >
                    Refresh
                </button>
            </div>
            <div style={{ padding: 14, display: "grid", gap: 14 }}>
                <div style={{
                    background: "rgba(48,70,95,0.06)",
                    border: "1px solid rgba(48,70,95,0.16)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontFamily: "var(--tekori-font-ui)",
                    fontSize: 12,
                    color: "rgba(16,32,51,0.76)",
                    lineHeight: 1.6,
                }}>
                    <div style={{ color: "var(--tekori-slate-navy)", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5 }}>
                        E-signature coming later
                    </div>
                    Type a signer name in the preview panel to apply a handwritten-style signature to this document before downloading PDF, DOCX, or HTML. Dropbox Sign and other provider flows are intentionally not active for this launch.
                </div>

                <div style={{ border: "1px solid rgba(7,26,47,0.06)", borderRadius: 12, background: "rgba(7,26,47,0.016)", padding: 12 }}>
                    <div style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 600, marginBottom: 8 }}>Provider Status</div>
                    <div style={{ display: "grid", gap: 8 }}>
                        {props.providerConfigurationStatus.map((provider) => (
                            <div key={provider.id} style={{ padding: "10px 10px 9px", borderRadius: 10, border: "1px solid rgba(7,26,47,0.06)", background: "rgba(7,26,47,0.018)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 4 }}>
                                    <div style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 600 }}>{provider.displayName}</div>
                                    <span style={{
                                        padding: "3px 8px",
                                        borderRadius: 999,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: provider.availableNow ? "var(--color-success)" : "var(--color-text-muted)",
                                        background: provider.availableNow ? "rgba(115,135,123,0.12)" : "rgba(7,26,47,0.04)",
                                        border: provider.availableNow ? "1px solid rgba(115,135,123,0.22)" : "1px solid rgba(7,26,47,0.08)",
                                    }}>
                                        {provider.id === "mock" ? "Not used" : provider.availableNow ? "Configured" : "Coming later"}
                                    </span>
                                </div>
                                <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>{provider.message}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ border: "1px solid rgba(7,26,47,0.06)", borderRadius: 12, background: "rgba(7,26,47,0.016)", overflow: "hidden" }}>
                    <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(7,26,47,0.05)" }}>
                        <div style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 600 }}>Legacy Request History</div>
                    </div>
                    <div style={{ padding: 12, maxHeight: 250, overflowY: "auto" }}>
                        {props.requestsLoading && <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", padding: "8px 4px" }}>Loading signature requests...</div>}
                        {!props.requestsLoading && props.requestsError && <div style={{ fontSize: 12, color: "var(--color-danger)", lineHeight: 1.6, padding: "8px 4px" }}>{props.requestsError}</div>}
                        {!props.requestsLoading && !props.requestsError && props.requests.length === 0 && (
                            <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6, padding: "8px 4px" }}>
                                No e-signature requests are linked to this document.
                            </div>
                        )}
                        {!props.requestsLoading && !props.requestsError && props.requests.map((request) => {
                            const active = request.id === props.selectedRequest?.id;
                            const requestFile = request.fileId ? props.files.find((file) => file.id === request.fileId) ?? null : null;
                            const requestVersion = request.versionId ? props.versions.find((version) => version.id === request.versionId) ?? null : null;
                            return (
                                <button
                                    key={request.id}
                                    onClick={() => props.onSelectRequest(request.id)}
                                    style={{ width: "100%", textAlign: "left", padding: "12px 12px 11px", borderRadius: 12, border: active ? "1px solid rgba(216,155,43,0.24)" : "1px solid rgba(7,26,47,0.06)", background: active ? "rgba(216,155,43,0.08)" : "rgba(7,26,47,0.018)", marginBottom: 8, cursor: "pointer", fontFamily: "var(--tekori-font-ui)" }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", marginBottom: 5 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 600 }}>{request.signerName || "Unnamed signer"}</div>
                                            <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", marginTop: 2 }}>{request.signerEmail || "No email"} · {request.provider || "mock"}</div>
                                        </div>
                                        <SignatureStatusBadge status={request.status} />
                                    </div>
                                    <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>
                                        {requestFile ? `File: ${requestFile.filename}` : "No file selected"}
                                        {requestVersion ? ` · Version ${requestVersion.versionNumber}` : ""}
                                    </div>
                                    <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", marginTop: 4, lineHeight: 1.6 }}>
                                        {request.sentAt ? `Sent ${formatShortDate(request.sentAt)}` : "Not sent yet"}
                                        {request.completedAt ? ` · Completed ${formatShortDate(request.completedAt)}` : ""}
                                        {request.declinedAt ? ` · Declined ${formatShortDate(request.declinedAt)}` : ""}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div style={{ border: "1px solid rgba(7,26,47,0.06)", borderRadius: 12, background: "rgba(7,26,47,0.016)", padding: 12 }}>
                    <div style={{ fontSize: 12, color: "var(--color-text)", fontWeight: 600, marginBottom: 8 }}>Request Detail</div>
                    {!props.selectedRequest ? (
                        <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>
                            Select a legacy request to inspect its timeline.
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>{props.selectedRequest.signerName || "Unnamed signer"}</div>
                                    <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", marginTop: 2 }}>{props.selectedRequest.signerEmail || "No email"} · {props.selectedRequest.provider || "mock"}</div>
                                </div>
                                <SignatureStatusBadge status={props.selectedRequest.status} />
                            </div>
                            <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", lineHeight: 1.7 }}>
                                {selectedFile ? `Selected file: ${selectedFile.filename}` : "Selected file: none"}
                                <br />
                                {selectedVersion ? `Selected version: ${selectedVersion.versionNumber}` : "Selected version: current/latest"}
                                <br />
                                {props.selectedRequest.expiresAt ? `Expires ${formatShortDate(props.selectedRequest.expiresAt)}` : "No expiration set"}
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: "var(--color-text)", fontWeight: 600, marginBottom: 8 }}>Events</div>
                                {props.eventsLoading && <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)" }}>Loading event timeline...</div>}
                                {!props.eventsLoading && props.eventsError && <div style={{ fontSize: 12, color: "var(--color-danger)", lineHeight: 1.6 }}>{props.eventsError}</div>}
                                {!props.eventsLoading && !props.eventsError && props.events.length === 0 && (
                                    <div style={{ fontSize: 12, color: "var(--foundry-text-secondary)", lineHeight: 1.6 }}>
                                        No events yet for this request.
                                    </div>
                                )}
                                {!props.eventsLoading && !props.eventsError && props.events.length > 0 && (
                                    <div style={{ display: "grid", gap: 8 }}>
                                        {props.events.map((event) => (
                                            <div key={event.id} style={{ padding: "9px 10px", borderRadius: 10, border: "1px solid rgba(7,26,47,0.06)", background: "rgba(7,26,47,0.018)" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 3 }}>
                                                    <div style={{ fontSize: 11, color: "var(--color-text)", fontWeight: 600 }}>{event.eventType}</div>
                                                    <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)" }}>{formatShortDate(event.occurredAt)}</div>
                                                </div>
                                                <div style={{ fontSize: 10, color: "var(--foundry-text-muted)" }}>
                                                    {event.eventStatus ? SIGNATURE_STATUS_LABELS[event.eventStatus] : "No status payload"}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

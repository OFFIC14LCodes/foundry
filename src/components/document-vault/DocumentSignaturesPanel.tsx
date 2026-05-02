import type { DocumentFile, DocumentSignatureEvent, DocumentSignatureRequest, DocumentVersion, SignatureRequestStatus } from "../../db";
import type { SignatureProviderConfigurationStatus, SignatureProviderId } from "../../lib/documentSignatureProviders";
import { SIGNATURE_STATUS_LABELS, SignatureStatusBadge, formatShortDate } from "./shared";

const SIGNATURE_ACTIONS: Array<{ label: string; status: SignatureRequestStatus; eventType: string }> = [
    { label: "Mark Sent", status: "sent", eventType: "mock_sent" },
    { label: "Mark Viewed", status: "viewed", eventType: "mock_viewed" },
    { label: "Mark Completed", status: "completed", eventType: "mock_completed" },
    { label: "Mark Declined", status: "declined", eventType: "mock_declined" },
    { label: "Cancel Request", status: "canceled", eventType: "mock_canceled" },
];

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
    const {
        providerConfigurationStatus, signatureProvider, onSignatureProviderChange, signatureSignerName,
        onSignatureSignerNameChange, signatureSignerEmail, onSignatureSignerEmailChange, signatureExpiresAt,
        onSignatureExpiresAtChange, signatureFileId, onSignatureFileIdChange, signatureVersionId,
        onSignatureVersionIdChange, onCreateSignatureRequest, creatingSignatureRequest, requests,
        requestsLoading, requestsError, selectedRequest, onSelectRequest, events, eventsLoading,
        eventsError, files, versions, selectedFile, selectedVersion, onRefresh, onStatusAction,
        signatureActionId,
    } = props;
    const hasRealProviderActive = providerConfigurationStatus.some((provider) => provider.id !== "mock" && provider.availableNow);

    return (
        <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, background: "rgba(255,255,255,0.018)", overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                    <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 600 }}>Signatures</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>Provider-agnostic request tracking with a mock lifecycle</div>
                </div>
                <button
                    onClick={onRefresh}
                    style={{ padding: "7px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#888", fontSize: 11, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}
                >
                    Refresh
                </button>
            </div>
            <div style={{ padding: 14, display: "grid", gap: 14 }}>
                {!hasRealProviderActive && (
                    <div style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        padding: "12px 14px",
                        fontFamily: "'DM Sans', system-ui, sans-serif",
                        fontSize: 12,
                        color: "rgba(240,237,232,0.5)",
                        fontStyle: "italic",
                        lineHeight: 1.6,
                    }}>
                        E-signature via Dropbox Sign is coming soon. For now you can track signature status manually using the controls below.
                    </div>
                )}
                <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, background: "rgba(255,255,255,0.016)", padding: 12 }}>
                    <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600, marginBottom: 10 }}>Create Signature Request</div>
                    <div style={{ display: "grid", gap: 8 }}>
                        <input
                            value={signatureSignerName}
                            onChange={(event) => onSignatureSignerNameChange(event.target.value)}
                            placeholder="Signer name"
                            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "9px 11px", color: "#F0EDE8", fontSize: 12, fontFamily: "'Lora', Georgia, serif", boxSizing: "border-box" }}
                        />
                        <input
                            value={signatureSignerEmail}
                            onChange={(event) => onSignatureSignerEmailChange(event.target.value)}
                            placeholder="Signer email"
                            type="email"
                            style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "9px 11px", color: "#F0EDE8", fontSize: 12, fontFamily: "'Lora', Georgia, serif", boxSizing: "border-box" }}
                        />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <select
                                value={signatureProvider}
                                onChange={(event) => onSignatureProviderChange(event.target.value as SignatureProviderId)}
                                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "9px 11px", color: "#F0EDE8", fontSize: 12, fontFamily: "'Lora', Georgia, serif", boxSizing: "border-box", colorScheme: "dark" }}
                            >
                                {providerConfigurationStatus.filter((p) => {
                                    // DocuSign integration planned for future release.
                                    return p.availableNow && p.id !== "docusign";
                                }).map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.id === "mock" ? "Mock provider (dev)" : p.displayName}
                                    </option>
                                ))}
                            </select>
                            <input
                                value={signatureExpiresAt}
                                onChange={(event) => onSignatureExpiresAtChange(event.target.value)}
                                type="date"
                                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "9px 11px", color: "#F0EDE8", fontSize: 12, fontFamily: "'Lora', Georgia, serif", boxSizing: "border-box", colorScheme: "dark" }}
                            />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <select
                                value={signatureFileId}
                                onChange={(event) => onSignatureFileIdChange(event.target.value)}
                                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "9px 11px", color: "#F0EDE8", fontSize: 12, fontFamily: "'Lora', Georgia, serif", boxSizing: "border-box", colorScheme: "dark" }}
                            >
                                <option value="none">No file selected</option>
                                {files.map((file) => (
                                    <option key={file.id} value={file.id}>{file.filename}</option>
                                ))}
                            </select>
                            <select
                                value={signatureVersionId}
                                onChange={(event) => onSignatureVersionIdChange(event.target.value)}
                                style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 10, padding: "9px 11px", color: "#F0EDE8", fontSize: 12, fontFamily: "'Lora', Georgia, serif", boxSizing: "border-box", colorScheme: "dark" }}
                            >
                                <option value="none">Use current version</option>
                                {versions.map((version) => (
                                    <option key={version.id} value={version.id}>Version {version.versionNumber}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={onCreateSignatureRequest}
                            disabled={creatingSignatureRequest}
                            style={{ padding: "10px 12px", background: creatingSignatureRequest ? "rgba(255,255,255,0.06)" : "rgba(232,98,42,0.08)", border: creatingSignatureRequest ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(232,98,42,0.18)", borderRadius: 10, color: creatingSignatureRequest ? "#777" : "#E8622A", fontSize: 12, fontWeight: 600, cursor: creatingSignatureRequest ? "wait" : "pointer", fontFamily: "'Lora', Georgia, serif" }}
                        >
                            {creatingSignatureRequest ? "Creating..." : "Create Signature Request"}
                        </button>
                    </div>
                </div>

                <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, background: "rgba(255,255,255,0.016)", padding: 12 }}>
                    <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600, marginBottom: 8 }}>Provider Availability</div>
                    <div style={{ display: "grid", gap: 8 }}>
                        {providerConfigurationStatus.map((provider) => (
                            <div key={provider.id} style={{ padding: "10px 10px 9px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.018)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 4 }}>
                                    <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600 }}>{provider.displayName}</div>
                                    <span style={{
                                        padding: "3px 8px",
                                        borderRadius: 999,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: provider.availableNow ? "#4CAF8A" : "#888",
                                        background: provider.availableNow ? "rgba(76,175,138,0.1)" : "rgba(255,255,255,0.04)",
                                        border: provider.availableNow ? "1px solid rgba(76,175,138,0.2)" : "1px solid rgba(255,255,255,0.08)",
                                    }}>
                                        {provider.id === "mock" ? "Available now" : provider.availableNow ? "Active" : "Not active"}
                                    </span>
                                </div>
                                <div style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>{provider.message}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, background: "rgba(255,255,255,0.016)", overflow: "hidden" }}>
                    <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600 }}>Requests</div>
                    </div>
                    <div style={{ padding: 12, maxHeight: 250, overflowY: "auto" }}>
                        {requestsLoading && <div style={{ fontSize: 12, color: "#666", padding: "8px 4px" }}>Loading signature requests...</div>}
                        {!requestsLoading && requestsError && <div style={{ fontSize: 12, color: "#D28B76", lineHeight: 1.6, padding: "8px 4px" }}>{requestsError}</div>}
                        {!requestsLoading && !requestsError && requests.length === 0 && (
                            <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6, padding: "8px 4px" }}>
                                No signature requests yet. Create one above to start the mock lifecycle.
                            </div>
                        )}
                        {!requestsLoading && !requestsError && requests.map((request) => {
                            const active = request.id === selectedRequest?.id;
                            const requestFile = request.fileId ? files.find((file) => file.id === request.fileId) ?? null : null;
                            const requestVersion = request.versionId ? versions.find((version) => version.id === request.versionId) ?? null : null;
                            return (
                                <button
                                    key={request.id}
                                    onClick={() => onSelectRequest(request.id)}
                                    style={{ width: "100%", textAlign: "left", padding: "12px 12px 11px", borderRadius: 12, border: active ? "1px solid rgba(232,98,42,0.24)" : "1px solid rgba(255,255,255,0.06)", background: active ? "rgba(232,98,42,0.08)" : "rgba(255,255,255,0.018)", marginBottom: 8, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}
                                >
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", marginBottom: 5 }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600 }}>{request.signerName || "Unnamed signer"}</div>
                                            <div style={{ fontSize: 10, color: "#777", marginTop: 2 }}>{request.signerEmail || "No email"} · {request.provider || "mock"}</div>
                                        </div>
                                        <SignatureStatusBadge status={request.status} />
                                    </div>
                                    <div style={{ fontSize: 10, color: "#666", lineHeight: 1.6 }}>
                                        {requestFile ? `File: ${requestFile.filename}` : "No file selected"}
                                        {requestVersion ? ` · Version ${requestVersion.versionNumber}` : ""}
                                    </div>
                                    <div style={{ fontSize: 10, color: "#555", marginTop: 4, lineHeight: 1.6 }}>
                                        {request.sentAt ? `Sent ${formatShortDate(request.sentAt)}` : "Not sent yet"}
                                        {request.completedAt ? ` · Completed ${formatShortDate(request.completedAt)}` : ""}
                                        {request.declinedAt ? ` · Declined ${formatShortDate(request.declinedAt)}` : ""}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, background: "rgba(255,255,255,0.016)", padding: 12 }}>
                    <div style={{ fontSize: 12, color: "#F0EDE8", fontWeight: 600, marginBottom: 8 }}>Request Detail</div>
                    {!selectedRequest ? (
                        <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
                            Select a signature request to inspect its timeline and mock status controls.
                        </div>
                    ) : (
                        <div style={{ display: "grid", gap: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 600 }}>{selectedRequest.signerName || "Unnamed signer"}</div>
                                    <div style={{ fontSize: 11, color: "#777", marginTop: 2 }}>{selectedRequest.signerEmail || "No email"} · {selectedRequest.provider || "mock"}</div>
                                </div>
                                <SignatureStatusBadge status={selectedRequest.status} />
                            </div>
                            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.7 }}>
                                {selectedFile ? `Selected file: ${selectedFile.filename}` : "Selected file: none"}
                                <br />
                                {selectedVersion ? `Selected version: ${selectedVersion.versionNumber}` : "Selected version: current/latest"}
                                <br />
                                {selectedRequest.expiresAt ? `Expires ${formatShortDate(selectedRequest.expiresAt)}` : "No expiration set"}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                {SIGNATURE_ACTIONS.map((action) => (
                                    <button
                                        key={action.label}
                                        onClick={() => onStatusAction(selectedRequest, action.status, action.eventType)}
                                        disabled={signatureActionId === selectedRequest.id}
                                        style={{ padding: "7px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#C8C4BE", fontSize: 10, cursor: signatureActionId === selectedRequest.id ? "wait" : "pointer", fontFamily: "'Lora', Georgia, serif" }}
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: "#F0EDE8", fontWeight: 600, marginBottom: 8 }}>Events</div>
                                {eventsLoading && <div style={{ fontSize: 12, color: "#666" }}>Loading event timeline...</div>}
                                {!eventsLoading && eventsError && <div style={{ fontSize: 12, color: "#D28B76", lineHeight: 1.6 }}>{eventsError}</div>}
                                {!eventsLoading && !eventsError && events.length === 0 && (
                                    <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>
                                        No events yet for this request.
                                    </div>
                                )}
                                {!eventsLoading && !eventsError && events.length > 0 && (
                                    <div style={{ display: "grid", gap: 8 }}>
                                        {events.map((event) => (
                                            <div key={event.id} style={{ padding: "9px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.018)" }}>
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 3 }}>
                                                    <div style={{ fontSize: 11, color: "#F0EDE8", fontWeight: 600 }}>{event.eventType}</div>
                                                    <div style={{ fontSize: 10, color: "#666" }}>{formatShortDate(event.occurredAt)}</div>
                                                </div>
                                                <div style={{ fontSize: 10, color: "#777" }}>
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

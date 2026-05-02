// ---------------------------------------------------------------------------
// SECURITY NOTE — environment variables in this file
// ---------------------------------------------------------------------------
// Variables prefixed with VITE_ are bundled into client-side JavaScript and
// are visible to anyone who opens browser DevTools or inspects the JS bundle.
// Never place API keys, secrets, or private tokens in VITE_ variables.
//
// Safe for VITE_ (not secrets):
//   VITE_SIGNATURE_PROVIDER     — which provider is active: "mock" | "dropbox_sign" | "docusign"
//   VITE_DROPBOX_SIGN_CLIENT_ID — OAuth app client ID for the embedded signing widget only
//
// Must live in Supabase Edge Function secrets ONLY (never in .env, never VITE_):
//   DROPBOX_SIGN_API_KEY
//   DROPBOX_SIGN_WEBHOOK_SECRET
//   DOCUSIGN_INTEGRATION_KEY
//   DOCUSIGN_PRIVATE_KEY_BASE64
//   DOCUSIGN_USER_ID
//   DOCUSIGN_ACCOUNT_ID
// ---------------------------------------------------------------------------

import { supabase } from "../supabase";
import type { DocumentSignatureRequest, SignatureRequestStatus } from "../db";

export type SignatureProviderId = "mock" | "docusign" | "dropbox_sign";

export type SignatureProviderCapability =
    | "single_signer"
    | "multi_signer"
    | "embedded_signing"
    | "email_signing"
    | "webhooks"
    | "reminders"
    | "signed_pdf_download";

export interface SignatureProviderError {
    code: string;
    message: string;
    configured: boolean;
}

export interface SignatureProviderOperationResult {
    ok: boolean;
    providerId: SignatureProviderId;
    providerRequestId: string | null;
    status: SignatureRequestStatus | null;
    metadata?: Record<string, unknown>;
    error?: SignatureProviderError;
}

export interface CreateSignatureRequestPayload {
    requestId: string;
    documentId: string;
    versionId?: string | null;
    fileId?: string | null;
    signerName?: string | null;
    signerEmail?: string | null;
    metadata?: Record<string, unknown>;
}

export interface NormalizeWebhookEventPayload {
    headers?: Record<string, string | string[] | undefined>;
    body?: unknown;
    rawBody?: string;
}

export interface NormalizedSignatureWebhookEvent {
    providerId: SignatureProviderId;
    externalRequestId: string | null;
    eventType: string;
    eventStatus: SignatureRequestStatus | null;
    occurredAt: string | null;
    payload: Record<string, unknown>;
}

export interface NormalizedSignatureWebhookResult {
    ok: boolean;
    event?: NormalizedSignatureWebhookEvent;
    error?: SignatureProviderError;
}

export interface SignatureProviderAdapter {
    id: SignatureProviderId;
    displayName: string;
    capabilities: SignatureProviderCapability[];
    createSignatureRequest(payload: CreateSignatureRequestPayload): Promise<SignatureProviderOperationResult>;
    cancelSignatureRequest(request: DocumentSignatureRequest): Promise<SignatureProviderOperationResult>;
    getSignatureRequestStatus(request: DocumentSignatureRequest): Promise<SignatureProviderOperationResult>;
    normalizeWebhookEvent(payload: NormalizeWebhookEventPayload): Promise<NormalizedSignatureWebhookResult>;
}

export interface SignatureProviderConfigurationStatus {
    id: SignatureProviderId;
    displayName: string;
    configured: boolean;
    availableNow: boolean;
    message: string;
    capabilities: SignatureProviderCapability[];
}

function buildProviderError(
    code: string,
    message: string,
    configured: boolean,
): SignatureProviderError {
    return { code, message, configured };
}

function buildUnconfiguredResult(providerId: SignatureProviderId, displayName: string): SignatureProviderOperationResult {
    return {
        ok: false,
        providerId,
        providerRequestId: null,
        status: null,
        error: buildProviderError(
            "provider_not_configured",
            `${displayName} is not configured yet.`,
            false,
        ),
        metadata: {
            placeholder: true,
        },
    };
}

function buildUnconfiguredWebhookResult(providerId: SignatureProviderId, displayName: string): NormalizedSignatureWebhookResult {
    return {
        ok: false,
        error: buildProviderError(
            "provider_not_configured",
            `${displayName} webhook handling is not configured yet.`,
            false,
        ),
    };
}

// ---------------------------------------------------------------------------
// Edge Function call helpers
// ---------------------------------------------------------------------------

// Calls a signature Edge Function with the caller's JWT.
// Derives the base URL from VITE_SUPABASE_URL (safe — not a secret).
// Throws an Error with the provider's error message on non-2xx responses.
async function callSignatureFunction(
    functionName: string,
    payload: Record<string, unknown>,
    token: string,
): Promise<Record<string, unknown>> {
    const env = import.meta.env as Record<string, string | undefined>;
    const baseUrl = (env["VITE_SUPABASE_URL"] ?? "").replace(/\/$/, "");
    if (!baseUrl) throw new Error("VITE_SUPABASE_URL is not set — cannot call Edge Function.");

    const resp = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({})) as Record<string, unknown>;

    if (!resp.ok) {
        const msg = typeof data.error === "string" && data.error
            ? data.error
            : `${functionName} failed (HTTP ${resp.status}).`;
        throw new Error(msg);
    }

    return data;
}

// Returns the current Supabase session access token, or an empty string when
// no session is active. An empty string means the Edge Function will return
// 401, which the adapter surfaces as a clean error.
async function getSessionToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? "";
}

// Reads VITE_SIGNATURE_PROVIDER, the single safe client-side indicator of
// which provider has been activated. Set this to "dropbox_sign" or "docusign"
// in your .env file — it is not a secret.
function getActiveProviderId(): SignatureProviderId | null {
    const env = import.meta.env as Record<string, string | undefined>;
    const v = env["VITE_SIGNATURE_PROVIDER"]?.trim() ?? "";
    if (v === "mock" || v === "dropbox_sign" || v === "docusign") return v as SignatureProviderId;
    return null;
}

// Returns true when the given provider is the one selected via
// VITE_SIGNATURE_PROVIDER (or when the provider is "mock", which is always
// available). Does NOT check for API keys — those live in Edge Function
// secrets and are never visible to client code.
export function isProviderActive(providerId: SignatureProviderId): boolean {
    if (providerId === "mock") return true;
    return getActiveProviderId() === providerId;
}

// Kept for backwards-compatibility; delegates to isProviderActive.
export function isProviderConfigured(providerId: SignatureProviderId): boolean {
    return isProviderActive(providerId);
}

function createMockAdapter(): SignatureProviderAdapter {
    return {
        id: "mock",
        displayName: "Mock provider",
        capabilities: [
            "single_signer",
            "email_signing",
            "webhooks",
        ],
        async createSignatureRequest(payload) {
            return {
                ok: true,
                providerId: "mock",
                providerRequestId: `mock_${payload.requestId}`,
                status: "draft",
                metadata: {
                    placeholder: true,
                    action: "create_signature_request",
                },
            };
        },
        async cancelSignatureRequest(request) {
            return {
                ok: true,
                providerId: "mock",
                providerRequestId: request.providerRequestId ?? `mock_${request.id}`,
                status: "canceled",
                metadata: {
                    placeholder: true,
                    action: "cancel_signature_request",
                },
            };
        },
        async getSignatureRequestStatus(request) {
            return {
                ok: true,
                providerId: "mock",
                providerRequestId: request.providerRequestId ?? `mock_${request.id}`,
                status: request.status,
                metadata: {
                    placeholder: true,
                    action: "get_signature_request_status",
                },
            };
        },
        async normalizeWebhookEvent(payload) {
            const body = payload.body && typeof payload.body === "object"
                ? payload.body as Record<string, unknown>
                : {};
            return {
                ok: true,
                event: {
                    providerId: "mock",
                    externalRequestId: typeof body.requestId === "string" ? body.requestId : null,
                    eventType: typeof body.eventType === "string" ? body.eventType : "mock_event",
                    eventStatus: typeof body.eventStatus === "string" ? body.eventStatus as SignatureRequestStatus : null,
                    occurredAt: typeof body.occurredAt === "string" ? body.occurredAt : new Date().toISOString(),
                    payload: body,
                },
            };
        },
    };
}

function createUnconfiguredAdapter(
    id: Exclude<SignatureProviderId, "mock">,
    displayName: string,
    capabilities: SignatureProviderCapability[],
): SignatureProviderAdapter {
    return {
        id,
        displayName,
        capabilities,
        async createSignatureRequest() {
            return buildUnconfiguredResult(id, displayName);
        },
        async cancelSignatureRequest() {
            return buildUnconfiguredResult(id, displayName);
        },
        async getSignatureRequestStatus() {
            return buildUnconfiguredResult(id, displayName);
        },
        async normalizeWebhookEvent() {
            return buildUnconfiguredWebhookResult(id, displayName);
        },
    };
}

// ---------------------------------------------------------------------------
// Dropbox Sign adapter — wired to Edge Function skeletons.
// No provider API calls are made here. Real Dropbox Sign API calls live
// exclusively inside supabase/functions/sign-*/index.ts (server-side secrets).
// ---------------------------------------------------------------------------
function createDropboxSignAdapter(): SignatureProviderAdapter {
    const id: SignatureProviderId = "dropbox_sign";
    const displayName = "Dropbox Sign";
    const capabilities: SignatureProviderCapability[] = [
        "single_signer",
        "multi_signer",
        "email_signing",
        "webhooks",
        "reminders",
        "signed_pdf_download",
    ];

    return {
        id,
        displayName,
        capabilities,

        async createSignatureRequest(payload) {
            const token = await getSessionToken();
            if (!token) {
                return {
                    ok: false,
                    providerId: id,
                    providerRequestId: null,
                    status: null,
                    error: buildProviderError(
                        "no_session",
                        "No active session. Please sign in before sending a document for signature.",
                        true,
                    ),
                };
            }
            try {
                const result = await callSignatureFunction("sign-request", {
                    documentId: payload.documentId,
                    versionId: payload.versionId ?? null,
                    fileId: payload.fileId ?? null,
                    signerName: payload.signerName ?? "",
                    signerEmail: payload.signerEmail ?? "",
                    provider: "dropbox_sign",
                }, token);

                return {
                    ok: true,
                    providerId: id,
                    providerRequestId: typeof result.providerRequestId === "string" ? result.providerRequestId : null,
                    status: typeof result.status === "string" ? result.status as SignatureRequestStatus : "draft",
                    metadata: {
                        // signatureRequestId is the database row ID returned by the Edge Function.
                        // The UI uses this to create a local signature event and refresh the list.
                        signatureRequestId: result.signatureRequestId,
                        _mock: result._mock,
                    },
                };
            } catch (error) {
                return {
                    ok: false,
                    providerId: id,
                    providerRequestId: null,
                    status: null,
                    error: buildProviderError(
                        "request_failed",
                        error instanceof Error ? error.message : "Failed to create signature request.",
                        true,
                    ),
                };
            }
        },

        async cancelSignatureRequest(request) {
            const token = await getSessionToken();
            if (!token) {
                return {
                    ok: false,
                    providerId: id,
                    providerRequestId: request.providerRequestId ?? null,
                    status: null,
                    error: buildProviderError(
                        "no_session",
                        "No active session. Please sign in to cancel this request.",
                        true,
                    ),
                };
            }
            try {
                const result = await callSignatureFunction("sign-cancel", {
                    signatureRequestId: request.id,
                }, token);

                return {
                    ok: true,
                    providerId: id,
                    providerRequestId: request.providerRequestId ?? null,
                    status: typeof result.status === "string" ? result.status as SignatureRequestStatus : "canceled",
                    metadata: { _mock: result._mock },
                };
            } catch (error) {
                return {
                    ok: false,
                    providerId: id,
                    providerRequestId: request.providerRequestId ?? null,
                    status: null,
                    error: buildProviderError(
                        "cancel_failed",
                        error instanceof Error ? error.message : "Failed to cancel signature request.",
                        true,
                    ),
                };
            }
        },

        async getSignatureRequestStatus(request) {
            // Returns the locally cached status from the database row.
            // The sign-webhook Edge Function keeps this current via database
            // updates when provider events arrive. A dedicated polling
            // endpoint will be added in Phase 2.
            return {
                ok: true,
                providerId: id,
                providerRequestId: request.providerRequestId ?? null,
                status: request.status,
                metadata: { source: "local_cache" },
            };
        },

        async normalizeWebhookEvent() {
            // Webhook normalization runs server-side in sign-webhook/index.ts.
            // This client-side stub is intentionally non-functional.
            return buildUnconfiguredWebhookResult(id, displayName);
        },
    };
}

export const signatureProviderRegistry: Record<SignatureProviderId, SignatureProviderAdapter> = {
    mock: createMockAdapter(),
    docusign: createUnconfiguredAdapter("docusign", "DocuSign", [
        "single_signer",
        "multi_signer",
        "embedded_signing",
        "email_signing",
        "webhooks",
        "reminders",
        "signed_pdf_download",
    ]),
    dropbox_sign: createDropboxSignAdapter(),
};

export function getSignatureProviderAdapter(providerId: SignatureProviderId) {
    return signatureProviderRegistry[providerId];
}

export function getProviderConfigurationStatus(): SignatureProviderConfigurationStatus[] {
    const activeId = getActiveProviderId();
    return Object.values(signatureProviderRegistry).map((provider) => {
        const active = isProviderActive(provider.id);
        return {
            id: provider.id,
            displayName: provider.displayName,
            // "configured" means this provider has been activated via VITE_SIGNATURE_PROVIDER.
            // It does NOT mean API keys are present — those are server-side only.
            configured: active,
            availableNow: active,
            message: provider.id === "mock"
                ? "Available for local development and testing."
                : active
                    ? `Activated via VITE_SIGNATURE_PROVIDER. API credentials must be set as Edge Function secrets — not in .env.`
                    : activeId
                        ? `Not active. Set VITE_SIGNATURE_PROVIDER=${provider.id} to activate.`
                        : "Not active. Set VITE_SIGNATURE_PROVIDER in your .env to activate a provider.",
            capabilities: provider.capabilities,
        };
    });
}

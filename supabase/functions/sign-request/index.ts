// =============================================================================
// sign-request — Create a signature request for a document
// =============================================================================
// SECURITY RULES:
//   - All provider API keys must be set as Supabase Edge Function secrets via
//     `supabase secrets set` or the dashboard. They are NEVER in .env and
//     NEVER in VITE_ prefixed variables. The VITE_ prefix bundles values into
//     the client-side JavaScript bundle, making them visible to anyone.
//   - The user JWT is validated on every request. Only the document owner may
//     create a signature request for their document.
//   - The service-role client is used only for Storage downloads (bypasses
//     RLS by design). All database reads/writes use explicit user_id checks.
//
// PHASE 2: Real Dropbox Sign integration — guarded by two independent gates.
//   Gate 1 (client):  VITE_SIGNATURE_PROVIDER=dropbox_sign must be set in .env.
//                     Without it the UI only shows the mock provider.
//   Gate 2 (server):  DROPBOX_SIGN_API_KEY must exist as an Edge Function secret.
//                     Without it this function returns 503 before touching Dropbox.
//
// Cost-free default: both gates are OFF. Set VITE_SIGNATURE_PROVIDER=mock (or
// leave it unset) and no paid provider account is needed for development.
//
// Launch checklist — do these before switching to dropbox_sign:
//   1. supabase secrets set DROPBOX_SIGN_API_KEY=<api_key>
//   2. supabase secrets set DROPBOX_SIGN_WEBHOOK_SECRET=<webhook_secret>
//   3. Register https://<project-ref>.supabase.co/functions/v1/sign-webhook
//      in the Dropbox Sign dashboard (app.hellosign.com/api/settings).
//   4. Implement HMAC verification in sign-webhook/index.ts.
//   5. Implement signed PDF download in sign-download/index.ts.
//   6. Set VITE_SIGNATURE_PROVIDER=dropbox_sign in production environment.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SignRequestBody = {
    documentId: string;
    versionId?: string | null;
    fileId?: string | null;
    signerName: string;
    signerEmail: string;
    provider: "mock" | "dropbox_sign" | "docusign";
};

type DocumentRecord = {
    id: string;
    title: string;
    status: string;
    user_id: string;
};

type DocumentFileRecord = {
    id: string;
    storage_bucket: string;
    storage_path: string;
    filename: string;
    mime_type: string;
};

// Partial Dropbox Sign v3 API response shapes.
// Full spec: https://developers.hellosign.com/api/reference/operation/signatureRequestSend/
type DropboxSignApiResponse = {
    signature_request?: {
        signature_request_id?: string;
        title?: string;
        subject?: string;
        message?: string;
        is_complete?: boolean;
        has_error?: boolean;
        created_at?: number;
        signing_url?: string | null;
        details_url?: string;
        requester_email_address?: string;
        signatures?: Array<{
            signature_id?: string;
            signer_email_address?: string;
            signer_name?: string;
            status_code?: string;
        }>;
    };
    // Error shape returned by Dropbox Sign on non-2xx responses.
    error?: {
        error_name?: string;
        error_msg?: string;
        status_code?: number;
    };
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_PROVIDERS = new Set(["mock", "dropbox_sign", "docusign"]);

const DROPBOX_SIGN_SEND_URL = "https://api.hellosign.com/v3/signature_request/send";

const DEFAULT_SIGNATURE_MESSAGE = "Please review and sign this document through Foundry.";

// Document statuses that are safe to advance to sent_for_signature.
// Never overwrite terminal states (signed, declined, archived).
const STATUSES_SAFE_TO_ADVANCE = new Set(["draft", "generated", "reviewed"]);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        if (request.method !== "POST") {
            return jsonResponse({ error: "Method not allowed." }, 405);
        }

        // ── Environment ────────────────────────────────────────────────────
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        if (!supabaseUrl || !serviceRoleKey) {
            return jsonResponse({ error: "Missing Supabase environment variables." }, 500);
        }

        // ── Auth ───────────────────────────────────────────────────────────
        // The service-role client lets us call auth.getUser() and Storage.
        // All DB queries still include explicit user_id checks.
        const serviceClient = createClient(supabaseUrl, serviceRoleKey);
        const authHeader = request.headers.get("Authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
        if (!token || authError || !user) {
            return jsonResponse({ error: "Unauthorized." }, 401);
        }

        // ── Parse and validate body ────────────────────────────────────────
        const body = await request.json().catch(() => null) as SignRequestBody | null;
        if (!body || typeof body !== "object") {
            return jsonResponse({ error: "Invalid request body." }, 400);
        }

        const { documentId, versionId, fileId, signerName, signerEmail, provider } = body;

        if (!documentId || typeof documentId !== "string") {
            return jsonResponse({ error: "documentId is required." }, 400);
        }
        if (!signerName || typeof signerName !== "string") {
            return jsonResponse({ error: "signerName is required." }, 400);
        }
        if (!signerEmail || typeof signerEmail !== "string" || !signerEmail.includes("@")) {
            return jsonResponse({ error: "A valid signerEmail is required." }, 400);
        }
        if (!provider || !VALID_PROVIDERS.has(provider)) {
            return jsonResponse({
                error: `provider must be one of: ${[...VALID_PROVIDERS].join(", ")}.`,
            }, 400);
        }

        // ── Document ownership check ───────────────────────────────────────
        const { data: document, error: docError } = await serviceClient
            .from("documents")
            .select("id, title, status, user_id")
            .eq("id", documentId)
            .eq("user_id", user.id)
            .maybeSingle() as { data: DocumentRecord | null; error: unknown };

        if (docError || !document) {
            return jsonResponse({ error: "Document not found or access denied." }, 404);
        }

        // ── File validation ────────────────────────────────────────────────
        // Load all fields we need for the provider call, not just the id.
        // The query's .eq("user_id") and .eq("document_id") enforce ownership.
        let fileRecord: DocumentFileRecord | null = null;
        if (fileId) {
            const { data: fileRow, error: fileError } = await serviceClient
                .from("document_files")
                .select("id, storage_bucket, storage_path, filename, mime_type")
                .eq("id", fileId)
                .eq("document_id", documentId)
                .eq("user_id", user.id)
                .maybeSingle() as { data: DocumentFileRecord | null; error: unknown };

            if (fileError || !fileRow) {
                return jsonResponse({
                    error: "File not found or does not belong to this document.",
                }, 404);
            }
            fileRecord = fileRow;
        }

        // ── Provider dispatch ──────────────────────────────────────────────

        let providerRequestId: string;
        let providerStatus: string;
        let providerMetadata: Record<string, unknown>;

        if (provider === "dropbox_sign") {
            // ── Require a file ─────────────────────────────────────────────
            // Dropbox Sign sends the actual file to the signer. Without a
            // stored file there is nothing to sign.
            if (!fileId || !fileRecord) {
                return jsonResponse({
                    error: "A stored document file (fileId) is required to send via Dropbox Sign. "
                        + "Save this document as a PDF or upload a file before sending for signature.",
                }, 400);
            }

            // ── Gate 2: server-side API key check ─────────────────────────
            // TODO (launch): set this secret before activating Dropbox Sign:
            //   supabase secrets set DROPBOX_SIGN_API_KEY=<your_api_key>
            // This key is NEVER in .env and NEVER in a VITE_ variable.
            const apiKey = Deno.env.get("DROPBOX_SIGN_API_KEY") ?? "";
            if (!apiKey) {
                return jsonResponse({
                    error: "Dropbox Sign provider is not configured yet. "
                        + "Set DROPBOX_SIGN_API_KEY as a Supabase Edge Function secret to activate it. "
                        + "Use VITE_SIGNATURE_PROVIDER=mock for development.",
                    _unconfigured: true,
                }, 503);
            }

            // ── Download file from private Supabase Storage ────────────────
            // The service-role client bypasses RLS and has full storage read
            // access. Ownership was already verified above via the DB query.
            const { data: fileBlob, error: downloadError } = await serviceClient.storage
                .from(fileRecord.storage_bucket)
                .download(fileRecord.storage_path);

            if (downloadError || !fileBlob) {
                console.error("[sign-request] Storage download failed:", downloadError);
                return jsonResponse({
                    error: "Could not retrieve the document file from storage. "
                        + "The file may have been deleted — please re-upload and try again.",
                }, 500);
            }

            // ── Build multipart/form-data payload ──────────────────────────
            // Do NOT set Content-Type manually. Deno's fetch injects the
            // boundary automatically when the body is a FormData instance.
            const form = new FormData();
            form.append("title", document.title);
            form.append("subject", `Please sign: ${document.title}`);
            form.append("message", DEFAULT_SIGNATURE_MESSAGE);
            form.append("signers[0][name]", signerName);
            form.append("signers[0][email_address]", signerEmail);
            form.append("signers[0][order]", "0");
            // Third argument sets the Content-Disposition filename for the part.
            form.append("files[0]", fileBlob, fileRecord.filename);

            // ── Call Dropbox Sign API ──────────────────────────────────────
            // Basic auth: base64(<api_key>:) — empty password, colon required.
            const dsResp = await fetch(DROPBOX_SIGN_SEND_URL, {
                method: "POST",
                headers: {
                    Authorization: `Basic ${btoa(apiKey + ":")}`,
                },
                body: form,
            });

            const dsData = await dsResp.json().catch(() => ({})) as DropboxSignApiResponse;

            if (!dsResp.ok) {
                // Return a safe error — the API key is never included in logs
                // or responses. Sanitize to message and status code only.
                const providerMsg = dsData?.error?.error_msg
                    ?? dsData?.error?.error_name
                    ?? `Dropbox Sign returned HTTP ${dsResp.status}.`;
                console.error("[sign-request] Dropbox Sign API error:", dsResp.status, {
                    error_name: dsData?.error?.error_name,
                    error_msg: dsData?.error?.error_msg,
                });
                return jsonResponse({
                    error: providerMsg,
                    providerStatusCode: dsResp.status,
                }, 502);
            }

            const sigReq = dsData?.signature_request;
            if (!sigReq?.signature_request_id) {
                console.error(
                    "[sign-request] Unexpected Dropbox Sign response shape:",
                    JSON.stringify(dsData).slice(0, 300),
                );
                return jsonResponse({
                    error: "Dropbox Sign returned an unexpected response format. Please try again.",
                }, 502);
            }

            providerRequestId = sigReq.signature_request_id;
            providerStatus = "sent";
            // Store the full provider response for audit trail and future
            // status reconciliation. Cast is safe — stored in a JSONB column.
            providerMetadata = dsData as unknown as Record<string, unknown>;

        } else if (provider === "docusign") {
            // ----------------------------------------------------------------
            // TODO — DOCUSIGN INTEGRATION (future phase)
            // ----------------------------------------------------------------
            // DocuSign requires JWT Grant OAuth with an RSA private key.
            // Secrets needed: DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID,
            //   DOCUSIGN_ACCOUNT_ID, DOCUSIGN_PRIVATE_KEY_BASE64, DOCUSIGN_BASE_URL
            // ----------------------------------------------------------------
            providerRequestId = `mock_docusign_${crypto.randomUUID()}`;
            providerStatus = "draft";
            providerMetadata = { skeleton: true };

        } else {
            // mock provider — no external call.
            providerRequestId = `mock_${crypto.randomUUID()}`;
            providerStatus = "draft";
            providerMetadata = { skeleton: true };
        }

        // ── Write signature request to database ────────────────────────────
        const now = new Date().toISOString();
        const { data: signatureRequest, error: insertError } = await serviceClient
            .from("document_signature_requests")
            .insert({
                document_id: documentId,
                user_id: user.id,
                version_id: versionId ?? null,
                file_id: fileId ?? null,
                provider,
                provider_request_id: providerRequestId,
                status: providerStatus,
                signer_name: signerName,
                signer_email: signerEmail,
                sent_at: providerStatus === "sent" ? now : null,
                created_at: now,
                updated_at: now,
                metadata: providerMetadata,
            })
            .select("id, status, provider_request_id")
            .single();

        if (insertError || !signatureRequest) {
            console.error("[sign-request] DB insert failed:", insertError);
            return jsonResponse({ error: "Failed to save signature request." }, 500);
        }

        // ── Advance parent document status ─────────────────────────────────
        // Only update from safe pre-signature states. Never overwrite
        // partially_signed, signed, declined, or archived.
        if (providerStatus === "sent" && STATUSES_SAFE_TO_ADVANCE.has(document.status)) {
            const { error: statusError } = await serviceClient
                .from("documents")
                .update({ status: "sent_for_signature", updated_at: now })
                .eq("id", documentId)
                .eq("user_id", user.id);

            if (statusError) {
                // Non-fatal: signature request exists. Log and return success.
                console.warn("[sign-request] Could not advance document status:", statusError);
            }
        }

        return jsonResponse({
            ok: true,
            signatureRequestId: signatureRequest.id,
            providerRequestId: signatureRequest.provider_request_id,
            status: signatureRequest.status,
            documentId,
            provider,
            _mock: provider === "mock",
        });

    } catch (error) {
        console.error("[sign-request] Unhandled error:", error);
        return jsonResponse({
            error: error instanceof Error ? error.message : "Unexpected error.",
        }, 500);
    }
});

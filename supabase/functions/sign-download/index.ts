// =============================================================================
// sign-download — Retrieve the signed PDF for a completed signature request
// =============================================================================
// SECURITY RULES:
//   - Provider API keys must be set as Supabase Edge Function secrets only.
//     Never VITE_ prefixed. Never in .env committed to source control.
//   - User JWT is validated on every request.
//   - Only the owner of the signature request may download its signed PDF.
//   - Signed PDFs are NEVER served via long-lived public storage URLs.
//     This function either proxies the file stream or returns a short-lived
//     signed URL (60–300 seconds) so the link cannot be shared or cached.
//
// CURRENT STATE: skeleton only — returns a not-implemented message.
// Real download logic (provider fetch → storage save → signed URL) will be
// added in the next phase once the webhook flow is wired up.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type SignDownloadBody = {
    signatureRequestId: string;
};

// Signed storage URLs expire this many seconds after generation.
const SIGNED_URL_TTL_SECONDS = 120;

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
        const serviceClient = createClient(supabaseUrl, serviceRoleKey);
        const authHeader = request.headers.get("Authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
        if (!token || authError || !user) {
            return jsonResponse({ error: "Unauthorized." }, 401);
        }

        // ── Parse body ─────────────────────────────────────────────────────
        const body = await request.json().catch(() => null) as SignDownloadBody | null;
        if (!body || typeof body.signatureRequestId !== "string" || !body.signatureRequestId) {
            return jsonResponse({ error: "signatureRequestId is required." }, 400);
        }

        const { signatureRequestId } = body;

        // ── Ownership check ────────────────────────────────────────────────
        const { data: sigRequest, error: fetchError } = await serviceClient
            .from("document_signature_requests")
            .select("id, status, provider, provider_request_id, document_id")
            .eq("id", signatureRequestId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (fetchError || !sigRequest) {
            return jsonResponse({ error: "Signature request not found or access denied." }, 404);
        }

        // Only completed requests have a signed PDF.
        if (sigRequest.status !== "completed") {
            return jsonResponse({
                error: `Signed PDF is only available for completed requests. Current status: "${sigRequest.status}".`,
                status: sigRequest.status,
            }, 409);
        }

        // ── Look for an existing stored signed PDF ─────────────────────────
        // After Phase 2 webhook integration, the sign-webhook function will
        // automatically download the signed PDF from the provider and save it
        // to Supabase Storage when the completion event fires. This function
        // then just returns a short-lived signed URL for that stored file.
        const { data: signedPdfFile } = await serviceClient
            .from("document_files")
            .select("id, storage_bucket, storage_path, filename")
            .eq("document_id", sigRequest.document_id)
            .eq("user_id", user.id)
            .eq("file_kind", "signed_pdf")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (signedPdfFile) {
            // ── Return a short-lived signed storage URL ────────────────────
            // This is the production path: the file was already saved by the
            // webhook handler. Generate a URL that expires quickly.
            const { data: signedUrlData, error: urlError } = await serviceClient.storage
                .from(signedPdfFile.storage_bucket)
                .createSignedUrl(signedPdfFile.storage_path, SIGNED_URL_TTL_SECONDS);

            if (urlError || !signedUrlData?.signedUrl) {
                return jsonResponse({ error: "Failed to generate download URL." }, 500);
            }

            return jsonResponse({
                ok: true,
                url: signedUrlData.signedUrl,
                filename: signedPdfFile.filename,
                expiresInSeconds: SIGNED_URL_TTL_SECONDS,
            });
        }

        // ── Signed PDF not yet stored — provider fetch path ────────────────
        // TODO — DROPBOX SIGN DOWNLOAD (Phase 2)
        // ----------------------------------------------------------------
        // Triggered when the webhook has fired "signature_request_all_signed"
        // but the file was not yet saved (e.g. webhook missed or late).
        //
        // if (sigRequest.provider === "dropbox_sign") {
        //     const apiKey = Deno.env.get("DROPBOX_SIGN_API_KEY") ?? "";
        //     if (!apiKey) return jsonResponse({ error: "Dropbox Sign is not configured." }, 500);
        //
        //     const fileResp = await fetch(
        //         `https://api.hellosign.com/v3/signature_request/files/${sigRequest.provider_request_id}?file_type=pdf`,
        //         { headers: { Authorization: `Basic ${btoa(apiKey + ":")}` } }
        //     );
        //     if (!fileResp.ok) return jsonResponse({ error: "Provider file download failed." }, 502);
        //
        //     const pdfBytes = await fileResp.arrayBuffer();
        //     const storagePath = `users/${user.id}/documents/${sigRequest.document_id}/${Date.now()}-signed.pdf`;
        //
        //     const { error: uploadError } = await serviceClient.storage
        //         .from("document-files")
        //         .upload(storagePath, pdfBytes, { contentType: "application/pdf" });
        //     if (uploadError) return jsonResponse({ error: "Failed to store signed PDF." }, 500);
        //
        //     // Insert document_files row with file_kind = 'signed_pdf'
        //     // ... then generate a signed URL and return it.
        // }
        // ----------------------------------------------------------------

        // TODO — DOCUSIGN DOWNLOAD (future)
        // ----------------------------------------------------------------
        // GET /restapi/v2.1/accounts/{accountId}/envelopes/{envelopeId}/documents/combined
        // ----------------------------------------------------------------

        // Until Phase 2 is complete, return a clear not-implemented message.
        return jsonResponse({
            ok: false,
            message: "Signed PDF download is not yet implemented. The file will be available automatically after webhook integration is complete.",
            signatureRequestId,
            status: sigRequest.status,
        }, 501);
    } catch (error) {
        return jsonResponse({
            error: error instanceof Error ? error.message : "Unexpected error.",
        }, 500);
    }
});

// =============================================================================
// sign-cancel — Cancel an in-progress signature request
// =============================================================================
// SECURITY RULES:
//   - Provider API keys (DROPBOX_SIGN_API_KEY, DOCUSIGN_INTEGRATION_KEY, etc.)
//     must be set as Supabase Edge Function secrets only. Never VITE_ prefixed.
//   - User JWT is validated on every request.
//   - Only the owner of the signature request may cancel it.
//
// CURRENT STATE: skeleton only — returns a mock canceled response.
// Real provider API calls will be added in the next phase.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

type SignCancelBody = {
    signatureRequestId: string;
};

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
        const body = await request.json().catch(() => null) as SignCancelBody | null;
        if (!body || typeof body.signatureRequestId !== "string" || !body.signatureRequestId) {
            return jsonResponse({ error: "signatureRequestId is required." }, 400);
        }

        const { signatureRequestId } = body;

        // ── Ownership check ────────────────────────────────────────────────
        // Only the owner of the signature request may cancel it.
        const { data: sigRequest, error: fetchError } = await serviceClient
            .from("document_signature_requests")
            .select("id, status, provider, provider_request_id, document_id")
            .eq("id", signatureRequestId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (fetchError || !sigRequest) {
            return jsonResponse({ error: "Signature request not found or access denied." }, 404);
        }

        // Guard: already in a terminal state — do not re-cancel.
        const terminalStatuses = new Set(["completed", "declined", "expired", "canceled"]);
        if (terminalStatuses.has(sigRequest.status)) {
            return jsonResponse({
                error: `Cannot cancel a request with status "${sigRequest.status}".`,
                status: sigRequest.status,
            }, 409);
        }

        // ── Provider cancel call ───────────────────────────────────────────
        if (sigRequest.provider === "dropbox_sign") {
            // ----------------------------------------------------------------
            // TODO — DROPBOX SIGN CANCEL (Phase 2)
            // ----------------------------------------------------------------
            // const apiKey = Deno.env.get("DROPBOX_SIGN_API_KEY") ?? "";
            // if (!apiKey) return jsonResponse({ error: "Dropbox Sign is not configured." }, 500);
            //
            // const cancelResp = await fetch(
            //     `https://api.hellosign.com/v3/signature_request/cancel/${sigRequest.provider_request_id}`,
            //     {
            //         method: "POST",
            //         headers: { Authorization: `Basic ${btoa(apiKey + ":")}` },
            //     }
            // );
            // Dropbox Sign returns 200 with an empty body on success.
            // if (!cancelResp.ok) {
            //     const err = await cancelResp.json().catch(() => ({}));
            //     return jsonResponse({ error: err?.error?.error_msg ?? "Provider cancel failed." }, 502);
            // }
            // ----------------------------------------------------------------
        } else if (sigRequest.provider === "docusign") {
            // ----------------------------------------------------------------
            // TODO — DOCUSIGN VOID ENVELOPE (future)
            // ----------------------------------------------------------------
            // Obtain JWT access token, then:
            // PUT /restapi/v2.1/accounts/{accountId}/envelopes/{envelopeId}
            //   body: { status: "voided", voidedReason: "Canceled by sender." }
            // ----------------------------------------------------------------
        }
        // mock provider: no external call needed.

        // ── Update database ────────────────────────────────────────────────
        const { data: updated, error: updateError } = await serviceClient
            .from("document_signature_requests")
            .update({
                status: "canceled",
                updated_at: new Date().toISOString(),
            })
            .eq("id", signatureRequestId)
            .eq("user_id", user.id)
            .select("id, status")
            .single();

        if (updateError || !updated) {
            return jsonResponse({ error: "Failed to update signature request status." }, 500);
        }

        return jsonResponse({
            ok: true,
            signatureRequestId: updated.id,
            status: updated.status,
            _mock: sigRequest.provider === "mock",
        });
    } catch (error) {
        return jsonResponse({
            error: error instanceof Error ? error.message : "Unexpected error.",
        }, 500);
    }
});

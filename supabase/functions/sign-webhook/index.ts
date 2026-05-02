// =============================================================================
// sign-webhook — Receive and process e-signature provider webhook events
// =============================================================================
// SECURITY RULES:
//   - This endpoint is called by provider servers, not by browser clients.
//     It does NOT require a user JWT — providers authenticate via HMAC.
//   - HMAC verification MUST be implemented before going to production.
//     Processing unverified webhooks lets an attacker forge "document signed"
//     events and falsely mark documents as signed.
//   - The webhook secret (DROPBOX_SIGN_WEBHOOK_SECRET, DOCUSIGN_HMAC_KEY)
//     must be set as a Supabase Edge Function secret. Never VITE_ prefixed.
//   - Database writes use the service-role client (bypasses RLS). The handler
//     must explicitly validate record ownership before any write.
//   - All event writes are idempotent: upsert on (provider_request_id, event_type)
//     so retried deliveries do not create duplicate rows.
//
// CURRENT STATE: skeleton only — logs the event, returns a mock accepted response.
// HMAC verification and real status sync will be added in the next phase.
//
// Launch checklist for this function:
//   1. TODO (launch): Register this URL in the Dropbox Sign dashboard
//      (https://app.hellosign.com/api/settings → API → Webhooks):
//        https://<project-ref>.supabase.co/functions/v1/sign-webhook
//      Subscribe to: signature_request_sent, signature_request_viewed,
//        signature_request_all_signed, signature_request_declined,
//        signature_request_expired, signature_request_error
//   2. TODO (launch): Set the HMAC secret as an Edge Function secret:
//        supabase secrets set DROPBOX_SIGN_WEBHOOK_SECRET=<secret_from_dashboard>
//   3. TODO (launch): Uncomment and complete the HMAC verification block below.
//   4. TODO (launch): Uncomment the database write block below.
//   5. TODO (launch): On "signature_request_all_signed", download and store the
//      signed PDF (see sign-download/index.ts for the fetch pattern).
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

// Provider IDs we recognise. The active provider is determined by inspecting
// the request headers and body — not by a VITE_ variable.
type KnownProvider = "dropbox_sign" | "docusign";

// Mapping from provider event strings to our internal SignatureRequestStatus.
const DROPBOX_SIGN_EVENT_MAP: Record<string, string> = {
    signature_request_sent: "sent",
    signature_request_viewed: "viewed",
    signature_request_signed: "partially_signed",   // one signer of many
    signature_request_all_signed: "completed",
    signature_request_declined: "declined",
    signature_request_expired: "expired",
    signature_request_canceled: "canceled",
    signature_request_error: "error",
};

// DocuSign envelope status → our status (for future use).
const DOCUSIGN_STATUS_MAP: Record<string, string> = {
    sent: "sent",
    delivered: "viewed",
    completed: "completed",
    declined: "declined",
    voided: "canceled",
};

Deno.serve(async (request) => {
    // Webhook endpoints receive server-to-server POST requests. No preflight
    // is needed from a browser, but we handle OPTIONS for consistency.
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed." }, 405);
    }

    // ── Environment ──────────────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
        return jsonResponse({ error: "Missing Supabase environment variables." }, 500);
    }

    // Read the raw body BEFORE parsing JSON. HMAC is computed over the raw bytes.
    const rawBody = await request.text();

    // ── Detect provider from headers ─────────────────────────────────────────
    // Dropbox Sign sends X-HelloSign-Signature.
    // DocuSign sends X-DocuSign-Signature-1 (or similar).
    const dropboxSignature = request.headers.get("x-hellosign-signature") ?? "";
    const docusignSignature = request.headers.get("x-docusign-signature-1") ?? "";

    let detectedProvider: KnownProvider | null = null;
    if (dropboxSignature) detectedProvider = "dropbox_sign";
    else if (docusignSignature) detectedProvider = "docusign";

    // ── HMAC verification (REQUIRED before production) ───────────────────────
    if (detectedProvider === "dropbox_sign") {
        // --------------------------------------------------------------------
        // TODO — DROPBOX SIGN HMAC VERIFICATION (Phase 2)
        // --------------------------------------------------------------------
        // Dropbox Sign signs the raw request body with HMAC-SHA256 using the
        // webhook secret you set in your Dropbox Sign app settings.
        //
        // const webhookSecret = Deno.env.get("DROPBOX_SIGN_WEBHOOK_SECRET") ?? "";
        // if (!webhookSecret) {
        //     return jsonResponse({ error: "Webhook secret not configured." }, 500);
        // }
        //
        // const encoder = new TextEncoder();
        // const keyData = encoder.encode(webhookSecret);
        // const msgData = encoder.encode(rawBody);
        // const cryptoKey = await crypto.subtle.importKey(
        //     "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
        // );
        // const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
        // const expectedHex = Array.from(new Uint8Array(sig))
        //     .map(b => b.toString(16).padStart(2, "0")).join("");
        //
        // if (dropboxSignature !== expectedHex) {
        //     return jsonResponse({ error: "Invalid webhook signature." }, 401);
        // }
        // --------------------------------------------------------------------
        console.warn("[sign-webhook] Dropbox Sign HMAC verification is NOT yet enabled.");
    } else if (detectedProvider === "docusign") {
        // --------------------------------------------------------------------
        // TODO — DOCUSIGN HMAC VERIFICATION (future)
        // --------------------------------------------------------------------
        // DocuSign can be configured with an HMAC key in the Connect settings.
        // The verification process is similar to Dropbox Sign above.
        //
        // const hmacKey = Deno.env.get("DOCUSIGN_HMAC_KEY") ?? "";
        // Compute HMAC-SHA256 of rawBody, compare with docusignSignature.
        // --------------------------------------------------------------------
        console.warn("[sign-webhook] DocuSign HMAC verification is NOT yet enabled.");
    } else {
        // No recognised signature header. Accept for now (skeleton mode only).
        // In production, reject any request without a valid provider signature.
        console.warn("[sign-webhook] No recognised provider signature header. Accepting in skeleton mode only.");
    }

    // ── Parse the event payload ───────────────────────────────────────────────
    let parsedBody: Record<string, unknown>;
    try {
        parsedBody = JSON.parse(rawBody);
    } catch {
        return jsonResponse({ error: "Invalid JSON body." }, 400);
    }

    // ── Extract provider-specific fields ─────────────────────────────────────
    let externalRequestId: string | null = null;
    let eventType: string | null = null;
    let mappedStatus: string | null = null;
    let occurredAt: string = new Date().toISOString();

    if (detectedProvider === "dropbox_sign") {
        // ----------------------------------------------------------------
        // TODO — DROPBOX SIGN EVENT PARSING (Phase 2)
        // ----------------------------------------------------------------
        // Dropbox Sign wraps everything in a `signature_request` object.
        // Example payload shape:
        // {
        //   "event": {
        //     "event_type": "signature_request_all_signed",
        //     "event_time": "1234567890",
        //     "event_hash": "...",
        //     "event_metadata": { "related_signature_id": "...", ... }
        //   },
        //   "signature_request": {
        //     "signature_request_id": "abc123...",
        //     "title": "My Document",
        //     "original_title": "My Document",
        //     "subject": "...",
        //     "requester_email_address": "...",
        //     "signatures": [...]
        //   }
        // }
        //
        // const event = parsedBody.event as Record<string, unknown>;
        // const sigReq = parsedBody.signature_request as Record<string, unknown>;
        // externalRequestId = sigReq?.signature_request_id as string ?? null;
        // eventType = event?.event_type as string ?? null;
        // mappedStatus = DROPBOX_SIGN_EVENT_MAP[eventType ?? ""] ?? null;
        // const unixTs = event?.event_time as string ?? null;
        // if (unixTs) occurredAt = new Date(Number(unixTs) * 1000).toISOString();
        // ----------------------------------------------------------------
        externalRequestId = (parsedBody as Record<string, Record<string, unknown>>)
            ?.signature_request?.signature_request_id as string ?? null;
        eventType = (parsedBody as Record<string, Record<string, unknown>>)
            ?.event?.event_type as string ?? null;
        mappedStatus = DROPBOX_SIGN_EVENT_MAP[eventType ?? ""] ?? null;
    } else if (detectedProvider === "docusign") {
        // ----------------------------------------------------------------
        // TODO — DOCUSIGN EVENT PARSING (future)
        // ----------------------------------------------------------------
        // DocuSign Connect payloads vary by configuration (XML or JSON).
        // With JSON notification:
        // {
        //   "envelopeId": "...",
        //   "status": "completed",
        //   "statusChangedDateTime": "2026-05-01T12:00:00Z",
        //   ...
        // }
        //
        // externalRequestId = parsedBody.envelopeId as string ?? null;
        // eventType = parsedBody.status as string ?? null;
        // mappedStatus = DOCUSIGN_STATUS_MAP[eventType ?? ""] ?? null;
        // occurredAt = parsedBody.statusChangedDateTime as string ?? occurredAt;
        // ----------------------------------------------------------------
        externalRequestId = parsedBody.envelopeId as string ?? null;
        eventType = parsedBody.status as string ?? null;
        mappedStatus = DOCUSIGN_STATUS_MAP[eventType ?? ""] ?? null;
    } else {
        // Unknown provider — accept and log, but do not persist.
        console.log("[sign-webhook] Unknown provider. Raw body:", rawBody.slice(0, 500));
        return jsonResponse({ received: true, persisted: false });
    }

    // ── Persist the event ─────────────────────────────────────────────────────
    // TODO — DATABASE WRITES (Phase 2)
    // ----------------------------------------------------------------
    // 1. Look up the document_signature_requests row by provider_request_id:
    //    const { data: sigRequest } = await serviceClient
    //        .from("document_signature_requests")
    //        .select("id, document_id, user_id, status")
    //        .eq("provider", detectedProvider)
    //        .eq("provider_request_id", externalRequestId)
    //        .maybeSingle();
    //
    //    if (!sigRequest) {
    //        // Unknown request — log and return 200 so the provider does not retry.
    //        console.warn("[sign-webhook] Unknown provider_request_id:", externalRequestId);
    //        return jsonResponse({ received: true, persisted: false });
    //    }
    //
    // 2. Insert a signature event (idempotent upsert):
    //    await serviceClient
    //        .from("document_signature_events")
    //        .upsert({
    //            signature_request_id: sigRequest.id,
    //            document_id: sigRequest.document_id,
    //            user_id: sigRequest.user_id,
    //            provider: detectedProvider,
    //            event_type: eventType,
    //            event_status: mappedStatus,
    //            payload: parsedBody,
    //            occurred_at: occurredAt,
    //        }, { onConflict: "signature_request_id,event_type" });
    //
    // 3. Update the signature request status:
    //    if (mappedStatus) {
    //        await serviceClient
    //            .from("document_signature_requests")
    //            .update({ status: mappedStatus, updated_at: new Date().toISOString() })
    //            .eq("id", sigRequest.id);
    //    }
    //
    // 4. On "completed" / "signature_request_all_signed":
    //    Download the signed PDF from the provider and save it to Storage
    //    with file_kind = 'signed_pdf'. See sign-download/index.ts for the
    //    provider fetch pattern.
    // ----------------------------------------------------------------

    console.log("[sign-webhook] Received event:", {
        provider: detectedProvider,
        externalRequestId,
        eventType,
        mappedStatus,
        occurredAt,
    });

    // Dropbox Sign requires the literal string "Hello API Event Received" in
    // the response body to acknowledge the event. Other providers use HTTP 200.
    if (detectedProvider === "dropbox_sign") {
        return new Response("Hello API Event Received", {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
    }

    return jsonResponse({ received: true, persisted: false });
});

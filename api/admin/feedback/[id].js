import {
  auditAdminAction,
  createAdminApiError,
  parseJsonBody,
  requireAdminApiContext,
  requireUuid,
  sendAdminApiError,
} from "../../_lib/admin.js";

const VALID_STATUSES = ["new", "reviewed", "fixed", "ignored"];

export default async function handler(req, res) {
  if (req.method !== "PATCH") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { user, serviceClient } = await requireAdminApiContext(req);
    const feedbackId = getFeedbackIdFromRequest(req);
    const body = await parseJsonBody(req);

    const { data: current, error: fetchError } = await serviceClient
      .from("message_feedback")
      .select("id, user_id, reaction, surface, status, admin_note, reviewed_by, reviewed_at")
      .eq("id", feedbackId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!current) throw createAdminApiError(404, "Feedback item not found");

    const updates = {};

    if (body.status != null) {
      const nextStatus = String(body.status).trim();
      if (!VALID_STATUSES.includes(nextStatus)) {
        throw createAdminApiError(400, `status must be one of: ${VALID_STATUSES.join(", ")}`);
      }
      updates.status = nextStatus;
    }

    if (body.admin_note !== undefined) {
      updates.admin_note = body.admin_note == null
        ? null
        : String(body.admin_note).trim().slice(0, 5000) || null;
    }

    if (Object.keys(updates).length === 0) {
      throw createAdminApiError(400, "No valid fields to update");
    }

    // Set reviewed_by/reviewed_at when moving out of "new" for the first time
    const nextStatus = updates.status ?? current.status;
    if (nextStatus !== "new" && !current.reviewed_by) {
      updates.reviewed_by = user.id;
      updates.reviewed_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await serviceClient
      .from("message_feedback")
      .update(updates)
      .eq("id", feedbackId)
      .select("id, user_id, reaction, surface, message_id, message_text, conversation_title, stage_id, status, admin_note, reviewed_by, reviewed_at, created_at")
      .single();

    if (updateError) throw updateError;

    await auditAdminAction(serviceClient, {
      admin_id: user.id,
      target_user_id: current.user_id || null,
      action_type: "admin.feedback.update",
      entity_type: "message_feedback",
      entity_id: feedbackId,
      reason: "Admin feedback review update",
      before_state: { status: current.status, admin_note: current.admin_note },
      after_state: { status: updated.status, admin_note: updated.admin_note },
      metadata: { reaction: current.reaction, surface: current.surface },
    }, req);

    res.status(200).json({ ok: true, feedback: updated });
  } catch (error) {
    sendAdminApiError(res, error, "Unable to update feedback");
  }
}

function getFeedbackIdFromRequest(req) {
  const queryValue = req?.query?.id;
  if (typeof queryValue === "string" && queryValue) {
    return requireUuid(queryValue, "id");
  }
  const url = new URL(req?.url || "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  // path: /api/admin/feedback/:id
  const feedbackIdx = parts.findIndex((p) => p === "feedback");
  return requireUuid(parts[feedbackIdx + 1] || "", "id");
}

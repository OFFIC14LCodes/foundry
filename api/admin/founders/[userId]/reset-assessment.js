import {
  auditAdminAction,
  parseJsonBody,
  requireAdminApiContext,
  requireString,
  requireUuid,
  sendAdminApiError,
  validateAdminReason,
} from "../../../_lib/admin.js";
import { loadLessonState, resetFounderAcademyAssessment } from "../../_lib/academyProgress.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { user, serviceClient } = await requireAdminApiContext(req);
    const userId = getUserIdFromRequest(req);
    const body = await parseJsonBody(req);
    const contentId = requireUuid(body.contentId, "contentId");
    const reason = validateAdminReason(body.reason, { required: true, minLength: 8 });
    const confirmation = requireString(body.confirmation, "confirmation", { maxLength: 80 });
    if (confirmation !== "RESET ASSESSMENT") {
      res.status(400).json({ error: 'confirmation must equal "RESET ASSESSMENT"' });
      return;
    }

    const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : {};

    const result = await resetFounderAcademyAssessment(serviceClient, { userId, contentId });

    await auditAdminAction(serviceClient, {
      admin_id: user.id,
      target_user_id: userId,
      action_type: "academy.assessment.reset",
      entity_type: "academy_content",
      entity_id: contentId,
      reason,
      before_state: result.beforeState,
      after_state: result.afterState,
      metadata,
    }, req);

    const state = await loadLessonState(serviceClient, userId, contentId);
    res.status(200).json({
      ok: true,
      content_id: contentId,
      assessment_summary: state.assessment_summary,
    });
  } catch (error) {
    sendAdminApiError(res, error, "Unable to reset founder Academy assessment");
  }
}

function getUserIdFromRequest(req) {
  const queryValue = req?.query?.userId || req?.query?.user_id;
  if (typeof queryValue === "string" && queryValue) {
    return requireUuid(queryValue, "userId");
  }

  const url = new URL(req?.url || "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  const userIdIndex = parts.findIndex((part) => part === "founders") + 1;
  return requireUuid(parts[userIdIndex] || "", "userId");
}

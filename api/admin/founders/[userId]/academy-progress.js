import {
  auditAdminAction,
  parseJsonBody,
  requireAdminApiContext,
  requireEnum,
  requireUuid,
  sendAdminApiError,
  validateAdminReason,
} from "../../../_lib/admin.js";
import {
  loadFounderAcademyProgress,
  repairFounderAcademyLessonProgress,
} from "../../_lib/academyProgress.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { user, serviceClient } = await requireAdminApiContext(req);
    const userId = getUserIdFromRequest(req);

    if (req.method === "POST") {
      const body = await parseJsonBody(req);
      const contentId = requireUuid(body.contentId, "contentId");
      const status = requireEnum(body.status, "status", ["completed", "in_progress", "not_started"]);
      const reason = validateAdminReason(body.reason, { required: true, minLength: 8 });
      const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata
        : {};

      const result = await repairFounderAcademyLessonProgress(serviceClient, {
        userId,
        contentId,
        status,
      });

      await auditAdminAction(serviceClient, {
        admin_id: user.id,
        target_user_id: userId,
        action_type: "academy.progress.repair",
        entity_type: "academy_content",
        entity_id: contentId,
        reason,
        before_state: result.beforeState,
        after_state: result.afterState,
        metadata: {
          ...metadata,
          repaired_status: status,
        },
      }, req);

      res.status(200).json({ ok: true, lesson: result.lesson });
      return;
    }

    const payload = await loadFounderAcademyProgress(serviceClient, userId);
    res.status(200).json(payload);
  } catch (error) {
    sendAdminApiError(res, error, "Unable to load founder Academy progress");
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

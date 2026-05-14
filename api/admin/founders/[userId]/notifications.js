import {
  auditAdminAction,
  createAdminApiError,
  parseJsonBody,
  requireAdminApiContext,
  requireString,
  requireUuid,
  sendAdminApiError,
} from "../../../_lib/admin.js";

const ALLOWED_TYPES = ["admin_support", "system", "milestone"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { user, serviceClient } = await requireAdminApiContext(req);
    const userId = getUserIdFromRequest(req);
    const body = await parseJsonBody(req);

    const title = requireString(body.title, "title", { minLength: 3, maxLength: 512 });
    const message = requireString(body.message, "message", { minLength: 3, maxLength: 4000 });

    let type = "admin_support";
    if (body.type != null) {
      type = requireString(body.type, "type", { maxLength: 80 });
      if (!ALLOWED_TYPES.includes(type)) {
        throw createAdminApiError(400, `type must be one of: ${ALLOWED_TYPES.join(", ")}`);
      }
    }

    const metadata = normalizeMetadata(body.metadata);
    metadata.created_by_admin = true;
    metadata.admin_id = user.id;

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) throw createAdminApiError(404, "Founder not found");

    const now = new Date().toISOString();
    const insertRow = {
      user_id: userId,
      type,
      title,
      message,
      channel: "in_app",
      status: "sent",
      sent_at: now,
      metadata,
    };

    const { data: created, error: insertError } = await serviceClient
      .from("notifications")
      .insert(insertRow)
      .select("id, user_id, type, title, message, channel, status, sent_at, read_at, metadata, created_at")
      .single();

    if (insertError) throw insertError;

    await auditAdminAction(serviceClient, {
      admin_id: user.id,
      target_user_id: userId,
      action_type: "admin.notification.create",
      entity_type: "notifications",
      entity_id: created.id,
      reason: "Admin-created in-app founder notification",
      before_state: null,
      after_state: { id: created.id, type, title, channel: "in_app" },
      metadata: { notification_type: type, title_length: title.length },
    }, req);

    res.status(201).json({ ok: true, notification: created });
  } catch (error) {
    sendAdminApiError(res, error, "Unable to create founder notification");
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

function normalizeMetadata(value) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw createAdminApiError(400, "metadata must be an object");
  }
  return { ...value };
}

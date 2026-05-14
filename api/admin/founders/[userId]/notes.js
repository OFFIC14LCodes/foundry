import {
  auditAdminAction,
  createAdminApiError,
  parseJsonBody,
  requireAdminApiContext,
  requireEnum,
  requireString,
  requireUuid,
  sendAdminApiError,
} from "../../../_lib/admin.js";

const NOTE_TYPES = ["general", "support", "retention", "billing", "academy", "technical"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { user, serviceClient } = await requireAdminApiContext(req);
    const userId = getUserIdFromRequest(req);
    const body = await parseJsonBody(req);

    const note = requireString(body.note, "note", { minLength: 3, maxLength: 10000 });
    const noteType = requireEnum(body.note_type || "general", "note_type", NOTE_TYPES);
    const linkedEntityType = optionalText(body.linked_entity_type, "linked_entity_type", 160);
    const linkedEntityId = optionalText(body.linked_entity_id, "linked_entity_id", 240);
    const metadata = normalizeMetadata(body.metadata);

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) throw createAdminApiError(404, "Founder not found");

    const insertRow = {
      target_user_id: userId,
      admin_id: user.id,
      note,
      note_type: noteType,
      visibility: "internal",
      linked_entity_type: linkedEntityType,
      linked_entity_id: linkedEntityId,
      metadata,
    };

    const { data: createdNote, error: insertError } = await serviceClient
      .from("admin_support_notes")
      .insert(insertRow)
      .select("id,target_user_id,admin_id,note,note_type,visibility,linked_entity_type,linked_entity_id,metadata,created_at,updated_at")
      .single();

    if (insertError) throw insertError;

    await auditAdminAction(serviceClient, {
      admin_id: user.id,
      target_user_id: userId,
      action_type: "admin.note.create",
      entity_type: "admin_support_notes",
      entity_id: createdNote.id,
      reason: "Internal admin support note created",
      before_state: null,
      after_state: createdNote,
      metadata: {
        note_type: noteType,
        linked_entity_type: linkedEntityType,
        linked_entity_id: linkedEntityId,
      },
    }, req);

    res.status(201).json({ ok: true, note: createdNote });
  } catch (error) {
    sendAdminApiError(res, error, "Unable to create admin support note");
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

function optionalText(value, fieldName, maxLength) {
  if (value == null || value === "") return null;
  return requireString(value, fieldName, { maxLength });
}

function normalizeMetadata(value) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw createAdminApiError(400, "metadata must be an object");
  }
  return value;
}

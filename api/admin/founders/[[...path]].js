import {
  auditAdminAction,
  createAdminApiError,
  parseJsonBody,
  requireAdminApiContext,
  requireEnum,
  requireString,
  requireUuid,
  sendAdminApiError,
  validateAdminReason,
} from "../../_lib/admin.js";
import { loadFounderDetail, loadFounderList, parseListQuery } from "../_lib/founderRoutes.js";
import {
  loadFounderAcademyProgress,
  loadLessonState,
  repairFounderAcademyLessonProgress,
  resetFounderAcademyAssessment,
} from "../_lib/academyProgress.js";

const NOTE_TYPES = ["general", "support", "retention", "billing", "academy", "technical"];
const ALLOWED_NOTIFICATION_TYPES = ["admin_support", "system", "milestone"];

export default async function handler(req, res) {
  try {
    const { user, serviceClient } = await requireAdminApiContext(req);

    const url = new URL(req.url || "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    const foundersIdx = parts.findIndex((p) => p === "founders");
    const rest = parts.slice(foundersIdx + 1);

    // GET /api/admin/founders
    if (rest.length === 0) {
      if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }
      const payload = await loadFounderList(serviceClient, parseListQuery(req));
      res.status(200).json(payload);
      return;
    }

    const userId = requireUuid(rest[0] || "", "userId");
    const subroute = rest[1] || null;

    // GET /api/admin/founders/:userId
    if (!subroute) {
      if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }
      res.status(200).json(await loadFounderDetail(serviceClient, userId));
      return;
    }

    // /api/admin/founders/:userId/academy-progress
    if (subroute === "academy-progress") {
      if (req.method !== "GET" && req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      if (req.method === "POST") {
        const body = await parseJsonBody(req);
        const contentId = requireUuid(body.contentId, "contentId");
        const status = requireEnum(body.status, "status", ["completed", "in_progress", "not_started"]);
        const reason = validateAdminReason(body.reason, { required: true, minLength: 8 });
        const metadata = normalizeMetadata(body.metadata);
        const result = await repairFounderAcademyLessonProgress(serviceClient, { userId, contentId, status });
        await auditAdminAction(serviceClient, {
          admin_id: user.id, target_user_id: userId,
          action_type: "academy.progress.repair", entity_type: "academy_content", entity_id: contentId,
          reason, before_state: result.beforeState, after_state: result.afterState,
          metadata: { ...metadata, repaired_status: status },
        }, req);
        res.status(200).json({ ok: true, lesson: result.lesson });
        return;
      }
      res.status(200).json(await loadFounderAcademyProgress(serviceClient, userId));
      return;
    }

    // /api/admin/founders/:userId/reset-assessment
    if (subroute === "reset-assessment") {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      const body = await parseJsonBody(req);
      const contentId = requireUuid(body.contentId, "contentId");
      const reason = validateAdminReason(body.reason, { required: true, minLength: 8 });
      const confirmation = requireString(body.confirmation, "confirmation", { maxLength: 80 });
      if (confirmation !== "RESET ASSESSMENT") {
        res.status(400).json({ error: 'confirmation must equal "RESET ASSESSMENT"' });
        return;
      }
      const metadata = normalizeMetadata(body.metadata);
      const result = await resetFounderAcademyAssessment(serviceClient, { userId, contentId });
      await auditAdminAction(serviceClient, {
        admin_id: user.id, target_user_id: userId,
        action_type: "academy.assessment.reset", entity_type: "academy_content", entity_id: contentId,
        reason, before_state: result.beforeState, after_state: result.afterState, metadata,
      }, req);
      const state = await loadLessonState(serviceClient, userId, contentId);
      res.status(200).json({ ok: true, content_id: contentId, assessment_summary: state.assessment_summary });
      return;
    }

    // /api/admin/founders/:userId/notes
    if (subroute === "notes") {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      const body = await parseJsonBody(req);
      const note = requireString(body.note, "note", { minLength: 3, maxLength: 10000 });
      const noteType = requireEnum(body.note_type || "general", "note_type", NOTE_TYPES);
      const linkedEntityType = optionalText(body.linked_entity_type, "linked_entity_type", 160);
      const linkedEntityId = optionalText(body.linked_entity_id, "linked_entity_id", 240);
      const metadata = normalizeMetadata(body.metadata);

      const { data: profile, error: profileError } = await serviceClient
        .from("profiles").select("id").eq("id", userId).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw createAdminApiError(404, "Founder not found");

      const { data: createdNote, error: insertError } = await serviceClient
        .from("admin_support_notes")
        .insert({ target_user_id: userId, admin_id: user.id, note, note_type: noteType,
          visibility: "internal", linked_entity_type: linkedEntityType,
          linked_entity_id: linkedEntityId, metadata })
        .select("id,target_user_id,admin_id,note,note_type,visibility,linked_entity_type,linked_entity_id,metadata,created_at,updated_at")
        .single();
      if (insertError) throw insertError;

      await auditAdminAction(serviceClient, {
        admin_id: user.id, target_user_id: userId,
        action_type: "admin.note.create", entity_type: "admin_support_notes", entity_id: createdNote.id,
        reason: "Internal admin support note created", before_state: null, after_state: createdNote,
        metadata: { note_type: noteType, linked_entity_type: linkedEntityType, linked_entity_id: linkedEntityId },
      }, req);
      res.status(201).json({ ok: true, note: createdNote });
      return;
    }

    // /api/admin/founders/:userId/notifications
    if (subroute === "notifications") {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      const body = await parseJsonBody(req);
      const title = requireString(body.title, "title", { minLength: 3, maxLength: 512 });
      const message = requireString(body.message, "message", { minLength: 3, maxLength: 4000 });
      let type = "admin_support";
      if (body.type != null) {
        type = requireString(body.type, "type", { maxLength: 80 });
        if (!ALLOWED_NOTIFICATION_TYPES.includes(type)) {
          throw createAdminApiError(400, `type must be one of: ${ALLOWED_NOTIFICATION_TYPES.join(", ")}`);
        }
      }
      const metadata = normalizeMetadata(body.metadata);
      metadata.created_by_admin = true;
      metadata.admin_id = user.id;

      const { data: profile, error: profileError } = await serviceClient
        .from("profiles").select("id").eq("id", userId).maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw createAdminApiError(404, "Founder not found");

      const now = new Date().toISOString();
      const { data: created, error: insertError } = await serviceClient
        .from("notifications")
        .insert({ user_id: userId, type, title, message, channel: "in_app", status: "sent", sent_at: now, metadata })
        .select("id, user_id, type, title, message, channel, status, sent_at, read_at, metadata, created_at")
        .single();
      if (insertError) throw insertError;

      await auditAdminAction(serviceClient, {
        admin_id: user.id, target_user_id: userId,
        action_type: "admin.notification.create", entity_type: "notifications", entity_id: created.id,
        reason: "Admin-created in-app founder notification", before_state: null,
        after_state: { id: created.id, type, title, channel: "in_app" },
        metadata: { notification_type: type, title_length: title.length },
      }, req);
      res.status(201).json({ ok: true, notification: created });
      return;
    }

    res.status(404).json({ error: "Not found" });
  } catch (error) {
    sendAdminApiError(res, error, "Unable to handle admin founders request");
  }
}

function normalizeMetadata(value) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw createAdminApiError(400, "metadata must be an object");
  }
  return { ...value };
}

function optionalText(value, fieldName, maxLength) {
  if (value == null || value === "") return null;
  return requireString(value, fieldName, { maxLength });
}

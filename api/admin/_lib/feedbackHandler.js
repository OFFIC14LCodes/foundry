import {
  auditAdminAction,
  createAdminApiError,
  parseJsonBody,
  requireAdminApiContext,
  requireUuid,
  sendAdminApiError,
} from "../../_lib/admin.js";

const VALID_STATUSES = ["new", "reviewed", "fixed", "ignored"];
const VALID_REACTIONS = ["up", "down"];

export default async function handler(req, res) {
  try {
    const { user, serviceClient } = await requireAdminApiContext(req);

    const url = new URL(req.url || "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    const feedbackIdx = parts.findIndex((p) => p === "feedback");
    const rest = parts.slice(feedbackIdx + 1);

    // GET /api/admin/feedback
    if (rest.length === 0) {
      if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }

      const params = url.searchParams;
      const status = params.get("status") || "";
      const reaction = params.get("reaction") || "";
      const surface = params.get("surface") || "";
      const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 25)));
      const page = Math.max(1, Number(params.get("page") || 1));
      const offset = (page - 1) * limit;

      if (status && !VALID_STATUSES.includes(status)) {
        res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
        return;
      }
      if (reaction && !VALID_REACTIONS.includes(reaction)) {
        res.status(400).json({ error: "reaction must be up or down" });
        return;
      }

      const applyFilters = (query) => {
        if (status) query = query.eq("status", status);
        if (reaction) query = query.eq("reaction", reaction);
        if (surface) query = query.ilike("surface", `%${surface}%`);
        return query;
      };

      const [countResult, dataResult] = await Promise.all([
        applyFilters(serviceClient.from("message_feedback").select("id", { count: "exact", head: true })),
        applyFilters(
          serviceClient.from("message_feedback")
            .select("id, user_id, reaction, surface, message_id, message_text, conversation_title, stage_id, status, admin_note, reviewed_by, reviewed_at, created_at")
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1)
        ),
      ]);

      if (countResult.error) throw countResult.error;
      if (dataResult.error) throw dataResult.error;

      const items = dataResult.data || [];
      const count = countResult.count || 0;
      const userIds = [...new Set(items.map((i) => i.user_id).filter(Boolean))];
      const profileMap = {};

      if (userIds.length > 0) {
        const { data: profiles } = await serviceClient
          .from("profiles").select("id, email, name, business_name").in("id", userIds);
        for (const p of profiles || []) profileMap[p.id] = p;
      }

      const enriched = items.map((item) => {
        const p = item.user_id ? profileMap[item.user_id] : null;
        return {
          ...item,
          message_text: item.message_text ? item.message_text.slice(0, 2000) : null,
          profile: item.user_id
            ? { user_id: p?.id ?? item.user_id, email: p?.email ?? null, name: p?.name ?? null, business_name: p?.business_name ?? null }
            : null,
        };
      });

      res.status(200).json({ items: enriched, pagination: { limit, page, count, total_pages: Math.max(1, Math.ceil(count / limit)) } });
      return;
    }

    // PATCH /api/admin/feedback/:id
    if (rest.length === 1) {
      if (req.method !== "PATCH") { res.status(405).json({ error: "Method not allowed" }); return; }
      const feedbackId = requireUuid(rest[0] || "", "id");
      const body = await parseJsonBody(req);

      const { data: current, error: fetchError } = await serviceClient
        .from("message_feedback")
        .select("id, user_id, reaction, surface, status, admin_note, reviewed_by, reviewed_at")
        .eq("id", feedbackId).maybeSingle();
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
      if (Object.keys(updates).length === 0) throw createAdminApiError(400, "No valid fields to update");

      const nextStatus = updates.status ?? current.status;
      if (nextStatus !== "new" && !current.reviewed_by) {
        updates.reviewed_by = user.id;
        updates.reviewed_at = new Date().toISOString();
      }

      const { data: updated, error: updateError } = await serviceClient
        .from("message_feedback").update(updates).eq("id", feedbackId)
        .select("id, user_id, reaction, surface, message_id, message_text, conversation_title, stage_id, status, admin_note, reviewed_by, reviewed_at, created_at")
        .single();
      if (updateError) throw updateError;

      await auditAdminAction(serviceClient, {
        admin_id: user.id, target_user_id: current.user_id || null,
        action_type: "admin.feedback.update", entity_type: "message_feedback", entity_id: feedbackId,
        reason: "Admin feedback review update",
        before_state: { status: current.status, admin_note: current.admin_note },
        after_state: { status: updated.status, admin_note: updated.admin_note },
        metadata: { reaction: current.reaction, surface: current.surface },
      }, req);

      res.status(200).json({ ok: true, feedback: updated });
      return;
    }

    res.status(404).json({ error: "Not found" });
  } catch (error) {
    sendAdminApiError(res, error, "Unable to handle admin feedback request");
  }
}

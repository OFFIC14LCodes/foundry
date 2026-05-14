import {
  requireAdminApiContext,
  sendAdminApiError,
} from "../../_lib/admin.js";

const VALID_STATUSES = ["new", "reviewed", "fixed", "ignored"];
const VALID_REACTIONS = ["up", "down"];

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { serviceClient } = await requireAdminApiContext(req);

    const url = new URL(req.url || "/", "http://localhost");
    const params = url.searchParams;

    const status = params.get("status") || "";
    const reaction = params.get("reaction") || "";
    const surface = params.get("surface") || "";
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 25)));
    const page = Math.max(1, Number(params.get("page") || 1));
    const offset = (page - 1) * limit;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    }
    if (reaction && !VALID_REACTIONS.includes(reaction)) {
      return res.status(400).json({ error: "reaction must be up or down" });
    }

    const applyFilters = (query) => {
      if (status) query = query.eq("status", status);
      if (reaction) query = query.eq("reaction", reaction);
      if (surface) query = query.ilike("surface", `%${surface}%`);
      return query;
    };

    const countQuery = applyFilters(
      serviceClient
        .from("message_feedback")
        .select("id", { count: "exact", head: true })
    );

    const dataQuery = applyFilters(
      serviceClient
        .from("message_feedback")
        .select("id, user_id, reaction, surface, message_id, message_text, conversation_title, stage_id, status, admin_note, reviewed_by, reviewed_at, created_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1)
    );

    const [countResult, dataResult] = await Promise.all([countQuery, dataQuery]);

    if (countResult.error) throw countResult.error;
    if (dataResult.error) throw dataResult.error;

    const items = dataResult.data || [];
    const count = countResult.count || 0;

    // Enrich with founder profiles
    const userIds = [...new Set(items.map((i) => i.user_id).filter(Boolean))];
    const profileMap = {};

    if (userIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, email, name, business_name")
        .in("id", userIds);

      for (const p of profiles || []) {
        profileMap[p.id] = p;
      }
    }

    const enriched = items.map((item) => {
      const p = item.user_id ? profileMap[item.user_id] : null;
      return {
        ...item,
        message_text: item.message_text ? item.message_text.slice(0, 2000) : null,
        profile: item.user_id
          ? {
              user_id: p?.id ?? item.user_id,
              email: p?.email ?? null,
              name: p?.name ?? null,
              business_name: p?.business_name ?? null,
            }
          : null,
      };
    });

    res.status(200).json({
      items: enriched,
      pagination: {
        limit,
        page,
        count,
        total_pages: Math.max(1, Math.ceil(count / limit)),
      },
    });
  } catch (error) {
    sendAdminApiError(res, error, "Unable to load feedback");
  }
}

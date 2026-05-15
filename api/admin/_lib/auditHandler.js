import {
  createAdminApiError,
  requireAdminApiContext,
  requireUuid,
  sendAdminApiError,
} from "../../_lib/admin.js";

const MAX_LIMIT = 100;

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { serviceClient } = await requireAdminApiContext(req);
    const query = await parseAuditQuery(req, serviceClient);

    let auditQuery = serviceClient
      .from("admin_actions")
      .select("id,admin_id,target_user_id,action_type,entity_type,entity_id,reason,before_state,after_state,metadata,ip_address,user_agent,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (query.targetUserId) auditQuery = auditQuery.eq("target_user_id", query.targetUserId);
    if (query.adminId) auditQuery = auditQuery.eq("admin_id", query.adminId);
    if (query.actionType) auditQuery = auditQuery.eq("action_type", query.actionType);
    if (query.entityType) auditQuery = auditQuery.eq("entity_type", query.entityType);
    if (query.dateFrom) auditQuery = auditQuery.gte("created_at", query.dateFrom);
    if (query.dateTo) auditQuery = auditQuery.lte("created_at", query.dateTo);
    if (query.searchFilter) auditQuery = auditQuery.or(query.searchFilter);

    const { data, error, count } = await auditQuery;
    if (error) throw error;

    const rows = data || [];
    const profileMap = await loadProfileSummaries(serviceClient, collectUserIds(rows));

    res.status(200).json({
      items: rows.map((row) => ({
        id: row.id,
        admin_id: row.admin_id || null,
        admin_profile: row.admin_id ? profileMap.get(row.admin_id) || null : null,
        target_user_id: row.target_user_id || null,
        target_profile: row.target_user_id ? profileMap.get(row.target_user_id) || null : null,
        action_type: row.action_type,
        entity_type: row.entity_type || null,
        entity_id: row.entity_id || null,
        reason: row.reason || null,
        before_state: row.before_state ?? null,
        after_state: row.after_state ?? null,
        metadata: row.metadata || {},
        ip_address: row.ip_address || null,
        user_agent: row.user_agent || null,
        created_at: row.created_at || null,
      })),
      pagination: {
        limit: query.limit,
        offset: query.offset,
        page: query.page,
        count: count ?? rows.length,
      },
    });
  } catch (error) {
    sendAdminApiError(res, error, "Unable to load admin audit log");
  }
}

async function parseAuditQuery(req, serviceClient) {
  const limit = clampNumber(readQueryValue(req, "limit"), 50, 1, MAX_LIMIT);
  const explicitOffset = parseOptionalInt(readQueryValue(req, "offset"));
  const page = Math.max(parseOptionalInt(readQueryValue(req, "page")) || 1, 1);
  const offset = explicitOffset != null ? Math.max(explicitOffset, 0) : (page - 1) * limit;
  const search = cleanOptionalString(readQueryValue(req, "search"), 160);

  return {
    limit,
    offset,
    page,
    targetUserId: optionalUuid(readQueryValue(req, "target_user_id") || readQueryValue(req, "targetUserId"), "target_user_id"),
    adminId: optionalUuid(readQueryValue(req, "admin_id") || readQueryValue(req, "adminId"), "admin_id"),
    actionType: cleanOptionalString(readQueryValue(req, "action_type") || readQueryValue(req, "actionType"), 160),
    entityType: cleanOptionalString(readQueryValue(req, "entity_type") || readQueryValue(req, "entityType"), 160),
    dateFrom: normalizeDate(readQueryValue(req, "date_from") || readQueryValue(req, "dateFrom"), "date_from", false),
    dateTo: normalizeDate(readQueryValue(req, "date_to") || readQueryValue(req, "dateTo"), "date_to", true),
    searchFilter: search ? await buildSearchFilter(serviceClient, search) : null,
  };
}

async function buildSearchFilter(serviceClient, search) {
  const escaped = escapePostgrestSearch(search);
  if (!escaped) return null;

  const profileIds = await searchProfileIds(serviceClient, escaped);
  const clauses = [
    `action_type.ilike.%${escaped}%`,
    `entity_type.ilike.%${escaped}%`,
    `entity_id.ilike.%${escaped}%`,
    `reason.ilike.%${escaped}%`,
  ];

  if (profileIds.length) {
    const ids = profileIds.join(",");
    clauses.push(`target_user_id.in.(${ids})`);
    clauses.push(`admin_id.in.(${ids})`);
  }

  return clauses.join(",");
}

async function searchProfileIds(serviceClient, escapedSearch) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id")
    .or(`email.ilike.%${escapedSearch}%,name.ilike.%${escapedSearch}%,business_name.ilike.%${escapedSearch}%,idea.ilike.%${escapedSearch}%`)
    .limit(200);
  if (error) throw error;
  return (data || []).map((row) => row.id).filter(Boolean);
}

async function loadProfileSummaries(serviceClient, userIds) {
  if (!userIds.length) return new Map();

  const { data, error } = await serviceClient
    .from("profiles")
    .select("id,email,name,business_name,role")
    .in("id", userIds);
  if (error) throw error;

  const map = new Map((data || []).map((profile) => [
    profile.id,
    summarizeProfile(profile),
  ]));

  const missingIds = userIds.filter((id) => !map.get(id)?.email);
  if (missingIds.length && serviceClient.auth?.admin?.getUserById) {
    const entries = await Promise.all(missingIds.map(async (id) => {
      try {
        const { data: userData, error: userError } = await serviceClient.auth.admin.getUserById(id);
        if (userError || !userData?.user?.email) return null;
        const existing = map.get(id) || { user_id: id, email: null, name: null, business_name: null, role: null };
        return [id, { ...existing, email: userData.user.email }];
      } catch {
        return null;
      }
    }));
    for (const entry of entries) {
      if (entry) map.set(entry[0], entry[1]);
    }
  }

  return map;
}

function collectUserIds(rows) {
  return Array.from(new Set(rows.flatMap((row) => [row.admin_id, row.target_user_id]).filter(Boolean)));
}

function summarizeProfile(profile) {
  return {
    user_id: profile.id,
    email: profile.email || null,
    name: profile.name || null,
    business_name: profile.business_name || null,
    role: profile.role || null,
  };
}

function optionalUuid(value, fieldName) {
  if (value == null || value === "") return null;
  return requireUuid(value, fieldName);
}

function normalizeDate(value, fieldName, endOfDay) {
  const text = cleanOptionalString(value, 80);
  if (!text) return null;
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) {
    throw createAdminApiError(400, `${fieldName} must be a valid date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    if (endOfDay) date.setUTCHours(23, 59, 59, 999);
    else date.setUTCHours(0, 0, 0, 0);
  }
  return date.toISOString();
}

function readQueryValue(req, key) {
  const queryValue = req?.query?.[key];
  if (Array.isArray(queryValue)) return queryValue[0] || "";
  if (typeof queryValue === "string") return queryValue;
  const value = new URL(req?.url || "/", "http://localhost").searchParams.get(key);
  return value || "";
}

function parseOptionalInt(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampNumber(value, fallback, min, max) {
  const parsed = parseOptionalInt(value) ?? fallback;
  return Math.min(Math.max(parsed, min), max);
}

function cleanOptionalString(value, maxLength) {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function escapePostgrestSearch(value) {
  return String(value || "").replace(/[%*,()]/g, "").trim();
}

import { createAdminApiError, requireUuid } from "../../_lib/admin.js";

const OPTIONAL_TABLE_CODES = new Set(["PGRST116", "PGRST200", "PGRST204", "PGRST205"]);

export function parseListQuery(req) {
  const limit = clampNumber(readQueryValue(req, "limit"), 50, 1, 100);
  const explicitOffset = parseOptionalInt(readQueryValue(req, "offset"));
  const page = Math.max(parseOptionalInt(readQueryValue(req, "page")) || 1, 1);
  const offset = explicitOffset != null ? Math.max(explicitOffset, 0) : (page - 1) * limit;
  const stage = parseOptionalInt(readQueryValue(req, "stage"));

  return {
    search: cleanOptionalString(readQueryValue(req, "search"), 120),
    limit,
    offset,
    page,
    accessStatus: cleanOptionalString(readQueryValue(req, "access_status") || readQueryValue(req, "accessStatus"), 80),
    stage: stage && stage >= 1 && stage <= 6 ? stage : null,
  };
}

export function getUserIdFromRequest(req) {
  const queryValue = readQueryValue(req, "userId") || readQueryValue(req, "user_id");
  if (queryValue) return requireUuid(queryValue, "userId");

  const pathname = getRequestUrl(req).pathname;
  const parts = pathname.split("/").filter(Boolean);
  const maybeUserId = parts[parts.length - 1];
  return requireUuid(maybeUserId, "userId");
}

export async function loadFounderList(serviceClient, query) {
  const accessFilterIds = await loadAccessFilterIds(serviceClient, query.accessStatus);
  if (query.accessStatus && accessFilterIds.length === 0) {
    return {
      founders: [],
      pagination: { limit: query.limit, offset: query.offset, count: 0 },
    };
  }

  let profileQuery = serviceClient
    .from("profiles")
    .select("id,email,name,idea,business_name,current_stage,venture_mode,role,created_at,updated_at,last_active_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(query.offset, query.offset + query.limit - 1);

  if (query.search) {
    const search = escapePostgrestSearch(query.search);
    if (search) {
      profileQuery = profileQuery.or(`email.ilike.%${search}%,name.ilike.%${search}%,business_name.ilike.%${search}%,idea.ilike.%${search}%`);
    }
  }
  if (query.stage) {
    profileQuery = profileQuery.eq("current_stage", query.stage);
  }
  if (accessFilterIds) {
    profileQuery = profileQuery.in("id", accessFilterIds);
  }

  const { data: profiles, error, count } = await profileQuery;
  if (error) throw error;

  const userIds = (profiles || []).map((profile) => profile.id);
  const [
    accessMap,
    billingMap,
    authEmailMap,
    actionCounts,
    documentCounts,
    archiveCounts,
    academyPrimaryCounts,
    academyLegacyCounts,
  ] = await Promise.all([
    loadRowsByUser(serviceClient, "account_access", "user_id,access_status,plan_type,subscription_status,is_family_comp,ends_at,canceled_at,suspended_at,updated_at", userIds),
    loadRowsByUser(serviceClient, "billing_subscriptions", "user_id,stripe_status,current_period_end,cancel_at_period_end,trial_end,updated_at,stripe_customer_id,stripe_subscription_id", userIds),
    loadMissingAuthEmails(serviceClient, profiles || []),
    loadCountMap(serviceClient, "foundry_actions", userIds),
    loadCountMap(serviceClient, "documents", userIds),
    loadCountMap(serviceClient, "daily_chat_summaries", userIds),
    loadCountMap(serviceClient, "academy_user_content_progress", userIds),
    loadCountMap(serviceClient, "user_lesson_progress", userIds),
  ]);

  const founders = (profiles || []).map((profile) => {
    const billing = billingMap.get(profile.id) || null;
    const academyProgressCount = Math.max(
      academyPrimaryCounts.get(profile.id) || 0,
      academyLegacyCounts.get(profile.id) || 0
    );

    return {
      user_id: profile.id,
      email: profile.email || authEmailMap.get(profile.id) || null,
      display_name: profile.name || null,
      name: profile.name || null,
      business_name: profile.business_name || null,
      side_hustle_name: null,
      idea: profile.idea || null,
      current_stage: profile.current_stage ?? null,
      venture_mode: profile.venture_mode || null,
      role: profile.role || "user",
      created_at: profile.created_at || null,
      updated_at: profile.updated_at || null,
      last_active_at: profile.last_active_at || null,
      account_access: summarizeAccess(accessMap.get(profile.id) || null),
      billing_subscription: summarizeBilling(billing),
      action_count: actionCounts.get(profile.id) || 0,
      document_count: documentCounts.get(profile.id) || 0,
      archive_count: archiveCounts.get(profile.id) || 0,
      academy_progress_count: academyProgressCount,
    };
  });

  return {
    founders,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      count: count ?? founders.length,
    },
  };
}

export async function loadFounderDetail(serviceClient, userId) {
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id,email,name,idea,business_name,industry,strategy_label,current_stage,venture_mode,role,setup_completed,created_at,updated_at,last_active_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    throw createAdminApiError(404, "Founder not found");
  }

  const [
    authEmailMap,
    access,
    billing,
    supportNotes,
    adminActions,
    counts,
    recentArchives,
    recentDocuments,
    recentActions,
  ] = await Promise.all([
    loadMissingAuthEmails(serviceClient, [profile]),
    loadMaybeSingle(serviceClient, "account_access", "user_id,access_status,plan_type,subscription_status,is_family_comp,comp_reason,starts_at,ends_at,canceled_at,suspended_at,suspension_reason,created_at,updated_at", "user_id", userId),
    loadMaybeSingle(serviceClient, "billing_subscriptions", "user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,stripe_status,current_period_start,current_period_end,cancel_at_period_end,trial_end,created_at,updated_at", "user_id", userId),
    loadRowsForUser(serviceClient, "admin_support_notes", "id,target_user_id,admin_id,note,note_type,visibility,linked_entity_type,linked_entity_id,metadata,created_at,updated_at", userId, { orderBy: "created_at", limit: 20 }),
    loadRowsForUser(serviceClient, "admin_actions", "id,admin_id,target_user_id,action_type,entity_type,entity_id,reason,metadata,created_at", userId, { column: "target_user_id", orderBy: "created_at", limit: 30 }),
    loadFounderCounts(serviceClient, userId),
    loadRowsForUser(serviceClient, "daily_chat_summaries", "id,stage_id,summary_date,title,summary,message_count,archive_source_type,archive_source_ref_id,archive_source_title,archive_source_metadata,created_at,updated_at", userId, { orderBy: "created_at", limit: 8 }),
    loadRowsForUser(serviceClient, "documents", "id,title,doc_type,category,status,stage_id,created_at,updated_at,archived_at", userId, { orderBy: "updated_at", limit: 8 }),
    loadRowsForUser(serviceClient, "foundry_actions", "id,title,source_module,source_type,action_type,status,priority,due_date,completed_at,created_at,updated_at", userId, { orderBy: "updated_at", limit: 8 }),
  ]);

  return {
    profile: {
      user_id: profile.id,
      email: profile.email || authEmailMap.get(profile.id) || null,
      display_name: profile.name || null,
      name: profile.name || null,
      business_name: profile.business_name || null,
      side_hustle_name: null,
      idea: profile.idea || null,
      industry: profile.industry || null,
      strategy_label: profile.strategy_label || null,
      current_stage: profile.current_stage ?? null,
      venture_mode: profile.venture_mode || null,
      role: profile.role || "user",
      setup_completed: profile.setup_completed ?? false,
      created_at: profile.created_at || null,
      updated_at: profile.updated_at || null,
      last_active_at: profile.last_active_at || null,
    },
    account_access: summarizeAccess(access, { detailed: true }),
    billing_subscription: summarizeBilling(billing, { detailed: true }),
    recent_admin_support_notes: supportNotes,
    recent_admin_actions: adminActions,
    counts,
    recent_archives: recentArchives.map(summarizeArchive),
    recent_documents: recentDocuments,
    recent_actions: recentActions,
  };
}

async function loadFounderCounts(serviceClient, userId) {
  const [
    academyContentProgress,
    userLessonProgress,
    actions,
    documents,
    archives,
    books,
    marketReports,
  ] = await Promise.all([
    safeCount(serviceClient, "academy_user_content_progress", userId),
    safeCount(serviceClient, "user_lesson_progress", userId),
    safeCount(serviceClient, "foundry_actions", userId),
    safeCount(serviceClient, "documents", userId),
    safeCount(serviceClient, "daily_chat_summaries", userId),
    safeCount(serviceClient, "founder_books", userId),
    safeCount(serviceClient, "market_reports", userId),
  ]);

  return {
    academy_progress: Math.max(academyContentProgress, userLessonProgress),
    academy_user_content_progress: academyContentProgress,
    user_lesson_progress: userLessonProgress,
    actions,
    documents,
    archives,
    books,
    market_reports: marketReports,
  };
}

async function loadAccessFilterIds(serviceClient, accessStatus) {
  if (!accessStatus) return null;
  const { data, error } = await serviceClient
    .from("account_access")
    .select("user_id")
    .eq("access_status", accessStatus)
    .limit(10000);
  if (isOptionalTableError(error)) return [];
  if (error) throw error;
  return (data || []).map((row) => row.user_id).filter(Boolean);
}

async function loadRowsByUser(serviceClient, table, select, userIds) {
  const rows = await loadRowsForUsers(serviceClient, table, select, userIds);
  return new Map(rows.map((row) => [row.user_id, row]));
}

async function loadRowsForUsers(serviceClient, table, select, userIds) {
  if (!userIds.length) return [];
  const { data, error } = await serviceClient
    .from(table)
    .select(select)
    .in("user_id", userIds);
  if (isOptionalTableError(error)) return [];
  if (error) throw error;
  return data || [];
}

async function loadRowsForUser(serviceClient, table, select, userId, options = {}) {
  const column = options.column || "user_id";
  let query = serviceClient
    .from(table)
    .select(select)
    .eq(column, userId);

  if (options.orderBy) {
    query = query.order(options.orderBy, { ascending: false });
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (isOptionalTableError(error)) return [];
  if (error) throw error;
  return data || [];
}

async function loadMaybeSingle(serviceClient, table, select, column, value) {
  const { data, error } = await serviceClient
    .from(table)
    .select(select)
    .eq(column, value)
    .maybeSingle();
  if (isOptionalTableError(error)) return null;
  if (error) throw error;
  return data || null;
}

async function loadCountMap(serviceClient, table, userIds) {
  const entries = await Promise.all(userIds.map(async (userId) => [userId, await safeCount(serviceClient, table, userId)]));
  return new Map(entries);
}

async function safeCount(serviceClient, table, userId, column = "user_id") {
  const { count, error } = await serviceClient
    .from(table)
    .select(column, { count: "exact", head: true })
    .eq(column, userId);
  if (isOptionalTableError(error)) return 0;
  if (error) throw error;
  return count || 0;
}

async function loadMissingAuthEmails(serviceClient, profiles) {
  const missing = (profiles || []).filter((profile) => profile?.id && !profile.email);
  if (!missing.length || !serviceClient.auth?.admin?.getUserById) return new Map();

  const entries = await Promise.all(missing.map(async (profile) => {
    try {
      const { data, error } = await serviceClient.auth.admin.getUserById(profile.id);
      if (error || !data?.user?.email) return null;
      return [profile.id, data.user.email];
    } catch {
      return null;
    }
  }));

  return new Map(entries.filter(Boolean));
}

function summarizeAccess(access, options = {}) {
  if (!access) return null;
  const base = {
    access_status: access.access_status || null,
    plan_type: access.plan_type || null,
    subscription_status: access.subscription_status || null,
    is_family_comp: access.is_family_comp ?? false,
    ends_at: access.ends_at || null,
    canceled_at: access.canceled_at || null,
    suspended_at: access.suspended_at || null,
    updated_at: access.updated_at || null,
  };
  if (!options.detailed) return base;
  return {
    ...base,
    comp_reason: access.comp_reason || null,
    starts_at: access.starts_at || null,
    suspension_reason: access.suspension_reason || null,
    created_at: access.created_at || null,
  };
}

function summarizeBilling(billing, options = {}) {
  if (!billing) return null;
  const base = {
    stripe_status: billing.stripe_status || null,
    current_period_end: billing.current_period_end || null,
    cancel_at_period_end: billing.cancel_at_period_end ?? false,
    trial_end: billing.trial_end || null,
    updated_at: billing.updated_at || null,
    has_stripe_customer: Boolean(billing.stripe_customer_id),
    has_stripe_subscription: Boolean(billing.stripe_subscription_id),
  };
  if (!options.detailed) return base;
  return {
    ...base,
    stripe_customer_id: billing.stripe_customer_id || null,
    stripe_subscription_id: billing.stripe_subscription_id || null,
    stripe_price_id: billing.stripe_price_id || null,
    current_period_start: billing.current_period_start || null,
    created_at: billing.created_at || null,
  };
}

function summarizeArchive(row) {
  return {
    id: row.id,
    stage_id: row.stage_id,
    summary_date: row.summary_date || null,
    title: row.title || null,
    summary_preview: truncateText(row.summary, 500),
    message_count: row.message_count ?? 0,
    archive_source_type: row.archive_source_type || null,
    archive_source_ref_id: row.archive_source_ref_id || null,
    archive_source_title: row.archive_source_title || null,
    archive_source_metadata: row.archive_source_metadata || {},
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function truncateText(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function readQueryValue(req, key) {
  const queryValue = req?.query?.[key];
  if (Array.isArray(queryValue)) return queryValue[0] || "";
  if (typeof queryValue === "string") return queryValue;
  const urlValue = getRequestUrl(req).searchParams.get(key);
  return urlValue || "";
}

function getRequestUrl(req) {
  return new URL(req?.url || "/", "http://localhost");
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

function isOptionalTableError(error) {
  if (!error) return false;
  const message = String(error.message || "");
  return OPTIONAL_TABLE_CODES.has(error.code) || /could not find|does not exist|schema cache/i.test(message);
}

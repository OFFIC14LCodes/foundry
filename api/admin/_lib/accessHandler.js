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

const COMP_TYPES = ["gifted", "family_comp"];
const CHURN_STATUSES = ["at_risk", "win_back_candidate", "do_not_contact", "converted", "none"];
const WINBACK_STATUSES = ["pending", "contacted", "offered_discount", "returned", "declined", "none"];
const ACCESS_SELECT = "user_id,access_status,plan_type,subscription_status,is_family_comp,comp_reason,starts_at,ends_at,canceled_at,suspended_at,suspension_reason,created_at,updated_at";
const BILLING_SELECT = "user_id,stripe_customer_id,stripe_subscription_id,stripe_price_id,stripe_status,plan_key,current_period_start,current_period_end,cancel_at_period_end,trial_end,created_at,updated_at";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { user, serviceClient } = await requireAdminApiContext(req);
    const action = getActionFromRequest(req);
    const body = await parseJsonBody(req);
    const targetUserId = requireUuid(body.userId || body.user_id || body.target_user_id, "userId");

    const founder = await loadFounder(serviceClient, targetUserId);
    const beforeAccess = await loadAccess(serviceClient, targetUserId);
    const billing = await loadBilling(serviceClient, targetUserId);

    if (action === "grant-comp") {
      const reason = validateAdminReason(body.reason, { required: true, minLength: 1 });
      const compType = body.compType || body.comp_type || body.type || "gifted";
      const normalizedCompType = requireEnum(compType, "compType", COMP_TYPES);
      const expiresAt = normalizeOptionalDate(body.expiresAt || body.expires_at);
      const updates = {
        access_status: "active",
        plan_type: normalizedCompType,
        subscription_status: normalizedCompType === "family_comp" ? "comped" : "gifted",
        is_family_comp: normalizedCompType === "family_comp",
        comp_reason: reason,
        starts_at: beforeAccess?.starts_at || new Date().toISOString(),
        ends_at: expiresAt,
        suspended_at: null,
        suspension_reason: null,
      };
      const afterAccess = await upsertAccess(serviceClient, targetUserId, updates);
      await writeAccessAudit(serviceClient, req, user.id, targetUserId, "admin.access.grant_comp", reason, beforeAccess, afterAccess, {
        comp_type: normalizedCompType,
        expires_at: expiresAt,
        stripe_preserved: Boolean(billing?.stripe_subscription_id),
      });
      res.status(200).json({ ok: true, access: afterAccess, billing_subscription: billing, founder });
      return;
    }

    if (action === "remove-comp") {
      const reason = validateAdminReason(body.reason, { required: true, minLength: 1 });
      const updates = buildRemoveCompUpdates(beforeAccess, billing);
      const afterAccess = await upsertAccess(serviceClient, targetUserId, updates);
      await writeAccessAudit(serviceClient, req, user.id, targetUserId, "admin.access.remove_comp", reason, beforeAccess, afterAccess, {
        stripe_status: billing?.stripe_status || null,
        stripe_preserved: Boolean(billing?.stripe_subscription_id),
      });
      res.status(200).json({ ok: true, access: afterAccess, billing_subscription: billing, founder });
      return;
    }

    if (action === "suspend") {
      const reason = validateAdminReason(body.reason, { required: true, minLength: 1 });
      const afterAccess = await upsertAccess(serviceClient, targetUserId, {
        access_status: "suspended",
        suspended_at: new Date().toISOString(),
        suspension_reason: reason,
      });
      await writeAccessAudit(serviceClient, req, user.id, targetUserId, "admin.access.suspend", reason, beforeAccess, afterAccess, {
        stripe_preserved: Boolean(billing?.stripe_subscription_id),
      });
      res.status(200).json({ ok: true, access: afterAccess, billing_subscription: billing, founder });
      return;
    }

    if (action === "reactivate") {
      const reason = validateAdminReason(body.reason, { required: true, minLength: 1 });
      const afterAccess = await upsertAccess(serviceClient, targetUserId, {
        access_status: "active",
        suspended_at: null,
        suspension_reason: null,
      });
      await writeAccessAudit(serviceClient, req, user.id, targetUserId, "admin.access.reactivate", reason, beforeAccess, afterAccess, {
        stripe_preserved: Boolean(billing?.stripe_subscription_id),
      });
      res.status(200).json({ ok: true, access: afterAccess, billing_subscription: billing, founder });
      return;
    }

    if (action === "revoke") {
      const reason = validateAdminReason(body.reason, { required: true, minLength: 1 });
      const confirmation = requireString(body.confirmation, "confirmation", { maxLength: 80 });
      if (confirmation !== "REVOKE ACCESS") {
        res.status(400).json({ error: 'confirmation must equal "REVOKE ACCESS"' });
        return;
      }
      const afterAccess = await upsertAccess(serviceClient, targetUserId, {
        access_status: "revoked",
      });
      await writeAccessAudit(serviceClient, req, user.id, targetUserId, "admin.access.revoke", reason, beforeAccess, afterAccess, {
        stripe_preserved: Boolean(billing?.stripe_subscription_id),
      });
      res.status(200).json({ ok: true, access: afterAccess, billing_subscription: billing, founder });
      return;
    }

    if (action === "churn-note") {
      const note = requireString(body.note, "note", { minLength: 3, maxLength: 10000 });
      const reason = validateAdminReason(body.reason, { required: true, minLength: 8 });
      const retentionStatus = optionalEnum(body.retentionStatus || body.retention_status, "retentionStatus", CHURN_STATUSES);
      const winbackStatus = optionalEnum(body.winbackStatus || body.winback_status, "winbackStatus", WINBACK_STATUSES);
      const metadata = normalizeMetadata(body.metadata);
      const insertRow = {
        target_user_id: targetUserId,
        admin_id: user.id,
        note,
        note_type: "retention",
        visibility: "internal",
        linked_entity_type: "account_access",
        linked_entity_id: targetUserId,
        metadata: {
          ...metadata,
          retention_status: retentionStatus,
          winback_status: winbackStatus,
          source: metadata.source || "admin_access_churn_note",
        },
      };
      const { data: createdNote, error } = await serviceClient
        .from("admin_support_notes")
        .insert(insertRow)
        .select("id,target_user_id,admin_id,note,note_type,visibility,linked_entity_type,linked_entity_id,metadata,created_at,updated_at")
        .single();
      if (error) throw error;
      await auditAdminAction(serviceClient, {
        admin_id: user.id,
        target_user_id: targetUserId,
        action_type: "admin.access.churn_note",
        entity_type: "admin_support_notes",
        entity_id: createdNote.id,
        reason,
        before_state: null,
        after_state: createdNote,
        metadata: { retention_status: retentionStatus, winback_status: winbackStatus },
      }, req);
      res.status(201).json({ ok: true, note: createdNote, access: beforeAccess, billing_subscription: billing, founder });
      return;
    }

    res.status(404).json({ error: "Not found" });
  } catch (error) {
    sendAdminApiError(res, error, "Unable to update admin access controls");
  }
}

function getActionFromRequest(req) {
  const url = new URL(req?.url || "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  const accessIdx = parts.findIndex((part) => part === "access");
  return parts[accessIdx + 1] || "";
}

async function loadFounder(serviceClient, userId) {
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id,email,name,business_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw createAdminApiError(404, "Founder not found");
  return {
    user_id: data.id,
    email: data.email || null,
    name: data.name || null,
    business_name: data.business_name || null,
  };
}

async function loadAccess(serviceClient, userId) {
  const { data, error } = await serviceClient
    .from("account_access")
    .select(ACCESS_SELECT)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function loadBilling(serviceClient, userId) {
  const { data, error } = await serviceClient
    .from("billing_subscriptions")
    .select(BILLING_SELECT)
    .eq("user_id", userId)
    .maybeSingle();
  if (isMissingColumnError(error, "plan_key")) {
    const fallback = await serviceClient
      .from("billing_subscriptions")
      .select(BILLING_SELECT.replace(",plan_key", ""))
      .eq("user_id", userId)
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    return fallback.data || null;
  }
  if (error) throw error;
  return data || null;
}

async function upsertAccess(serviceClient, userId, updates) {
  const current = await loadAccess(serviceClient, userId);
  const row = {
    user_id: userId,
    access_status: current?.access_status || "active",
    plan_type: current?.plan_type || "free",
    subscription_status: current?.subscription_status || "trial",
    is_family_comp: current?.is_family_comp ?? false,
    comp_reason: current?.comp_reason || null,
    starts_at: current?.starts_at || null,
    ends_at: current?.ends_at || null,
    canceled_at: current?.canceled_at || null,
    suspended_at: current?.suspended_at || null,
    suspension_reason: current?.suspension_reason || null,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await serviceClient
    .from("account_access")
    .upsert(row, { onConflict: "user_id" })
    .select(ACCESS_SELECT)
    .single();
  if (error) throw error;
  return data;
}

function buildRemoveCompUpdates(beforeAccess, billing) {
  const stripeStatus = normalizeStripeStatus(billing?.stripe_status);
  const billingPlan = normalizeBillingPlan(billing?.plan_key);
  const updates = {
    is_family_comp: false,
    comp_reason: null,
    ends_at: null,
  };

  if (beforeAccess?.plan_type === "family_comp" || beforeAccess?.plan_type === "gifted") {
    updates.plan_type = billingPlan || "free";
  }
  if (beforeAccess?.subscription_status === "comped" || beforeAccess?.subscription_status === "gifted") {
    updates.subscription_status = stripeStatus || "trial";
  }
  return updates;
}

async function writeAccessAudit(serviceClient, req, adminId, targetUserId, actionType, reason, beforeState, afterState, metadata) {
  await auditAdminAction(serviceClient, {
    admin_id: adminId,
    target_user_id: targetUserId,
    action_type: actionType,
    entity_type: "account_access",
    entity_id: targetUserId,
    reason,
    before_state: beforeState,
    after_state: afterState,
    metadata,
  }, req);
}

function optionalEnum(value, fieldName, allowedValues) {
  if (value == null || value === "") return null;
  const normalized = requireString(value, fieldName, { maxLength: 120 });
  if (!allowedValues.includes(normalized)) {
    throw createAdminApiError(400, `${fieldName} must be one of: ${allowedValues.join(", ")}`);
  }
  return normalized === "none" ? null : normalized;
}

function normalizeMetadata(value) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw createAdminApiError(400, "metadata must be an object");
  }
  return { ...value };
}

function normalizeOptionalDate(value) {
  if (value == null || value === "") return null;
  const text = requireString(value, "expiresAt", { maxLength: 80 });
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) {
    throw createAdminApiError(400, "expiresAt must be a valid date");
  }
  return date.toISOString();
}

function normalizeStripeStatus(value) {
  const normalized = String(value || "").trim();
  if (["trial", "active", "trialing", "past_due", "canceled", "incomplete", "unpaid", "expired"].includes(normalized)) {
    return normalized;
  }
  return null;
}

function normalizeBillingPlan(value) {
  const normalized = String(value || "").trim();
  if (["starter", "pro", "enterprise"].includes(normalized)) return normalized;
  return null;
}

function isMissingColumnError(error, columnName) {
  if (!error) return false;
  const message = String(error.message || "");
  return error.code === "PGRST204" || message.includes(columnName);
}

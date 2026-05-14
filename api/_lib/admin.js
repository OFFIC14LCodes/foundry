import { createClient } from "@supabase/supabase-js";

const OWNER_EMAIL = "foundryandforge.app@gmail.com";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getBearerToken(req) {
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
  if (Array.isArray(authHeader)) {
    return getBearerToken({ headers: { authorization: authHeader[0] } });
  }
  if (typeof authHeader !== "string") return "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice("Bearer ".length).trim();
}

export async function requireAdminApiContext(req) {
  const token = getBearerToken(req);
  if (!token) {
    throw createAdminApiError(401, "Missing authorization token");
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createAdminApiError(500, "Supabase auth verification is not configured");
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: userData, error: authError } = await authClient.auth.getUser(token);
  const user = userData?.user;
  if (authError || !user) {
    throw createAdminApiError(401, "Invalid authorization token");
  }

  const isAdmin = await checkAdminOrOwner(authClient, user);
  if (!isAdmin) {
    throw createAdminApiError(403, "Admin access required");
  }

  if (!serviceRoleKey) {
    throw createAdminApiError(500, "Supabase service role configuration is missing");
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return {
    token,
    user,
    authClient,
    serviceClient,
  };
}

export async function auditAdminAction(serviceClient, input, req) {
  if (!serviceClient) {
    throw createAdminApiError(500, "Admin audit logging is not configured");
  }

  const actionType = requireString(input?.action_type, "action_type", { maxLength: 160 });
  const row = {
    admin_id: input?.admin_id ?? null,
    target_user_id: input?.target_user_id ?? null,
    action_type: actionType,
    entity_type: optionalString(input?.entity_type, { maxLength: 160 }),
    entity_id: optionalString(input?.entity_id, { maxLength: 240 }),
    reason: optionalString(input?.reason, { maxLength: 2000 }),
    before_state: normalizeJsonObject(input?.before_state, true),
    after_state: normalizeJsonObject(input?.after_state, true),
    metadata: normalizeJsonObject(input?.metadata, false),
    ip_address: getRequestIp(req),
    user_agent: getRequestUserAgent(req),
  };

  if (row.admin_id) requireUuid(row.admin_id, "admin_id");
  if (row.target_user_id) requireUuid(row.target_user_id, "target_user_id");

  const { error } = await serviceClient.from("admin_actions").insert(row);
  if (error) {
    throw createAdminApiError(500, "Unable to record admin audit action", { cause: error });
  }
}

export async function parseJsonBody(req, options = {}) {
  const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : 1_000_000;
  let raw = "";

  if (req?.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    if (Array.isArray(req.body)) {
      throw createAdminApiError(400, "JSON body must be an object");
    }
    return req.body;
  }

  if (typeof req?.body === "string") {
    raw = req.body;
  } else if (Buffer.isBuffer(req?.body)) {
    raw = req.body.toString("utf8");
  } else if (typeof req?.on === "function") {
    raw = await readRequestBody(req, maxBytes);
  }

  if (!raw || !raw.trim()) return {};

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw createAdminApiError(400, "Invalid JSON body");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw createAdminApiError(400, "JSON body must be an object");
  }

  return parsed;
}

export function requireString(value, fieldName, options = {}) {
  const allowEmpty = options.allowEmpty === true;
  const minLength = Number.isFinite(options.minLength) ? options.minLength : 1;
  const maxLength = Number.isFinite(options.maxLength) ? options.maxLength : 10_000;

  if (typeof value !== "string") {
    throw createAdminApiError(400, `${fieldName} must be a string`);
  }

  const normalized = options.trim === false ? value : value.trim();
  if (!allowEmpty && normalized.length < minLength) {
    throw createAdminApiError(400, `${fieldName} is required`);
  }
  if (normalized.length > maxLength) {
    throw createAdminApiError(400, `${fieldName} is too long`);
  }
  return normalized;
}

export function requireUuid(value, fieldName) {
  const normalized = requireString(value, fieldName, { maxLength: 80 });
  if (!UUID_PATTERN.test(normalized)) {
    throw createAdminApiError(400, `${fieldName} must be a valid UUID`);
  }
  return normalized;
}

export function requireEnum(value, fieldName, allowedValues) {
  if (!Array.isArray(allowedValues) || allowedValues.length === 0) {
    throw createAdminApiError(500, `No allowed values configured for ${fieldName}`);
  }
  const normalized = requireString(value, fieldName, { maxLength: 160 });
  if (!allowedValues.includes(normalized)) {
    throw createAdminApiError(400, `${fieldName} must be one of: ${allowedValues.join(", ")}`);
  }
  return normalized;
}

export function validateAdminReason(value, options = {}) {
  const sensitive = options.sensitive === true;
  const required = options.required === true || sensitive;
  const minLength = Number.isFinite(options.minLength) ? options.minLength : sensitive ? 12 : 3;

  if (value == null || value === "") {
    if (required) throw createAdminApiError(400, "reason is required");
    return null;
  }

  return requireString(value, "reason", { minLength, maxLength: 2000 });
}

export function sendAdminApiError(res, error, fallbackMessage = "Admin request failed") {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const safeStatus = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  const message = safeStatus >= 500
    ? fallbackMessage
    : error instanceof Error
      ? error.message
      : fallbackMessage;

  if (safeStatus >= 500) {
    console.error("Admin API error:", error);
  }

  return res.status(safeStatus).json({ error: message });
}

export function createAdminApiError(statusCode, message, options = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (options.cause) error.cause = options.cause;
  return error;
}

async function checkAdminOrOwner(authClient, user) {
  const email = normalizeEmail(user?.email);
  if (email === OWNER_EMAIL) return true;

  const { data: rpcResult, error: rpcError } = await authClient.rpc("is_admin_or_owner");
  if (!rpcError && rpcResult === true) return true;

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role,email")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) return false;

  return isAdminRole(profile?.role) || normalizeEmail(profile?.email) === OWNER_EMAIL;
}

function readRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let total = 0;
    let data = "";

    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(createAdminApiError(413, "JSON body is too large"));
        req.destroy?.();
        return;
      }
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function optionalString(value, options = {}) {
  if (value == null || value === "") return null;
  return requireString(value, "value", { ...options, allowEmpty: false });
}

function normalizeJsonObject(value, allowNull) {
  if (value == null) return allowNull ? null : {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw createAdminApiError(400, "JSON fields must be objects");
  }
  return value;
}

function getRequestIp(req) {
  const headers = req?.headers || {};
  const forwardedFor = readHeader(headers, "x-forwarded-for");
  const candidate = forwardedFor?.split(",")[0]?.trim()
    || readHeader(headers, "x-real-ip")
    || readHeader(headers, "cf-connecting-ip")
    || req?.socket?.remoteAddress
    || req?.connection?.remoteAddress
    || "";
  return candidate ? candidate.slice(0, 120) : null;
}

function getRequestUserAgent(req) {
  const value = readHeader(req?.headers || {}, "user-agent");
  return value ? value.slice(0, 500) : null;
}

function readHeader(headers, name) {
  const direct = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  if (Array.isArray(direct)) return direct[0] || "";
  return typeof direct === "string" ? direct : "";
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAdminRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "owner";
}

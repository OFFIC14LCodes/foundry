#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://127.0.0.1:3001";
const NIL_UUID = "00000000-0000-4000-8000-000000000000";
const ACCESS_ACTIONS = ["grant-comp", "remove-comp", "suspend", "reactivate", "revoke", "churn-note"];

const baseUrl = normalizeBaseUrl(readArg("--base-url") || process.env.ADMIN_SMOKE_BASE_URL || DEFAULT_BASE_URL);
const adminToken = readArg("--admin-token") || process.env.ADMIN_SMOKE_ADMIN_TOKEN || "";
const nonAdminToken = readArg("--non-admin-token") || process.env.ADMIN_SMOKE_NON_ADMIN_TOKEN || "";
const userId = readArg("--user-id") || process.env.ADMIN_SMOKE_USER_ID || NIL_UUID;

const results = [];

await runMissingAuthChecks();
await runNonAdminChecks();
await runAdminReadOnlyChecks();
await runAdminValidationChecks();

printResults();

const failed = results.filter((result) => result.status === "fail");
process.exitCode = failed.length ? 1 : 0;

async function runMissingAuthChecks() {
  const cases = [
    ["GET", "/api/admin/founders?limit=1&page=1"],
    ["GET", `/api/admin/founders/${NIL_UUID}`],
    ["GET", `/api/admin/founders/${NIL_UUID}/academy-progress`],
    ["POST", `/api/admin/founders/${NIL_UUID}/notes`, {}],
    ["POST", `/api/admin/founders/${NIL_UUID}/notifications`, {}],
    ["POST", `/api/admin/founders/${NIL_UUID}/academy-progress`, {}],
    ["POST", `/api/admin/founders/${NIL_UUID}/reset-assessment`, {}],
    ["GET", "/api/admin/feedback?limit=1&page=1"],
    ["PATCH", `/api/admin/feedback/${NIL_UUID}`, {}],
    ...ACCESS_ACTIONS.map((action) => ["POST", `/api/admin/access/${action}`, {}]),
    ["GET", "/api/admin/audit?limit=1&page=1"],
  ];

  for (const [method, path, body] of cases) {
    await expectStatus(`missing auth ${method} ${path}`, method, path, 401, { body });
  }
}

async function runNonAdminChecks() {
  if (!nonAdminToken) {
    skip("non-admin returns 403", "Set ADMIN_SMOKE_NON_ADMIN_TOKEN to run this check.");
    return;
  }

  await expectStatus("non-admin GET /api/admin/founders returns 403", "GET", "/api/admin/founders?limit=1", 403, { token: nonAdminToken });
  await expectStatus("non-admin GET /api/admin/audit returns 403", "GET", "/api/admin/audit?limit=1", 403, { token: nonAdminToken });
}

async function runAdminReadOnlyChecks() {
  if (!adminToken) {
    skip("admin read-only route shape", "Set ADMIN_SMOKE_ADMIN_TOKEN to run authenticated read-only checks.");
    return;
  }

  await expectJsonShape("admin founders list shape", "GET", "/api/admin/founders?limit=1&page=1&search=smoke", {
    token: adminToken,
    assert: (json) => Array.isArray(json.founders) && hasPagination(json.pagination),
  });

  await expectJsonShape("admin feedback list shape", "GET", "/api/admin/feedback?limit=1&page=1&status=new", {
    token: adminToken,
    assert: (json) => Array.isArray(json.items) && hasPagination(json.pagination),
  });

  await expectJsonShape("admin audit log shape", "GET", "/api/admin/audit?limit=1&page=1&search=admin", {
    token: adminToken,
    assert: (json) => Array.isArray(json.items) && hasPagination(json.pagination) && json.items.every(hasAuditItemShape),
  });

  if (userId === NIL_UUID) {
    skip("admin founder detail and academy read-only shape", "Set ADMIN_SMOKE_USER_ID to an existing founder UUID.");
    return;
  }

  await expectJsonShape("admin founder detail shape", "GET", `/api/admin/founders/${encodeURIComponent(userId)}`, {
    token: adminToken,
    assert: (json) => Boolean(json.profile?.user_id) && Array.isArray(json.recent_admin_actions),
  });

  await expectJsonShape("admin founder academy progress shape", "GET", `/api/admin/founders/${encodeURIComponent(userId)}/academy-progress`, {
    token: adminToken,
    assert: (json) => json.user_id === userId && Array.isArray(json.stages),
  });
}

async function runAdminValidationChecks() {
  if (!adminToken) {
    skip("admin mutation validation routes", "Set ADMIN_SMOKE_ADMIN_TOKEN to run non-mutating validation checks.");
    return;
  }

  const cases = [
    ["POST", `/api/admin/founders/${NIL_UUID}/notes`, {}],
    ["POST", `/api/admin/founders/${NIL_UUID}/notifications`, {}],
    ["POST", `/api/admin/founders/${NIL_UUID}/academy-progress`, {}],
    ["POST", `/api/admin/founders/${NIL_UUID}/reset-assessment`, {}],
    ["PATCH", "/api/admin/feedback/not-a-uuid", {}],
    ...ACCESS_ACTIONS.map((action) => ["POST", `/api/admin/access/${action}`, {}]),
  ];

  for (const [method, path, body] of cases) {
    await expectStatus(`admin validation ${method} ${path}`, method, path, 400, { token: adminToken, body });
  }
}

async function expectStatus(name, method, path, expectedStatus, options = {}) {
  const response = await request(method, path, options);
  if (response.status === expectedStatus) {
    pass(name);
    return;
  }
  fail(name, `Expected ${expectedStatus}, got ${response.status}: ${truncate(JSON.stringify(response.json))}`);
}

async function expectJsonShape(name, method, path, options) {
  const response = await request(method, path, options);
  if (response.status !== 200) {
    fail(name, `Expected 200, got ${response.status}: ${truncate(JSON.stringify(response.json))}`);
    return;
  }
  if (!options.assert(response.json)) {
    fail(name, `Unexpected JSON shape: ${truncate(JSON.stringify(response.json))}`);
    return;
  }
  pass(name);
}

async function request(method, path, options = {}) {
  const headers = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let json = null;
  const text = await response.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }

  return { status: response.status, json };
}

function hasPagination(value) {
  return value && Number.isFinite(value.limit) && Number.isFinite(value.count);
}

function hasAuditItemShape(item) {
  return item
    && typeof item.id === "string"
    && typeof item.action_type === "string"
    && "admin_id" in item
    && "target_user_id" in item
    && "before_state" in item
    && "after_state" in item
    && "metadata" in item
    && "created_at" in item;
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function pass(name) {
  results.push({ status: "pass", name });
}

function fail(name, detail) {
  results.push({ status: "fail", name, detail });
}

function skip(name, detail) {
  results.push({ status: "skip", name, detail });
}

function truncate(value) {
  const text = String(value || "");
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}

function printResults() {
  const counts = results.reduce((acc, result) => {
    acc[result.status] += 1;
    return acc;
  }, { pass: 0, fail: 0, skip: 0 });

  console.log(`Admin Operations smoke check against ${baseUrl}`);
  console.log(`PASS ${counts.pass}  FAIL ${counts.fail}  SKIP ${counts.skip}`);

  for (const result of results) {
    const marker = result.status === "pass" ? "PASS" : result.status === "fail" ? "FAIL" : "SKIP";
    console.log(`${marker} ${result.name}${result.detail ? ` - ${result.detail}` : ""}`);
  }
}

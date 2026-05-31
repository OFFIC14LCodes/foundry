import adminAccessHandler from "./admin/_lib/accessHandler.js";
import adminAuditHandler from "./admin/_lib/auditHandler.js";
import adminFeedbackHandler from "./admin/_lib/feedbackHandler.js";
import adminFoundersHandler from "./admin/_lib/foundersHandler.js";

export default async function handler(req, res) {
  const pathname = getAdminPathname(req);
  req.url = pathname;

  if (pathname === "/api/admin/founders" || pathname.startsWith("/api/admin/founders/")) {
    await adminFoundersHandler(req, res);
    return;
  }

  if (pathname === "/api/admin/feedback" || pathname.startsWith("/api/admin/feedback/")) {
    await adminFeedbackHandler(req, res);
    return;
  }

  if (pathname.startsWith("/api/admin/access/")) {
    await adminAccessHandler(req, res);
    return;
  }

  if (pathname === "/api/admin/audit") {
    await adminAuditHandler(req, res);
    return;
  }

  res.status(404).json({ error: "Not found" });
}

function getAdminPathname(req) {
  const url = new URL(req.url || "/api/admin", "http://localhost");
  const rewrittenPath = url.searchParams.get("path");
  if (!rewrittenPath) return url.pathname;
  const normalized = rewrittenPath.replace(/^\/+/, "");
  return normalized ? `/api/admin/${normalized}` : "/api/admin";
}

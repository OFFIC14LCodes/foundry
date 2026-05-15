import adminAccessHandler from "./_lib/accessHandler.js";
import adminAuditHandler from "./_lib/auditHandler.js";
import adminFeedbackHandler from "./_lib/feedbackHandler.js";
import adminFoundersHandler from "./_lib/foundersHandler.js";

export default async function handler(req, res) {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;

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

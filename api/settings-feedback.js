import { Resend } from "resend";

const SUPPORT_EMAIL = "foundryandforge.app@gmail.com";
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "Foundry <onboarding@resend.dev>";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const user = await verifySignedInUser(req);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    const kind = body.kind === "suggestion" ? "suggestion" : "support";
    const message = String(body.message || "").trim();
    const profileName = String(body.profileName || user?.user_metadata?.name || user?.email || "Foundry user").trim();
    const businessName = String(body.businessName || "").trim();
    const marketFocus = String(body.marketFocus || "").trim();

    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      res.status(500).json({ error: "RESEND_API_KEY not set" });
      return;
    }

    const resend = new Resend(resendKey);
    const submittedAt = new Date().toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const subject = kind === "support"
      ? `Foundry support ticket from ${profileName}`
      : `Foundry product suggestion from ${profileName}`;

    const title = kind === "support" ? "Support Ticket" : "Product Suggestion";

    const html = `
      <div style="font-family: Georgia, serif; color: #1b1b1d; line-height: 1.65;">
        <h2 style="margin: 0 0 12px;">${title}</h2>
        <p style="margin: 0 0 18px;">Submitted from Foundry Settings on ${submittedAt}.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 760px; margin-bottom: 18px;">
          <tr><td style="padding: 6px 0; font-weight: 700; width: 180px;">Name</td><td style="padding: 6px 0;">${escapeHtml(profileName)}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 700;">Email</td><td style="padding: 6px 0;">${escapeHtml(String(user?.email || "Unknown"))}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 700;">Business</td><td style="padding: 6px 0;">${escapeHtml(businessName || "Not set")}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 700;">Market</td><td style="padding: 6px 0;">${escapeHtml(marketFocus || "Not set")}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 700;">Type</td><td style="padding: 6px 0;">${kind === "support" ? "Support" : "Suggestion"}</td></tr>
        </table>
        <div style="font-weight: 700; margin-bottom: 8px;">Message</div>
        <div style="white-space: pre-wrap; padding: 14px 16px; background: #f6f2ec; border: 1px solid #eadfce; border-radius: 12px;">${escapeHtml(message)}</div>
      </div>
    `;

    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: SUPPORT_EMAIL,
      replyTo: user?.email || undefined,
      subject,
      html,
    });

    if (result?.error) {
      throw createError(500, result.error.message || "Resend could not send the email.");
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    console.error("settings-feedback error:", error);
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Unable to send message",
    });
  }
}

async function verifySignedInUser(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    throw createError(401, "Missing authorization token");
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createError(500, "Supabase auth verification is not configured");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw createError(401, "Invalid Supabase session");
  }

  return response.json();
}

function createError(status, message) {
  const error = new Error(message);
  error.statusCode = status;
  return error;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

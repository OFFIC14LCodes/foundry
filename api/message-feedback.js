import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// ── Email config ───────────────────────────────────────────────────────────
// Priority: FEEDBACK_TO_EMAIL → RESEND_TO_ADDRESS → hardcoded fallback.
// IMPORTANT: When using onboarding@resend.dev (the Resend test sender), Resend
// will ONLY deliver to the Resend account owner's own verified email address.
// To send to any address, verify a custom domain at resend.com/domains and set
// FEEDBACK_FROM_EMAIL (or RESEND_FROM_ADDRESS) to "Foundry <no-reply@yourdomain.com>".
const SUPPORT_EMAIL =
  process.env.RESEND_TO_ADDRESS ||
  "foundryandforge.app@gmail.com";

const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ||
  "Foundry <onboarding@resend.dev>";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const user = await verifySignedInUser(req);
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const reaction = body.reaction === "up" ? "up" : body.reaction === "down" ? "down" : null;
    const messageText = String(body.messageText || "").trim();
    const context = body.context && typeof body.context === "object" ? body.context : {};

    if (!reaction) {
      res.status(400).json({ error: "reaction must be up or down" });
      return;
    }
    if (!messageText) {
      res.status(400).json({ error: "messageText is required" });
      return;
    }

    const normalizedContext = normalizeFeedbackContext(context, profile);
    const surface = String(normalizedContext.surface || "unknown");
    console.log(`[feedback] received: reaction=${reaction} surface=${surface} user=${user.id} chars=${messageText.length}`);

    const serviceClient = buildServiceClient();
    const profile = await loadProfile(user.id, serviceClient);

    // ── DB persistence (best-effort) ─────────────────────────────────────
    let dbOk = false;
    try {
      await insertFeedbackRecord(serviceClient, user.id, reaction, messageText, normalizedContext);
      dbOk = true;
      console.log(`[feedback] db insert ok: reaction=${reaction} user=${user.id}`);
    } catch (dbErr) {
      console.warn(`[feedback] db insert failed (best-effort): ${dbErr?.message}`);
    }

    // ── Email (best-effort — Feedback Inbox is the primary review queue) ─
    let emailOk = false;
    const resendKey = process.env.RESEND_API_KEY;

    if (!resendKey) {
      console.warn("[feedback] RESEND_API_KEY not set — email skipped. Feedback is still stored in the Feedback Inbox.");
    } else {
      emailOk = await trySendEmail({ resendKey, reaction, messageText, context: normalizedContext, user, profile });
    }

    console.log(`[feedback] done: db=${dbOk} email=${emailOk}`);
    res.status(200).json({ ok: true, db: dbOk, email: emailOk });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    console.error("[feedback] handler error:", error);
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Unable to submit message feedback",
    });
  }
}

async function trySendEmail({ resendKey, reaction, messageText, context, user, profile }) {
  try {
    const resend = new Resend(resendKey);
    const submittedAt = new Date().toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Chicago",
      timeZoneName: "short",
    });
    const reactionLabel = reaction === "up" ? "Thumbs Up" : "Thumbs Down";
    const profileName = profile?.name || user.user_metadata?.name || user.email || "Foundry user";
    const subject = `Forge ${reactionLabel} from ${profileName}`;
    const pageUrl = String(context.pageUrl || "").slice(0, 500);

    console.log(`[feedback] sending email: from="${FROM_ADDRESS}" to="${SUPPORT_EMAIL}" subject="${subject}"`);

    const html = `
      <div style="font-family: Georgia, serif; color: #1b1b1d; line-height: 1.65;">
        <h2 style="margin: 0 0 12px;">Forge Message Feedback: ${escapeHtml(reactionLabel)}</h2>
        <p style="margin: 0 0 18px;">Submitted on ${escapeHtml(submittedAt)}.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 760px; margin-bottom: 18px;">
          <tr><td style="padding: 6px 0; font-weight: 700; width: 180px;">Name</td><td style="padding: 6px 0;">${escapeHtml(profileName)}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 700;">Email</td><td style="padding: 6px 0;">${escapeHtml(user.email || profile?.email || "Unknown")}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 700;">Business</td><td style="padding: 6px 0;">${escapeHtml(profile?.business_name || profile?.idea || "Not set")}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 700;">Surface</td><td style="padding: 6px 0;">${escapeHtml(String(context.surface || "Unknown"))}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 700;">Conversation</td><td style="padding: 6px 0;">${escapeHtml(String(context.conversationTitle || "Unknown"))}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 700;">Stage</td><td style="padding: 6px 0;">${escapeHtml(context.stageId ? `Stage ${context.stageId}` : "Unknown")}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: 700;">Message ID</td><td style="padding: 6px 0;">${escapeHtml(String(context.messageId || "Unknown"))}</td></tr>
          ${pageUrl ? `<tr><td style="padding: 6px 0; font-weight: 700;">Page</td><td style="padding: 6px 0;">${escapeHtml(pageUrl)}</td></tr>` : ""}
        </table>
        <div style="font-weight: 700; margin-bottom: 8px;">Forge message</div>
        <div style="white-space: pre-wrap; padding: 14px 16px; background: #f6f2ec; border: 1px solid #eadfce; border-radius: 12px;">${escapeHtml(messageText)}</div>
      </div>
    `;

    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: SUPPORT_EMAIL,
      replyTo: user.email || undefined,
      subject,
      html,
    });

    if (result?.error) {
      const errCode = result.error.statusCode || result.error.name || "unknown";
      const errMsg = result.error.message || JSON.stringify(result.error);
      console.error(`[feedback] Resend rejected email: code=${errCode} message="${errMsg}"`);
      if (FROM_ADDRESS.includes("onboarding@resend.dev")) {
        console.error("[feedback] Sender is onboarding@resend.dev (Resend test domain). This domain can only deliver to the Resend account owner's verified email. Set FEEDBACK_FROM_EMAIL or RESEND_FROM_ADDRESS to a verified custom domain sender to reach any address.");
      }
      return false;
    }

    const emailId = result?.data?.id || "n/a";
    console.log(`[feedback] email sent ok: id=${emailId} to="${SUPPORT_EMAIL}"`);
    return true;
  } catch (emailErr) {
    console.error(`[feedback] email send threw: ${emailErr?.message}`);
    return false;
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
    throw createError(500, "Supabase auth configuration is missing.");
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) {
    throw createError(401, "Invalid authorization token");
  }
  return data.user;
}

function buildServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

async function loadProfile(userId, serviceClient) {
  if (!serviceClient) return null;
  const { data, error } = await serviceClient
    .from("profiles")
    .select("id,email,name,idea,business_name,current_stage")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn(`[feedback] profile lookup failed: ${error.message}`);
    return null;
  }
  return data;
}

function normalizeFeedbackContext(context, profile) {
  const pageUrl = String(context.pageUrl || "").slice(0, 500);
  const inferredSurface = inferSurfaceFromPageUrl(pageUrl);
  const rawStageId = Number(context.stageId ?? profile?.current_stage);
  const stageId = Number.isInteger(rawStageId) && rawStageId > 0 ? rawStageId : null;
  const conversationTitle = String(context.conversationTitle || "").trim()
    || inferConversationTitle(context.surface || inferredSurface, stageId);

  return {
    ...context,
    surface: String(context.surface || inferredSurface || "Unknown").trim(),
    conversationTitle,
    stageId,
    messageId: String(context.messageId || "").trim(),
    pageUrl,
  };
}

function inferSurfaceFromPageUrl(pageUrl) {
  const normalized = String(pageUrl || "").toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("academy")) return "Forge Academy";
  if (normalized.includes("market")) return "Market Intelligence";
  if (normalized.includes("pitch")) return "Pitch Practice";
  if (normalized.includes("cofounder")) return "Cofounder Mode";
  if (normalized.includes("onboarding")) return "Onboarding";
  return "Foundry";
}

function inferConversationTitle(surface, stageId) {
  const cleanSurface = String(surface || "").trim();
  if (cleanSurface && stageId) return `${cleanSurface} - Stage ${stageId}`;
  if (cleanSurface) return cleanSurface;
  if (stageId) return `Stage ${stageId}`;
  return "Foundry conversation";
}

async function insertFeedbackRecord(serviceClient, userId, reaction, messageText, context) {
  if (!serviceClient) return;
  const archiveSummaryIdRaw = String(context.archiveSummaryId || "");
  const archiveSummaryId = UUID_PATTERN.test(archiveSummaryIdRaw) ? archiveSummaryIdRaw : null;
  const stageIdRaw = Number(context.stageId);
  const stageId = Number.isInteger(stageIdRaw) && stageIdRaw > 0 ? stageIdRaw : null;

  const { error } = await serviceClient.from("message_feedback").insert({
    user_id: userId,
    reaction,
    surface: String(context.surface || "").slice(0, 200) || null,
    message_id: String(context.messageId || "").slice(0, 240) || null,
    message_text: messageText.slice(0, 20000),
    conversation_title: String(context.conversationTitle || "").slice(0, 500) || null,
    archive_summary_id: archiveSummaryId,
    stage_id: stageId,
    context: {
      surface: context.surface ?? undefined,
      conversationTitle: context.conversationTitle ?? undefined,
      stageId: context.stageId ?? undefined,
      messageId: context.messageId ?? undefined,
      archiveSummaryId: context.archiveSummaryId ?? undefined,
    },
  });

  if (error) throw error;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

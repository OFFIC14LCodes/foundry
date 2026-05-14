import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const SUPPORT_EMAIL = process.env.RESEND_TO_ADDRESS || "foundryandforge.app@gmail.com";
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS || "Foundry <onboarding@resend.dev>";
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

    const serviceClient = buildServiceClient();
    const profile = await loadProfile(user.id, serviceClient);

    // DB persistence — best-effort, never fails the response
    try {
      await insertFeedbackRecord(serviceClient, user.id, reaction, messageText, context);
    } catch (dbErr) {
      console.warn("message-feedback: DB insert failed (best-effort):", dbErr?.message);
    }

    // Email — existing behavior preserved
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
      timeZone: "America/Chicago",
      timeZoneName: "short",
    });
    const reactionLabel = reaction === "up" ? "Thumbs Up" : "Thumbs Down";
    const profileName = profile?.name || user.user_metadata?.name || user.email || "Foundry user";
    const subject = `Forge ${reactionLabel} from ${profileName}`;
    const pageUrl = String(context.pageUrl || "").slice(0, 500);

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
      throw createError(500, result.error.message || "Resend could not send the email.");
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    console.error("message-feedback error:", error);
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Unable to send message feedback",
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
    console.warn("message-feedback profile lookup failed:", error.message);
    return null;
  }
  return data;
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

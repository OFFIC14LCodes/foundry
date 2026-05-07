import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || "https://foundryandforge.app";

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return res.status(500).json({ error: "Missing required environment variables" });
  }

  // Verify the caller is authenticated
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const jwt = authHeader.slice(7);

  // Validate token and get caller identity via anon client
  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error: authError } = await supabaseAnon.auth.getUser();
  if (authError || !user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const { email: invitedEmail, teamId } = req.body ?? {};
  if (!invitedEmail || typeof invitedEmail !== "string") {
    return res.status(400).json({ error: "email is required" });
  }
  if (!teamId || typeof teamId !== "string") {
    return res.status(400).json({ error: "teamId is required" });
  }

  const normalizedEmail = invitedEmail.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Verify caller is owner of this team
  const { data: team, error: teamError } = await supabaseAdmin
    .from("cofounder_teams")
    .select("id, business_name, owner_id")
    .eq("id", teamId)
    .single();

  if (teamError || !team) {
    return res.status(404).json({ error: "Team not found" });
  }
  if (team.owner_id !== user.id) {
    return res.status(403).json({ error: "Only the team owner can send invitations" });
  }

  // Prevent inviting yourself
  if (normalizedEmail === user.email?.toLowerCase()) {
    return res.status(400).json({ error: "You cannot invite yourself" });
  }

  // Check for an existing pending invite to this address
  const { data: existing } = await supabaseAdmin
    .from("cofounder_email_invites")
    .select("id, status")
    .eq("team_id", teamId)
    .ilike("invited_email", normalizedEmail)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: "A pending invitation has already been sent to this address" });
  }

  // Get or create the reusable invite token for this team
  const { data: existingInvite } = await supabaseAdmin
    .from("cofounder_invites")
    .select("token")
    .eq("team_id", teamId)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let token = existingInvite?.token;

  if (!token) {
    const { data: newInvite, error: inviteError } = await supabaseAdmin
      .from("cofounder_invites")
      .insert({ team_id: teamId, created_by: user.id })
      .select("token")
      .single();

    if (inviteError || !newInvite) {
      return res.status(500).json({ error: "Failed to create invite token" });
    }
    token = newInvite.token;
  }

  // Get inviter's display name
  const { data: inviterMember } = await supabaseAdmin
    .from("cofounder_members")
    .select("display_name")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .maybeSingle();

  const inviterName = inviterMember?.display_name || user.email?.split("@")[0] || "Your colleague";
  const teamName = team.business_name || "Foundry Team";

  // Record the email invite
  const { error: insertError } = await supabaseAdmin
    .from("cofounder_email_invites")
    .insert({
      team_id: teamId,
      invited_by: user.id,
      invited_email: normalizedEmail,
      token,
      inviter_name: inviterName,
      team_name: teamName,
      status: "pending",
    });

  if (insertError) {
    return res.status(500).json({ error: "Failed to record invitation" });
  }

  // Send email via Resend
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL || process.env.RESEND_FROM_ADDRESS || "Foundry <onboarding@resend.dev>";
  const inviteUrl = `${appUrl}/?invite=${token}`;

  if (resendKey) {
    const emailBody = `${inviterName} has invited you to join ${teamName} on Foundry.

Foundry is an AI-powered business partner that helps founders build, plan, and launch their companies.

Accept your invitation and join the team:
${inviteUrl}

If you don't have a Foundry account yet, you'll be guided to create one after clicking the link above.

—
The Foundry Team`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [normalizedEmail],
        subject: `${inviterName} invited you to join ${teamName} on Foundry`,
        text: emailBody,
      }),
    });

    if (!emailResponse.ok) {
      console.warn("Cofounder invite email failed:", normalizedEmail, await emailResponse.text());
      // Don't fail the request — the in-app notification still works
    }
  }

  return res.status(200).json({ ok: true, inviteUrl });
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildReminderEmail, buildPersonalizedReminderEmail } from "../_shared/reengagement.ts";

type DueUser = {
    user_id: string;
    email: string;
    name: string | null;
    current_stage: number;
    last_active_at: string;
    days_inactive: number;
};

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
        const reminderFromEmail = Deno.env.get("REMINDER_FROM_EMAIL") ?? "";
        const cronSecret = Deno.env.get("CRON_SECRET") ?? "";

        if (!supabaseUrl || !serviceRoleKey) {
            return jsonResponse({ error: "Missing Supabase service role environment variables." }, 500);
        }

        if (cronSecret) {
            const authHeader = request.headers.get("authorization") ?? "";
            const suppliedToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
            if (suppliedToken !== cronSecret) {
                return jsonResponse({ error: "Unauthorized" }, 401);
            }
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const { data: adminSettingsRow, error: adminSettingsError } = await supabase
            .from("admin_notification_settings")
            .select("*")
            .eq("id", "global")
            .maybeSingle();

        if (adminSettingsError) {
            return jsonResponse({ error: adminSettingsError.message }, 500);
        }

        if (!adminSettingsRow?.reengagement_enabled) {
            return jsonResponse({
                processed: 0,
                providerConfigured: Boolean(resendApiKey && reminderFromEmail),
                notificationsEnabled: false,
                results: [],
            });
        }

        const { data, error } = await supabase.rpc("reengagement_due_users", {
            delay_days: adminSettingsRow?.reengagement_delay_days ?? 3,
            max_reminders: adminSettingsRow?.max_reminders_per_user ?? 1,
        });

        if (error) {
            return jsonResponse({ error: error.message }, 500);
        }

        const dueUsers = (data ?? []) as DueUser[];
        const results: Array<Record<string, unknown>> = [];

        for (const user of dueUsers) {
            // Check for an active personalized nudge (undismissed, created within last 7 days)
            const nudgeCutoff = new Date();
            nudgeCutoff.setDate(nudgeCutoff.getDate() - 7);
            const { data: nudgeRow } = await supabase
                .from("founder_nudges")
                .select("nudge_text")
                .eq("user_id", user.user_id)
                .is("dismissed_at", null)
                .gte("created_at", nudgeCutoff.toISOString())
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            const reminder = nudgeRow?.nudge_text
                ? buildPersonalizedReminderEmail(user.name, nudgeRow.nudge_text)
                : buildReminderEmail(user.name, user.days_inactive);
            const createdAt = new Date().toISOString();
            const { data: createdNotification, error: createError } = await supabase
                .from("notifications")
                .insert({
                    user_id: user.user_id,
                    type: "reengagement",
                    title: reminder.title,
                    message: reminder.body,
                    channel: "email",
                    status: "pending",
                    created_at: createdAt,
                })
                .select()
                .single();

            if (createError || !createdNotification) {
                results.push({
                    userId: user.user_id,
                    email: user.email,
                    status: "failed",
                    reason: createError?.message ?? "Could not create notification row",
                });
                continue;
            }

            let status: "sent" | "failed" = "sent";
            let sentAt: string | null = null;
            let providerMessageId: string | null = null;
            let failureReason: string | null = null;
            let simulated = false;

            if (resendApiKey && reminderFromEmail) {
                const resendResponse = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${resendApiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        from: reminderFromEmail,
                        to: [user.email],
                        subject: reminder.subject,
                        html: reminder.html,
                    }),
                });

                if (resendResponse.ok) {
                    const resendPayload = await resendResponse.json();
                    status = "sent";
                    sentAt = new Date().toISOString();
                    providerMessageId = resendPayload?.id ?? null;
                } else {
                    status = "failed";
                    failureReason = await resendResponse.text();
                }
            } else {
                simulated = true;
                sentAt = new Date().toISOString();
            }

            await supabase
                .from("notifications")
                .update({
                    status,
                    sent_at: sentAt,
                })
                .eq("id", createdNotification.id);

            if (status === "sent") {
                await supabase
                    .from("profiles")
                    .update({
                        last_reengagement_sent_at: sentAt,
                        last_reengagement_variant: reminder.id,
                        updated_at: sentAt,
                    })
                    .eq("id", user.user_id);
            }

            results.push({
                userId: user.user_id,
                email: user.email,
                status,
                notificationId: createdNotification.id,
                template: reminder.id,
                daysInactive: user.days_inactive,
                simulated,
                providerMessageId,
                failureReason,
            });
        }

        return jsonResponse({
            processed: results.length,
            providerConfigured: Boolean(resendApiKey && reminderFromEmail),
            results,
        });
    } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
    }
});

function jsonResponse(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
        },
    });
}

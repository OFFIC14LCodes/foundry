import { createClient } from "@supabase/supabase-js";

const MAX_FOUNDERS_PER_RUN = 50;
const MODEL = "claude-sonnet-4-20250514";
const SYSTEM_PROMPT = "You are Forge, the AI business partner inside Foundry. Write exactly as instructed. Keep the text flush-left, easy to scan, grounded in the founder's week, and structured with short paragraphs, bullets, and numbered lines when useful.";

const STAGES = {
  1: { label: "Idea", mission: "Prove the problem is real before building anything", totalMilestones: 5 },
  2: { label: "Plan", mission: "Build a coherent business model before spending serious money", totalMilestones: 5 },
  3: { label: "Legal", mission: "Protect the business and the founder with the right structure", totalMilestones: 5 },
  4: { label: "Finance", mission: "Build the financial foundation that makes every decision clearer", totalMilestones: 5 },
  5: { label: "Launch", mission: "Get the first paying customers and a repeatable way to find more", totalMilestones: 5 },
  6: { label: "Grow", mission: "Scale what's working without breaking what made it work", totalMilestones: 5 },
};

const RECURRING_THEME_KEYWORDS = [
  { label: "cash discipline", keywords: ["cash", "runway", "burn", "budget", "expense", "money"] },
  { label: "customer clarity", keywords: ["customer", "buyer", "discovery", "sales", "conversion"] },
  { label: "positioning and offer clarity", keywords: ["offer", "positioning", "message", "pricing", "price"] },
  { label: "founder confidence", keywords: ["fear", "doubt", "clarity", "momentum", "stuck"] },
];

export default async function handler(req, res) {
  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set" });
  }
  if (!anthropicKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const eligible = await loadEligibleFounders(supabaseAdmin);
    const selected = eligible.slice(0, MAX_FOUNDERS_PER_RUN);
    const results = [];

    for (const founder of selected) {
      try {
        const weekly = await buildServerWeeklyContext(supabaseAdmin, founder.userId, founder.profile);
        const stage = STAGES[founder.profile.currentStage] ?? STAGES[1];
        const prompt = buildWeeklyBriefingPrompt(
          founder.profile,
          stage.label,
          weekly.highlights.completedMilestones,
          weekly.highlights.totalMilestones,
          weekly.contextBlock,
        );
        const content = await generateBriefingWithAnthropic(prompt, anthropicKey);
        const saved = await saveBriefing(supabaseAdmin, founder.userId, content, founder.profile.currentStage, weekly);

        if (saved) {
          await createInAppBriefingNotification(supabaseAdmin, founder.userId, founder.profile);
        }

        let emailSent = false;
        if (saved && founder.profile.email) {
          const emailEnabled = await isEmailEnabled(supabaseAdmin, founder.userId);
          if (emailEnabled) {
            emailSent = await sendBriefingEmail(founder.profile, content);
          }
        }

        results.push({ userId: founder.userId, status: "generated", briefingId: saved?.id ?? null, emailSent });
      } catch (error) {
        console.error("Monday briefing founder error:", founder.userId, error);
        results.push({ userId: founder.userId, status: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    }

    return res.status(200).json({
      ok: true,
      eligible: eligible.length,
      processed: selected.length,
      generated: results.filter((result) => result.status === "generated").length,
      failed: results.filter((result) => result.status === "failed").length,
      results,
    });
  } catch (error) {
    console.error("send-monday-briefings error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}

async function loadEligibleFounders(db) {
  const { data: accessRows, error: accessError } = await db
    .from("account_access")
    .select("user_id, access_status, subscription_status, is_family_comp");

  if (accessError) throw accessError;

  const activeUserIds = (accessRows ?? [])
    .filter((row) => (
      row.access_status === "active"
      || row.subscription_status === "active"
      || row.subscription_status === "comped"
      || row.subscription_status === "gifted"
      || row.is_family_comp === true
    ))
    .map((row) => row.user_id)
    .filter(Boolean);

  if (activeUserIds.length === 0) return [];

  const { data: profileRows, error: profileError } = await db
    .from("profiles")
    .select("id, email, name, idea, business_name, industry, strategy, strategy_label, current_stage, budget_remaining, budget_spent, budget_total, exact_budget_amount, expenses")
    .in("id", activeUserIds);

  if (profileError) throw profileError;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: briefingRows, error: briefingError } = await db
    .from("briefings")
    .select("id, user_id, created_at, streak_count")
    .in("user_id", activeUserIds)
    .order("created_at", { ascending: false });

  if (briefingError) throw briefingError;

  const latestByUser = new Map();
  for (const briefing of briefingRows ?? []) {
    if (!latestByUser.has(briefing.user_id)) latestByUser.set(briefing.user_id, briefing);
  }

  return (profileRows ?? [])
    .map((row) => {
      const latest = latestByUser.get(row.id) ?? null;
      return {
        userId: row.id,
        profile: mapProfile(row),
        latestBriefing: latest,
        latestCreatedAtMs: latest?.created_at ? new Date(latest.created_at).getTime() : 0,
      };
    })
    .filter((founder) => !founder.latestBriefing || new Date(founder.latestBriefing.created_at).getTime() < todayStart.getTime())
    .sort((a, b) => a.latestCreatedAtMs - b.latestCreatedAtMs);
}

function mapProfile(row) {
  const stage = Number(row.current_stage ?? 1);
  return {
    name: row.name || "Founder",
    email: row.email || null,
    idea: row.idea || "",
    businessName: row.business_name || row.idea || "your business",
    industry: row.industry || "Early stage",
    strategy: row.strategy || null,
    strategyLabel: row.strategy_label || null,
    currentStage: Number.isFinite(stage) && stage >= 1 && stage <= 6 ? stage : 1,
    budget: {
      remaining: Number(row.budget_remaining ?? row.exact_budget_amount ?? row.budget_total ?? 0),
      spent: Number(row.budget_spent ?? 0),
      expenses: Array.isArray(row.expenses) ? row.expenses : [],
    },
  };
}

async function buildServerWeeklyContext(db, userId, profile) {
  const now = new Date();
  const weekStartDate = startOfWeekMonday(now);
  const weekStart = toDateKey(weekStartDate);
  const cutoffIso = weekStartDate.toISOString();
  const currentStageId = profile.currentStage || 1;
  const stage = STAGES[currentStageId] ?? STAGES[1];

  const [
    progressRes,
    decisionsRes,
    journalRes,
    summariesRes,
    nudgeRes,
    academyHistoryRes,
    academyCompletedRes,
  ] = await Promise.all([
    db.from("stage_progress").select("stage_id, completed_milestones, updated_at").eq("user_id", userId),
    db.from("founder_decisions").select("stage_id, tag, text, decided_at").eq("user_id", userId).gte("decided_at", cutoffIso).order("decided_at", { ascending: false }).limit(4),
    db.from("journal_entries").select("created_at, forge_summary, themes").eq("user_id", userId).gte("created_at", cutoffIso).not("forge_summary", "is", null).order("created_at", { ascending: false }).limit(4),
    db.from("daily_chat_summaries").select("stage_id, summary, summary_date, title").eq("user_id", userId).gte("summary_date", weekStart).order("summary_date", { ascending: false }).limit(3),
    db.from("founder_nudges").select("nudge_text").eq("user_id", userId).is("dismissed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("academy_user_history").select("action, created_at, content_id, content:academy_content(title)").eq("user_id", userId).gte("created_at", cutoffIso).order("created_at", { ascending: false }).limit(12),
    db.from("academy_user_content_progress").select("content_id, completed_at, content:academy_content(title)").eq("user_id", userId).eq("status", "completed").not("completed_at", "is", null).gte("completed_at", cutoffIso).order("completed_at", { ascending: false }),
  ]);

  const progressRows = progressRes.data ?? [];
  const currentProgress = progressRows.find((row) => Number(row.stage_id) === currentStageId);
  const completedMilestones = Array.isArray(currentProgress?.completed_milestones) ? currentProgress.completed_milestones.length : 0;
  const totalMilestones = stage.totalMilestones;
  const stageMovedThisWeek = isWithinLookback(currentProgress?.updated_at, weekStartDate.getTime());

  const weeklyDecisions = decisionsRes.data ?? [];
  const weeklySummaries = summariesRes.data ?? [];
  const weeklyJournalEntries = journalRes.data ?? [];
  const journalThemes = Array.from(new Set(weeklyJournalEntries.flatMap((item) => Array.isArray(item.themes) ? item.themes : []).filter(Boolean)));
  const recurringThemes = collectRecurringThemes(weeklySummaries, weeklyDecisions, journalThemes);
  const academyActivity = normalizeAcademyActivity(academyHistoryRes.data ?? [], academyCompletedRes.data ?? []);

  const expenses = Array.isArray(profile?.budget?.expenses) ? profile.budget.expenses : [];
  const recentExpenses = expenses
    .map((expense) => ({ expense, parsedDate: safeParseExpenseDate(expense?.date) }))
    .filter((item) => item.parsedDate && item.parsedDate.getTime() >= weekStartDate.getTime())
    .slice(0, 3);

  const weeklyMovementLines = [
    `Stage ${currentStageId} — ${stage.label}`,
    stageMovedThisWeek
      ? `Stage progress moved this week. The founder now sits at ${completedMilestones}/${totalMilestones} milestones complete.`
      : `Current stage progress stands at ${completedMilestones}/${totalMilestones} milestones complete.`,
  ];
  if (weeklyDecisions.length > 0) weeklyMovementLines.push(`Logged ${weeklyDecisions.length} notable decision${weeklyDecisions.length === 1 ? "" : "s"} this week.`);
  if (academyActivity.completedCount > 0) weeklyMovementLines.push(`Academy learning advanced with ${academyActivity.completedCount} lesson completion${academyActivity.completedCount === 1 ? "" : "s"}.`);

  const decisionsBlock = weeklyDecisions.length > 0
    ? weeklyDecisions.map((item) => `- ${item.tag ? `[${item.tag}] ` : ""}${truncate(item.text, 120)}`).join("\n")
    : "- No major decisions were logged this week.";

  const journalBlock = weeklyJournalEntries.length > 0
    ? weeklyJournalEntries.map((item) => {
      const themes = Array.isArray(item.themes) && item.themes.length > 0 ? ` Themes: ${item.themes.join(", ")}.` : "";
      return `- ${truncate(item.forge_summary || "Summary pending.", 150)}${themes}`;
    }).join("\n")
    : "- No journal summaries or themes were captured this week.";

  const academyBlock = [
    `- Lessons opened this week: ${academyActivity.openedCount}`,
    `- Lessons completed this week: ${academyActivity.completedCount}`,
    academyActivity.recentOpenedLessons.length > 0 ? `- Recent lessons visited: ${academyActivity.recentOpenedLessons.join(", ")}` : null,
    academyActivity.recentCompletedLessons.length > 0 ? `- Recently completed: ${academyActivity.recentCompletedLessons.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  const summaryBlock = weeklySummaries.length > 0
    ? weeklySummaries.map((item) => {
      const summaryStage = STAGES[item.stage_id] ?? { label: `Stage ${item.stage_id}` };
      return `- ${summaryStage.label}: ${truncate(item.summary, 150)}`;
    }).join("\n")
    : "- No recent Forge session summaries were available this week.";

  const financialLines = [
    `- Budget remaining: $${Number(profile?.budget?.remaining || 0).toLocaleString()}`,
    `- Budget spent: $${Number(profile?.budget?.spent || 0).toLocaleString()}`,
    recentExpenses.length > 0
      ? `- Reliably dated recent expenses: ${recentExpenses.map(({ expense }) => `$${Number(expense.amount || 0).toLocaleString()} for ${expense.label || "an expense"}`).join("; ")}`
      : expenses.length > 0
        ? "- Expenses exist, but their dates are not reliable enough to make a week-specific claim. Use the snapshot, not a delta."
        : "- No expenses recorded yet.",
  ];

  const activeNudgeText = nudgeRes.data?.nudge_text ?? null;
  const focusCandidates = [
    activeNudgeText ? truncate(activeNudgeText, 150) : null,
    recurringThemes[0] ? `There is a repeated pattern around ${recurringThemes[0]}.` : null,
    weeklyDecisions.length > 0 ? "Multiple decisions were made quickly enough this week that follow-through may matter more than new options." : null,
    stageMovedThisWeek ? "Stage progress moved. The next move should reinforce that momentum rather than scatter it." : null,
    `The founder is in Stage ${currentStageId}, where the real question is: ${stage.mission}.`,
  ].filter(Boolean);

  const contextBlock = [
    "[WEEKLY_FOUNDER_CONTEXT]",
    `CURRENT STAGE:\n- Stage ${currentStageId} — ${stage.label}\n- Mission: ${stage.mission}\n- Business: ${profile?.businessName || profile?.idea || "Still being clarified"}\n- Industry: ${profile?.industry || "Early stage"}\n- Strategy mode: ${profile?.strategyLabel || profile?.strategy || "Not specified"}`,
    `THIS WEEK'S MOVEMENT:\n${weeklyMovementLines.map((line) => `- ${line}`).join("\n")}`,
    `DECISIONS:\n${decisionsBlock}`,
    `JOURNAL SIGNALS:\n${journalBlock}`,
    `ACADEMY LEARNING:\n${academyBlock}`,
    `RECENT FORGE CONVERSATIONS:\n${summaryBlock}`,
    `FINANCIAL SNAPSHOT:\n${financialLines.join("\n")}`,
    `RECURRING THEMES:\n${recurringThemes.length > 0 ? recurringThemes.map((theme) => `- ${theme}`).join("\n") : "- No strong repeated pattern stood out yet."}`,
    `ACTIVE NUDGE:\n- ${activeNudgeText ? truncate(activeNudgeText, 150) : "No active nudge is currently sitting with the founder."}`,
    `FORGE'S BRIEFING FOCUS:\n- ${focusCandidates[0]}`,
    "[/WEEKLY_FOUNDER_CONTEXT]",
  ].join("\n\n");

  return {
    weekStart,
    contextBlock,
    highlights: {
      stageLabel: stage.label,
      completedMilestones,
      totalMilestones,
      stageMovedThisWeek,
      recentDecisionTags: Array.from(new Set(weeklyDecisions.map((item) => item.tag).filter(Boolean))),
      journalThemes,
      recurringThemes,
      academyCompletedTitles: academyActivity.recentCompletedLessons,
      academyOpenedTitles: academyActivity.recentOpenedLessons,
      activeNudge: activeNudgeText,
    },
    sourceCounts: {
      decisions: weeklyDecisions.length,
      chat_summaries: weeklySummaries.length,
      journal_entries: weeklyJournalEntries.length,
      journal_themes: journalThemes.length,
      academy_history: academyActivity.recentActivity.length,
      academy_completed: academyActivity.completedCount,
      parseable_recent_expenses: recentExpenses.length,
      active_nudges: activeNudgeText ? 1 : 0,
    },
  };
}

function buildWeeklyBriefingPrompt(profile, stageLabel, completedCount, totalCount, weeklyContextBlock) {
  return `
You are Forge. Write a weekly founder briefing for ${profile.name}, who is building "${profile.businessName || profile.idea}".

You should sound like a business partner who has been tracking the shape of the founder's week. Be observant, warm, and direct. Do not sound like you are reading records or analyzing a database.

Use the weekly context below. Treat it as directional memory, not raw material to repeat mechanically.

${weeklyContextBlock}

Anchor points:
- Current stage: Stage ${profile.currentStage} — ${stageLabel}
- Stage progress: ${completedCount}/${totalCount} milestones complete
- Budget remaining: $${Number(profile.budget?.remaining || 0).toLocaleString()}

Write the briefing in this structure:

1. Opening reflection
- 2-3 sentences
- grounded in the founder's actual week
- natural language, not data-speak

2. What moved this week
- 2-4 bullets
- reference meaningful movement: decisions, learning, stage progress, financial movement, or recent Forge work

3. What seems stuck or repeated
- 1 short paragraph or 2-3 bullets
- surface friction, repetition, or a pattern worth naming

4. What deserves attention now
- 2-3 sentences
- name the one thing Forge thinks matters most this week

5. This week's focus
- exactly one clear focus line

6. One concrete next action
- exactly one concrete next action
- practical, specific, and doable this week

Keep it under 420 words. Keep everything flush-left and easy to scan on a phone. Use short paragraphs and bullets when helpful. Do not quote private journal text. Do not say phrases like "based on the data" or "I noticed from your records."
  `.trim();
}

async function generateBriefingWithAnthropic(briefingPrompt, anthropicKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 900,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: briefingPrompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic ${response.status}: ${text.slice(0, 200)}`);
  }

  const payload = await response.json();
  const content = Array.isArray(payload?.content)
    ? payload.content.map((block) => block?.text || "").join("")
    : "";
  if (!content.trim()) throw new Error("Anthropic returned empty briefing content");
  return content;
}

async function saveBriefing(db, userId, content, stageId, weekly) {
  const { data: previous } = await db
    .from("briefings")
    .select("created_at, streak_count")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousCreatedAtMs = previous?.created_at ? new Date(previous.created_at).getTime() : NaN;
  const withinEightDays = Number.isFinite(previousCreatedAtMs)
    && Date.now() - previousCreatedAtMs <= 8 * 24 * 60 * 60 * 1000;
  const streakCount = withinEightDays ? Math.max(1, Number(previous?.streak_count ?? 1)) + 1 : 1;

  const { data, error } = await db
    .from("briefings")
    .insert({
      user_id: userId,
      content,
      stage_id: stageId,
      week_start: weekly.weekStart,
      highlights: weekly.highlights,
      source_counts: weekly.sourceCounts,
      generated_at: new Date().toISOString(),
      streak_count: streakCount,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

async function isEmailEnabled(db, userId) {
  const { data, error } = await db
    .from("user_notification_preferences")
    .select("email_notifications_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("email preference lookup failed:", userId, error.message);
    return true;
  }
  return data?.email_notifications_enabled ?? true;
}

async function createInAppBriefingNotification(db, userId, profile) {
  const { error } = await db
    .from("notifications")
    .insert({
      user_id: userId,
      type: "system",
      title: "Your Monday Briefing is ready",
      message: `Forge generated this week's briefing for ${profile.businessName || "your business"}.`,
      channel: "in_app",
      status: "pending",
      created_at: new Date().toISOString(),
    });
  if (error) {
    console.warn("Monday briefing in-app notification failed:", userId, error.message);
  }
}

async function sendBriefingEmail(profile, content) {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL || process.env.RESEND_FROM_ADDRESS || "Foundry <onboarding@resend.dev>";
  const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://foundryandforge.app");
  if (!resendKey || !profile.email) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [profile.email],
      subject: `Your Monday Briefing — ${profile.businessName || "Foundry"}`,
      text: `${content.trim()}\n\nOpen Foundry → ${appUrl}`,
    }),
  });

  if (!response.ok) {
    console.warn("Monday briefing email failed:", profile.email, await response.text());
    return false;
  }
  return true;
}

function normalizeAcademyActivity(historyRows, completedRows) {
  const recentActivity = historyRows.map((row) => ({
    action: row.action,
    title: row.content?.title ?? "Academy lesson",
    createdAt: row.created_at,
  }));
  const openedIds = new Set(historyRows.filter((row) => row.action === "viewed" || row.action === "opened_forge").map((row) => row.content_id).filter(Boolean));
  const completedIds = new Set(completedRows.map((row) => row.content_id).filter(Boolean));
  const recentOpenedLessons = Array.from(new Set(historyRows.filter((row) => (row.action === "viewed" || row.action === "opened_forge") && row.content?.title).map((row) => row.content.title))).slice(0, 4);
  const recentCompletedLessons = Array.from(new Set(completedRows.map((row) => row.content?.title).filter(Boolean))).slice(0, 4);
  return {
    openedCount: openedIds.size,
    completedCount: completedIds.size,
    recentOpenedLessons,
    recentCompletedLessons,
    recentActivity,
  };
}

function startOfWeekMonday(now) {
  const result = new Date(now);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWithinLookback(dateLike, cutoffMs) {
  if (!dateLike) return false;
  const ms = new Date(dateLike).getTime();
  return Number.isFinite(ms) && ms >= cutoffMs;
}

function truncate(value, max = 140) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trim()}…`;
}

function safeParseExpenseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed;
}

function collectRecurringThemes(summaries, decisions, journalThemes) {
  const bag = [
    ...summaries.map((item) => String(item.summary || "").toLowerCase()),
    ...decisions.map((item) => `${item.tag ?? ""} ${item.text ?? ""}`.toLowerCase()),
    ...journalThemes.map((theme) => String(theme).toLowerCase()),
  ].join(" ");

  return RECURRING_THEME_KEYWORDS
    .filter((cluster) => cluster.keywords.some((keyword) => bag.includes(keyword)))
    .map((cluster) => cluster.label);
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import AuthScreen from "./AuthScreen";
import JournalScreen from "./JournalScreen";
import BriefingsScreen from "./BriefingsScreen";
import {
  loadProfile, saveProfile,
  loadAllStageProgress, saveStageProgress,
  loadAllMessages, saveMessages,
  loadConversationSummaries, saveConversationSummary,
  loadJournalEntries, saveJournalEntry, deleteJournalEntry,
  loadBriefings, saveBriefing,
  loadLatestMarketReport,
  ensureUserProfile,
  ensureOwnerProfileRole,
  loadNotifications,
  loadNotificationPreferences,
  saveNotificationPreferences,
  loadAdminNotificationSettings,
  saveAdminNotificationSettings,
  markNotificationRead,
  recordMeaningfulActivity,
  loadBillingSubscription,
} from "./db";
import { GLOBAL_STYLES } from "./constants/styles";
import { FORGE_SYSTEM_PROMPT, FOUNDRY_METHOD } from "./constants/prompts";
import { STAGES_DATA } from "./constants/stages";
import { applyGlossaryHighlights } from "./lib/applyGlossaryHighlights";
import { cleanAIText } from "./lib/cleanAIText";
import { buildMessageContent, type AttachedFile } from "./lib/fileAttach";
import TypingDots from "./components/TypingDots";
import ForgeAvatar from "./components/ForgeAvatar";
import ChatInput from "./components/ChatInput";
import StageRefModal from "./components/StageRefModal";
import GlossaryModal from "./components/GlossaryModal";
import CinematicIntro from "./components/CinematicIntro";
import MessageBubble from "./components/MessageBubble";
import HubPanel from "./components/HubPanel";
import OnboardingScreen from "./components/OnboardingScreen";
import MilestonesPanel from "./components/MilestonesPanel";
import StageBriefing from "./components/StageBriefing";
import HubScreen from "./components/HubScreen";
import { Icons } from "./icons";
import PitchPracticeScreen from "./components/PitchPracticeScreen";
import DocumentProductionScreen from "./components/DocumentProductionScreen";
import MarketIntelligenceScreen from "./components/MarketIntelligenceScreen";
import CofounderModeScreen from "./components/CofounderModeScreen";
import ForgeChatRoom from "./components/ForgeChatRoom";
import AdminHubScreen from "./components/AdminHubScreen";
import SettingsScreen from "./components/settings/SettingsScreen";
import PrivacyPolicyScreen from "./components/settings/PrivacyPolicyScreen";
import EulaScreen from "./components/settings/EulaScreen";
import TermsAndConditionsScreen from "./components/settings/TermsAndConditionsScreen";
import AcceptableUsePolicyScreen from "./components/settings/AcceptableUsePolicyScreen";
import DisclaimerScreen from "./components/settings/DisclaimerScreen";
import Logo from "./components/Logo";
import ForgeBubble from "./components/ForgeBubble";
import LoadingForgeAnimation from "./components/LoadingForgeAnimation";
import PaywallScreen from "./components/paywall/PaywallScreen";
import BillingReturnScreen from "./components/BillingReturnScreen";
import { buildMarketIntelContext } from "./constants/marketPrompt";
import { callForgeAPI, streamForgeAPI } from "./lib/forgeApi";
import { getTeamForUser, getRecentCofounderContext } from "./lib/cofounderDb";
import { ensureAccountAccess, updateUserActivity } from "./db";
import { canAccessApp, getAccessBlockReason } from "./lib/accessGate";
import type { AccountAccess, BillingSubscription } from "./lib/accessGate";
import { canAccessStage, getAccessSummary } from "./lib/foundryAccess";
import { hasAdminHubAccess, isOwnerEmail } from "./lib/roles";
import { openCustomerPortal } from "./lib/billing";
import { clearBillingRoute, getBillingRouteState } from "./lib/billingRoute";
import {
  DEFAULT_ADMIN_NOTIFICATION_SETTINGS,
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  type AdminNotificationSettings,
  type AppNotification,
  type UserNotificationPreferences,
} from "./lib/notifications";
import { STORAGE_KEYS, clearFoundryClientStorage, createEmptyMessagesByStage, createEmptyStageProgress } from "./lib/session";

// callForgeAPI and streamForgeAPI are imported from ./lib/forgeApi

// ─────────────────────────────────────────────────────────────
// MEMORY + CONTEXT BUILDERS
// ─────────────────────────────────────────────────────────────
const memorySummaryCache: Record<number, { summary: string; messageCount: number }> = {};

async function generateStageSummary(stageId, messages, profile) {
  if (!messages || messages.length === 0) return null;
  const cached = memorySummaryCache[stageId];
  if (cached && cached.messageCount === messages.length) return cached.summary;
  const stageData = STAGES_DATA[stageId - 1];
  const transcript = messages
    .filter(m => m.text && m.text.trim())
    .map(m => `${m.role === "forge" ? "Forge" : profile.name}: ${m.text.replace(/\[.*?\]/g, "").trim()}`)
    .slice(-20)
    .join("\n");
  const prompt = `Summarize this Stage ${stageId} (${stageData.label}) coaching conversation in 3-4 sentences. Focus on: key decisions made, insights discovered, problems identified, and progress on milestones. Be specific — names, numbers, and concrete findings matter.\n\nConversation:\n${transcript}`;
  try {
    const summary = await callForgeAPI(
      [{ role: "user", content: prompt }],
      "You are a concise summarizer. Respond with only the summary, no preamble."
    );
    memorySummaryCache[stageId] = { summary, messageCount: messages.length };
    return summary;
  } catch {
    return null;
  }
}

async function buildRichContext(profile, activeStage, completedByStage, messagesByStage, cofoundersContext?: string | null) {
  const stageData = STAGES_DATA[activeStage - 1];
  const completedMilestones = completedByStage[activeStage] || [];

  const pending = stageData.milestones
    .filter(m => !completedMilestones.includes(m.id))
    .map(m => `- ${m.id}: "${m.label}"`).join("\n");
  const done = stageData.milestones
    .filter(m => completedMilestones.includes(m.id))
    .map(m => `  ✓ ${m.label}`).join("\n");

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  const allStageStatus = STAGES_DATA.map(s => {
    const comp = completedByStage[s.id] || [];
    const pct = Math.round((comp.length / s.milestones.length) * 100);
    return `  Stage ${s.id} (${s.label}): ${comp.length}/${s.milestones.length} milestones — ${pct}% complete`;
  }).join("\n");

  const decisions = (profile.decisions || []).slice(0, 5)
    .map(d => `  [${typeof d === "string" ? "Decision" : d.tag}] ${typeof d === "string" ? d : d.text}`)
    .join("\n") || "  None yet";
  const expenses = (profile.budget?.expenses || []).slice(0, 4)
    .map(e => `  $${e.amount?.toLocaleString()} — ${e.label}`)
    .join("\n") || "  None yet";

  const memorySections: string[] = [];
  for (const s of STAGES_DATA) {
    if (s.id === activeStage) continue;
    const msgs = messagesByStage[s.id] || [];
    if (msgs.length === 0) continue;
    const summary = await generateStageSummary(s.id, msgs, profile);
    if (summary) memorySections.push(`Stage ${s.id} (${s.label}) memory:\n  ${summary}`);
  }

  // Foundry Method — inject active stage knowledge base
  const methodContent = FOUNDRY_METHOD[activeStage] || "";
  const methodSection = methodContent ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOUNDRY METHOD — STAGE ${activeStage} KNOWLEDGE BASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is your coaching depth for this stage. You carry it as fluency — not a curriculum to deliver. Let it inform your questions more than your answers. Surface frameworks when they directly serve the founder's current situation. When a founder describes a problem, you often already know its name, its cause, and its proven resolution — use that to ask a sharper question or offer a more precise reframe. Never say "the knowledge base says" or "according to the Foundry Method." Just use it the way a great advisor uses experience — naturally, in service of this specific person and this specific moment.

${methodContent}` : "";

  const cofounderSection = cofoundersContext ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COFOUNDER TEAM CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This founder is part of a team. The following is from their shared team chat. Use it naturally when relevant — it represents knowledge the founder should not have to repeat. Reference it when it directly bears on the current conversation.

${cofoundersContext}` : "";

  return `
Current date & time: ${dateStr}, ${timeStr}
Founder: ${profile.name} | Business: ${profile.businessName || profile.idea || "Idea stage"} (${profile.industry || "Early Stage"})
Strategy: ${profile.strategyLabel || profile.strategy} | Experience: ${profile.experience || "Not specified"}
Budget: $${(profile.budget?.remaining || 0).toLocaleString()} remaining of $${(profile.budget?.total || 0).toLocaleString()} | Spent: $${(profile.budget?.spent || 0).toLocaleString()} | Runway: ${profile.budget?.runway || "TBD"}

CURRENT STAGE: ${activeStage} — ${stageData.label}
Mission: ${stageData.mission}
${done ? `Completed milestones:\n${done}` : "No milestones completed yet"}
${pending ? `Pending milestones:\n${pending}` : "All milestones complete"}

ALL STAGE PROGRESS:
${allStageStatus}

DECISIONS LOG:
${decisions}

RECENT EXPENSES:
${expenses}

${memorySections.length > 0 ? `CROSS-STAGE MEMORY (prior stage work):
${memorySections.join("\n\n")}` : ""}

STAGE REFERENCES: When referencing work from another stage, wrap it like [STAGE_REF:N]text[/STAGE_REF]. Use naturally when prior work is relevant — not on every mention.${cofounderSection}${methodSection}
  `.trim();
}

// Market intel is injected at call-sites rather than inside buildRichContext
// so the function signature stays clean and the report is optional.
function appendMarketContext(ctx: string, marketReport: any): string {
  if (!marketReport?.content) return ctx;
  return ctx + buildMarketIntelContext(marketReport);
}

function buildContext(profile, stage = null, completedMilestones = []) {
  const stageData = stage ? STAGES_DATA[stage - 1] : null;
  const pending = stageData
    ? stageData.milestones.filter(m => !completedMilestones.includes(m.id)).map(m => `- ${m.id}: "${m.label}"`).join("\n")
    : "";
  const done = stageData
    ? stageData.milestones.filter(m => completedMilestones.includes(m.id)).map(m => `  ✓ ${m.label}`).join("\n")
    : "";
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  return `
Current date & time: ${dateStr}, ${timeStr}
Founder: ${profile.name} | Idea: ${profile.idea || "Idea stage"} | Strategy: ${profile.strategyLabel || profile.strategy}
Budget: $${(profile.budget?.remaining || 0).toLocaleString()} remaining | Stage: ${stage ? `${stage} — ${stageData?.label}` : "Onboarding"} | Experience: ${profile.experience || "Not specified"}
${done ? `Completed:\n${done}` : ""}
${pending ? `Pending:\n${pending}` : ""}
  `.trim();
}

function parseForgeResponse(text) {
  const completedIds: string[] = [];
  const regex = /\[COMPLETE:\s*(\w+)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) completedIds.push(match[1]);
  const advanceReady = text.includes("[ADVANCE_READY]");
  const cleanText = text.replace(/\[COMPLETE:\s*\w+\]/g, "").replace(/\[ADVANCE_READY\]/g, "").trim();
  return { cleanText, completedIds, advanceReady };
}

function getFurthestStageReached(profile, completedByStage, messagesByStage) {
  const reachedStages = STAGES_DATA.map((stage) => {
    const hasCompletedMilestones = (completedByStage[stage.id] || []).length > 0;
    const hasMessages = (messagesByStage[stage.id] || []).some((message: any) => {
      const text = typeof message?.text === "string" ? message.text : "";
      return text.trim().length > 0;
    });
    return hasCompletedMilestones || hasMessages ? stage.id : 0;
  });

  return Math.max(profile?.currentStage ?? 1, 1, ...reachedStages);
}

// Returns the Monday (YYYY-MM-DD) of the week containing the given date
function getWeekStartKey(dateLike?: string | number | Date) {
  const date = dateLike ? new Date(dateLike) : new Date();
  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(date);
  monday.setDate(date.getDate() - daysToMonday);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${year}-${month}-${d}`;
}

// Returns a human-readable label like "Apr 7 – Apr 13, 2026"
function getWeekLabel(weekStartKey: string) {
  const monday = new Date(`${weekStartKey}T12:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(monday)} – ${fmt(sunday)}, ${sunday.getFullYear()}`;
}

function groupMessagesByWeek(messages: any[] = []) {
  return messages.reduce((acc, msg) => {
    const key = getWeekStartKey(msg.createdAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {} as Record<string, any[]>);
}


function getSummaryPreview(summary: string) {
  const plain = (summary || "").replace(/\s+/g, " ").trim();
  if (plain.length <= 140) return plain;
  return `${plain.slice(0, 140).trim()}...`;
}

function parseDailySummaryResponse(raw: string, fallbackDate: string) {
  try {
    const parsed = JSON.parse(raw);
    return {
      title: parsed.title?.trim() || `Conversation Summary · ${fallbackDate}`,
      summary: parsed.summary?.trim() || raw.trim(),
    };
  } catch {
    const [firstLine, ...rest] = raw.trim().split("\n");
    return {
      title: firstLine?.trim() || `Conversation Summary · ${fallbackDate}`,
      summary: rest.join("\n").trim() || raw.trim(),
    };
  }
}


function renderWithBold(text, onStageRef, onGlossaryTap) {
  if (!text) return null;
  text = cleanAIText(text);

  const stageRefRegex = /\[STAGE_REF:(\d+)\](.*?)\[\/STAGE_REF\]/gs;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = stageRefRegex.exec(text)) !== null) {
    const [fullMatch, stageId, stageText] = match;
    const start = match.index;

    if (start > lastIndex) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex, start),
      });
    }

    parts.push({
      type: "stage_ref",
      stageId: Number(stageId),
      content: stageText,
    });

    lastIndex = start + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  const renderInlineContent = (segment: string, keyPrefix: string) => {
    const boldParts = segment.split(/(\*\*.*?\*\*)/g);

    return boldParts.map((part: string, i: number) => {
      const key = `${keyPrefix}-${i}`;

      if (part.startsWith("**") && part.endsWith("**")) {
        const inner = part.slice(2, -2);
        return (
          <strong key={key} style={{ color: "#F0EDE8", fontWeight: 700 }}>
            {applyGlossaryHighlights(inner, onGlossaryTap)}
          </strong>
        );
      }

      // Handle single newlines as <br>
      const lines = part.split("\n");
      return lines.map((line: string, j: number) => (
        <span key={`${key}-l${j}`}>
          {j > 0 && <br />}
          {applyGlossaryHighlights(line, onGlossaryTap)}
        </span>
      ));
    });
  };

  const renderTextWithBold = (segment: string, keyPrefix: string) => {
    // Split on double newlines to create paragraph breaks
    const paragraphs = segment.split(/\n\n+/);
    return paragraphs.map((para: string, pIdx: number) => (
      <p key={`${keyPrefix}-p${pIdx}`} style={{ margin: pIdx === 0 ? 0 : "10px 0 0 0" }}>
        {renderInlineContent(para, `${keyPrefix}-p${pIdx}`)}
      </p>
    ));
  };

  return parts.map((part, i) => {
    if (part.type === "stage_ref") {
      return (
        <button
          key={`stage-ref-${i}`}
          onClick={() => onStageRef && onStageRef(part.stageId)}
          style={{
            background: "rgba(232,98,42,0.08)",
            border: "1px solid rgba(232,98,42,0.22)",
            borderRadius: 8,
            padding: "2px 8px",
            margin: "0 2px",
            color: "#E8622A",
            cursor: "pointer",
            fontSize: "0.95em",
            fontFamily: "inherit",
          }}
        >
          {part.content}
        </button>
      );
    }

    return (
      <span key={`text-${i}`}>
        {renderTextWithBold(part.content, `text-${i}`)}
      </span>
    );
  });
}


// ─────────────────────────────────────────────────────────────
// FORGE SCREEN — the main chat interface
// ─────────────────────────────────────────────────────────────
function ForgeScreen({
  userId,
  profile,
  onBack,
  onUpdateProfile,
  completedByStage,
  onMilestoneComplete,
  onAdvance,
  messagesByStage,
  onUpdateMessages,
  marketReport = null,
  isFirstVisit = false,
  initialStage = null,
  teamId = null as string | null,
  onMeaningfulActivity,
  bubbleSummaries = [] as any[],
  pendingUpgradeStage = null as number | null,
  furthestStageReached = 1,
  onRequestUpgrade = null as ((stage: number) => void) | null,
  onDowngradeToFree = null as (() => void) | null,
}) {
  const [activeStage, setActiveStage] = useState(pendingUpgradeStage || initialStage || profile.currentStage);
  const [activeTab, setActiveTab] = useState("chat");
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [advanceReady, setAdvanceReady] = useState(false);
  const [showStageSelector, setShowStageSelector] = useState(false);
  const [stageRefModal, setStageRefModal] = useState<number | null>(null);
  const [glossaryModal, setGlossaryModal] = useState<{ term: string; entry: any } | null>(null);
  const [briefingDismissed, setBriefingDismissed] = useState(false);
  const [cofoundersContext, setCofoundersContext] = useState<string | null>(null);
  const [summariesByStage, setSummariesByStage] = useState<Record<number, any[]>>({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });
  const [summaryModal, setSummaryModal] = useState<any | null>(null);
  const [archivingDateKey, setArchivingDateKey] = useState<string | null>(null);

  // Load shared team context for Forge injection
  useEffect(() => {
    if (!teamId) { setCofoundersContext(null); return; }
    getRecentCofounderContext(teamId, 20).then(ctx => setCofoundersContext(ctx || null));
  }, [teamId]);

  useEffect(() => {
    let cancelled = false;

    loadConversationSummaries(userId).then((rows) => {
      if (cancelled) return;
      const grouped = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] } as Record<number, any[]>;
      rows.forEach((row) => {
        if (!grouped[row.stageId]) grouped[row.stageId] = [];
        grouped[row.stageId].push(row);
      });
      setSummariesByStage(grouped);
    });

    return () => { cancelled = true; };
  }, [userId]);

  const stage = STAGES_DATA[activeStage - 1];
  const StageIcon = stage.icon;
  const messages = messagesByStage[activeStage] || [];
  const stageSummaries = summariesByStage[activeStage] || [];
  const completedMilestones = completedByStage[activeStage] || [];
  const allMilestonesComplete = completedMilestones.length >= stage.milestones.length && stage.milestones.length > 0;

  // Combined chat view: all stages up to activeStage, with stage-transition markers
  const combinedMessages = useMemo(() => {
    const result: Array<any> = [];
    for (let s = 1; s <= activeStage; s++) {
      const stageMsgs = messagesByStage[s] || [];
      if (stageMsgs.length === 0) continue;
      if (result.length > 0) {
        result.push({ _stageMarker: true, stageId: s, id: `marker-s${s}` });
      }
      result.push(...stageMsgs);
    }
    return result;
  }, [messagesByStage, activeStage]);
  const completionPct = Math.round(
    (completedMilestones.length / stage.milestones.length) * 100
  );

  const scrollRef = useRef(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  const buildUpgradeActions = (stageNumber: number) => ([
    {
      id: `upgrade-stage-${stageNumber}`,
      type: "upgrade",
      stage: stageNumber,
      label: `Unlock Stage ${stageNumber} →`,
      variant: "primary",
    },
    {
      id: `free-stage-1`,
      type: "downgrade_to_stage_1",
      stage: 1,
      label: "← Start with Stage 1 (free)",
      variant: "secondary",
    },
  ]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 120) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  useLayoutEffect(() => {
    const shouldShowBriefing = messages.length === 0 && stageSummaries.length === 0 && !loading && !briefingDismissed;
    if (activeTab !== "chat" || shouldShowBriefing) return;

    const restore = () => {
      bottomAnchorRef.current?.scrollIntoView({ block: "end" });
    };

    restore();
    const timer = window.setTimeout(restore, 60);
    let rafTwo = 0;
    const rafOne = window.requestAnimationFrame(() => {
      restore();
      rafTwo = window.requestAnimationFrame(restore);
    });

    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(rafOne);
      if (rafTwo) window.cancelAnimationFrame(rafTwo);
    };
  }, [activeStage, activeTab, briefingDismissed, messages.length, loading, stageSummaries.length]);

  useEffect(() => {
    setActiveTab("chat");
    setAdvanceReady(false);
    setBriefingDismissed(false);
  }, [activeStage]);

  // Ensure activeStage matches pendingUpgradeStage when arriving from onboarding with a paid stage
  useEffect(() => {
    if (pendingUpgradeStage && activeStage !== pendingUpgradeStage) {
      setActiveStage(pendingUpgradeStage);
    }
  }, [pendingUpgradeStage]);

  useEffect(() => {
    const stageMessages = messagesByStage[activeStage] || [];
    const shouldShowBriefing = !pendingUpgradeStage && stageMessages.length === 0 && stageSummaries.length === 0 && !loading && !briefingDismissed;
    if (stageMessages.length > 0 || loading || shouldShowBriefing) return;

    const stageData = STAGES_DATA[activeStage - 1];
    const lastSeenRaw = localStorage.getItem("foundry_last_seen");
    const lastSeen = lastSeenRaw ? parseInt(lastSeenRaw) : null;
    const hoursSince = lastSeen ? (Date.now() - lastSeen) / 1000 / 60 / 60 : null;
    const isLongAbsence = !lastSeen || hoursSince > 8;

    localStorage.setItem("foundry_last_seen", Date.now().toString());

    const runGreeting = async () => {
      const ctx = appendMarketContext(await buildRichContext(
        profile,
        activeStage,
        completedByStage,
        messagesByStage,
        cofoundersContext
      ), marketReport);

      let greetingPrompt = "";

      if (isFirstVisit && pendingUpgradeStage && activeStage === pendingUpgradeStage) {
        greetingPrompt = `${profile.name} just finished onboarding and wants to start at Stage ${activeStage}: ${stageData.label}. Their idea: "${profile.idea}". Experience: ${profile.experience}. Budget: $${profile.budget?.total?.toLocaleString() || "unknown"}. Strategy: ${profile.strategyLabel}.

Write a 2-3 paragraph welcome. First: recap what they shared during onboarding — the idea, experience, budget, and strategy — in a natural, specific way, not a form readback. Second: briefly describe what Stage ${activeStage} is about and why it fits where they are. Third (short): let them know Stage ${activeStage} requires a Starter or Pro plan to access — they can upgrade now to jump straight in, or step back and explore Stage 1 for free first. Keep the tone warm and direct. Use **bold** on 2-3 key words. Do NOT end with a question — end after the payment note.`;
      } else if (isFirstVisit && activeStage === 1) {
        greetingPrompt = `${profile.name} just finished onboarding and is entering Stage 1 for the first time. Their idea: "${profile.idea}". Experience: ${profile.experience}. Budget: $${profile.budget?.total?.toLocaleString() || "unknown"}. Strategy: ${profile.strategyLabel}.

Start with a short recap of what they told Foundry during onboarding: the business idea, their experience level, their budget, and their strategy. Make it sound natural and specific, not like a form readback. Then pivot immediately to Stage 1's core question: is the problem real. End with one sharp, concrete question that gets the conversation moving. Use **bold** on 2-3 key words. Keep it to 2-3 tight paragraphs.`;
      } else if (isLongAbsence && activeStage > 0) {
        const hoursText = hoursSince ? `about ${Math.round(hoursSince)} hours` : "a while";
        greetingPrompt = `${profile.name} is returning to Stage ${activeStage}: ${stageData.label} after ${hoursText} away. Welcome them back briefly and warmly — 1 sentence, not more. Reference where they are in this stage and what matters most right now. Then ask one sharp forward-moving question. 3-4 paragraphs max. Use **bold** on 2-3 key words.`;
      } else {
        greetingPrompt = `${profile.name} just opened Stage ${activeStage}: ${stageData.label}. Introduce the mission for this stage in a way that feels personal to their specific situation. Reference what makes this stage matter. Then ask the first sharp question to get started. Use **bold** on 2-3 key words. 3-4 paragraphs max.`;
      }

      setLoading(true);

      try {
        const reply = await callForgeAPI(
          [{ role: "user", content: greetingPrompt }],
          FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", ctx)
        );
        onUpdateMessages(activeStage, [{
          id: `greet-${Date.now()}`,
          role: "forge",
          text: reply,
          createdAt: new Date().toISOString(),
          actions: isFirstVisit && pendingUpgradeStage && activeStage === pendingUpgradeStage
            ? buildUpgradeActions(activeStage)
            : undefined,
        }]);
      } catch {
        const fallback =
          isFirstVisit && activeStage === 1
            ? `${profile.name} — welcome to Foundry.

You came in with **${profile.idea || "a new business idea"}**, a ${profile.experience || "founder"} background, a budget of **$${profile.budget?.total?.toLocaleString() || "unknown"}**, and a **${profile.strategyLabel || profile.strategy || "focused"}** approach. That's enough to start pressure-testing this the right way.

Stage 1 is about one thing: making sure a real person has a real problem worth solving.

Who, specifically, is the first person you believe feels this problem often enough to want a better solution?`
            : isFirstVisit && pendingUpgradeStage && activeStage === pendingUpgradeStage
              ? `${profile.name} — Stage ${activeStage}: ${stageData.label}.

You came in wanting to start here, which makes sense based on what you shared. This stage is where the work gets more concrete and more consequential.

To continue in Stage ${activeStage}, you'll need a paid plan. You can unlock it now, or step back and start with Stage 1 for free first.`
              : `${profile.name} — Stage ${activeStage}: ${stageData.label}.

${stageData.mission}

Where do you want to start?`;

        onUpdateMessages(activeStage, [{
          id: `greet-${Date.now()}`,
          role: "forge",
          text: fallback,
          createdAt: new Date().toISOString(),
          actions: isFirstVisit && pendingUpgradeStage && activeStage === pendingUpgradeStage
            ? buildUpgradeActions(activeStage)
            : undefined,
        }]);
      }

      setLoading(false);
    };

    setTimeout(runGreeting, 400);
  }, [activeStage, briefingDismissed, stageSummaries.length, !!messagesByStage[activeStage]?.length]);

  useEffect(() => {
    const currentWeekKey = getWeekStartKey();
    const grouped = groupMessagesByWeek(messages);
    const summaryWeeks = new Set(stageSummaries.map((entry) => entry.date));
    const archiveCandidates = Object.keys(grouped)
      .filter((weekKey) => weekKey < currentWeekKey && grouped[weekKey]?.length > 0 && !summaryWeeks.has(weekKey))
      .sort();

    if (archiveCandidates.length === 0 || archivingDateKey) return;

    const weekKey = archiveCandidates[0];
    const weekMessages = grouped[weekKey];
    const weekLabel = getWeekLabel(weekKey);

    const archiveWeek = async () => {
      setArchivingDateKey(weekKey);
      const transcript = weekMessages
        .map((msg: any) => `${msg.role === "forge" ? "Forge" : profile.name}: ${msg.text}`)
        .join("\n");

      const prompt = `Summarize this Foundry coaching conversation for ${profile.name} for the week of ${weekLabel}.\n\nReturn valid JSON with exactly these keys:\n"title": a concise week headline under 80 characters (include the week range)\n"summary": a detailed markdown summary with these sections: Key Decisions, Main Insights, Risks or Blockers, Recommended Next Moves.\n\nConversation:\n${transcript}`;

      try {
        const raw = await callForgeAPI(
          [{ role: "user", content: prompt }],
          "You write clean business conversation summaries. Return only valid JSON."
        );
        const parsed = parseDailySummaryResponse(raw, weekKey);
        const saved = await saveConversationSummary(
          userId,
          activeStage,
          weekKey,
          parsed.title,
          parsed.summary,
          weekMessages.length
        );

        if (!saved) return;

        setSummariesByStage((prev) => ({
          ...prev,
          [activeStage]: [saved, ...(prev[activeStage] || [])].sort((a, b) => b.date.localeCompare(a.date)),
        }));
        onUpdateMessages(activeStage, messages.filter((msg: any) => getWeekStartKey(msg.createdAt) === currentWeekKey));
      } catch (error) {
        console.error("weekly summary archive error:", error);
      } finally {
        setArchivingDateKey(null);
      }
    };

    archiveWeek();
  }, [activeStage, messages, stageSummaries, archivingDateKey, userId]);

  const send = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || loading) return;
    onMeaningfulActivity?.();

    const text = input.trim();
    const currentFiles = [...attachedFiles];
    setInput("");
    setAttachedFiles([]);

    // Build display text (shown in chat and saved to DB)
    const attachmentLabel = currentFiles.length > 0
      ? `[Attached: ${currentFiles.map(f => f.name).join(", ")}]`
      : "";
    const displayText = [attachmentLabel, text].filter(Boolean).join("\n");

    const timestamp = new Date().toISOString();
    const userMsg = { role: "user", text: displayText, id: `user-${Date.now()}`, createdAt: timestamp };
    const forgeMsg = { role: "forge", text: "", id: `forge-${Date.now()}`, createdAt: new Date().toISOString() };
    const current = messagesByStage[activeStage] || [];

    onUpdateMessages(activeStage, [...current, userMsg]);
    setLoading(true);

    await new Promise((r) => setTimeout(r, 300));
    onUpdateMessages(activeStage, [...current, userMsg, forgeMsg]);

    try {
      const allMsgs = [...current, userMsg];
      // Historical messages use plain text; last user message uses rich content if files attached
      const apiMsgs = [
        ...allMsgs.slice(0, -1).map((m) => ({
          role: m.role === "forge" ? "assistant" : "user",
          content: m.text,
        })),
        {
          role: "user" as const,
          content: buildMessageContent(text, currentFiles),
        },
      ];

      const ctx = appendMarketContext(await buildRichContext(
        profile,
        activeStage,
        completedByStage,
        messagesByStage,
        cofoundersContext
      ), marketReport);

      const raw = await streamForgeAPI(
        apiMsgs,
        FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", ctx),
        (chunk) => {
          const { cleanText: cleanChunk } = parseForgeResponse(chunk);
          onUpdateMessages(activeStage, (msgs) =>
            msgs.map((m) => (m.id === forgeMsg.id ? { ...m, text: cleanChunk } : m))
          );
        }
      );

      const { cleanText, completedIds, advanceReady: ar } = parseForgeResponse(raw);

      onUpdateMessages(activeStage, (msgs) =>
        msgs.map((m) => (m.id === forgeMsg.id ? { ...m, text: cleanText } : m))
      );

      completedIds.forEach((id) => onMilestoneComplete(id));

      if (ar) setAdvanceReady(true);
    } catch (err) {
      console.error("Forge error:", err);
      onUpdateMessages(activeStage, (msgs) =>
        msgs.map((m) =>
          m.id === forgeMsg.id ? { ...m, text: "Something went wrong. Try again." } : m
        )
      );
    }

    setLoading(false);
  };

  const handleAdvance = async (newStage) => {
    const allowed = await onAdvance(newStage);
    if (allowed === false) return;
    setActiveStage(newStage);
    setAdvanceReady(false);
  };

  const showBriefing = !pendingUpgradeStage && messages.length === 0 && stageSummaries.length === 0 && !loading && !briefingDismissed;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#080809",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', sans-serif",
        color: "#F0EDE8",
        zIndex: 20,
      }}
    >
      <HubPanel
        profile={profile}
        currentStage={profile.currentStage}
        completedByStage={completedByStage}
        open={hubOpen}
        onClose={() => setHubOpen(false)}
      />

      <div
        style={{
          padding: "max(11px, calc(6px + env(safe-area-inset-top))) 12px 11px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(8,8,9,0.95)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            onClick={onBack}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "5px 12px",
              color: "#F0EDE8",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Icons.forge.chat size={14} /> Hub
          </button>

          <button
            onClick={() => setHubOpen(true)}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding: "5px 8px",
              color: "#666",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            <Icons.sidebar.menu size={14} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            minWidth: 0,
          }}
        >
          <button
            onClick={() => setShowStageSelector((s) => !s)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "4px 10px",
              borderRadius: 8,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <StageIcon size={15} color={stage.color} />
            <div style={{ textAlign: "left" }}>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: "'Lora', Georgia, serif",
                  fontWeight: 600,
                  color: "#F0EDE8",
                  lineHeight: 1.2,
                }}
              >
                Stage {activeStage} — {stage.label}
              </div>
              <div style={{ fontSize: 10, color: "#4CAF8A" }}>
                ● Active · {completionPct}% complete
              </div>
            </div>
            <span style={{ fontSize: 10, color: "#555", marginLeft: 2 }}><Icons.forge.chat size={16} /></span>
          </button>

          {showStageSelector && (
            <>
              <div
                onClick={() => setShowStageSelector(false)}
                style={{ position: "fixed", inset: 0, zIndex: 10 }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 20,
                  background: "#0E0E10",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: 6,
                  minWidth: 220,
                  boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
                  animation: "fadeSlideUp 0.2s ease",
                }}
              >
                {STAGES_DATA.map((s) => {
                  const locked = s.id > profile.currentStage;
                  const pct = Math.round(
                    ((completedByStage[s.id] || []).length / s.milestones.length) * 100
                  );
                  const DropdownStageIcon = s.icon;

                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        if (!locked) {
                          setActiveStage(s.id);
                          setShowStageSelector(false);
                        }
                      }}
                      disabled={locked}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 12px",
                        borderRadius: 8,
                        border: "none",
                        background:
                          s.id === activeStage
                            ? "rgba(232,98,42,0.12)"
                            : "transparent",
                        cursor: locked ? "default" : "pointer",
                        opacity: locked ? 0.35 : 1,
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!locked) {
                          e.currentTarget.style.background =
                            s.id === activeStage
                              ? "rgba(232,98,42,0.15)"
                              : "rgba(255,255,255,0.05)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          s.id === activeStage
                            ? "rgba(232,98,42,0.12)"
                            : "transparent";
                      }}
                    >
                      <DropdownStageIcon size={16} color={s.color} />

                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontFamily: "'Lora', Georgia, serif",
                            color: s.id === activeStage ? "#E8622A" : "#C8C4BE",
                            fontWeight: s.id === activeStage ? 600 : 400,
                          }}
                        >
                          Stage {s.id} — {s.label}
                        </div>
                        {!locked && (
                          <div style={{ fontSize: 10, color: "#555", marginTop: 1 }}>
                            {pct}% complete
                          </div>
                        )}
                        {locked && (
                          <div style={{ fontSize: 10, color: "#444", marginTop: 1 }}>
                            Locked
                          </div>
                        )}
                      </div>

                      {s.id === activeStage && (
                        <span style={{ fontSize: 10, color: "#E8622A" }}><Icons.forge.chat size={16} /></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 2,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: 3,
            flexShrink: 0,
            marginLeft: "auto",
            maxWidth: "40vw",
            overflowX: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {[
            { id: "chat", label: "Chat" },
            { id: "summaries", label: "Archive" },
            { id: "milestones", label: "Goals" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "none",
                background:
                  activeTab === tab.id
                    ? "linear-gradient(135deg, #E8622A, #c9521e)"
                    : "transparent",
                color: activeTab === tab.id ? "#fff" : "#A8A4A0",
                fontSize: 10,
                cursor: "pointer",
                fontWeight: activeTab === tab.id ? 600 : 400,
                transition: "all 0.15s",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          height: 3,
          background: "rgba(255,255,255,0.06)",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${completionPct}%`,
            background: "linear-gradient(90deg, #E8622A, #F5A843)",
            transition: "width 0.6s ease",
            boxShadow:
              completionPct > 0 ? "0 0 8px rgba(232,98,42,0.4)" : "none",
          }}
        />
        {stage.milestones.map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${((i + 1) / stage.milestones.length) * 100}%`,
              width: 1,
              background: "rgba(0,0,0,0.5)",
            }}
          />
        ))}
      </div>

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {showBriefing && activeTab === "chat" && (
          <StageBriefing
            stage={stage}
            stageId={activeStage}
            onStart={() => {
              setBriefingDismissed(true);
            }}
          />
        )}

        {activeTab === "chat" && !showBriefing && (
          <div
            ref={scrollRef}
            style={{
              position: "absolute",
              inset: 0,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              maxWidth: 720,
              width: "100%",
              margin: "0 auto",
            }}
          >
            {stageRefModal !== null && (
              <StageRefModal
                stageId={stageRefModal}
                messages={messagesByStage[stageRefModal] || []}
                profile={profile}
                onClose={() => setStageRefModal(null)}
              />
            )}

            {glossaryModal && (
              <GlossaryModal
                term={glossaryModal.term}
                entry={glossaryModal.entry}
                profile={profile}
                activeStage={activeStage}
                onClose={() => setGlossaryModal(null)}
                onMarkLearned={(term, stageNum) => {
                  const learned = profile.glossaryLearned || [];
                  if (!learned.find((l) => l.term === term)) {
                    onUpdateProfile({
                      glossaryLearned: [
                        ...learned,
                        {
                          term,
                          stage: stageNum,
                          date: new Date().toLocaleDateString(),
                        },
                      ],
                    });
                  }
                }}
                alreadyLearned={(profile.glossaryLearned || []).some(
                  (l) => l.term === glossaryModal.term
                )}
                callForgeAPI={callForgeAPI}
              />
            )}

            {combinedMessages.map((item, i) => {
              if (item._stageMarker) {
                const ms = STAGES_DATA[item.stageId - 1];
                const MarkerIcon = ms.icon;
                return (
                  <div
                    key={item.id}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", margin: "6px 0" }}
                  >
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "4px 12px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 20,
                      fontSize: 10, color: "#555",
                      letterSpacing: "0.08em", textTransform: "uppercase" as const,
                      whiteSpace: "nowrap" as const,
                    }}>
                      <MarkerIcon size={10} color={ms.color} />
                      Stage {item.stageId} — {ms.label}
                    </div>
                    <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
                  </div>
                );
              }
              return (
                <MessageBubble
                  key={item.id || i}
                  msg={item}
                  onStageRef={(id: number) => setStageRefModal(id)}
                  onGlossaryTap={(term: string, entry: any) => setGlossaryModal({ term, entry })}
                  renderWithBold={renderWithBold}
                  userName={profile?.name || "You"}
                  onAction={(action: any) => {
                    if (action.type === "upgrade") {
                      onRequestUpgrade && onRequestUpgrade(action.stage || activeStage);
                      return;
                    }

                    if (action.type === "downgrade_to_stage_1") {
                      setActiveStage(1);
                      onDowngradeToFree && onDowngradeToFree();
                    }
                  }}
                />
              );
            })}

            {loading && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <ForgeAvatar size={30} />
                <div
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "4px 16px 16px 16px",
                    padding: "4px 12px",
                  }}
                >
                  <TypingDots />
                </div>
              </div>
            )}

            {advanceReady && (
              <div
                style={{
                  background:
                    "linear-gradient(135deg, rgba(76,175,138,0.15), rgba(72,187,120,0.06))",
                  border: "1px solid rgba(76,175,138,0.35)",
                  borderRadius: 14,
                  padding: "14px 16px",
                  animation: "fadeSlideUp 0.4s ease",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontFamily: "'Lora', Georgia, serif",
                    color: "#4CAF8A",
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  ✓ Forge says you're ready to advance
                </div>

                <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>
                  Stage {activeStage} work is done.
                  {STAGES_DATA[activeStage]
                    ? ` Stage ${activeStage + 1} — ${STAGES_DATA[activeStage].label} — is next.`
                    : " You've completed all stages."}
                </div>

                {STAGES_DATA[activeStage] && (
                  <button
                    onClick={() => handleAdvance(activeStage + 1)}
                    style={{
                      width: "100%",
                      background: "linear-gradient(135deg, #4CAF8A, #48BB78)",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px",
                      color: "#fff",
                      fontSize: 13,
                      fontFamily: "'Lora', Georgia, serif",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Advance to Stage {activeStage + 1} — {STAGES_DATA[activeStage].label} →
                  </button>
                )}
              </div>
            )}

            <div ref={bottomAnchorRef} style={{ height: 80 }} />
          </div>
        )}

        {activeTab === "milestones" && (
          <MilestonesPanel
            stage={stage}
            stageId={activeStage}
            completedMilestones={completedMilestones}
            advanceReady={advanceReady || allMilestonesComplete}
            furthestStageReached={furthestStageReached}
            onAdvance={handleAdvance}
            onSwitchToChat={() => setActiveTab("chat")}
            onClose={() => setActiveTab("chat")}
          />
        )}

        {activeTab === "summaries" && (
          <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "16px", maxWidth: 720, width: "100%", margin: "0 auto" }}>
            <div style={{ fontSize: 18, fontFamily: "’Cormorant Garamond’, Georgia, serif", fontWeight: 700, marginBottom: 4 }}>
              Full Archive
            </div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 18, lineHeight: 1.6 }}>
              Every week’s Forge conversation across all stages, archived here. Forge carries this history with you no matter which stage you’re in.
            </div>

            {STAGES_DATA.map((s) => {
              const entries = summariesByStage[s.id] || [];
              if (entries.length === 0) return null;
              const SIcon = s.icon;
              return (
                <div key={s.id} style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <SIcon size={12} color={s.color} />
                    <div style={{ fontSize: 10, color: s.color, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
                      Stage {s.id} — {s.label}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {entries.map((entry) => (
                      <button
                        key={entry.id || `${entry.stageId}-${entry.date}`}
                        onClick={() => setSummaryModal(entry)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 14,
                          padding: "14px 16px",
                          color: "#F0EDE8",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 10, color: "#E8622A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
                          {getWeekLabel(entry.date)}
                        </div>
                        <div style={{ fontSize: 15, fontFamily: "’Cormorant Garamond’, Georgia, serif", fontWeight: 700, marginBottom: 4 }}>
                          {entry.title}
                        </div>
                        <div style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}>
                          {getSummaryPreview(entry.summary)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            {Object.values(summariesByStage).every((arr) => arr.length === 0) && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 16px", color: "#888", fontSize: 13, lineHeight: 1.7 }}>
                No archived summaries yet. At the end of each week, Foundry will summarize your conversations and store them here.
              </div>
            )}

            {bubbleSummaries.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, color: "#4CAF8A", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>
                  Quick Chats with Forge
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {bubbleSummaries.map((entry) => (
                    <button
                      key={entry.id || entry.date}
                      onClick={() => setSummaryModal(entry)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        background: "rgba(76,175,138,0.05)",
                        border: "1px solid rgba(76,175,138,0.15)",
                        borderRadius: 14,
                        padding: "14px 16px",
                        color: "#F0EDE8",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 10, color: "#4CAF8A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
                        Quick Chat · {new Date(`${entry.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      <div style={{ fontSize: 15, fontFamily: "’Cormorant Garamond’, Georgia, serif", fontWeight: 700, marginBottom: 5 }}>
                        {entry.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}>
                        {getSummaryPreview(entry.summary)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {summaryModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(4,4,5,0.84)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div style={{ width: "min(720px, 100%)", maxHeight: "85vh", overflowY: "auto", background: "#0E0E10", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "20px 18px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: "#E8622A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                  {new Date(`${summaryModal.date}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
                <div style={{ fontSize: 24, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700 }}>
                  {summaryModal.title}
                </div>
              </div>
              <button
                onClick={() => setSummaryModal(null)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#999", padding: "8px 12px", cursor: "pointer", height: "fit-content" }}
              >
                Close
              </button>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 16px", fontSize: 14, color: "#C8C4BE", lineHeight: 1.8, fontFamily: "'Lora', Georgia, serif" }}>
              {renderWithBold(summaryModal.summary, () => { }, () => { })}
            </div>
          </div>
        </div>
      )}

      {
        activeTab === "chat" && !showBriefing && !pendingUpgradeStage && (
          <div
            style={{
              padding: "12px 16px",
              paddingBottom: "max(20px, calc(12px + env(safe-area-inset-bottom)))",
              flexShrink: 0,
              borderTop: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(8,8,9,0.95)",
              maxWidth: 720,
              width: "100%",
              alignSelf: "center",
            }}
          >
            <ChatInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onSend={send}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              loading={loading}
              placeholder={`Talk to Forge about Stage ${activeStage}...`}
              attachedFiles={attachedFiles}
              onFilesChange={setAttachedFiles}
            />
          </div>
        )
      }
    </div >
  );
}

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* Storage full — fail silently */ }
}

function usePersistedState(key, fallback) {
  const [value, setValue] = useState(() => loadFromStorage(key, fallback));
  const setPersisted = (updater) => {
    setValue(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveToStorage(key, next);
      return next;
    });
  };
  return [value, setPersisted];
}

// ─────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────
export default function FoundryApp() {
  const [profile, setProfile] = useState(null);
  const [completedByStage, setCompletedByStage] = useState(createEmptyStageProgress());
  const [messagesByStage, setMessagesByStage] = useState(createEmptyMessagesByStage());

  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const [screen, setScreen] = useState("loading");
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [initialStage, setInitialStage] = useState(null);
  const [pendingUpgradeStage, setPendingUpgradeStage] = useState<number | null>(null);
  const [journalEntries, setJournalEntries] = useState([]);
  const [showJournal, setShowJournal] = useState(false);
  const [briefings, setBriefings] = useState([]);
  const [showBriefings, setShowBriefings] = useState(false);
  const [showPitchPractice, setShowPitchPractice] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [showMarketIntel, setShowMarketIntel] = useState(false);
  const [showCofounder, setShowCofounder] = useState(false);
  const [showChatRoom, setShowChatRoom] = useState(false);
  const [settingsView, setSettingsView] = useState<null | "settings" | "privacy" | "eula" | "termsAndConditions" | "acceptableUse" | "disclaimer">(null);
  const [showAdminHub, setShowAdminHub] = useState(false);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [accountAccess, setAccountAccess] = useState<AccountAccess | null>(null);
  const [billingSubscription, setBillingSubscription] = useState<BillingSubscription | null>(null);
  const [billingRoute, setBillingRoute] = useState(() => getBillingRouteState());
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [billingPortalLoading, setBillingPortalLoading] = useState(false);
  const [billingSyncing, setBillingSyncing] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<UserNotificationPreferences>(DEFAULT_USER_NOTIFICATION_PREFERENCES);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [adminNotificationSettings, setAdminNotificationSettings] = useState<AdminNotificationSettings>(DEFAULT_ADMIN_NOTIFICATION_SETTINGS);
  const [marketReport, setMarketReport] = useState<any>(null);
  const [paywallStage, setPaywallStage] = useState<number | null>(null);
  const [bubbleSummaries, setBubbleSummaries] = useState<any[]>([]);

  const getPersistedPostAuthScreen = (setupCompleted: boolean) => {
    const fallback = setupCompleted ? "hub" : "intro";
    const persistedScreen = loadFromStorage(STORAGE_KEYS.screen, fallback);

    if (setupCompleted) {
      return persistedScreen === "forge" || persistedScreen === "hub" ? persistedScreen : "hub";
    }

    return persistedScreen === "onboarding" ? "onboarding" : "intro";
  };

  const resetClientSessionState = () => {
    setProfile(null);
    setCompletedByStage(createEmptyStageProgress());
    setMessagesByStage(createEmptyMessagesByStage());
    setScreen("loading");
    setIsFirstVisit(false);
    setInitialStage(null);
    setJournalEntries([]);
    setShowJournal(false);
    setBriefings([]);
    setShowBriefings(false);
    setShowPitchPractice(false);
    setShowDocuments(false);
    setShowMarketIntel(false);
    setShowCofounder(false);
    setSettingsView(null);
    setShowAdminHub(false);
    setUserTeamId(null);
    setAccountAccess(null);
    setBillingSubscription(null);
    setBillingRoute(getBillingRouteState());
    setBillingMessage(null);
    setBillingPortalLoading(false);
    setBillingSyncing(false);
    setNotificationPreferences(DEFAULT_USER_NOTIFICATION_PREFERENCES);
    setNotifications([]);
    setAdminNotificationSettings(DEFAULT_ADMIN_NOTIFICATION_SETTINGS);
    setMarketReport(null);
    setPaywallStage(null);
    setBubbleSummaries([]);
    setDataLoaded(false);
    clearFoundryClientStorage();
  };

  // ── Auth listener ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
        return;
      }
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setIsPasswordRecovery(false);
        resetClientSessionState();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Load all data from Supabase when user logs in ──
  useEffect(() => {
    if (!user) { setDataLoaded(false); return; }

    let cancelled = false;

    const loadData = async () => {
      const uid = (user as any).id as string;
      const authEmail = ((user as any).email ?? null) as string | null;
      await ensureUserProfile(uid, user as any);
      await ensureOwnerProfileRole(uid, authEmail);
      const [dbProfile, dbProgress, dbMessages, dbJournal, dbBriefings, dbMarket, dbNotificationPreferences, dbNotifications, dbBillingSubscription] = await Promise.all([
        loadProfile(uid),
        loadAllStageProgress(uid),
        loadAllMessages(uid),
        loadJournalEntries(uid),
        loadBriefings(uid),
        loadLatestMarketReport(uid),
        loadNotificationPreferences(uid),
        loadNotifications(uid),
        loadBillingSubscription(uid),
      ]);

      if (cancelled) return;

      if (dbProfile?.setupCompleted) {
        const ownerFallback = isOwnerEmail(authEmail);
        const resolvedProfile = {
          ...dbProfile,
          email: dbProfile.email ?? authEmail,
          role: ownerFallback ? "owner" : dbProfile.role,
          isAdmin: ownerFallback ? true : dbProfile.isAdmin,
          isOwner: ownerFallback ? true : dbProfile.isOwner,
        };

        console.debug("[AdminHub] loadData resolved profile", {
          authUserEmail: authEmail,
          profileEmail: resolvedProfile.email ?? null,
          profileRole: resolvedProfile.role ?? null,
          ownerFallback,
        });

        setProfile(resolvedProfile);
        setCompletedByStage(dbProgress);
        setMessagesByStage(dbMessages);
        setJournalEntries(dbJournal);
        setBriefings(dbBriefings);
        setNotificationPreferences(dbNotificationPreferences);
        setNotifications(dbNotifications);
        setMarketReport(dbMarket ?? null);
        // Load and ensure account access record
        const access = await ensureAccountAccess(uid);
        setAccountAccess(access);
        setBillingSubscription(dbBillingSubscription);
        // Update activity + sync email for admin dashboard
        updateUserActivity(uid, authEmail ?? undefined);
        setScreen(getPersistedPostAuthScreen(true));
      } else {
        if (dbProfile) {
          const ownerFallback = isOwnerEmail(authEmail);
          const resolvedProfile = {
            ...dbProfile,
            email: dbProfile.email ?? authEmail,
            role: ownerFallback ? "owner" : dbProfile.role,
            isAdmin: ownerFallback ? true : dbProfile.isAdmin,
            isOwner: ownerFallback ? true : dbProfile.isOwner,
          };
          console.debug("[AdminHub] loadData unresolved setup profile", {
            authUserEmail: authEmail,
            profileEmail: resolvedProfile.email ?? null,
            profileRole: resolvedProfile.role ?? null,
            ownerFallback,
          });
          setProfile(resolvedProfile);
        }
        setNotificationPreferences(dbNotificationPreferences);
        setNotifications(dbNotifications);
        setBillingSubscription(dbBillingSubscription);
        setScreen(getPersistedPostAuthScreen(false));
        setIsFirstVisit(true);
      }
      setDataLoaded(true);
    };

    loadData();

    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Save profile to Supabase whenever it changes ──
  useEffect(() => {
    if (!user || !profile || !dataLoaded) return;
    saveProfile(user.id, profile);
  }, [profile]);

  useEffect(() => {
    if (!user || !profile || accountAccess) return;
    ensureAccountAccess(user.id).then((access) => {
      if (access) setAccountAccess(access);
    });
  }, [user?.id, !!profile, accountAccess?.id]);

  const refreshBillingState = async () => {
    if (!user?.id) return;
    setBillingSyncing(true);
    const [access, subscription] = await Promise.all([
      ensureAccountAccess(user.id),
      loadBillingSubscription(user.id),
    ]);
    setAccountAccess(access);
    setBillingSubscription(subscription);
    setBillingSyncing(false);
  };

  const furthestStageReached = getFurthestStageReached(profile, completedByStage, messagesByStage);

  // ── Clear pendingUpgradeStage once the user gains access (after paying) ──
  useEffect(() => {
    if (pendingUpgradeStage && canAccessStage(pendingUpgradeStage, accountAccess)) {
      setPendingUpgradeStage(null);
    }
  }, [accountAccess, pendingUpgradeStage]);

  // ── Save stage progress to Supabase whenever it changes ──
  useEffect(() => {
    if (!user || !dataLoaded) return;
    Object.entries(completedByStage).forEach(([stageId, milestones]) => {
      saveStageProgress(user.id, parseInt(stageId), milestones as string[]);
    });
  }, [completedByStage]);

  // ── Save messages to Supabase whenever they change ──
  useEffect(() => {
    if (!user || !dataLoaded) return;
    Object.entries(messagesByStage).forEach(([stageId, messages]) => {
      saveMessages(user.id, parseInt(stageId), messages as any[]);
    });
  }, [messagesByStage]);

  const setScreenPersisted = (s) => {
    setScreen(s);
    saveToStorage(STORAGE_KEYS.screen, s);
  };

  const updateProfile = (updates) => setProfile(p => ({ ...p, ...updates }));

  const handleMilestoneComplete = (milestoneId) => {
    markMeaningfulActivity(true);
    const stageNum =
      milestoneId.startsWith("idea") ? 1
        : milestoneId.startsWith("plan") ? 2
          : milestoneId.startsWith("legal") ? 3
            : milestoneId.startsWith("finance") ? 4
              : milestoneId.startsWith("launch") ? 5
                : 6;
    setCompletedByStage(prev => ({
      ...prev,
      [stageNum]: [...new Set([...prev[stageNum], milestoneId])]
    }));
  };

  const handleUpdateMessages = (stageId, updater) => {
    setMessagesByStage(prev => ({
      ...prev,
      [stageId]: typeof updater === "function" ? updater(prev[stageId] || []) : updater,
    }));
  };

  const markMeaningfulActivity = (force = false) => {
    if (!user?.id) return;
    const nowIso = new Date().toISOString();
    setProfile((prev) => prev ? { ...prev, lastActiveAt: nowIso } : prev);
    recordMeaningfulActivity(user.id, authUserEmail ?? undefined, { force });
  };

  const handleAdvance = (newStage) => {
    markMeaningfulActivity(true);
    updateProfile({ currentStage: newStage });
    setInitialStage(newStage);
    return true;
  };

  const revertToStage = (targetStage) => {
    const nextStage = Math.max(1, Math.min(targetStage, furthestStageReached));
    markMeaningfulActivity(true);
    setPendingUpgradeStage(null);
    setPaywallStage(null);
    updateProfile({ currentStage: nextStage });
    setInitialStage(nextStage);
    setIsFirstVisit(false);
    setScreenPersisted("hub");
    return true;
  };

  const requestUpgrade = (targetStage = 2) => {
    setPendingUpgradeStage(targetStage);
    setPaywallStage(targetStage);
    return false;
  };

  const attemptStageAccess = (targetStage) => {
    if (canAccessStage(targetStage, accountAccess)) return true;
    return requestUpgrade(targetStage);
  };

  const attemptAdvance = async (newStage) => {
    if (!attemptStageAccess(newStage)) return false;
    return handleAdvance(newStage);
  };

  const openForge = (stageId = null) => {
    const targetStage = stageId || profile?.currentStage || 1;
    if (!attemptStageAccess(targetStage)) return false;
    if (canAccessStage(targetStage, accountAccess)) {
      setPendingUpgradeStage(null);
    }
    setInitialStage(stageId ?? targetStage);
    setIsFirstVisit(false);
    setScreenPersisted("forge");
    return true;
  };

  const handleReset = async () => {
    // Clear Supabase data for this user
    if (user) {
      await Promise.all([
        supabase.from("profiles").delete().eq("id", user.id),
        supabase.from("stage_progress").delete().eq("user_id", user.id),
        supabase.from("messages").delete().eq("user_id", user.id),
      ]);
    }
    // Clear localStorage
    clearFoundryClientStorage();
    window.location.reload();
  };

  const handleLogout = async () => {
    resetClientSessionState();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("logout error:", error.message);
    }
  };

  const accessSummary = getAccessSummary(accountAccess);
  const lockedSelectedStage = profile
    ? (() => {
      const targetStage = initialStage ?? profile.currentStage ?? 1;
      if (targetStage <= 1) return null;
      return canAccessStage(targetStage, accountAccess) ? null : targetStage;
    })()
    : null;
  const effectivePendingUpgradeStage = pendingUpgradeStage ?? lockedSelectedStage;
  const authUserEmail = ((user as any)?.email ?? null) as string | null;
  const canOpenAdminHub = hasAdminHubAccess({
    role: profile?.role,
    profileEmail: profile?.email,
    authEmail: authUserEmail,
  });

  useEffect(() => {
    console.debug("[AdminHub] visibility check", {
      authUserEmail,
      profileEmail: profile?.email ?? null,
      profileRole: profile?.role ?? null,
      hasAdminHubAccess: canOpenAdminHub,
      hubScreenIsAdminProp: canOpenAdminHub,
      showAdminHub,
      canOpenAdminScreen: canOpenAdminHub,
    });
  }, [authUserEmail, profile?.email, profile?.role, canOpenAdminHub, showAdminHub]);

  const handleNotificationPreferencesChange = async (next: UserNotificationPreferences) => {
    if (!user?.id) return;
    setNotificationPreferences(next);
    await saveNotificationPreferences(user.id, next);
    markMeaningfulActivity(true);
  };

  const handleProfileSave = async (updates: { displayName: string; businessName: string }) => {
    if (!user?.id) return;
    const next = { ...profile, name: updates.displayName, businessName: updates.businessName };
    setProfile(next);
    await saveProfile(user.id, next);
    markMeaningfulActivity(true);
  };

  useEffect(() => {
    if (!canOpenAdminHub) return;
    loadAdminNotificationSettings().then((settings) => {
      setAdminNotificationSettings(settings);
    });
  }, [canOpenAdminHub]);

  const handleAdminNotificationSettingsChange = async (next: AdminNotificationSettings) => {
    setAdminNotificationSettings(next);
    await saveAdminNotificationSettings(next);
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    const updated = await markNotificationRead(notificationId);
    if (!updated) return;
    setNotifications((prev) => prev.map((notification) => (
      notification.id === notificationId
        ? { ...notification, readAt: notification.readAt ?? new Date().toISOString() }
        : notification
    )));
  };

  const openJournal = () => {
    markMeaningfulActivity();
    setShowJournal(true);
  };

  const openBriefings = () => {
    markMeaningfulActivity();
    setShowBriefings(true);
  };

  const openPitchPractice = () => {
    markMeaningfulActivity();
    setShowPitchPractice(true);
  };

  const openDocuments = () => {
    markMeaningfulActivity();
    setShowDocuments(true);
  };

  const openMarketIntel = () => {
    markMeaningfulActivity();
    setShowMarketIntel(true);
  };

  const openChatRoom = () => {
    markMeaningfulActivity();
    setShowChatRoom(true);
  };

  const openCofounder = () => {
    markMeaningfulActivity();
    setShowCofounder(true);
  };

  useEffect(() => {
    const uid = (user as any)?.id;
    if (!uid) {
      setUserTeamId(null);
      return;
    }

    if (screen !== "forge" && !showCofounder) return;

    let cancelled = false;
    getTeamForUser(uid)
      .then((team) => {
        if (!cancelled) setUserTeamId(team?.id ?? null);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("team lookup error:", error);
          setUserTeamId(null);
        }
      });

    return () => { cancelled = true; };
  }, [screen, showCofounder, user]);

  const openSettings = () => {
    markMeaningfulActivity();
    setSettingsView("settings");
  };

  const handleOpenManageSubscription = async () => {
    setBillingMessage(null);
    setBillingPortalLoading(true);
    const result = await openCustomerPortal();
    setBillingPortalLoading(false);
    if (!result.ok) {
      setBillingMessage(result.message);
      setSettingsView("settings");
    }
  };

  useEffect(() => {
    if (!user?.id || !dataLoaded) return;
    if (!billingRoute) return;

    if (billingRoute.type === "cancelled") {
      setBillingMessage("Checkout was canceled. No billing changes were made.");
      setPaywallStage(Math.max(2, profile?.currentStage || 2));
      setSettingsView(null);
      return;
    }

    if (billingRoute.type === "success") {
      let attempts = 0;
      const interval = window.setInterval(async () => {
        attempts += 1;
        await refreshBillingState();
        if (attempts >= 8) {
          window.clearInterval(interval);
        }
      }, 2500);

      refreshBillingState();
      return () => window.clearInterval(interval);
    }
  }, [billingRoute?.type, user?.id, dataLoaded]);

  useEffect(() => {
    if (!user?.id || !dataLoaded || billingRoute) return;

    const path = window.location.pathname.replace(/\/+$/, "") || "/";

    if (path === "/settings") {
      refreshBillingState();
      setSettingsView("settings");
      clearBillingRoute("/");
      return;
    }

    if (path === "/pricing") {
      setPaywallStage(Math.max(2, profile?.currentStage || 2));
      clearBillingRoute("/");
    }
  }, [user?.id, dataLoaded, billingRoute?.type, profile?.currentStage]);

  const handleBillingReturnContinue = () => {
    if (billingRoute?.type === "cancelled") {
      clearBillingRoute("/");
      setBillingRoute(null);
      setPaywallStage(Math.max(2, profile?.currentStage || 2));
      return;
    }

    clearBillingRoute("/");
    setBillingRoute(null);
    setPaywallStage(null);
    setSettingsView("settings");
  };

  // ── Auth not yet checked ──
  if (!authChecked) {
    return (
      <>
        <style>{GLOBAL_STYLES}</style>
        <div style={{ background: "#080809", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <Logo variant="flame" style={{ width: 52, height: 52, objectFit: "contain", opacity: 0.88 }} />
          <LoadingForgeAnimation size={62} />
        </div>
      </>
    );
  }

  // ── Password recovery (user clicked reset link in email) ──
  if (isPasswordRecovery) {
    return (
      <>
        <style>{GLOBAL_STYLES}</style>
        <AuthScreen
          onAuth={() => { }}
          initialMode="reset"
          onPasswordReset={() => setIsPasswordRecovery(false)}
        />
      </>
    );
  }

  // ── Not logged in ──
  if (!user) {
    return (
      <>
        <style>{GLOBAL_STYLES}</style>
        <AuthScreen onAuth={() => { }} />
      </>
    );
  }

  // ── Logged in but data still loading ──
  if (!dataLoaded) {
    return (
      <>
        <style>{GLOBAL_STYLES}</style>
        <div style={{ background: "#080809", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Logo variant="flame" style={{ width: 56, height: 56, objectFit: "contain", opacity: 0.9 }} />
          <LoadingForgeAnimation size={68} />
          <div style={{ fontSize: 12, color: "#5B5650", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em" }}>Loading your workspace...</div>
        </div>
      </>
    );
  }

  // ── Access gate — suspended or revoked accounts ──
  if (dataLoaded && accountAccess && !canAccessApp(accountAccess)) {
    return (
      <>
        <style>{GLOBAL_STYLES}</style>
        <div style={{
          background: "#080809", minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 20, padding: 32,
          fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8", textAlign: "center",
        }}>
          <Logo variant="flame" style={{ width: 36, height: 36, objectFit: "contain", opacity: 0.4 }} />
          <div style={{ fontSize: 18, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>
            Access Restricted
          </div>
          <div style={{ fontSize: 13, color: "#666", maxWidth: 380, lineHeight: 1.7, fontStyle: "italic" }}>
            {getAccessBlockReason(accountAccess)}
          </div>
          <button
            onClick={handleLogout}
            style={{
              marginTop: 8, padding: "10px 24px", background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
              color: "#555", fontSize: 12, cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      </>
    );
  }

  // ── Logged in and data ready ──
  if (billingRoute) {
    const paidReady = accessSummary.canAccessPaidStages;

    return (
      <>
        <style>{GLOBAL_STYLES}</style>
        <BillingReturnScreen
          mode={billingRoute.type}
          isProvisioning={billingSyncing}
          accessReady={paidReady}
          message={billingMessage}
          onContinue={handleBillingReturnContinue}
          onRefresh={refreshBillingState}
        />
      </>
    );
  }

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ background: "#080809", minHeight: "100vh", minHeight: "-webkit-fill-available" }}>
        {screen === "intro" && <CinematicIntro onComplete={() => setScreenPersisted("onboarding")} />}
        {screen === "onboarding" && (
          <OnboardingScreen
            onComplete={(p: any) => {
              setProfile({ ...p, setupCompleted: true });
              setIsFirstVisit(true);
              setInitialStage((p.detectedStage || 1) as any);
              setScreenPersisted("forge");
              if ((p.detectedStage || 1) > 1) {
                setPendingUpgradeStage(p.detectedStage);
              }
            }}
            callForgeAPI={callForgeAPI}
            renderWithBold={renderWithBold}
          />
        )}
        {screen === "hub" && profile && (
          <HubScreen
            profile={profile}
            onUpdateProfile={updateProfile}
            onEnterStage={id => openForge(id)}
            onOpenForge={() => openForge(null)}
            onRevertToStage={(stageId: number) => revertToStage(stageId)}
            onLogout={handleLogout}
            completedByStage={completedByStage}
            furthestStageReached={furthestStageReached}
            onReset={handleReset}
            onOpenJournal={openJournal}
            onOpenBriefings={openBriefings}
            onOpenPitchPractice={openPitchPractice}
            onOpenDocuments={openDocuments}
            onOpenMarketIntel={openMarketIntel}
            onOpenCofounder={openCofounder}
            onOpenChatRoom={openChatRoom}
            onOpenSettings={openSettings}
            onOpenAdminHub={() => setShowAdminHub(true)}
            isAdmin={canOpenAdminHub}
            accessSummary={accessSummary}
            onOpenUpgrade={() => requestUpgrade(Math.max(2, profile.currentStage || 2))}
          />
        )}
        {screen === "forge" && profile && (
          <ForgeScreen
            key="forge"
            userId={(user as any).id}
            profile={profile}
            onBack={() => { setIsFirstVisit(false); setInitialStage(null); setScreenPersisted("hub"); }}
            onUpdateProfile={updateProfile}
            completedByStage={completedByStage}
            onMilestoneComplete={handleMilestoneComplete}
            onAdvance={attemptAdvance}
            messagesByStage={messagesByStage}
            onUpdateMessages={handleUpdateMessages}
            marketReport={marketReport}
            isFirstVisit={isFirstVisit}
            initialStage={initialStage}
            teamId={userTeamId}
            onMeaningfulActivity={() => markMeaningfulActivity(true)}
            bubbleSummaries={bubbleSummaries}
            pendingUpgradeStage={effectivePendingUpgradeStage}
            furthestStageReached={furthestStageReached}
            onRequestUpgrade={(stage: number) => setPaywallStage(stage)}
            onDowngradeToFree={() => revertToStage(1)}
          />
        )}
      </div>
      {showMarketIntel && profile && user && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#080809", overflowY: "auto" }}>
          <MarketIntelligenceScreen
            profile={profile}
            userId={(user as any).id}
            report={marketReport}
            onReportChange={setMarketReport}
            onBack={() => setShowMarketIntel(false)}
          />
        </div>
      )}
      {showDocuments && profile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#080809", overflowY: "auto" }}>
          <DocumentProductionScreen
            userId={(user as any).id}
            profile={profile}
            onBack={() => setShowDocuments(false)}
          />
        </div>
      )}
      {showPitchPractice && profile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#080809", overflowY: "auto" }}>
          <PitchPracticeScreen
            profile={profile}
            onBack={() => setShowPitchPractice(false)}
          />
        </div>
      )}
      {showJournal && user && (
        <JournalScreen
          userId={user.id}
          entries={journalEntries}
          onEntriesChange={setJournalEntries}
          onBack={() => setShowJournal(false)}
          profile={profile}
        />
      )}
      {showBriefings && user && (
        <BriefingsScreen
          userId={user.id}
          profile={profile}
          briefings={briefings}
          onBriefingsChange={setBriefings}
          onBack={() => setShowBriefings(false)}
          completedByStage={completedByStage}
        />
      )}
      {showChatRoom && profile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#080809" }}>
          <ForgeChatRoom
            profile={profile}
            onBack={() => setShowChatRoom(false)}
          />
        </div>
      )}
      {showCofounder && user && profile && (
        <CofounderModeScreen
          userId={(user as any).id}
          profile={profile}
          onBack={() => setShowCofounder(false)}
          onTeamChanged={(id) => setUserTeamId(id)}
        />
      )}
      {settingsView === "settings" && profile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "#080809", overflowY: "auto" }}>
          <SettingsScreen
            profile={profile}
            authEmail={authUserEmail}
            accessSummary={accessSummary}
            billingSubscription={billingSubscription}
            onBack={() => setSettingsView(null)}
            onOpenPrivacy={() => setSettingsView("privacy")}
            onOpenEula={() => setSettingsView("eula")}
            onOpenTermsAndConditions={() => setSettingsView("termsAndConditions")}
            onOpenAcceptableUse={() => setSettingsView("acceptableUse")}
            onOpenDisclaimer={() => setSettingsView("disclaimer")}
            notificationPreferences={notificationPreferences}
            onNotificationPreferencesChange={handleNotificationPreferencesChange}
            notifications={notifications}
            onMarkNotificationRead={handleMarkNotificationRead}
            onOpenManageSubscription={handleOpenManageSubscription}
            billingActionMessage={billingMessage}
            billingPortalLoading={billingPortalLoading}
            onProfileSave={handleProfileSave}
            onLogout={handleLogout}
          />
        </div>
      )}
      {settingsView === "privacy" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 121, background: "#080809", overflowY: "auto" }}>
          <PrivacyPolicyScreen onBack={() => setSettingsView("settings")} />
        </div>
      )}
      {settingsView === "eula" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 121, background: "#080809", overflowY: "auto" }}>
          <EulaScreen onBack={() => setSettingsView("settings")} />
        </div>
      )}
      {settingsView === "termsAndConditions" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 121, background: "#080809", overflowY: "auto" }}>
          <TermsAndConditionsScreen onBack={() => setSettingsView("settings")} />
        </div>
      )}
      {settingsView === "acceptableUse" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 121, background: "#080809", overflowY: "auto" }}>
          <AcceptableUsePolicyScreen onBack={() => setSettingsView("settings")} />
        </div>
      )}
      {settingsView === "disclaimer" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 121, background: "#080809", overflowY: "auto" }}>
          <DisclaimerScreen onBack={() => setSettingsView("settings")} />
        </div>
      )}
      {showAdminHub && user && canOpenAdminHub && (
        <AdminHubScreen
          userId={(user as any).id}
          onBack={() => setShowAdminHub(false)}
          notificationSettings={adminNotificationSettings}
          onNotificationSettingsChange={handleAdminNotificationSettingsChange}
        />
      )}
      <PaywallScreen
        open={paywallStage !== null}
        targetStage={paywallStage ?? 2}
        access={accountAccess}
        onManageSubscription={handleOpenManageSubscription}
        billingMessage={billingMessage}
        onClose={() => {
          setPaywallStage(null);
          if (effectivePendingUpgradeStage && !canAccessStage(effectivePendingUpgradeStage, accountAccess)) {
            setIsFirstVisit(false);
            setInitialStage(null);
            setScreenPersisted("hub");
          }
        }}
      />
      {profile && user && screen !== "onboarding" && screen !== "intro" && canAccessStage(profile.currentStage || 1, accountAccess) && (
        <ForgeBubble
          profile={profile}
          userId={(user as any).id}
          currentScreen={
            showMarketIntel ? "marketIntel"
              : showDocuments ? "documents"
                : showPitchPractice ? "pitchPractice"
                  : showJournal ? "journal"
                    : showBriefings ? "briefings"
                      : showCofounder ? "cofounder"
                        : showChatRoom ? "chatRoom"
                          : settingsView ? "settings"
                            : screen
          }
          onBubbleSummaryAdded={(summary) => setBubbleSummaries(prev => [summary, ...prev])}
        />
      )}
    </>
  );
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import AuthScreen from "./AuthScreen";
import JournalScreen from "./JournalScreen";
import BriefingsScreen from "./BriefingsScreen";
import {
  loadProfile, saveProfile,
  loadAllStageProgress, saveStageProgress,
  loadAllMessages, saveMessages,
  loadConversationSummaries, saveConversationSummary, updateConversationSummary, deleteConversationSummary,
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
  saveDecision,
  loadDecisions,
  loadRecentSummaries,
  persistStageSummaryToday,
  loadStageProgressDates,
  loadActiveNudge,
  dismissNudge,
  markNudgeActedOn,
  markNudgeSeen,
  type StageSummary,
  type FounderDecision,
  type FounderNudge,
  type SavedBriefing,
} from "./db";
import { generateNudgeIfNeeded } from "./lib/nudgeEngine";
import { buildLongitudinalContext, extractLongitudinalSignals } from "./lib/longitudinalMemory";
import { buildJournalContext } from "./lib/journalIntelligence";
import { GLOBAL_STYLES } from "./constants/styles";
import { FORGE_SYSTEM_PROMPT } from "./constants/prompts";
import { STAGES_DATA } from "./constants/stages";
import { applyGlossaryHighlights } from "./lib/applyGlossaryHighlights";
import { loadGlossaryTerms, type GlossaryTerm } from "./lib/glossaryDb";
import { cleanAIText } from "./lib/cleanAIText";
import { buildMessageContent, type AttachedFile } from "./lib/fileAttach";
import { getArchiveDisplaySummary, getArchiveDisplayTitle, getArchivePreviewText, parseArchiveSummaryPayload } from "./lib/archiveSummary";
import { getLanguageWarning, moderateUserText } from "./lib/languageModeration";
import {
  applyFoundryBookCitations,
  buildFoundryBookContext,
  type RetrievedBookSection,
} from "./lib/foundryBook";
import TypingDots from "./components/TypingDots";
import ForgeAvatar from "./components/ForgeAvatar";
import ChatInput from "./components/ChatInput";
import StageRefModal from "./components/StageRefModal";
import GlossaryModal from "./components/GlossaryModal";
import ConceptModal from "./components/ConceptModal";
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
import ForgeAcademyScreen from "./components/ForgeAcademyScreen";
import AppTourScreen from "./components/AppTourScreen";
import ArchivePanel from "./components/ArchivePanel";
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
import { completeAcademyLesson } from "./lib/academyCompletion";
import {
  getFounderSessionState,
  type FounderSessionState,
  updateLastScreen,
  updateLastSeenAt,
} from "./lib/founderSessionState";
import { ensureAccountAccess, updateUserActivity } from "./db";
import { canAccessApp, getAccessBlockReason } from "./lib/accessGate";
import type { AccountAccess, BillingSubscription } from "./lib/accessGate";
import {
  canAccessStage,
  FREE_TIER_ACADEMY_STAGE_LIMIT,
  FREE_TIER_BRIEFING_LIMIT,
  FREE_TIER_MARKET_REPORT_LIMIT,
  FREE_TIER_PITCH_PRACTICE_LIMIT,
  getAccessSummary,
  isFreeTierAccess,
} from "./lib/foundryAccess";
import { hasAdminHubAccess, isOwnerEmail } from "./lib/roles";
import { openCustomerPortal } from "./lib/billing";
import { clearBillingRoute, getBillingRouteState } from "./lib/billingRoute";
import {
  buildLegacyFinancialMirror,
  getFinancialSummary,
  type FinancialSummary,
  type FounderFinancialData,
  type PlaidReviewTransaction,
} from "./lib/financialModeling";
import {
  acceptPlaidTransactionAsExpense,
  acceptPlaidTransactionAsRevenue,
  deleteExpense,
  deleteRevenue,
  ignorePlaidTransaction,
  loadFounderFinancialData,
  saveExpense,
  saveFinancialSettings,
  saveRevenue,
} from "./lib/financialDb";
import { syncPlaidTransactions } from "./lib/plaid";
import {
  DEFAULT_ADMIN_NOTIFICATION_SETTINGS,
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  type AdminNotificationSettings,
  type AppNotification,
  type UserNotificationPreferences,
} from "./lib/notifications";
import type { AcademyTopicLaunch } from "./lib/academy";
import { clearFoundryClientStorage, createEmptyMessagesByStage, createEmptyStageProgress } from "./lib/session";

// callForgeAPI and streamForgeAPI are imported from ./lib/forgeApi

// ─────────────────────────────────────────────────────────────
// MEMORY + CONTEXT BUILDERS
// ─────────────────────────────────────────────────────────────
const memorySummaryCache: Record<number, { summary: string; messageCount: number }> = {};

async function generateStageSummary(
  stageId: number,
  messages: any[],
  profile: any,
  recentSummaries?: StageSummary[],
  userId?: string
) {
  if (!messages || messages.length === 0) return null;
  const cached = memorySummaryCache[stageId];
  if (cached && cached.messageCount === messages.length) return cached.summary;

  // Check persisted summaries from the last 48 hours before regenerating
  if (recentSummaries && recentSummaries.length > 0) {
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const recent = recentSummaries.find(
      s => s.stageId === stageId && new Date(s.summaryDate + "T23:59:59") >= cutoff48h
    );
    if (recent) {
      memorySummaryCache[stageId] = { summary: recent.summary, messageCount: messages.length };
      return recent.summary;
    }
  }

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
    if (userId) {
      persistStageSummaryToday(userId, stageId, summary, messages.length).catch(() => {});
    }
    return summary;
  } catch {
    return null;
  }
}

async function buildRichContext(
  profile,
  activeStage,
  completedByStage,
  messagesByStage,
  cofoundersContext?: string | null,
  currentPrompt?: string,
  recentSummaries?: StageSummary[],
  foundryDecisions?: FounderDecision[],
  userId?: string,
  stageProgressDates?: Record<number, string>,
  journalEntries?: any[],
  financialSummary?: FinancialSummary | null,
) {
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
  const financialSummaryBlock = financialSummary ? `FINANCIAL MODEL:
Available cash: $${Math.round(financialSummary.availableCash).toLocaleString()}
Estimated monthly burn: $${Math.round(financialSummary.monthlyBurn).toLocaleString()}
Estimated runway: ${financialSummary.runwayMonths != null ? `${financialSummary.runwayMonths.toFixed(1)} months` : "Not enough recurring burn data yet"}
Recurring expenses: ${financialSummary.recurringExpenseCount} items · $${Math.round(financialSummary.monthlyRecurringExpenses).toLocaleString()}/mo
Recurring revenue: ${financialSummary.recurringRevenueCount} items · $${Math.round(financialSummary.monthlyRecurringRevenue).toLocaleString()}/mo
Rough net snapshot: $${Math.round(financialSummary.roughNetSnapshot).toLocaleString()}
Profit First status: ${financialSummary.profitFirst.enabled ? financialSummary.profitFirst.buckets.map((bucket) => `${bucket.bucketType} ${bucket.allocationPercent}% (~$${Math.round(bucket.estimatedAmount).toLocaleString()})`).join(", ") : "Disabled"}
Financial note: ${financialSummary.usesEstimatedInputs ? "Some values are estimated or manually entered." : "Based on manually entered normalized financial data."}` : "";

  const memorySections: string[] = [];
  for (const s of STAGES_DATA) {
    if (s.id === activeStage) continue;
    const msgs = messagesByStage[s.id] || [];
    if (msgs.length === 0) continue;
    const summary = await generateStageSummary(s.id, msgs, profile, recentSummaries, userId);
    if (summary) memorySections.push(`Stage ${s.id} (${s.label}) memory:\n  ${summary}`);
  }

  const currentStageMessages = messagesByStage[activeStage] || [];
  const recentStageText = currentStageMessages
    .slice(-6)
    .map((message) => message.text || "")
    .filter(Boolean);

  const bookContextPackage = buildFoundryBookContext(
    activeStage,
    [currentPrompt || "", ...recentStageText],
    3
  );

  const methodSection = bookContextPackage.context ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOUNDRY METHOD — TARGETED BOOK CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is selected from The Foundry Method book for the current topic. Use it as teaching depth, not as text to repeat. Answer the founder's question first. Use the book to sharpen your reasoning and reinforce the explanation naturally.

${bookContextPackage.context}` : "";

  const cofounderSection = cofoundersContext ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COFOUNDER TEAM CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This founder is part of a team. The following is from their shared team chat. Use it naturally when relevant — it represents knowledge the founder should not have to repeat. Reference it when it directly bears on the current conversation.

${cofoundersContext}` : "";

  const onboardingReviewSection = profile?.nameNeedsReview || profile?.ideaNeedsReview ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONBOARDING REVIEW NOTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Some onboarding answers were likely jokes or placeholders and need to be re-confirmed naturally in conversation.
${profile?.nameNeedsReview ? `- The founder did not give a serious name during onboarding. Current placeholder name: ${profile.name || "Founder"}.` : ""}
${profile?.ideaNeedsReview ? `- The founder did not give a serious business description during onboarding. Current placeholder business: ${profile.idea || "Still being clarified"}.` : ""}
Do not make this awkward or repetitive. Reassess naturally when it fits the conversation, then continue normally.` : "";

  const safeProfileName = profile?.nameNeedsReview ? "Founder" : profile.name;
  const safeBusinessName = profile?.ideaNeedsReview ? "Still being clarified" : (profile.businessName || profile.idea || "Idea stage");

  const longitudinalBlock = (recentSummaries || foundryDecisions || stageProgressDates)
    ? buildLongitudinalContext(
        activeStage,
        recentSummaries ?? [],
        foundryDecisions ?? [],
        completedByStage,
        stageProgressDates ?? {}
      )
    : "";

  const journalBlock = journalEntries && journalEntries.length > 0
    ? buildJournalContext(journalEntries, 14)
    : "";

  const context = `
Current date & time: ${dateStr}, ${timeStr}
Founder: ${safeProfileName} | Business: ${safeBusinessName} (${profile.industry || "Early Stage"})
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

${financialSummaryBlock ? `${financialSummaryBlock}

` : ""}
${memorySections.length > 0 ? `CROSS-STAGE MEMORY (prior stage work):
${memorySections.join("\n\n")}` : ""}

${longitudinalBlock ? `${longitudinalBlock}` : ""}

${journalBlock ? `${journalBlock}\n\n` : ""}STAGE REFERENCES: When referencing work from another stage, wrap it like [STAGE_REF:N]text[/STAGE_REF]. Use naturally when prior work is relevant — not on every mention.${onboardingReviewSection}${cofounderSection}${methodSection}
  `.trim();

  return {
    context,
    bookMatches: bookContextPackage.matches,
  };
}

// Market intel is injected at call-sites rather than inside buildRichContext
// so the function signature stays clean and the report is optional.
function appendMarketContext(
  contextPackage: { context: string; bookMatches: RetrievedBookSection[] },
  marketReport: any
) {
  if (!marketReport?.content) return contextPackage;
  return {
    ...contextPackage,
    context: contextPackage.context + buildMarketIntelContext(marketReport),
  };
}

function appendArchiveSessionContext(
  contextPackage: { context: string; bookMatches: RetrievedBookSection[] },
  archiveSession: any
) {
  if (!archiveSession?.entry?.summary) return contextPackage;

  return {
    ...contextPackage,
    context: `${contextPackage.context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ARCHIVE CONTINUATION CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The founder is continuing a saved archive titled "${archiveSession.entry.title}" from ${archiveSession.entry.date}.
Use this summary as prior context for the current conversation and build on it naturally.

${getArchiveDisplaySummary(archiveSession.entry.summary)}`.trim(),
  };
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

function parseForgeResponseWithBookCitations(
  text: string,
  bookMatches: RetrievedBookSection[] = []
) {
  const parsed = parseForgeResponse(text);
  const citationApplied = applyFoundryBookCitations(parsed.cleanText, bookMatches);
  return {
    ...parsed,
    cleanText: citationApplied.cleanText,
    usedCitations: citationApplied.usedCitations,
  };
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

function getSummaryPreview(summary: string) {
  const plain = getArchivePreviewText(summary || "").replace(/\s+/g, " ").trim();
  if (plain.length <= 140) return plain;
  return `${plain.slice(0, 140).trim()}...`;
}

function parseDailySummaryResponse(raw: string, fallbackDate: string) {
  return parseArchiveSummaryPayload(raw, `Conversation Summary · ${fallbackDate}`);
}

function getArchiveDisplayDate(dateLike?: string) {
  if (!dateLike) return "Unknown date";
  return new Date(`${dateLike}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}


function renderWithBold(text, onStageRef, onGlossaryTap, onConceptTap?, glossaryTerms: GlossaryTerm[] = []) {
  if (!text) return null;
  text = cleanAIText(text);

  // Parse both [STAGE_REF:N]...[/STAGE_REF] and [CONCEPT]...[/CONCEPT] tags
  // into a flat parts array, preserving the order they appear in the text.
  const tagRegex = /(\[STAGE_REF:(\d+)\](.*?)\[\/STAGE_REF\]|\[CONCEPT\](.*?)\[\/CONCEPT\])/gs;
  const parts: any[] = [];
  let lastIndex = 0;
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    const start = match.index;
    const fullMatch = match[1];

    if (start > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, start) });
    }

    if (fullMatch.startsWith("[STAGE_REF:")) {
      parts.push({ type: "stage_ref", stageId: Number(match[2]), content: match[3] });
    } else {
      // [CONCEPT] tag
      parts.push({ type: "concept", name: match[4] });
    }

    lastIndex = start + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }

  const renderInlineContent = (segment: string, keyPrefix: string) => {
    const boldParts = segment.split(/(\*\*.*?\*\*)/g);

    return boldParts.map((part: string, i: number) => {
      const key = `${keyPrefix}-${i}`;

      if (part.startsWith("**") && part.endsWith("**")) {
        const inner = part.slice(2, -2);
        return (
          <strong key={key} style={{ color: "#F0EDE8", fontWeight: 700 }}>
            {applyGlossaryHighlights(inner, onGlossaryTap, glossaryTerms)}
          </strong>
        );
      }

      // Handle single newlines as <br>
      const lines = part.split("\n");
      return lines.map((line: string, j: number) => (
        <span key={`${key}-l${j}`}>
          {j > 0 && <br />}
          {applyGlossaryHighlights(line, onGlossaryTap, glossaryTerms)}
        </span>
      ));
    });
  };

  const renderTextWithBold = (segment: string, keyPrefix: string) => {
    const lines = segment.split("\n");
    const blocks: ReactNode[] = [];
    let paragraphLines: string[] = [];
    let blockIndex = 0;

    const flushParagraph = () => {
      if (paragraphLines.length === 0) return;
      const paragraphText = paragraphLines.join("\n").trim();
      if (!paragraphText) {
        paragraphLines = [];
        return;
      }

      blocks.push(
        <p
          key={`${keyPrefix}-p${blockIndex++}`}
          style={{ margin: blocks.length === 0 ? 0 : "12px 0 0 0" }}
        >
          {renderInlineContent(paragraphText, `${keyPrefix}-p${blockIndex}`)}
        </p>
      );
      paragraphLines = [];
    };

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const headingTwoMatch = line.match(/^##\s+(.*)$/);
      const headingThreeMatch = line.match(/^###\s+(.*)$/);
      const bulletMatch = line.match(/^[-*]\s+(.*)$/);
      const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);

      if (line.trim() === "") {
        flushParagraph();
        continue;
      }

      if (headingTwoMatch) {
        flushParagraph();
        blocks.push(
          <div
            key={`${keyPrefix}-h2-${blockIndex++}`}
            style={{
              margin: blocks.length === 0 ? 0 : "14px 0 0 0",
              fontSize: 16,
              lineHeight: 1.35,
              fontWeight: 700,
              color: "#F0EDE8",
            }}
          >
            {renderInlineContent(headingTwoMatch[1], `${keyPrefix}-h2-${blockIndex}`)}
          </div>
        );
        continue;
      }

      if (headingThreeMatch) {
        flushParagraph();
        blocks.push(
          <div
            key={`${keyPrefix}-h3-${blockIndex++}`}
            style={{
              margin: blocks.length === 0 ? 0 : "12px 0 0 0",
              fontSize: 14,
              lineHeight: 1.4,
              fontWeight: 700,
              color: "#F0EDE8",
            }}
          >
            {renderInlineContent(headingThreeMatch[1], `${keyPrefix}-h3-${blockIndex}`)}
          </div>
        );
        continue;
      }

      if (bulletMatch) {
        flushParagraph();
        const items: string[] = [];
        let listIndex = idx;
        while (listIndex < lines.length) {
          const match = lines[listIndex].match(/^[-*]\s+(.*)$/);
          if (!match) break;
          items.push(match[1]);
          listIndex++;
        }

        blocks.push(
          <ul
            key={`${keyPrefix}-ul${blockIndex++}`}
            style={{ margin: blocks.length === 0 ? "0 0 0 20px" : "12px 0 0 20px", padding: 0 }}
          >
            {items.map((item, itemIndex) => (
              <li key={`${keyPrefix}-ul-item-${itemIndex}`} style={{ marginBottom: 6 }}>
                {renderInlineContent(item, `${keyPrefix}-ul-item-${itemIndex}`)}
              </li>
            ))}
          </ul>
        );
        idx = listIndex - 1;
        continue;
      }

      if (numberedMatch) {
        flushParagraph();
        const items: { value: number; content: string }[] = [];
        let listIndex = idx;
        while (listIndex < lines.length) {
          const match = lines[listIndex].match(/^(\d+)\.\s+(.*)$/);
          if (!match) break;
          items.push({ value: Number(match[1]), content: match[2] });
          listIndex++;
        }

        blocks.push(
          <ol
            key={`${keyPrefix}-ol${blockIndex++}`}
            style={{ margin: blocks.length === 0 ? "0 0 0 20px" : "12px 0 0 20px", padding: 0 }}
            start={items[0]?.value || 1}
          >
            {items.map((item, itemIndex) => (
              <li key={`${keyPrefix}-ol-item-${itemIndex}`} style={{ marginBottom: 6 }}>
                {renderInlineContent(item.content, `${keyPrefix}-ol-item-${itemIndex}`)}
              </li>
            ))}
          </ol>
        );
        idx = listIndex - 1;
        continue;
      }

      paragraphLines.push(line);
    }

    flushParagraph();
    return blocks;
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

    if (part.type === "concept") {
      const conceptName = part.name as string;
      return (
        <span
          key={`concept-${i}`}
          onClick={() => onConceptTap && onConceptTap(conceptName)}
          title={`Explore: ${conceptName}`}
          style={{
            color: "#9F7AEA",
            borderBottom: "1px dashed #9F7AEA",
            cursor: onConceptTap ? "pointer" : "default",
            opacity: 0.9,
            transition: "opacity 0.15s",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
        >
          ✦ {conceptName}
        </span>
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
  onContinueArchiveInChatRoom = null as ((entry: any) => void) | null,
  onBubbleSummaryUpdated = null as ((entry: any) => void) | null,
  onBubbleSummaryDeleted = null as ((entry: any) => void) | null,
  archiveMutationTick = 0,
  recentSummaries = [] as StageSummary[],
  foundryDecisions = [] as FounderDecision[],
  stageProgressDates = {} as Record<number, string>,
  onGreetingOpen = null as (() => void) | null,
  journalEntries = [] as any[],
  journalSeedPrompt = null as string | null,
  onJournalSeedUsed = null as (() => void) | null,
  financialSummary = null as FinancialSummary | null,
  initialLastSeenAt = null as string | null,
}) {
  const [activeStage, setActiveStage] = useState(pendingUpgradeStage || initialStage || profile.currentStage);
  const [activeTab, setActiveTab] = useState("chat");
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [languageWarning, setLanguageWarning] = useState<string | null>(null);
  const [confirmedProfanityInput, setConfirmedProfanityInput] = useState<string | null>(null);
  const [hubOpen, setHubOpen] = useState(false);
  const [advanceReady, setAdvanceReady] = useState(false);
  const [showStageSelector, setShowStageSelector] = useState(false);
  const [stageRefModal, setStageRefModal] = useState<number | null>(null);
  const [glossaryModal, setGlossaryModal] = useState<{ term: string; entry: GlossaryTerm } | null>(null);
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([]);
  const [conceptModal, setConceptModal] = useState<{ name: string } | null>(null);
  const [briefingDismissed, setBriefingDismissed] = useState(false);
  const [cofoundersContext, setCofoundersContext] = useState<string | null>(null);
  const [summariesByStage, setSummariesByStage] = useState<Record<number, any[]>>({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });
  const [summaryModal, setSummaryModal] = useState<any | null>(null);
  const [saveArchiveModalOpen, setSaveArchiveModalOpen] = useState(false);
  const [archiveTitleInput, setArchiveTitleInput] = useState("");
  const [savingArchive, setSavingArchive] = useState(false);
  const [archiveSession, setArchiveSession] = useState<any | null>(null);
  const [editingSummaryTitle, setEditingSummaryTitle] = useState(false);
  const [summaryTitleInput, setSummaryTitleInput] = useState("");
  const [updatingSummaryTitle, setUpdatingSummaryTitle] = useState(false);
  const [deletingSummaryId, setDeletingSummaryId] = useState<string | null>(null);
  const [archiveMenuOpenId, setArchiveMenuOpenId] = useState<string | null>(null);
  const [summaryModalMenuOpen, setSummaryModalMenuOpen] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<"all" | "forge" | "chatroom" | "academy" | "bubble" | "pitchpractice">("all");
  const [sessionLastSeenAt, setSessionLastSeenAt] = useState<string | null>(initialLastSeenAt);

  useEffect(() => {
    setSessionLastSeenAt(initialLastSeenAt);
  }, [initialLastSeenAt]);

  useEffect(() => {
    if (!summaryModal) {
      setEditingSummaryTitle(false);
      setSummaryTitleInput("");
      setSummaryModalMenuOpen(false);
      return;
    }

    setSummaryTitleInput(getArchiveDisplayTitle(summaryModal.title, summaryModal.summary, "Saved Archive"));
  }, [summaryModal?.id]);

  // Load shared team context for Forge injection
  useEffect(() => {
    if (!teamId) { setCofoundersContext(null); return; }
    getRecentCofounderContext(teamId, 20).then(ctx => setCofoundersContext(ctx || null));
  }, [teamId]);

  useEffect(() => {
    const stage = Number(profile?.currentStage) || 1;
    loadGlossaryTerms(stage).then(setGlossaryTerms).catch(() => {});
  }, [profile?.currentStage]);

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
  }, [userId, archiveMutationTick]);

  useEffect(() => {
    if (!archiveSession) return;
    if (archiveSession.stageId !== activeStage) {
      setArchiveSession(null);
    }
  }, [activeStage, archiveSession?.stageId]);

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
    const lastSeenMs = sessionLastSeenAt ? new Date(sessionLastSeenAt).getTime() : null;
    const hoursSince = lastSeenMs ? (Date.now() - lastSeenMs) / 1000 / 60 / 60 : null;
    const isLongAbsence = !lastSeenMs || hoursSince > 8;
    const nextLastSeenAt = new Date().toISOString();
    setSessionLastSeenAt(nextLastSeenAt);
    void updateLastSeenAt(userId, nextLastSeenAt);

    const runGreeting = async () => {
      // Journal seed — founder tapped "Ask Forge about this" from journal screen
      if (journalSeedPrompt) {
        onJournalSeedUsed?.();
        const seedMessage = journalSeedPrompt;
        const seedContext = appendMarketContext(await buildRichContext(
          profile, activeStage, completedByStage, messagesByStage,
          cofoundersContext, seedMessage, recentSummaries, foundryDecisions, userId, stageProgressDates, journalEntries, financialSummary
        ), marketReport);
        setLoading(true);
        try {
          const seedReply = await callForgeAPI(
            [{ role: "user", content: seedMessage }],
            FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", seedContext.context)
          );
          const { cleanText: seedClean } = parseForgeResponseWithBookCitations(seedReply, seedContext.bookMatches);
          onUpdateMessages(activeStage, [
            { id: `journal-user-${Date.now()}`, role: "user", text: seedMessage, createdAt: new Date().toISOString() },
            { id: `journal-forge-${Date.now()}`, role: "forge", text: seedClean, createdAt: new Date().toISOString() },
          ]);
        } catch {
          onUpdateMessages(activeStage, [
            { id: `journal-user-${Date.now()}`, role: "user", text: seedMessage, createdAt: new Date().toISOString() },
          ]);
        }
        setLoading(false);
        return;
      }

      let greetingPrompt = "";
      const safeName = profile.nameNeedsReview ? "Founder" : profile.name;
      const safeIdea = profile.ideaNeedsReview ? "still being clarified" : profile.idea;
      const onboardingReviewNote = [
        profile.nameNeedsReview ? "Their real name was not confirmed during onboarding." : "",
        profile.ideaNeedsReview ? "Their real business idea was not confirmed during onboarding." : "",
      ].filter(Boolean).join(" ");

      if (isFirstVisit && pendingUpgradeStage && activeStage === pendingUpgradeStage) {
        greetingPrompt = `${safeName} just finished onboarding and wants to start at Stage ${activeStage}: ${stageData.label}. Their idea: "${safeIdea}". Experience: ${profile.experience}. Budget: $${profile.budget?.total?.toLocaleString() || "unknown"}. Strategy: ${profile.strategyLabel}. ${onboardingReviewNote}

Write a 2-3 paragraph welcome. First: recap what they shared during onboarding — the idea, experience, budget, and strategy — in a natural, specific way, not a form readback. Second: briefly describe what Stage ${activeStage} is about and why it fits where they are. Third (short): let them know Stage ${activeStage} requires a Starter or Pro plan to access — they can upgrade now to jump straight in, or step back and explore Stage 1 for free first. Keep the tone warm and direct. Use **bold** on 2-3 key words. Do NOT end with a question — end after the payment note.`;
      } else if (isFirstVisit && activeStage === 1) {
        greetingPrompt = `${safeName} just finished onboarding and is entering Stage 1 for the first time. Their idea: "${safeIdea}". Experience: ${profile.experience}. Budget: $${profile.budget?.total?.toLocaleString() || "unknown"}. Strategy: ${profile.strategyLabel}. ${onboardingReviewNote}

Start with a short recap of what they told Foundry during onboarding: the business idea, their experience level, their budget, and their strategy. Make it sound natural and specific, not like a form readback. Then pivot immediately to Stage 1's core question: is the problem real. End with one sharp, concrete question that gets the conversation moving. Use **bold** on 2-3 key words. Keep it to 2-3 tight paragraphs.`;
      } else if (isLongAbsence && activeStage > 0) {
        const hoursText = hoursSince ? `about ${Math.round(hoursSince)} hours` : "a while";
        greetingPrompt = `${safeName} is returning to Stage ${activeStage}: ${stageData.label} after ${hoursText} away. Welcome them back briefly and warmly — 1 sentence, not more. Reference where they are in this stage and what matters most right now. Then ask one sharp forward-moving question. 3-4 paragraphs max. Use **bold** on 2-3 key words. ${onboardingReviewNote}`;
      } else {
        greetingPrompt = `${safeName} just opened Stage ${activeStage}: ${stageData.label}. Introduce the mission for this stage in a way that feels personal to their specific situation. Reference what makes this stage matter. Then ask the first sharp question to get started. Use **bold** on 2-3 key words. 3-4 paragraphs max. ${onboardingReviewNote}`;
      }

      // Augment greeting with longitudinal signals when patterns exist
      // Only for returning founders (not first visit / onboarding entry)
      if (!isFirstVisit) {
        const longitudinalBlock = buildLongitudinalContext(
          activeStage,
          recentSummaries,
          foundryDecisions,
          completedByStage,
          stageProgressDates
        );
        const signals = extractLongitudinalSignals(longitudinalBlock);
        if (signals) {
          greetingPrompt += `\n\nFORGE OPENING INSTRUCTION — LONGITUDINAL AWARENESS:\n${signals}\n\nOpen with awareness of this history. Do not narrate that you're reading context. Weave it naturally into your opening — reference what you've noticed as a partner who has been thinking about this founder between sessions. Then move forward.`;
        }
      }

      onGreetingOpen?.();

      const ctxPackage = appendMarketContext(await buildRichContext(
        profile,
        activeStage,
        completedByStage,
        messagesByStage,
        cofoundersContext,
        greetingPrompt,
        recentSummaries,
        foundryDecisions,
        userId,
        stageProgressDates,
        journalEntries,
        financialSummary
      ), marketReport);

      setLoading(true);

      try {
        const reply = await callForgeAPI(
          [{ role: "user", content: greetingPrompt }],
          FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", ctxPackage.context)
        );
        const { cleanText } = parseForgeResponseWithBookCitations(reply, ctxPackage.bookMatches);
        onUpdateMessages(activeStage, [{
          id: `greet-${Date.now()}`,
          role: "forge",
          text: cleanText,
          createdAt: new Date().toISOString(),
          actions: isFirstVisit && pendingUpgradeStage && activeStage === pendingUpgradeStage
            ? buildUpgradeActions(activeStage)
            : undefined,
        }]);
      } catch {
        const fallback =
          isFirstVisit && activeStage === 1
            ? `${safeName} — welcome to Foundry.

You came in with **${safeIdea || "a new business idea"}**, a ${profile.experience || "founder"} background, a budget of **$${profile.budget?.total?.toLocaleString() || "unknown"}**, and a **${profile.strategyLabel || profile.strategy || "focused"}** approach. That's enough to start pressure-testing this the right way.

Stage 1 is about one thing: making sure a real person has a real problem worth solving.

Who, specifically, is the first person you believe feels this problem often enough to want a better solution?`
            : isFirstVisit && pendingUpgradeStage && activeStage === pendingUpgradeStage
              ? `${safeName} — Stage ${activeStage}: ${stageData.label}.

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
  }, [activeStage, briefingDismissed, stageSummaries.length, !!messagesByStage[activeStage]?.length, !!journalSeedPrompt, userId]);

  const openSaveArchiveModal = () => {
    const defaultTitle = archiveSession?.entry?.title || `${stage.label} Archive — ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
    setArchiveTitleInput(defaultTitle);
    setSaveArchiveModalOpen(true);
  };

  const updateArchiveEntryInState = (entry: any) => {
    setSummariesByStage((prev) => {
      const next = { ...prev };
      const oldStageId = Object.keys(next).find((stageId) =>
        (next[Number(stageId)] || []).some((item: any) => item.id === entry.id)
      );

      if (oldStageId) {
        next[Number(oldStageId)] = (next[Number(oldStageId)] || []).filter((item: any) => item.id !== entry.id);
      }

      next[entry.stageId] = [entry, ...(next[entry.stageId] || [])];
      return next;
    });
    if (summaryModal?.id === entry.id) setSummaryModal(entry);
    if (archiveSession?.entry?.id === entry.id) {
      setArchiveSession((prev: any) => prev ? { ...prev, entry } : prev);
    }
  };

  const removeArchiveEntryFromState = (entry: any) => {
    setSummariesByStage((prev) => ({
      ...prev,
      [entry.stageId]: (prev[entry.stageId] || []).filter((item: any) => item.id !== entry.id),
    }));
    if (summaryModal?.id === entry.id) setSummaryModal(null);
    if (archiveSession?.entry?.id === entry.id) setArchiveSession(null);
  };

  const isAcademyArchive = (entry: any) => String(entry?.title || "").startsWith("Academy —");
  const isChatRoomArchive = (entry: any) => String(entry?.title || "").startsWith("Chat with Forge");
  const isQuickChatArchive = (entry: any) => String(entry?.title || "").startsWith("Quick Chat");
  const isPitchPracticeArchive = (entry: any) => String(entry?.title || "").startsWith("Pitch Practice —");
  const isChatStyleArchive = (entry: any) => isChatRoomArchive(entry) || isQuickChatArchive(entry) || isPitchPracticeArchive(entry);

  const handleContinueArchive = () => {
    if (!summaryModal) return;

    if (isChatStyleArchive(summaryModal)) {
      setSummaryModal(null);
      onContinueArchiveInChatRoom?.(summaryModal);
      return;
    }

    const targetStage = Number(summaryModal.stageId) || activeStage;
    setActiveStage(targetStage);
    setActiveTab("chat");
    setArchiveSession({
      entry: summaryModal,
      stageId: targetStage,
      initialMessageCount: (messagesByStage[targetStage] || []).length,
    });
    setSummaryModal(null);
  };

  const handleContinueArchiveEntry = (entry: any) => {
    if (summaryModal?.id !== entry.id) {
      setSummaryModal(entry);
    }

    if (isChatStyleArchive(entry)) {
      setSummaryModal(null);
      setArchiveMenuOpenId(null);
      setSummaryModalMenuOpen(false);
      onContinueArchiveInChatRoom?.(entry);
      return;
    }

    const targetStage = Number(entry.stageId) || activeStage;
    setActiveStage(targetStage);
    setActiveTab("chat");
    setArchiveSession({
      entry,
      stageId: targetStage,
      initialMessageCount: (messagesByStage[targetStage] || []).length,
    });
    setSummaryModal(null);
    setArchiveMenuOpenId(null);
    setSummaryModalMenuOpen(false);
  };

  const handleUpdateSummaryTitle = async () => {
    if (!summaryModal?.id || updatingSummaryTitle) return;
    const nextTitle = summaryTitleInput.trim();
    if (!nextTitle) return;

    setUpdatingSummaryTitle(true);
    try {
      const updated = await updateConversationSummary(userId, summaryModal.id, { title: nextTitle });
      if (!updated) return;
      updateArchiveEntryInState(updated);
      if (isChatStyleArchive(summaryModal)) {
        onBubbleSummaryUpdated?.(updated);
      }
      setEditingSummaryTitle(false);
    } catch (error) {
      console.error("archive title update error:", error);
    } finally {
      setUpdatingSummaryTitle(false);
    }
  };

  const startEditingSummaryTitle = (entry: any) => {
    setSummaryTitleInput(getArchiveDisplayTitle(entry.title, entry.summary, "Saved Archive"));
    setEditingSummaryTitle(true);
    setSummaryModalMenuOpen(false);
    setArchiveMenuOpenId(null);
  };

  const handleDeleteSummary = async () => {
    if (!summaryModal?.id || deletingSummaryId) return;
    setSummaryModalMenuOpen(false);
    setArchiveMenuOpenId(null);
    setDeletingSummaryId(summaryModal.id);
    try {
      const ok = await deleteConversationSummary(userId, summaryModal.id);
      if (!ok) return;
      removeArchiveEntryFromState(summaryModal);
      if (isChatStyleArchive(summaryModal)) {
        onBubbleSummaryDeleted?.(summaryModal);
      }
    } catch (error) {
      console.error("archive delete error:", error);
    } finally {
      setDeletingSummaryId(null);
    }
  };

  const handleDeleteSummaryEntry = async (entry: any) => {
    if (!entry?.id || deletingSummaryId) return;
    setSummaryModalMenuOpen(false);
    setArchiveMenuOpenId(null);
    setDeletingSummaryId(entry.id);
    try {
      const ok = await deleteConversationSummary(userId, entry.id);
      if (!ok) return;
      removeArchiveEntryFromState(entry);
      if (isChatStyleArchive(entry)) {
        onBubbleSummaryDeleted?.(entry);
      }
    } catch (error) {
      console.error("archive delete error:", error);
    } finally {
      setDeletingSummaryId(null);
    }
  };

  const renderArchiveActionsMenu = (entry: any, mode: "card" | "modal" = "card") => {
    const menuOpen = mode === "modal" ? summaryModalMenuOpen : archiveMenuOpenId === entry.id;

    return (
      <div style={{ position: "relative", zIndex: 2 }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (mode === "modal") {
              setSummaryModalMenuOpen((open) => !open);
            } else {
              setArchiveMenuOpenId((current) => current === entry.id ? null : entry.id);
            }
          }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            color: "#999",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: 40,
              right: 0,
              minWidth: 190,
              background: "#111214",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
              padding: 6,
            }}
          >
            <button
              onClick={() => {
                handleContinueArchiveEntry(entry);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                color: "#4CAF8A",
                padding: "10px 12px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Continue Conversation
            </button>
            <button
              onClick={() => {
                if (mode === "modal") {
                  startEditingSummaryTitle(entry);
                } else {
                  setSummaryModal(entry);
                  setArchiveMenuOpenId(null);
                  startEditingSummaryTitle(entry);
                }
              }}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                color: "#F0EDE8",
                padding: "10px 12px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Edit Title
            </button>
            <button
              onClick={() => {
                handleDeleteSummaryEntry(entry);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                color: "#FF6B6B",
                padding: "10px 12px",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  type ArchiveSourceType = "forge" | "chatroom" | "academy" | "bubble" | "pitchpractice";

  const ARCHIVE_SOURCE_CONFIG: Record<ArchiveSourceType, { label: string; color: string; bg: string; borderColor: string }> = {
    forge:    { label: "Forge Session",  color: "#E8622A", bg: "rgba(232,98,42,0.06)",   borderColor: "rgba(232,98,42,0.28)" },
    chatroom: { label: "Chat with Forge",color: "#4CAF8A", bg: "rgba(76,175,138,0.06)",  borderColor: "rgba(76,175,138,0.28)" },
    academy:  { label: "Academy",        color: "#9B8DE8", bg: "rgba(155,141,232,0.06)", borderColor: "rgba(155,141,232,0.28)" },
    bubble:   { label: "Quick Chat",     color: "#63B3ED", bg: "rgba(99,179,237,0.06)",  borderColor: "rgba(99,179,237,0.28)" },
    pitchpractice: { label: "Pitch Practice", color: "#D9B15D", bg: "rgba(217,177,93,0.08)", borderColor: "rgba(217,177,93,0.28)" },
  };

  const getEntrySourceType = (entry: any): ArchiveSourceType => {
    if (isPitchPracticeArchive(entry)) return "pitchpractice";
    if (isQuickChatArchive(entry)) return "bubble";
    if (isChatRoomArchive(entry)) return "chatroom";
    if (isAcademyArchive(entry)) return "academy";
    return "forge";
  };

  const renderArchiveCard = (entry: any) => {
    const sourceType = getEntrySourceType(entry);
    const cfg = ARCHIVE_SOURCE_CONFIG[sourceType];
    const dateLabel = getArchiveDisplayDate(entry.date);
    const fallbackTitle = `${cfg.label} · ${dateLabel}`;
    const stageData = sourceType === "forge" ? STAGES_DATA.find((s) => s.id === Number(entry.stageId)) : null;

    return (
      <div
        key={entry.id || `${entry.stageId}-${entry.date}`}
        style={{
          background: cfg.bg,
          border: `1px solid ${cfg.borderColor}`,
          borderLeft: `4px solid ${cfg.color}`,
          borderRadius: 14,
          color: "#F0EDE8",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}>
          {renderArchiveActionsMenu(entry, "card")}
        </div>
        <button
          onClick={() => setSummaryModal(entry)}
          style={{
            width: "100%",
            textAlign: "left",
            background: "transparent",
            border: "none",
            borderRadius: 14,
            padding: "14px 56px 14px 16px",
            color: "#F0EDE8",
            cursor: "pointer",
          }}
        >
          {/* Source badge row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 9,
              fontFamily: "’DM Sans’, sans-serif",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: cfg.color,
              background: `${cfg.color}18`,
              border: `1px solid ${cfg.color}30`,
              borderRadius: 5,
              padding: "2px 7px",
            }}>
              {cfg.label}
            </span>
            {stageData && (
              <span style={{
                fontSize: 9,
                fontFamily: "’DM Sans’, sans-serif",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: stageData.color,
                background: `${stageData.color}15`,
                border: `1px solid ${stageData.color}28`,
                borderRadius: 5,
                padding: "2px 7px",
              }}>
                Stage {stageData.id} — {stageData.label}
              </span>
            )}
            <span style={{ fontSize: 10, color: "rgba(240,237,232,0.3)", fontFamily: "’DM Sans’, sans-serif", marginLeft: "auto" }}>
              {dateLabel}
            </span>
          </div>
          <div style={{ fontSize: 15, fontFamily: "’Playfair Display’, Georgia, serif", fontWeight: 700, marginBottom: 5, lineHeight: 1.3 }}>
            {getArchiveDisplayTitle(entry.title, entry.summary, fallbackTitle)}
          </div>
          <div style={{ fontSize: 12, color: "rgba(240,237,232,0.45)", lineHeight: 1.7 }}>
            {getSummaryPreview(entry.summary)}
          </div>
        </button>
      </div>
    );
  };

  const handleSaveArchive = async () => {
    const archiveMessages = archiveSession
      ? messages.slice(archiveSession.initialMessageCount)
      : messages;
    if (savingArchive || archiveMessages.length === 0) return;

    const title = archiveTitleInput.trim() || archiveSession?.entry?.title || `${stage.label} Archive`;
    const transcript = archiveMessages
      .map((msg: any) => `${msg.role === "forge" ? "Forge" : profile.name}: ${msg.text}`)
      .join("\n");

    const prompt = archiveSession?.entry?.id
      ? `Update this archived Foundry coaching conversation for ${profile.name} in clear markdown.\n\nExisting archive summary:\n${archiveSession.entry.summary}\n\nNew continuation transcript:\n${transcript}\n\nReturn valid JSON with exactly these keys:\n"title": keep exactly this title: "${title}"\n"summary": a detailed markdown summary with these sections: Key Decisions, Main Insights, Risks or Blockers, Recommended Next Moves. Blend the prior archive context with the new continuation so this replaces the old summary cleanly.`
      : `Summarize this Foundry coaching conversation for ${profile.name} in clear markdown.\n\nReturn valid JSON with exactly these keys:\n"title": keep exactly this title: "${title}"\n"summary": a detailed markdown summary with these sections: Key Decisions, Main Insights, Risks or Blockers, Recommended Next Moves.\n\nConversation:\n${transcript}`;

    setSavingArchive(true);

    try {
      const raw = await callForgeAPI(
        [{ role: "user", content: prompt }],
        "You write clean business conversation summaries. Return only valid JSON."
      );
      const parsed = parseDailySummaryResponse(raw, new Date().toISOString().slice(0, 10));
      const saved = archiveSession?.entry?.id
        ? await updateConversationSummary(
            userId,
            archiveSession.entry.id,
            {
              stageId: activeStage,
              summaryDate: new Date().toISOString().slice(0, 10),
              title,
              summary: parsed.summary,
              messageCount: (archiveSession.entry.messageCount || 0) + archiveMessages.length,
            }
          )
        : await saveConversationSummary(
            userId,
            activeStage,
            new Date().toISOString().slice(0, 10),
            title,
            parsed.summary,
            messages.length
          );

      if (!saved) return;

      updateArchiveEntryInState(saved);
      setSaveArchiveModalOpen(false);
      onUpdateMessages(activeStage, []);
      setArchiveSession(null);
      setInput("");
      setAttachedFiles([]);
      setLanguageWarning(null);
      setConfirmedProfanityInput(null);
    } catch (error) {
      console.error("manual archive save error:", error);
    } finally {
      setSavingArchive(false);
    }
  };

  const send = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || loading) return;
    onMeaningfulActivity?.();

    const text = input.trim();
    const warning = getLanguageWarning(text);
    if (warning && confirmedProfanityInput !== text) {
      setLanguageWarning(warning);
      setConfirmedProfanityInput(text);
      return;
    }

    setLanguageWarning(null);
    setConfirmedProfanityInput(null);
    const { censoredText } = moderateUserText(text);
    const currentFiles = [...attachedFiles];
    setInput("");
    setAttachedFiles([]);

    // Build display text (shown in chat and saved to DB)
    const attachmentLabel = currentFiles.length > 0
      ? `[Attached: ${currentFiles.map(f => f.name).join(", ")}]`
      : "";
    const displayText = [attachmentLabel, censoredText].filter(Boolean).join("\n");

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

      const baseContextPackage = await buildRichContext(
        profile,
        activeStage,
        completedByStage,
        messagesByStage,
        cofoundersContext,
        text,
        recentSummaries,
        foundryDecisions,
        userId,
        stageProgressDates,
        journalEntries,
        financialSummary
      );
      const ctxPackage = appendArchiveSessionContext(
        appendMarketContext(baseContextPackage, marketReport),
        archiveSession?.stageId === activeStage ? archiveSession : null
      );

      const raw = await streamForgeAPI(
        apiMsgs,
        FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", ctxPackage.context),
        (chunk) => {
          const { cleanText: cleanChunk } = parseForgeResponseWithBookCitations(chunk, ctxPackage.bookMatches);
          onUpdateMessages(activeStage, (msgs) =>
            msgs.map((m) => (m.id === forgeMsg.id ? { ...m, text: cleanChunk } : m))
          );
        }
      );

      const { cleanText, completedIds, advanceReady: ar } = parseForgeResponseWithBookCitations(
        raw,
        ctxPackage.bookMatches
      );

      const nextCompletedMilestones = Array.from(
        new Set([...(completedByStage[activeStage] || []), ...completedIds])
      );
      const remainingMilestones = stage.milestones.filter(
        (milestone) => !nextCompletedMilestones.includes(milestone.id)
      );
      const canAdvanceNow =
        stage.milestones.length > 0 &&
        remainingMilestones.length === 0;

      const redirectedAdvanceText =
        ar && !canAdvanceNow
          ? `${cleanText}\n\nYou are not ready to move on yet. Finish the remaining ${remainingMilestones.length === 1 ? "goal" : "goals"} first: ${remainingMilestones.map((milestone) => `"${milestone.label}"`).join(", ")}.`
          : cleanText;

      onUpdateMessages(activeStage, (msgs) =>
        msgs.map((m) => (m.id === forgeMsg.id ? { ...m, text: redirectedAdvanceText } : m))
      );

      completedIds.forEach((id) => onMilestoneComplete(id));

      if (ar && canAdvanceNow) setAdvanceReady(true);
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
    const currentCompletedMilestones = completedByStage[activeStage] || [];
    const stageIsComplete =
      stage.milestones.length > 0 &&
      currentCompletedMilestones.length >= stage.milestones.length;
    if (!stageIsComplete) {
      setAdvanceReady(false);
      return;
    }
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
        fontFamily: "'Lora', Georgia, serif",
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
              padding: "var(--foundry-forge-header-button-padding)",
              color: "#F0EDE8",
              fontSize: "var(--foundry-forge-header-button-font)",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Icons.forge.chat size={"var(--foundry-forge-header-icon-size)"} /> Hub
          </button>

          <button
            onClick={() => setHubOpen(true)}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding: "var(--foundry-forge-header-menu-padding)",
              color: "#666",
              fontSize: "var(--foundry-forge-header-button-font)",
              cursor: "pointer",
            }}
          >
            <Icons.sidebar.menu size={"var(--foundry-forge-header-icon-size)"} />
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
            className="forge-screen__stage-trigger"
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
            <StageIcon size={"var(--foundry-forge-header-stage-icon-size)"} color={stage.color} />
            <div className="forge-screen__stage-copy" style={{ textAlign: "left" }}>
              <div
                className="forge-screen__stage-title"
                style={{
                  fontSize: "var(--foundry-forge-header-stage-title-font)",
                  fontFamily: "'Lora', Georgia, serif",
                  fontWeight: 600,
                  color: "#F0EDE8",
                  lineHeight: 1.2,
                }}
              >
                Stage {activeStage} — {stage.label}
              </div>
              <div className="forge-screen__stage-meta" style={{ fontSize: "var(--foundry-forge-header-stage-meta-font)", color: "#4CAF8A" }}>
                ● Active · {completionPct}% complete
              </div>
            </div>
            <span className="forge-screen__stage-chevron" style={{ fontSize: "var(--foundry-forge-header-stage-meta-font)", color: "#555", marginLeft: 2 }}><Icons.forge.chat size={"var(--foundry-forge-header-chevron-icon-size)"} /></span>
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
                padding: tab.id === "chat"
                  ? "var(--foundry-forge-header-tab-padding)"
                  : "var(--foundry-forge-header-secondary-tab-padding)",
                borderRadius: 6,
                border: "none",
                background:
                  activeTab === tab.id
                    ? "linear-gradient(135deg, #E8622A, #c9521e)"
                    : "transparent",
                color: activeTab === tab.id ? "#fff" : "#A8A4A0",
                fontSize: tab.id === "chat"
                  ? "var(--foundry-forge-header-tab-font)"
                  : "var(--foundry-forge-header-secondary-tab-font)",
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
            className="forge-screen__content"
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
              maxWidth: "var(--foundry-forge-chat-width)",
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

            {conceptModal && (
              <ConceptModal
                conceptName={conceptModal.name}
                profile={profile}
                activeStage={activeStage}
                onClose={() => setConceptModal(null)}
                onMarkExplored={(name) => {
                  const explored = profile.exploredConcepts || [];
                  if (!explored.find((e: any) => e.concept === name)) {
                    onUpdateProfile({
                      exploredConcepts: [
                        ...explored,
                        {
                          concept: name,
                          stage: activeStage,
                          date: new Date().toLocaleDateString(),
                        },
                      ],
                    });
                  }
                }}
                alreadyExplored={(profile.exploredConcepts || []).some(
                  (e: any) => e.concept === conceptModal.name.toLowerCase().trim()
                )}
                callForgeAPI={callForgeAPI}
                onRelatedConceptTap={(name) => setConceptModal({ name })}
              />
            )}

            {archiveSession?.entry && archiveSession.stageId === activeStage && (
              <div
                style={{
                  background: "rgba(76,175,138,0.05)",
                  border: "1px solid rgba(76,175,138,0.16)",
                  borderRadius: 14,
                  padding: "14px 16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#4CAF8A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
                      Continuing Archive
                    </div>
                    <div style={{ fontSize: 16, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>
                      {getArchiveDisplayTitle(archiveSession.entry.title, archiveSession.entry.summary, "Saved Archive")}
                    </div>
                  </div>
                  <button
                    onClick={() => setArchiveSession(null)}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                      color: "#999",
                      padding: "8px 12px",
                      cursor: "pointer",
                      height: "fit-content",
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}>
                  {getSummaryPreview(archiveSession.entry.summary)}
                </div>
                <div style={{ fontSize: 11, color: "#888", lineHeight: 1.6, marginTop: 10 }}>
                  Ask follow-up questions normally. When you save, this archive card will be updated instead of creating a new one.
                </div>
              </div>
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
                  onConceptTap={(name: string) => setConceptModal({ name })}
                  renderWithBold={(t, sr, gt, ct) => renderWithBold(t, sr, gt, ct, glossaryTerms)}
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

            {loading && messages[messages.length - 1]?.role !== "forge" && messages[messages.length - 1]?.role !== "assistant" && (
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
          <div className="forge-screen__goals" style={{ position: "absolute", inset: 0 }}>
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
          </div>
        )}

        {activeTab === "summaries" && (() => {
          // Build a unified, date-sorted list of all archive entries tagged with source type
          const allForgeEntries: any[] = Object.values(summariesByStage).flat();
          const allEntries = [
            ...allForgeEntries,
            ...bubbleSummaries,
          ].sort((a, b) => {
            const aTime = new Date(a.createdAt || `${a.date}T12:00:00`).getTime();
            const bTime = new Date(b.createdAt || `${b.date}T12:00:00`).getTime();
            return bTime - aTime;
          });

          const hasForge    = allEntries.some((e) => getEntrySourceType(e) === "forge");
          const hasChatroom = allEntries.some((e) => getEntrySourceType(e) === "chatroom");
          const hasAcademy  = allEntries.some((e) => getEntrySourceType(e) === "academy");
          const hasBubble   = allEntries.some((e) => getEntrySourceType(e) === "bubble");
          const hasPitchPractice = allEntries.some((e) => getEntrySourceType(e) === "pitchpractice");

          const filteredEntries = archiveFilter === "all"
            ? allEntries
            : allEntries.filter((e) => getEntrySourceType(e) === archiveFilter);

          type FilterOption = { key: typeof archiveFilter; label: string; color: string; show: boolean };
          const filterOptions: FilterOption[] = [
            { key: "all",      label: "All",             color: "#F0EDE8", show: true },
            { key: "forge",    label: "Forge Sessions",  color: ARCHIVE_SOURCE_CONFIG.forge.color,    show: hasForge },
            { key: "chatroom", label: "Chat with Forge", color: ARCHIVE_SOURCE_CONFIG.chatroom.color, show: hasChatroom },
            { key: "academy",  label: "Academy",         color: ARCHIVE_SOURCE_CONFIG.academy.color,  show: hasAcademy },
            { key: "bubble",   label: "Quick Chat",      color: ARCHIVE_SOURCE_CONFIG.bubble.color,   show: hasBubble },
            { key: "pitchpractice", label: "Pitch Practice", color: ARCHIVE_SOURCE_CONFIG.pitchpractice.color, show: hasPitchPractice },
          ].filter((o) => o.show);

          return (
            <div className="forge-screen__archive" style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "16px", maxWidth: "var(--foundry-forge-chat-width)", width: "100%", margin: "0 auto" }}>
              <div style={{ fontSize: 18, fontFamily: "’Playfair Display’, Georgia, serif", fontWeight: 700, marginBottom: 4 }}>
                Full Archive
              </div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 16, lineHeight: 1.6 }}>
                Saved snapshots of your Forge conversations, chat sessions, and Academy lessons — all in one place.
              </div>

              {/* Filter chips */}
              {allEntries.length > 0 && filterOptions.length > 1 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                  {filterOptions.map((opt) => {
                    const active = archiveFilter === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setArchiveFilter(opt.key)}
                        style={{
                          background: active ? `${opt.color}20` : "rgba(255,255,255,0.04)",
                          border: `1px solid ${active ? opt.color + "50" : "rgba(255,255,255,0.1)"}`,
                          borderRadius: 20,
                          color: active ? opt.color : "rgba(240,237,232,0.45)",
                          fontSize: 11,
                          fontFamily: "’DM Sans’, sans-serif",
                          fontWeight: active ? 700 : 500,
                          padding: "5px 13px",
                          cursor: "pointer",
                          letterSpacing: "0.02em",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Card list */}
              {filteredEntries.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {filteredEntries.map((entry) => renderArchiveCard(entry))}
                </div>
              ) : allEntries.length === 0 ? (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 16px", color: "#888", fontSize: 13, lineHeight: 1.7 }}>
                  No saved archives yet. Use Save Chat from the chat tab whenever you want to store a named snapshot.
                </div>
              ) : (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 16px", color: "#888", fontSize: 13, lineHeight: 1.7 }}>
                  No {filterOptions.find((o) => o.key === archiveFilter)?.label} archives saved yet.
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {summaryModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(4,4,5,0.84)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div style={{ width: "min(720px, 100%)", maxHeight: "85vh", overflowY: "auto", background: "#0E0E10", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "20px 18px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: "#E8622A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
                  {getArchiveDisplayDate(summaryModal.date)}
                </div>
                {editingSummaryTitle ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      value={summaryTitleInput}
                      onChange={(e) => setSummaryTitleInput(e.target.value)}
                      style={{
                        width: "min(420px, 100%)",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        padding: "10px 12px",
                        color: "#F0EDE8",
                        fontSize: 14,
                      }}
                    />
                    <button
                      onClick={handleUpdateSummaryTitle}
                      disabled={updatingSummaryTitle}
                      style={{ background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 10, color: "#fff", padding: "10px 12px", cursor: updatingSummaryTitle ? "default" : "pointer", fontWeight: 600 }}
                    >
                      {updatingSummaryTitle ? "Saving..." : "Save"}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 24, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>
                    {getArchiveDisplayTitle(summaryModal.title, summaryModal.summary, `Saved Archive · ${getArchiveDisplayDate(summaryModal.date)}`)}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {!editingSummaryTitle && renderArchiveActionsMenu(summaryModal, "modal")}
                {editingSummaryTitle && (
                  <button
                    onClick={() => setEditingSummaryTitle(false)}
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#999", padding: "8px 12px", cursor: "pointer", height: "fit-content" }}
                  >
                    Cancel
                  </button>
                )}
                <button
                  onClick={() => setSummaryModal(null)}
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#999", padding: "8px 12px", cursor: "pointer", height: "fit-content" }}
                >
                  Close
                </button>
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "18px 16px", fontSize: 14, color: "#C8C4BE", lineHeight: 1.8, fontFamily: "'Lora', Georgia, serif", textAlign: "left" }}>
              {renderWithBold(getArchiveDisplaySummary(summaryModal.summary), () => { }, () => { })}
            </div>
          </div>
        </div>
      )}

      {saveArchiveModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 85, background: "rgba(4,4,5,0.84)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div style={{ width: "min(520px, 100%)", background: "#0E0E10", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "20px 18px 18px" }}>
            <div style={{ fontSize: 22, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 6 }}>
              {archiveSession?.entry ? "Update Archive" : "Save Chat to Archive"}
            </div>
            <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6, marginBottom: 14 }}>
              {archiveSession?.entry
                ? "This updates the current archive card with the new continuation. The saved date and summary will be refreshed."
                : `This saves the current Stage ${activeStage} chat as a named archive entry and clears the live chat.`}
            </div>
            <div style={{ fontSize: 10, color: "#888", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
              Archive Name
            </div>
            <input
              value={archiveTitleInput}
              onChange={(e) => setArchiveTitleInput(e.target.value)}
              placeholder="Stage 1 Archive — Apr 15, 2026"
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "12px 13px",
                color: "#F0EDE8",
                fontSize: 13,
                marginBottom: 16,
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => !savingArchive && setSaveArchiveModalOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  color: "#999",
                  padding: "10px 12px",
                  cursor: savingArchive ? "default" : "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveArchive}
                disabled={savingArchive || messages.length === 0}
                style={{
                  background: savingArchive || messages.length === 0 ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg, #E8622A, #c9521e)",
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  padding: "10px 14px",
                  cursor: savingArchive || messages.length === 0 ? "default" : "pointer",
                  fontWeight: 600,
                }}
              >
                {savingArchive ? "Saving..." : archiveSession?.entry ? "Update Archive" : "Save Archive"}
              </button>
            </div>
          </div>
        </div>
      )}

      {
        activeTab === "chat" && !showBriefing && !pendingUpgradeStage && (
          <div
            className="forge-screen__composer"
            style={{
              padding: "12px 16px",
              paddingBottom: "max(20px, calc(12px + env(safe-area-inset-bottom)))",
              flexShrink: 0,
              borderTop: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(8,8,9,0.95)",
              maxWidth: "var(--foundry-forge-chat-width)",
              width: "100%",
              alignSelf: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
              <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>
                Save this stage chat to the archive whenever you want. Nothing is archived automatically now.
              </div>
              <button
                onClick={openSaveArchiveModal}
                disabled={loading || savingArchive || messages.length === 0}
                style={{
                  border: "1px solid rgba(232,98,42,0.24)",
                  background: loading || savingArchive || messages.length === 0 ? "rgba(255,255,255,0.04)" : "rgba(232,98,42,0.1)",
                  color: loading || savingArchive || messages.length === 0 ? "#666" : "#E8622A",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 11,
                  cursor: loading || savingArchive || messages.length === 0 ? "default" : "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {savingArchive ? "Saving..." : "Save Chat"}
              </button>
            </div>
            <ChatInput
              value={input}
              onChange={(e) => {
                const nextValue = e.target.value;
                setInput(nextValue);
                if (!nextValue.trim()) {
                  setLanguageWarning(null);
                  setConfirmedProfanityInput(null);
                } else if (confirmedProfanityInput && nextValue.trim() !== confirmedProfanityInput) {
                  setLanguageWarning(null);
                  setConfirmedProfanityInput(null);
                }
              }}
              onValueChange={(v) => {
                setInput(v);
                if (!v.trim()) {
                  setLanguageWarning(null);
                  setConfirmedProfanityInput(null);
                }
              }}
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
              notice={languageWarning}
            />
            <div style={{ fontSize: 10, color: "#2b2b2b", textAlign: "center", marginTop: 4 }}>
              Forge is an AI. Always verify important information before acting on it.
            </div>
          </div>
        )
      }
    </div >
  );
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
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [showJournal, setShowJournal] = useState(false);
  const [briefings, setBriefings] = useState<SavedBriefing[]>([]);
  const [showBriefings, setShowBriefings] = useState(false);
  const [showPitchPractice, setShowPitchPractice] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [documentContext, setDocumentContext] = useState<import("./components/DocumentProductionScreen").DocumentScreenContext | null>(null);
  const [showMarketIntel, setShowMarketIntel] = useState(false);
  const [showCofounder, setShowCofounder] = useState(false);
  const [showAcademy, setShowAcademy] = useState(false);
  const [academyContext, setAcademyContext] = useState<import("./components/ForgeAcademyScreen").AcademyScreenContext | null>(null);
  const [showChatRoom, setShowChatRoom] = useState(false);
  const [settingsView, setSettingsView] = useState<null | "settings" | "privacy" | "eula" | "termsAndConditions" | "acceptableUse" | "disclaimer">(null);
  const [showAdminHub, setShowAdminHub] = useState(false);
  const [showAppTour, setShowAppTour] = useState(false);
  const [showArchivePanel, setShowArchivePanel] = useState(false);
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
  const [chatRoomArchive, setChatRoomArchive] = useState<any | null>(null);
  const [academyConversationEntry, setAcademyConversationEntry] = useState<AcademyTopicLaunch | null>(null);
  const [archiveMutationTick, setArchiveMutationTick] = useState(0);
  const [recentSummaries, setRecentSummaries] = useState<StageSummary[]>([]);
  const [foundryDecisions, setFoundryDecisions] = useState<FounderDecision[]>([]);
  const [stageProgressDates, setStageProgressDates] = useState<Record<number, string>>({});
  const [activeNudge, setActiveNudge] = useState<FounderNudge | null>(null);
  const [journalSeedPrompt, setJournalSeedPrompt] = useState<string | null>(null);
  const [founderSessionState, setFounderSessionState] = useState<FounderSessionState | null>(null);
  const [financialData, setFinancialData] = useState<FounderFinancialData | null>(null);

  const getPersistedPostAuthScreen = (setupCompleted: boolean, sessionLastScreen?: string | null) => {
    const fallback = setupCompleted ? "hub" : "intro";
    const persistedScreen = sessionLastScreen || fallback;

    if (setupCompleted) {
      return persistedScreen === "forge" || persistedScreen === "hub" ? persistedScreen : "hub";
    }

    return persistedScreen === "onboarding" ? "onboarding" : "intro";
  };

  const financialSummary = useMemo(
    () => (profile ? getFinancialSummary(profile, financialData) : null),
    [profile, financialData]
  );

  const buildProfileWithFinancialMirror = (baseProfile: any, nextFinancialData: FounderFinancialData | null) => {
    if (!baseProfile || !nextFinancialData) return baseProfile;
    const summary = getFinancialSummary(baseProfile, nextFinancialData);
    const legacyMirror = buildLegacyFinancialMirror(
      Array.isArray(nextFinancialData.expenses) ? nextFinancialData.expenses : [],
      Array.isArray(nextFinancialData.revenue) ? nextFinancialData.revenue : [],
    );
    return {
      ...baseProfile,
      budget: {
        ...baseProfile.budget,
        expenses: legacyMirror.expenses,
        income: legacyMirror.income,
        totalIncome: summary.totalRevenue,
        spent: summary.totalExpenses,
        remaining: summary.availableCash,
        runway: summary.runwayMonths != null ? `${summary.runwayMonths.toFixed(1)} months` : "TBD",
      },
    };
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
    setShowChatRoom(false);
    setShowAcademy(false);
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
    setChatRoomArchive(null);
    setAcademyConversationEntry(null);
    setRecentSummaries([]);
    setFoundryDecisions([]);
    setStageProgressDates({});
    setActiveNudge(null);
    setJournalSeedPrompt(null);
    setFounderSessionState(null);
    setFinancialData(null);
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
      const [dbProfile, dbProgress, dbMessages, dbJournal, dbBriefings, dbMarket, dbNotificationPreferences, dbNotifications, dbBillingSubscription, dbRecentSummaries, dbFoundryDecisions, dbStageProgressDates, dbActiveNudge, dbFounderSessionState] = await Promise.all([
        loadProfile(uid),
        loadAllStageProgress(uid),
        loadAllMessages(uid),
        loadJournalEntries(uid),
        loadBriefings(uid),
        loadLatestMarketReport(uid),
        loadNotificationPreferences(uid),
        loadNotifications(uid),
        loadBillingSubscription(uid),
        loadRecentSummaries(uid, 30),
        loadDecisions(uid, 30),
        loadStageProgressDates(uid),
        loadActiveNudge(uid),
        getFounderSessionState(uid),
      ]);
      const dbFinancialData = await loadFounderFinancialData(uid, dbProfile);

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
        const resolvedProfileWithFinancials = buildProfileWithFinancialMirror(resolvedProfile, dbFinancialData);

        console.debug("[AdminHub] loadData resolved profile", {
          authUserEmail: authEmail,
          profileEmail: resolvedProfileWithFinancials.email ?? null,
          profileRole: resolvedProfileWithFinancials.role ?? null,
          ownerFallback,
        });

        setProfile(resolvedProfileWithFinancials);
        setCompletedByStage(dbProgress);
        setMessagesByStage(dbMessages);
        setJournalEntries(dbJournal);
        setBriefings(dbBriefings);
        setNotificationPreferences(dbNotificationPreferences);
        setNotifications(dbNotifications);
        setMarketReport(dbMarket ?? null);
        setRecentSummaries(dbRecentSummaries);
        setFoundryDecisions(dbFoundryDecisions);
        setStageProgressDates(dbStageProgressDates);
        setFounderSessionState(dbFounderSessionState);
        setFinancialData(dbFinancialData);
        // Load or generate a proactive nudge
        const resolvedStage = dbProfile?.currentStage ?? 1;
        const nudge = dbActiveNudge ?? await generateNudgeIfNeeded(
          uid,
          resolvedStage,
          dbRecentSummaries,
          dbFoundryDecisions,
          dbProgress,
          dbStageProgressDates,
          null,
          dbJournal
        );
        if (!cancelled) setActiveNudge(nudge);
        // Load and ensure account access record
        const access = await ensureAccountAccess(uid);
        setAccountAccess(access);
        setBillingSubscription(dbBillingSubscription);
        // Update activity + sync email for admin dashboard
        updateUserActivity(uid, authEmail ?? undefined);
        setScreen(getPersistedPostAuthScreen(true, dbFounderSessionState?.lastScreen ?? null));
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
          const resolvedProfileWithFinancials = buildProfileWithFinancialMirror(resolvedProfile, dbFinancialData);
          console.debug("[AdminHub] loadData unresolved setup profile", {
            authUserEmail: authEmail,
            profileEmail: resolvedProfileWithFinancials.email ?? null,
            profileRole: resolvedProfileWithFinancials.role ?? null,
            ownerFallback,
          });
          setProfile(resolvedProfileWithFinancials);
        }
        setNotificationPreferences(dbNotificationPreferences);
        setNotifications(dbNotifications);
        setBillingSubscription(dbBillingSubscription);
        setFounderSessionState(dbFounderSessionState);
        setFinancialData(dbFinancialData);
        setScreen(getPersistedPostAuthScreen(false, dbFounderSessionState?.lastScreen ?? null));
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
    if (screen === s) return;
    setScreen(s);
    if (!user?.id || !dataLoaded) return;
    setFounderSessionState((prev) => prev ? { ...prev, lastScreen: s } : {
      userId: user.id,
      lastSeenAt: null,
      lastScreen: s,
      weeklyJournalSummary: null,
      weeklyJournalSummaryGeneratedAt: null,
      updatedAt: new Date().toISOString(),
    });
    void updateLastScreen(user.id, s);
  };

  const updateProfile = (updates) => {
    // When a new decision is prepended to profile.decisions, also persist it
    // to founder_decisions so longitudinal memory has a timestamped record.
    if (Array.isArray(updates.decisions) && user?.id) {
      const current = profile?.decisions || [];
      if (updates.decisions.length > current.length) {
        const newest = updates.decisions[0];
        const tag = typeof newest === "string" ? null : (newest.tag ?? null);
        const text = typeof newest === "string" ? newest : newest.text;
        const stageId = profile?.currentStage ?? 1;
        saveDecision(user.id, stageId, tag, text).then(saved => {
          if (saved) setFoundryDecisions(prev => [saved, ...prev]);
        });
      }
    }
    setProfile(p => ({ ...p, ...updates }));
  };

  const refreshFinancialData = async () => {
    if (!user?.id) return null;
    const nextFinancialData = await loadFounderFinancialData(user.id, profile);
    setFinancialData(nextFinancialData);
    setProfile((prev) => prev ? buildProfileWithFinancialMirror(prev, nextFinancialData) : prev);
    return nextFinancialData;
  };

  const handleSaveExpense = async (input: {
    label: string;
    amount: number;
    category?: string;
    incurredOn?: string | null;
    frequency?: "one_time" | "monthly" | "yearly";
    renewalDate?: string | null;
    notes?: string | null;
  }) => {
    if (!user?.id) return null;
    const saved = await saveExpense(user.id, input);
    if (!saved) return null;
    await refreshFinancialData();
    markMeaningfulActivity(true);
    return saved;
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!user?.id) return false;
    const ok = await deleteExpense(user.id, expenseId);
    if (!ok) return false;
    await refreshFinancialData();
    markMeaningfulActivity(true);
    return true;
  };

  const handleSaveRevenue = async (input: {
    label: string;
    amount: number;
    category?: string;
    receivedOn?: string | null;
    frequency?: "one_time" | "monthly" | "yearly";
    renewalDate?: string | null;
    notes?: string | null;
  }) => {
    if (!user?.id) return null;
    const saved = await saveRevenue(user.id, input);
    if (!saved) return null;
    await refreshFinancialData();
    markMeaningfulActivity(true);
    return saved;
  };

  const handleDeleteRevenue = async (revenueId: string) => {
    if (!user?.id) return false;
    const ok = await deleteRevenue(user.id, revenueId);
    if (!ok) return false;
    await refreshFinancialData();
    markMeaningfulActivity(true);
    return true;
  };

  const handleSaveFinancialSettings = async (updates: { startingCash?: number | null }) => {
    if (!user?.id) return null;
    const saved = await saveFinancialSettings(user.id, {
      ...financialData?.settings,
      ...updates,
    });
    if (!saved) return null;
    await refreshFinancialData();
    markMeaningfulActivity(true);
    return saved;
  };

  const handlePlaidConnected = async () => {
    await refreshFinancialData();
    markMeaningfulActivity(true);
  };

  const handleSyncPlaidTransactions = async (plaidItemId: string) => {
    if (!plaidItemId) return null;
    const result = await syncPlaidTransactions(plaidItemId);
    await refreshFinancialData();
    markMeaningfulActivity(true);
    return result;
  };

  const handleAcceptPlaidTransactionAsExpense = async (transaction: PlaidReviewTransaction) => {
    if (!user?.id) return null;
    const accepted = await acceptPlaidTransactionAsExpense(user.id, transaction);
    if (!accepted) return null;
    await refreshFinancialData();
    markMeaningfulActivity(true);
    return accepted;
  };

  const handleAcceptPlaidTransactionAsRevenue = async (transaction: PlaidReviewTransaction) => {
    if (!user?.id) return null;
    const accepted = await acceptPlaidTransactionAsRevenue(user.id, transaction);
    if (!accepted) return null;
    await refreshFinancialData();
    markMeaningfulActivity(true);
    return accepted;
  };

  const handleIgnorePlaidTransaction = async (transactionId: string) => {
    if (!user?.id) return false;
    const ok = await ignorePlaidTransaction(user.id, transactionId);
    if (!ok) return false;
    await refreshFinancialData();
    markMeaningfulActivity(true);
    return true;
  };

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

  const handleDismissNudge = () => {
    if (!activeNudge || !user?.id) return;
    dismissNudge(user.id, activeNudge.id);
    setActiveNudge(null);
  };

  const handleActOnNudge = () => {
    if (!activeNudge || !user?.id) return;
    markNudgeActedOn(user.id, activeNudge.id);
    setActiveNudge(null);
  };

  const handleGreetingOpen = () => {
    if (!activeNudge || !user?.id) return;
    markNudgeSeen(user.id, activeNudge.id);
  };

  const handleAskForgeAboutJournal = (entryContent: string) => {
    const seedText = `I want to talk through something I wrote in my journal: ${entryContent.trim().slice(0, 200)}${entryContent.trim().length > 200 ? "..." : ""}`;
    setJournalSeedPrompt(seedText);
    setShowJournal(false);
    openForge(null);
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
        supabase.from("founder_financial_accounts").delete().eq("user_id", user.id),
        supabase.from("founder_expenses").delete().eq("user_id", user.id),
        supabase.from("founder_revenue").delete().eq("user_id", user.id),
        supabase.from("founder_financial_settings").delete().eq("user_id", user.id),
        supabase.from("founder_profit_buckets").delete().eq("user_id", user.id),
        supabase.from("plaid_items").delete().eq("user_id", user.id),
        supabase.from("plaid_transactions").delete().eq("user_id", user.id),
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
  const isFreeTier = isFreeTierAccess(accountAccess);
  const pitchPracticeTrialUses = Math.max(0, Number(profile?.pitchPracticeTrialUses) || 0);
  const pitchPracticeUsesRemaining = isFreeTier
    ? Math.max(0, FREE_TIER_PITCH_PRACTICE_LIMIT - pitchPracticeTrialUses)
    : null;
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

  const handleProfileSave = async (updates: { displayName: string; businessName: string; marketFocus: string }) => {
    if (!user?.id) return;
    const next = { ...profile, name: updates.displayName, businessName: updates.businessName, industry: updates.marketFocus };
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

  const openFeatureUpgrade = (message: string) => {
    setBillingMessage(message);
    setPaywallStage(Math.max(2, profile?.currentStage || 2));
  };

  const openBriefings = () => {
    markMeaningfulActivity();
    setShowBriefings(true);
  };

  const openPitchPractice = () => {
    markMeaningfulActivity();
    if (isFreeTier && pitchPracticeTrialUses >= FREE_TIER_PITCH_PRACTICE_LIMIT) {
      openFeatureUpgrade("Free-tier founders can use Pitch Practice three times. Unlock paid access to keep rehearsing with Forge.");
      return;
    }
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

  const openAcademy = () => {
    markMeaningfulActivity();
    setAcademyConversationEntry(null);
    setShowAcademy(true);
  };

  const handleConsumePitchPracticeTrialUse = () => {
    if (!isFreeTier) return;
    updateProfile({ pitchPracticeTrialUses: pitchPracticeTrialUses + 1 });
  };

  const openAcademyAskForgeAnything = () => {
    markMeaningfulActivity();
    setAcademyConversationEntry(null);
    setShowAcademy(false);
    setChatRoomArchive(null);
    setShowChatRoom(true);
  };

  const openChatRoom = () => {
    markMeaningfulActivity();
    setAcademyConversationEntry(null);
    setChatRoomArchive(null);
    setShowChatRoom(true);
  };

  const launchAcademyConversation = (entry: AcademyTopicLaunch) => {
    markMeaningfulActivity(true);
    setAcademyConversationEntry(entry);
    setChatRoomArchive(null);
    setShowAcademy(false);
    setShowChatRoom(true);
  };

  const handleMarkAcademyLessonCompleted = async (
    contentId: string,
    options?: {
      knowledgeCheckedAt?: string;
      lastCheckResponse?: string | null;
      lastCheckFeedback?: string | null;
    }
  ) => {
    const activeUserId = (user as any)?.id as string | undefined;
    if (!activeUserId) return;

    await completeAcademyLesson({
      userId: activeUserId,
      contentId,
      contentTitle: academyConversationEntry?.id === contentId ? academyConversationEntry.title : null,
      response: options?.lastCheckResponse ?? null,
      feedback: options?.lastCheckFeedback ?? null,
      completedAt: options?.knowledgeCheckedAt ?? new Date().toISOString(),
      source: "forge_chat",
    });
  };

  const continueArchiveInChatRoom = (entry: any) => {
    markMeaningfulActivity();
    setAcademyConversationEntry(null);
    setChatRoomArchive(entry);
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
          <div style={{ fontSize: 12, color: "#5B5650", fontFamily: "'Lora', Georgia, serif", letterSpacing: "0.1em" }}>Loading your workspace...</div>
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
          fontFamily: "'Lora', Georgia, serif", color: "#F0EDE8", textAlign: "center",
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
              setShowAppTour(true);
            }}
            callForgeAPI={callForgeAPI}
            renderWithBold={renderWithBold}
          />
        )}
        {screen === "hub" && profile && (
          <HubScreen
            profile={profile}
            marketReport={marketReport}
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
            onOpenAcademy={openAcademy}
            onOpenSettings={openSettings}
            onOpenAdminHub={() => setShowAdminHub(true)}
            isAdmin={canOpenAdminHub}
            accessSummary={accessSummary}
            onOpenUpgrade={() => requestUpgrade(Math.max(2, profile.currentStage || 2))}
            onOpenArchive={() => setShowArchivePanel(true)}
            activeNudge={activeNudge}
            onDismissNudge={handleDismissNudge}
            onActOnNudge={handleActOnNudge}
            financialData={financialData}
            financialSummary={financialSummary}
            onSaveExpense={handleSaveExpense}
            onDeleteExpense={handleDeleteExpense}
            onSaveRevenue={handleSaveRevenue}
            onDeleteRevenue={handleDeleteRevenue}
            onSaveFinancialSettings={handleSaveFinancialSettings}
            onPlaidConnected={handlePlaidConnected}
            onSyncPlaidTransactions={handleSyncPlaidTransactions}
            onAcceptPlaidTransactionAsExpense={handleAcceptPlaidTransactionAsExpense}
            onAcceptPlaidTransactionAsRevenue={handleAcceptPlaidTransactionAsRevenue}
            onIgnorePlaidTransaction={handleIgnorePlaidTransaction}
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
            initialLastSeenAt={founderSessionState?.lastSeenAt ?? null}
            onRequestUpgrade={(stage: number) => setPaywallStage(stage)}
            onDowngradeToFree={() => revertToStage(1)}
            onContinueArchiveInChatRoom={continueArchiveInChatRoom}
            onBubbleSummaryUpdated={(entry) => {
              setBubbleSummaries((prev) => prev.map((item) => item.id === entry.id ? entry : item));
              setArchiveMutationTick((tick) => tick + 1);
            }}
            onBubbleSummaryDeleted={(entry) => {
              setBubbleSummaries((prev) => prev.filter((item) => item.id !== entry.id));
              setArchiveMutationTick((tick) => tick + 1);
            }}
            archiveMutationTick={archiveMutationTick}
            recentSummaries={recentSummaries}
            foundryDecisions={foundryDecisions}
            stageProgressDates={stageProgressDates}
            onGreetingOpen={handleGreetingOpen}
            journalEntries={journalEntries}
            journalSeedPrompt={journalSeedPrompt}
            onJournalSeedUsed={() => setJournalSeedPrompt(null)}
            financialSummary={financialSummary}
          />
        )}
      </div>
      {showAppTour && (
        <AppTourScreen
          profileName={profile?.name}
          onComplete={() => setShowAppTour(false)}
        />
      )}
      {showArchivePanel && user && (
        <ArchivePanel
          userId={(user as any).id}
          onBack={() => setShowArchivePanel(false)}
          onContinueChatEntry={(entry) => {
            setShowArchivePanel(false);
            continueArchiveInChatRoom(entry);
          }}
        />
      )}
      {showMarketIntel && profile && user && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#080809", overflowY: "auto" }}>
          <MarketIntelligenceScreen
            profile={profile}
            userId={(user as any).id}
            report={marketReport}
            onReportChange={setMarketReport}
            onBack={() => setShowMarketIntel(false)}
            generationLimit={isFreeTier ? FREE_TIER_MARKET_REPORT_LIMIT : null}
          />
        </div>
      )}
      {showDocuments && profile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#080809", overflowY: "auto" }}>
          <DocumentProductionScreen
            userId={(user as any).id}
            profile={profile}
            onBack={() => setShowDocuments(false)}
            onContextChange={setDocumentContext}
            generationLocked={isFreeTier}
            generationLockMessage={isFreeTier ? "Document Production stays browseable during Stage 1, but document generation unlocks once you move beyond the free idea-stage tier." : null}
          />
        </div>
      )}
      {showPitchPractice && profile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#080809", overflowY: "auto" }}>
          <PitchPracticeScreen
            userId={(user as any).id}
            profile={profile}
            onBack={() => setShowPitchPractice(false)}
            trialUsesRemaining={pitchPracticeUsesRemaining}
            onConsumeTrialUse={handleConsumePitchPracticeTrialUse}
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
          onAskForge={handleAskForgeAboutJournal}
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
          generationLimit={isFreeTier ? FREE_TIER_BRIEFING_LIMIT : null}
          recentSummaries={recentSummaries}
          foundryDecisions={foundryDecisions}
          journalEntries={journalEntries}
          activeNudge={activeNudge}
          stageProgressDates={stageProgressDates}
        />
      )}
      {showAcademy && profile && user && (
        <ForgeAcademyScreen
          userId={(user as any).id}
          profile={profile}
          onBack={() => setShowAcademy(false)}
          onLaunchForgeConversation={launchAcademyConversation}
          onOpenAskForgeAnything={openAcademyAskForgeAnything}
          onContextChange={setAcademyContext}
          onOpenArchive={() => setShowArchivePanel(true)}
          maxPreviewStage={isFreeTier ? FREE_TIER_ACADEMY_STAGE_LIMIT : null}
          trialNotice={isFreeTier ? "Free preview includes Forge Academy Stage 1 lessons only. The rest of Academy unlocks with paid access." : null}
        />
      )}
      {showChatRoom && profile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#080809" }}>
          <ForgeChatRoom
            userId={(user as any).id}
            profile={profile}
            initialArchive={chatRoomArchive}
            academyEntry={academyConversationEntry}
            onMarkAcademyLessonCompleted={handleMarkAcademyLessonCompleted}
            onBack={() => {
              const returnToAcademy = Boolean(academyConversationEntry);
              setShowChatRoom(false);
              setChatRoomArchive(null);
              setAcademyConversationEntry(null);
              if (returnToAcademy) {
                setShowAcademy(true);
              }
            }}
            onArchiveSaved={(saved) => {
              setBubbleSummaries((prev) => {
                const exists = prev.some((item) => item.id === saved.id);
                if (exists) {
                  return prev.map((item) => item.id === saved.id ? saved : item);
                }
                return prev;
              });
              setArchiveMutationTick((tick) => tick + 1);
            }}
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
                        : showAcademy ? "academy"
                        : showChatRoom ? "chatRoom"
                          : settingsView ? "settings"
                            : screen
          }
          screenContext={showDocuments ? documentContext : showAcademy ? academyContext : null}
          onBubbleSummaryAdded={(summary) => setBubbleSummaries(prev => [summary, ...prev])}
        />
      )}
    </>
  );
}

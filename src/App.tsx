import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import AuthScreen from "./AuthScreen";
import JournalScreen from "./JournalScreen";
import BriefingsScreen from "./BriefingsScreen";
import {
  loadProfile, saveProfile,
  loadAllStageProgress, saveStageProgress,
  loadAllMessages, saveMessages,
  loadJournalEntries, saveJournalEntry, deleteJournalEntry,
  loadBriefings, saveBriefing
} from "./db";
import { GLOBAL_STYLES } from "./constants/styles";
import { FORGE_SYSTEM_PROMPT, FOUNDRY_METHOD } from "./constants/prompts";
import { STAGES_DATA } from "./constants/stages";
import { applyGlossaryHighlights } from "./lib/applyGlossaryHighlights";
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

// API HELPERS
// ─────────────────────────────────────────────────────────────
async function callForgeAPI(messages, systemPrompt) {
  const res = await fetch("/api/forge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.map((b) => b.text || "").join("") || "Something went wrong.";
}

async function streamForgeAPI(messages, systemPrompt, onChunk) {
  const res = await fetch("/api/forge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      stream: true,
      system: systemPrompt,
      messages,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
          fullText += parsed.delta.text;
          onChunk(fullText);
        }
      } catch { /* skip */ }
    }
  }
  return fullText || "Something went wrong.";
}

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

async function buildRichContext(profile, activeStage, completedByStage, messagesByStage) {
  const stageData = STAGES_DATA[activeStage - 1];
  const completedMilestones = completedByStage[activeStage] || [];

  const pending = stageData.milestones
    .filter(m => !completedMilestones.includes(m.id))
    .map(m => `- ${m.id}: "${m.label}"`).join("\n");
  const done = stageData.milestones
    .filter(m => completedMilestones.includes(m.id))
    .map(m => `{isComplete ? <Icons.ui.check size={18} /> : <StageIcon size={18} color={isCurrent ? stage.color : "#888"} />} ${m.label}`).join("\n");

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

STAGE REFERENCES: When referencing work from another stage, wrap it like [STAGE_REF:N]text[/STAGE_REF]. Use naturally when prior work is relevant — not on every mention.${methodSection}
  `.trim();
}

function buildContext(profile, stage = null, completedMilestones = []) {
  const stageData = stage ? STAGES_DATA[stage - 1] : null;
  const pending = stageData
    ? stageData.milestones.filter(m => !completedMilestones.includes(m.id)).map(m => `- ${m.id}: "${m.label}"`).join("\n")
    : "";
  const done = stageData
    ? stageData.milestones.filter(m => completedMilestones.includes(m.id)).map(m => `{isComplete ? <Icons.ui.check size={18} /> : <StageIcon size={18} color={isCurrent ? stage.color : "#888"} />} ${m.label}`).join("\n")
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


function renderWithBold(text, onStageRef, onGlossaryTap) {
  if (!text) return null;

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

  const renderTextWithBold = (segment, keyPrefix) => {
    const boldParts = segment.split(/(\*\*.*?\*\*)/g);

    return boldParts.map((part, i) => {
      const key = `${keyPrefix}-${i}`;

      if (part.startsWith("**") && part.endsWith("**")) {
        const inner = part.slice(2, -2);
        return (
          <strong key={key} style={{ color: "#F0EDE8", fontWeight: 700 }}>
            {applyGlossaryHighlights(inner, onGlossaryTap)}
          </strong>
        );
      }

      return (
        <span key={key}>
          {applyGlossaryHighlights(part, onGlossaryTap)}
        </span>
      );
    });
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
  profile,
  onBack,
  onUpdateProfile,
  completedByStage,
  onMilestoneComplete,
  onAdvance,
  messagesByStage,
  onUpdateMessages,
  isFirstVisit = false,
  initialStage = null,
}) {
  const [activeStage, setActiveStage] = useState(initialStage || profile.currentStage);
  const [activeTab, setActiveTab] = useState("chat");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [advanceReady, setAdvanceReady] = useState(false);
  const [showStageSelector, setShowStageSelector] = useState(false);
  const [stageRefModal, setStageRefModal] = useState(null);
  const [glossaryModal, setGlossaryModal] = useState(null);

  const stage = STAGES_DATA[activeStage - 1];
  const StageIcon = stage.icon;
  const messages = messagesByStage[activeStage] || [];
  const completedMilestones = completedByStage[activeStage] || [];
  const completionPct = Math.round(
    (completedMilestones.length / stage.milestones.length) * 100
  );

  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distFromBottom < 120) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  useEffect(() => {
    setActiveTab("chat");
    setAdvanceReady(false);
  }, [activeStage]);

  useEffect(() => {
    const stageMessages = messagesByStage[activeStage] || [];
    if (stageMessages.length > 0 || loading) return;

    const stageData = STAGES_DATA[activeStage - 1];
    const lastSeenRaw = localStorage.getItem("foundry_last_seen");
    const lastSeen = lastSeenRaw ? parseInt(lastSeenRaw) : null;
    const hoursSince = lastSeen ? (Date.now() - lastSeen) / 1000 / 60 / 60 : null;
    const isLongAbsence = !lastSeen || hoursSince > 8;

    localStorage.setItem("foundry_last_seen", Date.now().toString());

    const runGreeting = async () => {
      const ctx = await buildRichContext(
        profile,
        activeStage,
        completedByStage,
        messagesByStage
      );

      let greetingPrompt = "";

      if (isFirstVisit && activeStage === 1) {
        greetingPrompt = `${profile.name} just finished onboarding and is entering Stage 1 for the first time. Their idea: "${profile.idea}". Experience: ${profile.experience}. Budget: $${profile.budget?.total?.toLocaleString() || "unknown"}. Strategy: ${profile.strategyLabel}.

Open with a warm, direct, personal greeting — reference something specific about their idea that signals you actually read it. Then pivot immediately to Stage 1's core question: is the problem real. Ask one sharp question to kick things off — something that gets at whether actual people have this problem right now. Use **bold** on 2-3 key words. Keep it to 3-4 tight paragraphs.`;
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
        onUpdateMessages(activeStage, [{ role: "forge", text: reply }]);
      } catch {
        const fallback =
          isFirstVisit && activeStage === 1
            ? `${profile.name} — welcome to Foundry.

Stage 1 is where we find out if the problem you're solving is real enough that people will pay for it. That's the most important question in business.

Who, specifically, has the problem you're solving?`
            : `${profile.name} — Stage ${activeStage}: ${stageData.label}.

${stageData.mission}

Where do you want to start?`;

        onUpdateMessages(activeStage, [{ role: "forge", text: fallback }]);
      }

      setLoading(false);
    };

    setTimeout(runGreeting, 400);
  }, [activeStage, !!messagesByStage[activeStage]?.length]);

  const send = async () => {
    if (!input.trim() || loading) return;

    const text = input.trim();
    setInput("");

    const userMsg = { role: "user", text };
    const forgeMsg = { role: "forge", text: "", id: Date.now() };
    const current = messagesByStage[activeStage] || [];

    onUpdateMessages(activeStage, [...current, userMsg]);
    setLoading(true);

    await new Promise((r) => setTimeout(r, 300));
    onUpdateMessages(activeStage, [...current, userMsg, forgeMsg]);

    try {
      const allMsgs = [...current, userMsg];
      const apiMsgs = allMsgs.map((m) => ({
        role: m.role === "forge" ? "assistant" : "user",
        content: m.text,
      }));

      const ctx = await buildRichContext(
        profile,
        activeStage,
        completedByStage,
        messagesByStage
      );

      const raw = await streamForgeAPI(
        apiMsgs,
        FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", ctx),
        (chunk) => {
          onUpdateMessages(activeStage, (msgs) =>
            msgs.map((m) => (m.id === forgeMsg.id ? { ...m, text: chunk } : m))
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

  const handleAdvance = (newStage) => {
    onAdvance(newStage);
    setActiveStage(newStage);
    setAdvanceReady(false);
  };

  const showBriefing = messages.length === 0 && !loading;

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
          }}
        >
          {[
            { id: "chat", label: "Chat" },
            { id: "milestones", label: `Goals ${completedMilestones.length}/${stage.milestones.length}` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background:
                  activeTab === tab.id
                    ? "linear-gradient(135deg, #E8622A, #c9521e)"
                    : "transparent",
                color: activeTab === tab.id ? "#fff" : "#A8A4A0",
                fontSize: 11,
                cursor: "pointer",
                fontWeight: activeTab === tab.id ? 600 : 400,
                transition: "all 0.15s",
                whiteSpace: "nowrap",
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
              setLoading(true);
              setTimeout(() => {
                setLoading(false);
                onUpdateMessages(activeStage, [
                  { role: "forge", text: stage.forgeOpener(profile.name) },
                ]);
              }, 1200);
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

            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id || i}
                msg={msg}
                onStageRef={(id) => setStageRefModal(id)}
                onGlossaryTap={(term, entry) => setGlossaryModal({ term, entry })}
                renderWithBold={renderWithBold}
              />
            ))}

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
                  {isComplete ? <Icons.ui.check size={18} /> : <StageIcon size={18} color={isCurrent ? stage.color : "#888"} />} Forge says you're ready to advance
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

            <div style={{ height: 80 }} />
          </div>
        )}

        {activeTab === "milestones" && (
          <MilestonesPanel
            stage={stage}
            stageId={activeStage}
            completedMilestones={completedMilestones}
            advanceReady={advanceReady}
            onAdvance={handleAdvance}
            onSwitchToChat={() => setActiveTab("chat")}
            onClose={() => setActiveTab("chat")}
          />
        )}
      </div>

      {
        activeTab === "chat" && !showBriefing && (
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
            />
          </div>
        )
      }
    </div >
  );
}

// ─────────────────────────────────────────────────────────────
// PERSISTENCE LAYER
// ─────────────────────────────────────────────────────────────
const STORAGE_KEYS = {
  profile: "foundry_profile",
  completedByStage: "foundry_completed",
  messagesByStage: "foundry_messages",
  screen: "foundry_screen",
};

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
  const [completedByStage, setCompletedByStage] = useState({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });
  const [messagesByStage, setMessagesByStage] = useState({ 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });

  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [screen, setScreen] = useState("loading");
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [initialStage, setInitialStage] = useState(null);
  const [journalEntries, setJournalEntries] = useState([]);
  const [showJournal, setShowJournal] = useState(false);
  const [briefings, setBriefings] = useState([]);
  const [showBriefings, setShowBriefings] = useState(false);

  // ── Auth listener ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Load all data from Supabase when user logs in ──
  useEffect(() => {
    if (!user) { setDataLoaded(false); return; }

    let cancelled = false;

    const loadData = async () => {
      const [dbProfile, dbProgress, dbMessages, dbJournal, dbBriefings] = await Promise.all([
        loadProfile(user.id),
        loadAllStageProgress(user.id),
        loadAllMessages(user.id),
        loadJournalEntries(user.id),
        loadBriefings(user.id),
      ]);

      if (cancelled) return;

      if (dbProfile) {
        setProfile(dbProfile);
        setCompletedByStage(dbProgress);
        setMessagesByStage(dbMessages);
        setJournalEntries(dbJournal);
        setBriefings(dbBriefings);
        setScreen("hub");
      } else {
        setScreen("intro");
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

  const handleAdvance = (newStage) => {
    updateProfile({ currentStage: newStage });
    setInitialStage(newStage);
  };

  const openForge = (stageId = null) => {
    setInitialStage(stageId);
    setIsFirstVisit(false);
    setScreenPersisted("forge");
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
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem("foundry_last_seen");
    window.location.reload();
  };

  // ── Auth not yet checked ──
  if (!authChecked) {
    return (
      <div style={{ background: "#080809", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 32 }}>🔥</div>
      </div>
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
      <div style={{ background: "#080809", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 32 }}>🔥</div>
        <div style={{ fontSize: 12, color: "#444", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.1em" }}>Loading your workspace...</div>
      </div>
    );
  }

  // ── Logged in and data ready ──
  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div style={{ background: "#080809", minHeight: "100vh", minHeight: "-webkit-fill-available" }}>
        {screen === "intro" && <CinematicIntro onComplete={() => setScreen("onboarding")} />}
        {screen === "onboarding" && (
          <OnboardingScreen onComplete={p => {
            onComplete = { handleCompleteOnboarding };
            callForgeAPI = { callForgeAPI };
            renderWithBold = { renderWithBold };
            setProfile(p);
            setIsFirstVisit(true);
            setInitialStage(1);
            setScreenPersisted("forge");

          }} />
        )}
        {screen === "hub" && profile && (
          <HubScreen
            profile={profile}
            onUpdateProfile={updateProfile}
            onEnterStage={id => openForge(id)}
            onOpenForge={() => openForge(null)}
            completedByStage={completedByStage}
            onReset={handleReset}
            onOpenJournal={() => setShowJournal(true)}
            onOpenBriefings={() => setShowBriefings(true)}
          />
        )}
        {screen === "forge" && profile && (
          <ForgeScreen
            key="forge"
            profile={profile}
            onBack={() => { setIsFirstVisit(false); setInitialStage(null); setScreenPersisted("hub"); }}
            onUpdateProfile={updateProfile}
            completedByStage={completedByStage}
            onMilestoneComplete={handleMilestoneComplete}
            onAdvance={handleAdvance}
            messagesByStage={messagesByStage}
            onUpdateMessages={handleUpdateMessages}
            isFirstVisit={isFirstVisit}
            initialStage={initialStage}
          />
        )}
      </div>
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
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { deliverMessage } from "../lib/deliverMessage";
import {
    ONBOARDING_STEPS,
    STAGE_ASSESSMENT_CARDS,
    EXPERIENCE_CARDS,
    BUDGET_CARDS,
    STRATEGY_CARDS,
} from "../constants/onboarding";
import { FORGE_SYSTEM_PROMPT } from "../constants/prompts";
import { STAGES_DATA } from "../constants/stages";
import MessageBubble from "./MessageBubble";
import ForgeAvatar from "./ForgeAvatar";
import TypingDots from "./TypingDots";
import ChatInput from "./ChatInput";
import Logo from "./Logo";



// ─────────────────────────────────────────────────────────────
// ONBOARDING SCREEN
// ─────────────────────────────────────────────────────────────
export default function OnboardingScreen({ onComplete, callForgeAPI, renderWithBold }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [profile, setProfile] = useState({
        name: "",
        idea: "",
        experience: "",
        budget: "",
        budgetAmount: 0,
        strategy: "",
        strategyLabel: "",
        detectedStage: 1,
    });
    const [cardSelection, setCardSelection] = useState(null);
    const [started, setStarted] = useState(false);
    const [readyToEnter, setReadyToEnter] = useState(false);
    const [completedProfile, setCompletedProfile] = useState(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distFromBottom < 120) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }, [messages, loading, readyToEnter]);

    const OPENER = `Hey. I'm **Forge** — your business partner inside Foundry.\n\nI'm not here to give you generic advice or walk you through a template. I'm here to help you build something **real** — from the first idea all the way to a business that runs without you losing sleep over it.\n\nBefore we get into it, I want to know a few things about you. Not a form. Just a conversation.\n\nWhat's your name?`;

    useEffect(() => {
        if (!started) {
            setStarted(true);
            deliverMessage(OPENER, setLoading, (text) =>
                setMessages([{ role: "forge", text }])
            );
        }
    }, [started]);

    const addForgeMsg = (text) => setMessages(m => [...m, { role: "forge", text }]);
    const addUserMsg = (text) => setMessages(m => [...m, { role: "user", text }]);
    const currentStep = ONBOARDING_STEPS[stepIndex];

    const processInput = async (value, rawId = null) => {
        addUserMsg(value);
        const p = { ...profile };

        if (currentStep.id === "name") {
            p.name = value; setProfile(p);
            const prompt = `Respond in 2 sentences only. First: greet "${value}" — warm, natural, one sentence. Second: tell them Foundry meets founders where they actually are, and you want to find the right starting point — they'll see some options now.`;
            try {
                const r = await callForgeAPI([{ role: "user", content: prompt }], FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", "Onboarding."));
                await deliverMessage(r, setLoading, addForgeMsg);
            } catch {
                await deliverMessage(`${value} — good to meet you. Foundry works best when we start you in the right place — tell me where you are right now.`, setLoading, addForgeMsg);
            }
            setStepIndex(1);

        } else if (currentStep.id === "stage_assessment") {
            const card = STAGE_ASSESSMENT_CARDS.find(c => c.id === rawId);
            const detectedStage = card?.stage || 1;
            p.detectedStage = detectedStage; setProfile(p);
            const stageLabel = STAGES_DATA[detectedStage - 1]?.label || "Idea";
            const prompt = `Respond in 2 sentences only. First: acknowledge "${card?.label || value}" in a way that shows you understand where they are in the journey — be specific, not generic. Second: ask what their business idea or current business is.`;
            try {
                const r = await callForgeAPI([{ role: "user", content: prompt }], FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", `Onboarding. Founder: ${p.name}. Starting stage: ${detectedStage} (${stageLabel}).`));
                await deliverMessage(r, setLoading, addForgeMsg);
            } catch {
                await deliverMessage(`Stage ${detectedStage} — ${stageLabel}. That's where we'll start.\n\nWhat's the business? Tell me what you're building.`, setLoading, addForgeMsg);
            }
            setStepIndex(2);

        } else if (currentStep.id === "idea") {
            p.idea = value; setProfile(p);
            const prompt = `Respond in 2 sentences only. First: react to "${value}" specifically — one genuine observation about this type of business, not generic encouragement. Second: tell them you want to understand their background before going further, and that they'll see some options to pick from.`;
            try {
                const r = await callForgeAPI([{ role: "user", content: prompt }], FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", `Onboarding. Founder: ${p.name}. Idea: ${p.idea}.`));
                await deliverMessage(r, setLoading, addForgeMsg);
            } catch {
                await deliverMessage(`A meal prep business — there's real demand there, especially with how time-strapped people are. How much experience do you have in business or in this industry?`, setLoading, addForgeMsg);
            }
            setStepIndex(3);

        } else if (currentStep.id === "experience") {
            p.experience = value; setProfile(p);
            const prompt = `Respond in 2 sentences only. First: acknowledge "${value}" in one specific sentence that shows you understand what that experience level means for building a business — not generic. Second: ask about their budget in a casual, direct way.`;
            try {
                const r = await callForgeAPI([{ role: "user", content: prompt }], FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", `Onboarding. ${p.name}. Idea: ${p.idea}. Experience: ${p.experience}.`));
                await deliverMessage(r, setLoading, addForgeMsg);
            } catch {
                await deliverMessage(`Got it — that combination of industry knowledge without formal business experience is actually common for the best founders. What's your starting budget?`, setLoading, addForgeMsg);
            }
            setStepIndex(4);

        } else if (currentStep.id === "budget") {
            const card = BUDGET_CARDS.find(c => c.id === rawId);
            p.budget = card?.label || value;
            p.budgetAmount = card?.amount || 0;
            setProfile(p);
            const prompt = `Respond in 2 sentences only. First: acknowledge "${p.budget}" in one sentence — honest, practical, not over-enthusiastic. Second: tell them the last question is about how they want to approach building this, and they'll see some options.`;
            try {
                const r = await callForgeAPI([{ role: "user", content: prompt }], FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", `Onboarding. ${p.name}. Idea: ${p.idea}. Budget: ${p.budget}.`));
                await deliverMessage(r, setLoading, addForgeMsg);
            } catch {
                await deliverMessage(`${p.budget} — that's a workable foundation. Last question: how do you want to approach this?`, setLoading, addForgeMsg);
            }
            setStepIndex(5);

        } else if (currentStep.id === "strategy") {
            const card = STRATEGY_CARDS.find(c => c.id === rawId);
            p.strategy = rawId || value;
            p.strategyLabel = card?.label || value;
            setProfile(p);

            const context = `Founder: ${p.name} | Idea: ${p.idea} | Experience: ${p.experience} | Budget: ${p.budget} | Strategy: ${p.strategyLabel} | Starting Stage: ${p.detectedStage || 1} (${STAGES_DATA[(p.detectedStage || 1) - 1]?.label})`;
            const startStage = p.detectedStage || 1;
            const startStageLabel = STAGES_DATA[startStage - 1]?.label || "Idea";
            const prompt = `Onboarding is complete. Give a personalized opening assessment in 3-4 short paragraphs. Reference their specific idea, budget, experience level, strategy mode, and the fact that we're starting them at Stage ${startStage}: ${startStageLabel}. Be direct and specific — not generic. If there's real potential in what they're building, name it specifically. If there's a common pitfall for this type of idea or stage, call it out. Explain in one sentence why Stage ${startStage} is the right starting point for them given where they are. Use **bold** on 2-3 key words. End with just the word "Ready?" on its own line — nothing after it.`;

            try {
                const r = await callForgeAPI([{ role: "user", content: prompt }], FORGE_SYSTEM_PROMPT.replace("{CONTEXT}", context));
                await deliverMessage(r, setLoading, addForgeMsg);
            } catch {
                await deliverMessage(`Alright ${p.name} — we have what we need. Let's build something real.\n\nReady?`, setLoading, addForgeMsg);
            }

            setStepIndex(6);
            setCompletedProfile({
                ...p,
                businessName: "",
                currentStage: p.detectedStage || 1,
                budget: {
                    total: p.budgetAmount,
                    spent: 0,
                    remaining: p.budgetAmount,
                    runway: "calculating...",
                    income: [{ source: p.budget, amount: p.budgetAmount }],
                    expenses: [],
                },
                decisions: [],
            });
            setReadyToEnter(true);
        }
    };

    const handleSubmit = async () => {
        if (!input.trim() || loading) return;
        const val = input.trim(); setInput("");
        await processInput(val);
    };

    const handleCard = async (cardId) => {
        if (loading) return;
        setCardSelection(cardId);
        const label =
            currentStep.id === "stage_assessment" ? STAGE_ASSESSMENT_CARDS.find(c => c.id === cardId)?.label || cardId
                : currentStep.id === "experience" ? EXPERIENCE_CARDS.find(c => c.id === cardId)?.label || cardId
                    : currentStep.id === "budget" ? BUDGET_CARDS.find(c => c.id === cardId)?.label || cardId
                        : STRATEGY_CARDS.find(c => c.id === cardId)?.label || cardId;
        setTimeout(() => { setCardSelection(null); processInput(label, cardId); }, 350);
    };

    const showCards = currentStep?.cards && !loading && !readyToEnter;
    const showInput = !currentStep?.cards && stepIndex < 6 && !readyToEnter;

    return (
        <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Logo variant="flame" style={{ width: 20, height: 20, objectFit: "contain" }} />
                    <span style={{ fontSize: 18, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700 }}>Foundry</span>
                </div>
                {stepIndex > 0 && (
                    <div style={{ display: "flex", gap: 6 }}>
                        {[0, 1, 2, 3, 4, 5].map(i => (
                            <div key={i} style={{ width: i < stepIndex ? 18 : 6, height: 6, borderRadius: 3, background: i < stepIndex ? "linear-gradient(90deg, #E8622A, #F5A843)" : "rgba(255,255,255,0.12)", transition: "all 0.4s ease" }} />
                        ))}
                    </div>
                )}
            </div>

            <div
                ref={scrollRef}
                style={{
                    flex: 1,
                    overflowY: "auto",
                    WebkitOverflowScrolling: "touch",
                    padding: "20px 16px 140px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                    maxWidth: 680,
                    width: "100%",
                    margin: "0 auto",
                }}
            >
                {messages.map((msg, i) => (
                    <MessageBubble
                        key={msg.id || i}
                        msg={msg}
                        renderWithBold={renderWithBold}
                    />
                ))}

                {loading && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <ForgeAvatar size={32} />
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

                {showCards && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: 42, animation: "fadeSlideUp 0.5s ease" }}>
                        {currentStep.id === "stage_assessment" && STAGE_ASSESSMENT_CARDS.map(card => (
                            <button key={card.id} onClick={() => handleCard(card.id)} style={{ background: cardSelection === card.id ? "rgba(232,98,42,0.15)" : "rgba(255,255,255,0.02)", border: cardSelection === card.id ? "1px solid rgba(232,98,42,0.6)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    {(() => { const CardIcon = card.icon; return <CardIcon size={20} color="#C8C4BE" />; })()}
                                    <div>
                                        <div style={{ fontSize: 14, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 2 }}>{card.label}</div>
                                        <div style={{ fontSize: 12, color: "#888" }}>{card.sub}</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                        {currentStep.id === "experience" && EXPERIENCE_CARDS.map(card => (
                            <button key={card.id} onClick={() => handleCard(card.id)} style={{ background: cardSelection === card.id ? "rgba(232,98,42,0.15)" : "rgba(255,255,255,0.02)", border: cardSelection === card.id ? "1px solid rgba(232,98,42,0.6)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    {(() => { const CardIcon = card.icon; return <CardIcon size={20} color="#C8C4BE" />; })()}
                                    <div>
                                        <div style={{ fontSize: 14, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 2 }}>{card.label}</div>
                                        <div style={{ fontSize: 12, color: "#888" }}>{card.sub}</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                        {currentStep.id === "budget" && BUDGET_CARDS.map(card => (
                            <button key={card.id} onClick={() => handleCard(card.id)} style={{ background: cardSelection === card.id ? "rgba(232,98,42,0.15)" : "rgba(255,255,255,0.02)", border: cardSelection === card.id ? "1px solid rgba(232,98,42,0.6)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    {(() => { const CardIcon = card.icon; return <CardIcon size={20} color="#C8C4BE" />; })()}
                                    <div>
                                        <div style={{ fontSize: 14, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 2 }}>{card.label}</div>
                                        <div style={{ fontSize: 12, color: "#888" }}>{card.sub}</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                        {currentStep.id === "strategy" && STRATEGY_CARDS.map(card => (
                            <button key={card.id} onClick={() => handleCard(card.id)} style={{ background: cardSelection === card.id ? "rgba(232,98,42,0.15)" : "rgba(255,255,255,0.02)", border: cardSelection === card.id ? "1px solid rgba(232,98,42,0.6)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "18px 20px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                    {(() => { const CardIcon = card.icon; return <CardIcon size={24} color="#C8C4BE" />; })()}
                                    <div>
                                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 6 }}>{card.label}</div>
                                        <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>{card.desc}</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {readyToEnter && completedProfile && (
                    <div style={{ marginLeft: 42, animation: "fadeSlideUp 0.6s ease 0.4s both", opacity: 0 }}>
                        <button
                            onClick={() => onComplete(completedProfile)}
                            style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, cursor: "pointer", boxShadow: "0 8px 32px rgba(232,98,42,0.35)", transition: "all 0.2s ease" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(232,98,42,0.5)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(232,98,42,0.35)"; }}
                        >
                            Enter Foundry →
                        </button>
                    </div>
                )}
            </div>

            {showInput && (
                <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "16px 16px max(24px, calc(12px + env(safe-area-inset-bottom)))", background: "linear-gradient(to top, rgba(8,8,9,1) 60%, transparent)", zIndex: 20 }}>
                    <div style={{ maxWidth: 680, margin: "0 auto" }}>
                        <ChatInput
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onSend={handleSubmit}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                            loading={loading}
                            placeholder={stepIndex === 0 ? "Type your name..." : stepIndex === 2 ? "Tell me about your idea..." : "Type your response..."}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

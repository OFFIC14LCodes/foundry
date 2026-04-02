import { useEffect, useState } from "react";
import { STAGES_DATA } from "../constants/stages";
import { STAGE_COLORS } from "../constants/glossary";
import { TAG_COLORS } from "../constants/styles";
import { Icons } from "../icons";

export default function HubScreen({
    profile,
    onUpdateProfile,
    onEnterStage,
    onOpenForge,
    onReset,
    onOpenJournal,
    onOpenBriefings,
    onOpenPitchPractice,
    onOpenDocuments,
    onOpenMarketIntel,
}) {
    const [showDecisionModal, setShowDecisionModal] = useState(false);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [decisionText, setDecisionText] = useState("");
    const [decisionTag, setDecisionTag] = useState("Strategy");
    const [expenseLabel, setExpenseLabel] = useState("");
    const [expenseAmount, setExpenseAmount] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const addDecision = () => {
        if (!decisionText.trim()) return;

        onUpdateProfile({
            decisions: [
                { text: decisionText.trim(), tag: decisionTag, date: "Today" },
                ...(profile.decisions || []),
            ],
        });

        setDecisionText("");
        setDecisionTag("Strategy");
        setShowDecisionModal(false);
    };

    const addExpense = () => {
        const amt = parseFloat(expenseAmount);
        if (!expenseLabel.trim() || isNaN(amt) || amt <= 0) return;

        const newExpenses = [
            ...(profile.budget?.expenses || []),
            { label: expenseLabel.trim(), amount: amt, date: "Today" },
        ];

        const newSpent = (profile.budget?.spent || 0) + amt;
        const newRemaining = (profile.budget?.total || 0) - newSpent;

        onUpdateProfile({
            budget: {
                ...profile.budget,
                expenses: newExpenses,
                spent: newSpent,
                remaining: newRemaining,
            },
        });

        setExpenseLabel("");
        setExpenseAmount("");
        setShowExpenseModal(false);
    };

    const currentStage = profile.currentStage || 1;
    const spentPct = profile.budget?.total
        ? Math.min((profile.budget.spent / profile.budget.total) * 100, 100)
        : 0;

    const NAV_ITEMS = [
        {
            icon: Icons.sidebar.journal,
            label: "Founder's Journal",
            sub: "Private writing space",
            action: () => {
                setSidebarOpen(false);
                onOpenJournal();
            },
            available: true,
        },
        {
            icon: Icons.sidebar.briefings,
            label: "Monday Briefings",
            sub: "Weekly Forge updates",
            action: () => {
                setSidebarOpen(false);
                onOpenBriefings();
            },
            available: true,
        },
        {
            icon: Icons.sidebar.pitchPractice,
            label: "Pitch Practice",
            sub: "Simulate investor meetings",
            action: () => {
                setSidebarOpen(false);
                onOpenPitchPractice();
            },
            available: true,
        },
        {
            icon: Icons.sidebar.documents,
            label: "Document Production",
            sub: "Professional documents",
            action: () => {
                setSidebarOpen(false);
                onOpenDocuments();
            },
            available: true,
        },
        {
            icon: Icons.sidebar.marketIntel,
            label: "Market Intelligence",
            sub: "Daily industry briefing",
            action: () => {
                setSidebarOpen(false);
                onOpenMarketIntel();
            },
            available: true,
        },
        {
            icon: Icons.sidebar.voice,
            label: "Voice Mode",
            sub: "Talk to Forge out loud",
            action: null,
            available: false,
        },
        {
            icon: Icons.sidebar.cofounder,
            label: "Co-Founder Mode",
            sub: "Shared workspace",
            action: null,
            available: false,
        },
    ];


    return (
        <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8" }}>
            {sidebarOpen && (
                <div
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 40,
                        background: "rgba(0,0,0,0.6)",
                        backdropFilter: "blur(4px)",
                        animation: "fadeIn 0.2s ease",
                    }}
                />
            )}

            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: 280,
                    zIndex: 50,
                    background: "#0C0C0E",
                    borderRight: "1px solid rgba(255,255,255,0.08)",
                    transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
                    transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1)",
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                }}
            >
                <div
                    style={{
                        padding: "max(20px, calc(14px + env(safe-area-inset-top))) 16px 16px",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 14,
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 18 }}>🔥</span>
                            <span
                                style={{
                                    fontSize: 15,
                                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                                    fontWeight: 700,
                                    color: "#F0EDE8",
                                }}
                            >
                                Foundry
                            </span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            style={{
                                background: "rgba(255,255,255,0.05)",
                                border: "none",
                                borderRadius: 6,
                                padding: "5px 10px",
                                color: "#555",
                                fontSize: 12,
                                cursor: "pointer",
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    <div
                        style={{
                            fontSize: 13,
                            fontFamily: "'Lora', Georgia, serif",
                            color: "#C8C4BE",
                            fontWeight: 500,
                        }}
                    >
                        {profile.name}
                    </div>
                    <div
                        style={{
                            fontSize: 11,
                            color: "#555",
                            marginTop: 2,
                            fontStyle: "italic",
                        }}
                    >
                        {profile.businessName || profile.idea?.slice(0, 40) || "Your business"}
                    </div>
                </div>

                <div style={{ padding: "12px 10px", flex: 1 }}>
                    <div
                        style={{
                            fontSize: 9,
                            color: "#444",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            padding: "4px 8px 10px",
                        }}
                    >
                        Features
                    </div>

                    {NAV_ITEMS.map((item, i) => {
                        const Icon = item.icon;

                        return (
                            <button
                                key={i}
                                onClick={item.available && item.action ? item.action : undefined}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "10px 10px",
                                    borderRadius: 10,
                                    border: "none",
                                    background: "transparent",
                                    cursor: item.available ? "pointer" : "default",
                                    opacity: item.available ? 1 : 0.35,
                                    transition: "background 0.15s",
                                    marginBottom: 2,
                                    textAlign: "left",
                                }}
                                onMouseEnter={(e) => {
                                    if (item.available) {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "transparent";
                                }}
                            >
                                <div
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 9,
                                        background: item.available
                                            ? "rgba(232,98,42,0.12)"
                                            : "rgba(255,255,255,0.04)",
                                        border: item.available
                                            ? "1px solid rgba(232,98,42,0.2)"
                                            : "1px solid rgba(255,255,255,0.06)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                    }}
                                >
                                    <Icon size={16} />
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            color: item.available ? "#F0EDE8" : "#666",
                                            fontWeight: 500,
                                            lineHeight: 1.2,
                                            marginBottom: 2,
                                        }}
                                    >
                                        {item.label}
                                    </div>
                                    <div style={{ fontSize: 10, color: "#444" }}>
                                        {item.available ? item.sub : "Coming soon"}
                                    </div>
                                </div>

                                {item.available && <span style={{ fontSize: 10, color: "#555" }}>→</span>}
                            </button>
                        );
                    })}

                    <div style={{ padding: "12px 10px 24px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <button
                            onClick={onReset}
                            style={{
                                width: "100%",
                                padding: "9px",
                                background: "transparent",
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: 8,
                                color: "#444",
                                fontSize: 11,
                                cursor: "pointer",
                            }}
                        >
                            Reset Account
                        </button>
                    </div>
                </div>
            </div>

            <div
                style={{
                    padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    position: "sticky",
                    top: 0,
                    background: "rgba(8,8,9,0.95)",
                    backdropFilter: "blur(12px)",
                    zIndex: 10,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 8,
                            padding: "6px 10px",
                            color: "#888",
                            fontSize: 16,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        ☰
                    </button>

                    <div>
                        <div
                            style={{
                                fontSize: 16,
                                fontFamily: "'Cormorant Garamond', Georgia, serif",
                                fontWeight: 700,
                                color: "#F0EDE8",
                            }}
                        >
                            Foundry
                        </div>
                        <div style={{ fontSize: 10, color: "#555" }}>Hub · {profile.name}</div>
                    </div>
                </div>

                <button
                    onClick={onOpenForge}
                    style={{
                        background: "linear-gradient(135deg, #E8622A, #c9521e)",
                        border: "none",
                        borderRadius: 10,
                        padding: "8px 16px",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontFamily: "'DM Sans', sans-serif",
                    }}
                >
                    <Icons.forge.chat size={14} /> Talk to Forge
                </button>
            </div>

            <div style={{ padding: "16px", maxWidth: 680, margin: "0 auto", paddingBottom: 60 }}>
                <div
                    style={{
                        marginBottom: 16,
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? "translateY(0)" : "translateY(8px)",
                        transition: "all 0.5s ease",
                    }}
                >
                    <div
                        style={{
                            fontSize: 22,
                            fontFamily: "'Cormorant Garamond', Georgia, serif",
                            fontWeight: 700,
                            color: "#F0EDE8",
                            lineHeight: 1.2,
                            marginBottom: 4,
                        }}
                    >
                        Welcome back, {profile.name}
                    </div>
                    <div
                        style={{
                            fontSize: 13,
                            color: "#666",
                            fontFamily: "'Lora', Georgia, serif",
                            fontStyle: "italic",
                        }}
                    >
                        {profile.businessName || profile.idea?.slice(0, 50) || "Your business"}
                    </div>
                </div>

                <div
                    style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 16,
                        padding: "14px 16px",
                        marginBottom: 14,
                        animation: "fadeSlideUp 0.5s ease 0.1s both",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 12,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 15,
                                fontFamily: "'Lora', Georgia, serif",
                                fontWeight: 600,
                                color: "#F0EDE8",
                            }}
                        >
                            Your Journey
                        </div>
                        <div style={{ fontSize: 11, color: "#E8622A" }}>
                            Stage {currentStage} of 6
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                        {STAGES_DATA.map((stage) => {
                            const isComplete = stage.id < currentStage;
                            const isCurrent = stage.id === currentStage;
                            const StageIcon = stage.icon;

                            return (
                                <div
                                    key={stage.id}
                                    onClick={() => stage.id <= currentStage && onEnterStage(stage.id)}
                                    style={{
                                        flex: 1,
                                        cursor: stage.id <= currentStage ? "pointer" : "default",
                                        textAlign: "center",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: "100%",
                                            aspectRatio: "1",
                                            maxWidth: 44,
                                            margin: "0 auto 5px",
                                            borderRadius: 10,
                                            fontSize: 16,
                                            background: isComplete
                                                ? "linear-gradient(135deg, #E8622A, #c9521e)"
                                                : isCurrent
                                                    ? "rgba(232,98,42,0.15)"
                                                    : "rgba(255,255,255,0.03)",
                                            border: isCurrent ? "1px solid rgba(232,98,42,0.5)" : "none",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        {isComplete ? "✓" : <StageIcon size={18} color={isCurrent ? stage.color : "#888"} />}
                                    </div>

                                    <div
                                        style={{
                                            fontSize: 9,
                                            color: isCurrent ? "#E8622A" : isComplete ? "#666" : "#333",
                                            fontWeight: isCurrent ? 600 : 400,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.05em",
                                        }}
                                    >
                                        {stage.label}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ marginTop: 4, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                        <div
                            style={{
                                height: "100%",
                                width: `${((currentStage - 1) / 5) * 100}%`,
                                background: "linear-gradient(90deg, #E8622A, #F5A843)",
                                borderRadius: 2,
                                transition: "width 1s ease",
                            }}
                        />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <div style={{ fontSize: 11, color: "#555" }}>
                            {Math.round(((currentStage - 1) / 5) * 100)}% complete
                        </div>
                        <div
                            onClick={() => onEnterStage(currentStage)}
                            style={{ fontSize: 11, color: "#E8622A", cursor: "pointer" }}
                        >
                            Continue Stage {currentStage} →
                        </div>
                    </div>
                </div>
                {/* Budget */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 14, animation: "fadeSlideUp 0.5s ease 0.25s both" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Budget</div>
                        <button onClick={() => setShowExpenseModal(true)} style={{ background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.25)", borderRadius: 8, padding: "4px 12px", color: "#E8622A", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>+ Expense</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                        {[
                            { label: "Total", value: `$${(profile.budget?.total || 0).toLocaleString()}`, color: "#F0EDE8" },
                            { label: "Spent", value: `$${(profile.budget?.spent || 0).toLocaleString()}`, color: "#E8622A" },
                            { label: "Remaining", value: `$${(profile.budget?.remaining || 0).toLocaleString()}`, color: "#4CAF8A" },
                        ].map(item => (
                            <div key={item.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px", textAlign: "center" }}>
                                <div style={{ fontSize: "clamp(14px, 4vw, 20px)", fontFamily: "'Lora', Georgia, serif", fontWeight: 700, color: item.color, lineHeight: 1, marginBottom: 3 }}>{item.value}</div>
                                <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase" }}>{item.label}</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${spentPct}%`, background: spentPct > 75 ? "linear-gradient(90deg, #E85A2A, #FF4444)" : "linear-gradient(90deg, #E8622A, #F5A843)", borderRadius: 3, transition: "width 1s ease" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                        <div style={{ fontSize: 10, color: "#555" }}>{spentPct.toFixed(0)}% spent</div>
                        <div style={{ fontSize: 10, color: "#555" }}>Runway: {profile.budget?.runway || "TBD"}</div>
                    </div>
                    {profile.budget?.expenses?.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Recent Expenses</div>
                            {profile.budget.expenses.slice(0, 4).map((exp, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                                    <div style={{ fontSize: 12, color: "#888" }}>{exp.label}</div>
                                    <div style={{ fontSize: 12, color: "#E8622A", fontFamily: "'Lora', Georgia, serif", fontWeight: 600 }}>-${exp.amount?.toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Glossary learned */}
                {(profile.glossaryLearned || []).length > 0 && (
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, animation: "fadeSlideUp 0.5s ease 0.32s both" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Icons.glossary.book size={14} />
                                <span>Your Glossary</span>
                            </div>
                            <div style={{ fontSize: 11, color: "#4CAF8A" }}>{(profile.glossaryLearned || []).length} terms learned</div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {(profile.glossaryLearned || []).map((item, i) => {
                                const color = STAGE_COLORS[item.stage] || "#E8622A";
                                return <div key={i} style={{ fontSize: 11, color, background: `${color}12`, border: `1px solid ${color}25`, borderRadius: 20, padding: "3px 10px", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{item.term}</div>;
                            })}
                        </div>
                        {(profile.glossaryLearned || []).length >= 5 && (
                            <div style={{ fontSize: 11, color: "#555", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", marginTop: 10 }}>You're building real business literacy. Keep going.</div>
                        )}
                    </div>
                )}

                {/* Decisions */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "14px 16px", animation: "fadeSlideUp 0.5s ease 0.3s both" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8" }}>Decisions</div>
                        <button onClick={() => setShowDecisionModal(true)} style={{ background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.25)", borderRadius: 8, padding: "4px 12px", color: "#E8622A", fontSize: 11, cursor: "pointer", fontWeight: 500 }}>+ Log Decision</button>
                    </div>
                    {(!profile.decisions || profile.decisions.length === 0) ? (
                        <div style={{ fontSize: 13, color: "#444", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>No decisions logged yet. Every call you make deliberately is worth recording.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {profile.decisions.slice(0, 4).map((d, i) => {
                                const dec = typeof d === "string" ? { text: d, tag: "Strategy", date: "Recent" } : d;
                                return (
                                    <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                            <div style={{ fontSize: 12, color: "#C8C4BE", lineHeight: 1.5, flex: 1 }}>{dec.text}</div>
                                            {dec.tag && <div style={{ fontSize: 10, color: TAG_COLORS[dec.tag]?.text || "#888", background: TAG_COLORS[dec.tag]?.bg || "rgba(255,255,255,0.06)", borderRadius: 20, padding: "2px 8px", flexShrink: 0 }}>{dec.tag}</div>}
                                        </div>
                                        <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>{dec.date}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Decision modal */}
            {showDecisionModal && (
                <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }} onClick={() => setShowDecisionModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 22, animation: "fadeSlideUp 0.3s ease" }}>
                        <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 16 }}>Log a Decision</div>
                        <textarea value={decisionText} onChange={e => setDecisionText(e.target.value)} placeholder="What did you decide and why?" rows={3} autoFocus style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, boxSizing: "border-box" }} />
                        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                            {Object.keys(TAG_COLORS).map(t => (
                                <button key={t} onClick={() => setDecisionTag(t)} style={{ padding: "4px 12px", borderRadius: 20, border: "none", background: decisionTag === t ? TAG_COLORS[t].bg : "rgba(255,255,255,0.04)", color: decisionTag === t ? TAG_COLORS[t].text : "#555", fontSize: 11, cursor: "pointer" }}>{t}</button>
                            ))}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                            <button onClick={() => setShowDecisionModal(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#555", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                            <button onClick={addDecision} style={{ flex: 2, padding: "10px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}>Save Decision</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Expense modal */}
            {showExpenseModal && (
                <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.2s ease" }} onClick={() => setShowExpenseModal(false)}>
                    <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: "#0E0E10", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 22, animation: "fadeSlideUp 0.3s ease" }}>
                        <div style={{ fontSize: 17, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 16 }}>Log an Expense</div>
                        <input value={expenseLabel} onChange={e => setExpenseLabel(e.target.value)} placeholder="What was it for?" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 10, boxSizing: "border-box" }} />
                        <input value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Amount ($)" type="number" style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", marginBottom: 16, boxSizing: "border-box" }} />
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setShowExpenseModal(false)} style={{ flex: 1, padding: "10px", background: "transparent", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#555", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                            <button onClick={addExpense} style={{ flex: 2, padding: "10px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 10, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Lora', Georgia, serif" }}>Save Expense</button>
                        </div>
                    </div>
                </div>
            )}
        </div>

    )
}
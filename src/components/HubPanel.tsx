import { STAGES_DATA } from "../constants/stages";

// ─────────────────────────────────────────────────────────────
// HUB PANEL (slide-in)
// ─────────────────────────────────────────────────────────────
export default function HubPanel({ profile, currentStage, completedByStage, open, onClose }) {
    return (
        <>
            {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }} />}
            <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 280, zIndex: 40, background: "#0E0E10", borderRight: "1px solid rgba(255,255,255,0.08)", transform: open ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span>🔥</span>
                            <span style={{ fontSize: 15, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, color: "#F0EDE8" }}>Hub</span>
                        </div>
                        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 6, padding: "6px 12px", color: "#666", fontSize: 11, cursor: "pointer" }}>✕</button>
                    </div>
                    <div style={{ fontSize: 16, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, color: "#F0EDE8", lineHeight: 1.2 }}>{profile.businessName || (profile.idea?.slice(0, 28) + "...") || "Your Business"}</div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>{profile.strategyLabel}</div>
                </div>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Budget</div>
                    <div style={{ fontSize: 22, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#4CAF8A" }}>${(profile.budget?.remaining || 0).toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: "#555", marginBottom: 8 }}>remaining of ${(profile.budget?.total || 0).toLocaleString()}</div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${profile.budget?.total ? (profile.budget.remaining / profile.budget.total) * 100 : 0}%`, background: "linear-gradient(90deg, #4CAF8A, #48BB78)", borderRadius: 2 }} />
                    </div>
                </div>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Journey</div>
                    <div style={{ display: "flex", gap: 4 }}>
                        {STAGES_DATA.map(s => <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: s.id < currentStage ? "linear-gradient(90deg, #E8622A, #F5A843)" : s.id === currentStage ? "rgba(232,98,42,0.4)" : "rgba(255,255,255,0.06)" }} />)}
                    </div>
                    <div style={{ fontSize: 11, color: "#888", fontFamily: "'Lora', Georgia, serif", marginTop: 8 }}>Stage {currentStage} — {STAGES_DATA[currentStage - 1]?.label}</div>
                </div>
                {profile.decisions?.length > 0 && (
                    <div style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Recent Decisions</div>
                        {profile.decisions.slice(0, 3).map((d, i) => (
                            <div key={i} style={{ fontSize: 11, color: "#777", padding: "5px 0", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.04)" : "none", lineHeight: 1.4 }}>
                                — {typeof d === "string" ? d : d.text}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

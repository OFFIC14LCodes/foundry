import { STAGES_DATA } from "../constants/stages";
import Logo from "./Logo";

// ─────────────────────────────────────────────────────────────
// HUB PANEL (slide-in)
// ─────────────────────────────────────────────────────────────
export default function HubPanel({ profile, currentStage, completedByStage, open, onClose }) {
    const isStageGoalsComplete = (stage) =>
        stage.milestones.length > 0 &&
        (completedByStage[stage.id] || []).length >= stage.milestones.length;
    const isStageDoneInJourney = (stage) => stage.id < currentStage || isStageGoalsComplete(stage);

    return (
        <>
            {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(7,26,47,0.34)", backdropFilter: "blur(4px)", animation: "fadeIn 0.2s ease" }} />}
            <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 280, zIndex: 40, background: "var(--color-surface)", borderRight: "1px solid rgba(7,26,47,0.08)", transform: open ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
                <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid rgba(7,26,47,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <Logo variant="flame" style={{ width: 16, height: 16, objectFit: "contain" }} />
                            <span style={{ fontSize: 15, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, color: "var(--color-text)" }}>Hub</span>
                        </div>
                        <button onClick={onClose} style={{ background: "rgba(7,26,47,0.06)", border: "none", borderRadius: 6, padding: "6px 12px", color: "var(--foundry-text-secondary)", fontSize: 11, cursor: "pointer" }}>✕</button>
                    </div>
                    <div style={{ fontSize: 16, fontFamily: "var(--tekori-font-brand)", fontWeight: 700, color: "var(--color-text)", lineHeight: 1.2 }}>{profile.businessName || (profile.idea?.slice(0, 28) + "...") || "Your Business"}</div>
                    <div style={{ fontSize: 11, color: "var(--foundry-text-muted)", marginTop: 3 }}>{profile.strategyLabel}</div>
                </div>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(7,26,47,0.06)" }}>
                    <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Budget</div>
                    <div style={{ fontSize: 22, fontFamily: "var(--tekori-font-ui)", fontWeight: 600, color: "var(--color-success)" }}>${(profile.budget?.remaining || 0).toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", marginBottom: 8 }}>remaining of ${(profile.budget?.total || 0).toLocaleString()}</div>
                    <div style={{ height: 3, background: "rgba(7,26,47,0.06)", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${profile.budget?.total ? (profile.budget.remaining / profile.budget.total) * 100 : 0}%`, background: "linear-gradient(90deg, var(--color-success), var(--color-success))", borderRadius: 2 }} />
                    </div>
                </div>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(7,26,47,0.06)" }}>
                    <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Journey</div>
                    <div style={{ display: "flex", gap: 4 }}>
                        {STAGES_DATA.map(s => {
                            const isDone = isStageDoneInJourney(s);
                            return <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: isDone ? "linear-gradient(90deg, var(--tekori-gold), var(--tekori-amber))" : s.id === currentStage ? "rgba(216,155,43,0.4)" : "rgba(7,26,47,0.06)" }} />;
                        })}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--tekori-font-ui)", marginTop: 8 }}>Stage {currentStage} — {STAGES_DATA[currentStage - 1]?.label}</div>
                </div>
                {profile.decisions?.length > 0 && (
                    <div style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 10, color: "var(--foundry-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Recent Decisions</div>
                        {profile.decisions.slice(0, 3).map((d, i) => (
                            <div key={i} style={{ fontSize: 11, color: "var(--foundry-text-muted)", padding: "5px 0", borderBottom: i < 2 ? "1px solid rgba(7,26,47,0.04)" : "none", lineHeight: 1.4 }}>
                                — {typeof d === "string" ? d : d.text}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

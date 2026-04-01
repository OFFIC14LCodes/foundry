// ─────────────────────────────────────────────────────────────
// MILESTONES PANEL
// ─────────────────────────────────────────────────────────────
export default function MilestonesPanel({
    stage,
    completedMilestones,
    onClose,
    onSwitchToChat,
    advanceReady,
    onAdvance,
    stageId,
}) {
    const completionPct = Math.round(
        (completedMilestones.length / stage.milestones.length) * 100
    );
    const StageIcon = stage.icon;

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                background: "#080809",
                zIndex: 5,
                display: "flex",
                flexDirection: "column",
                animation: "fadeIn 0.2s ease",
                overflowY: "auto",
            }}
        >
            <div
                style={{
                    padding: "18px 20px 12px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    flexShrink: 0,
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
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 15,
                            fontFamily: "'Lora', Georgia, serif",
                            fontWeight: 600,
                            color: "#F0EDE8",
                        }}
                    >
                        <StageIcon size={16} color={stage.color} />
                        <span>Stage {stageId} Goals</span>
                    </div>

                    <div style={{ fontSize: 12, color: "#E8622A", fontWeight: 600 }}>
                        {completionPct}% complete
                    </div>
                </div>

                <div
                    style={{
                        height: 4,
                        background: "rgba(255,255,255,0.06)",
                        borderRadius: 2,
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            height: "100%",
                            width: `${completionPct}%`,
                            background: "linear-gradient(90deg, #E8622A, #F5A843)",
                            borderRadius: 2,
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
                                background: "rgba(0,0,0,0.4)",
                            }}
                        />
                    ))}
                </div>

                <div style={{ fontSize: 11, color: "#555", marginTop: 6 }}>
                    {completedMilestones.length} of {stage.milestones.length} milestones
                    complete
                </div>
            </div>

            <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto" }}>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        marginBottom: 20,
                    }}
                >
                    {stage.milestones.map((m, i) => {
                        const done = completedMilestones.includes(m.id);

                        return (
                            <div
                                key={m.id}
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 12,
                                    padding: "11px 12px",
                                    background: done
                                        ? "rgba(76,175,138,0.06)"
                                        : "rgba(255,255,255,0.02)",
                                    border: done
                                        ? "1px solid rgba(76,175,138,0.2)"
                                        : "1px solid rgba(255,255,255,0.06)",
                                    borderRadius: 10,
                                    transition: "all 0.3s ease",
                                }}
                            >
                                <div
                                    style={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: "50%",
                                        flexShrink: 0,
                                        background: done
                                            ? "linear-gradient(135deg, #4CAF8A, #48BB78)"
                                            : "rgba(255,255,255,0.06)",
                                        border: done
                                            ? "none"
                                            : "1px solid rgba(255,255,255,0.12)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: 11,
                                        color: "#fff",
                                        fontWeight: 700,
                                        marginTop: 1,
                                    }}
                                >
                                    {done ? "✓" : i + 1}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div
                                        style={{
                                            fontSize: 13,
                                            fontFamily: "'Lora', Georgia, serif",
                                            color: done ? "#555" : "#C8C4BE",
                                            textDecoration: done ? "line-through" : "none",
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        {m.label}
                                    </div>

                                    {!done && (
                                        <div style={{ fontSize: 10, color: "#444", marginTop: 3 }}>
                                            Discuss with Forge to unlock
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {advanceReady && (
                    <div
                        style={{
                            background:
                                "linear-gradient(135deg, rgba(76,175,138,0.15), rgba(72,187,120,0.06))",
                            border: "1px solid rgba(76,175,138,0.35)",
                            borderRadius: 14,
                            padding: "16px",
                            marginBottom: 16,
                            animation: "fadeSlideUp 0.4s ease",
                        }}
                    >
                        <div
                            style={{
                                fontSize: 14,
                                fontFamily: "'Lora', Georgia, serif",
                                color: "#4CAF8A",
                                fontWeight: 600,
                                marginBottom: 6,
                            }}
                        >
                            ✓ Forge says you're ready to advance
                        </div>

                        <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>
                            All Stage {stageId} work is done.
                            {STAGES_DATA[stageId]
                                ? ` Stage ${stageId + 1} — ${STAGES_DATA[stageId].label} — awaits.`
                                : " You've completed all stages."}
                        </div>

                        {STAGES_DATA[stageId] && (
                            <button
                                onClick={() => onAdvance(stageId + 1)}
                                style={{
                                    width: "100%",
                                    background: "linear-gradient(135deg, #4CAF8A, #48BB78)",
                                    border: "none",
                                    borderRadius: 10,
                                    padding: "11px",
                                    color: "#fff",
                                    fontSize: 13,
                                    fontFamily: "'Lora', Georgia, serif",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                }}
                            >
                                Advance to Stage {stageId + 1} — {STAGES_DATA[stageId].label} →
                            </button>
                        )}
                    </div>
                )}

                <div
                    style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 12,
                        padding: "12px 14px",
                        marginBottom: 10,
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            color: "#555",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            marginBottom: 8,
                        }}
                    >
                        Key Frameworks This Stage
                    </div>

                    {stage.frameworks.map((f, i) => (
                        <div
                            key={i}
                            style={{
                                fontSize: 12,
                                color: "#888",
                                fontFamily: "'Lora', Georgia, serif",
                                padding: "3px 0",
                            }}
                        >
                            · {f}
                        </div>
                    ))}
                </div>

                <div
                    style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 12,
                        padding: "12px 14px",
                        marginBottom: 20,
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            color: "#555",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            marginBottom: 8,
                        }}
                    >
                        Inner Circle
                    </div>

                    {stage.innerCircle.map((ref, i) => (
                        <div
                            key={i}
                            style={{
                                fontSize: 12,
                                color: "#888",
                                fontFamily: "'Lora', Georgia, serif",
                                fontStyle: "italic",
                                padding: "3px 0",
                            }}
                        >
                            {ref}
                        </div>
                    ))}
                </div>

                <button
                    onClick={onSwitchToChat}
                    style={{
                        width: "100%",
                        padding: "12px",
                        background: "linear-gradient(135deg, #E8622A, #c9521e)",
                        border: "none",
                        borderRadius: 12,
                        color: "#fff",
                        fontSize: 13,
                        fontFamily: "'Lora', Georgia, serif",
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    Continue with Forge →
                </button>
            </div>
        </div>
    );
}
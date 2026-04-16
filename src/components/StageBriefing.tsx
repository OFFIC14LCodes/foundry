// ─────────────────────────────────────────────────────────────
// STAGE BRIEFING
// ─────────────────────────────────────────────────────────────
export default function StageBriefing({ stage, stageId, onStart }) {
    const StageIcon = stage.icon;

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-start",
                padding: "28px 20px max(28px, calc(20px + env(safe-area-inset-bottom)))",
                boxSizing: "border-box",
                overflowY: "auto",
                WebkitOverflowScrolling: "touch",
                animation: "fadeIn 0.4s ease",
            }}
        >
            <div style={{ maxWidth: 520, width: "100%", textAlign: "center", margin: "auto 0", flexShrink: 0 }}>
                <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}>
                    <StageIcon size={44} color={stage.color} />
                </div>

                <div
                    style={{
                        fontSize: 11,
                        color: "#E8622A",
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        marginBottom: 10,
                    }}
                >
                    Stage {stageId} of 6
                </div>

                <h2
                    style={{
                        fontSize: 26,
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontWeight: 700,
                        color: "#F0EDE8",
                        letterSpacing: "-0.5px",
                        lineHeight: 1.2,
                        marginBottom: 10,
                    }}
                >
                    {stage.label}
                </h2>

                <div
                    style={{
                        fontSize: 13,
                        color: "#E8622A",
                        fontFamily: "'Lora', Georgia, serif",
                        fontStyle: "italic",
                        marginBottom: 20,
                    }}
                >
                    "{stage.mission}"
                </div>

                <div
                    style={{
                        textAlign: "left",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 14,
                        padding: "18px 20px",
                        marginBottom: 18,
                    }}
                >
                    {stage.briefing.split("\n\n").map((para, i, arr) => (
                        <p
                            key={i}
                            style={{
                                fontSize: 13,
                                fontFamily: "'Lora', Georgia, serif",
                                color: "#C8C4BE",
                                lineHeight: 1.75,
                                marginBottom: i < arr.length - 1 ? 12 : 0,
                            }}
                        >
                            {para}
                        </p>
                    ))}
                </div>

                <div
                    style={{
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 12,
                        padding: "14px 16px",
                        marginBottom: 22,
                        textAlign: "left",
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            color: "#555",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            marginBottom: 10,
                        }}
                    >
                        Inner Circle for this stage
                    </div>

                    {stage.innerCircle.map((ref, i) => (
                        <div
                            key={i}
                            style={{
                                fontSize: 12,
                                color: "#888",
                                fontFamily: "'Lora', Georgia, serif",
                                fontStyle: "italic",
                                padding: "4px 0",
                                borderBottom:
                                    i < stage.innerCircle.length - 1
                                        ? "1px solid rgba(255,255,255,0.04)"
                                        : "none",
                            }}
                        >
                            {ref}
                        </div>
                    ))}
                </div>

                <button
                    onClick={onStart}
                    style={{
                        width: "100%",
                        padding: "15px",
                        background: "linear-gradient(135deg, #E8622A, #c9521e)",
                        border: "none",
                        borderRadius: 12,
                        color: "#fff",
                        fontSize: 14,
                        fontFamily: "'Lora', Georgia, serif",
                        fontWeight: 600,
                        cursor: "pointer",
                        boxShadow: "0 8px 32px rgba(232,98,42,0.3)",
                        transition: "transform 0.2s",
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                    }}
                >
                    Start Stage {stageId} with Forge →
                </button>
            </div>
        </div>
    );
}

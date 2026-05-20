import { useEffect, useRef } from "react";
import { STAGES_DATA } from "../constants/stages";
import ForgeAvatar from "./ForgeAvatar";

// ─────────────────────────────────────────────────────────────
// STAGE REFERENCE MODAL
// ─────────────────────────────────────────────────────────────
export default function StageRefModal({ stageId, messages, profile, onClose }) {
    const stage = STAGES_DATA[stageId - 1];
    const StageIcon = stage.icon;
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, []);

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                animation: "fadeIn 0.2s ease",
            }}
        >
            <div
                onClick={onClose}
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(7,26,47,0.44)",
                    backdropFilter: "blur(6px)",
                }}
            />

            <div
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    top: "8%",
                    background: "#0A0A0C",
                    borderTop: "1px solid rgba(7,26,47,0.1)",
                    borderRadius: "20px 20px 0 0",
                    display: "flex",
                    flexDirection: "column",
                    animation: "slideUp 0.35s cubic-bezier(0.16,1,0.3,1)",
                }}
            >
                <div
                    style={{
                        padding: "18px 20px 14px",
                        borderBottom: "1px solid rgba(7,26,47,0.06)",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <div>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 3,
                            }}
                        >
                            <StageIcon size={18} color={stage.color} />
                            <div
                                style={{
                                    fontSize: 15,
                                    fontFamily: "var(--tekori-font-ui)",
                                    fontWeight: 600,
                                    color: "var(--color-text)",
                                }}
                            >
                                Stage {stageId} — {stage.label}
                            </div>
                        </div>

                        <div style={{ fontSize: 11, color: "var(--foundry-text-muted)" }}>
                            {messages.length} messages · tap outside to close
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: "rgba(7,26,47,0.06)",
                            border: "1px solid rgba(7,26,47,0.1)",
                            borderRadius: 8,
                            padding: "6px 14px",
                            color: "var(--color-text-muted)",
                            fontSize: 12,
                            cursor: "pointer",
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div
                    ref={scrollRef}
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        padding: "20px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                        maxWidth: 680,
                        width: "100%",
                        margin: "0 auto",
                        alignSelf: "center",
                    }}
                >
                    {messages.length === 0 ? (
                        <div
                            style={{
                                textAlign: "center",
                                color: "var(--foundry-text-secondary)",
                                fontFamily: "var(--tekori-font-ui)",
                                fontStyle: "italic",
                                padding: "40px 0",
                            }}
                        >
                            No conversation yet in this stage.
                        </div>
                    ) : (
                        messages.map((msg, i) => {
                            const isForge = msg.role === "forge" || msg.role === "assistant";
                            const senderName = isForge ? "Navi" : (profile?.name || "You");

                            return (
                                <div
                                    key={i}
                                    style={{
                                        display: "flex",
                                        justifyContent: isForge ? "flex-start" : "flex-end",
                                        alignItems: "flex-start",
                                        gap: 10,
                                    }}
                                >
                                    {isForge && (
                                        <ForgeAvatar size={28} />
                                    )}

                                    <div
                                        style={{
                                            maxWidth: "78%",
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: isForge ? "flex-start" : "flex-end",
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 10,
                                                lineHeight: 1.2,
                                                marginBottom: 6,
                                                color: isForge ? "var(--color-text-muted)" : "rgba(71,84,103,0.88)",
                                                letterSpacing: "0.04em",
                                                fontFamily: "var(--tekori-font-ui)",
                                            }}
                                        >
                                            {senderName}
                                        </div>
                                        <div
                                            style={{
                                                padding: isForge ? "12px 16px" : "9px 14px",
                                                borderRadius: isForge
                                                    ? "4px 14px 14px 14px"
                                                    : "14px 14px 4px 14px",
                                                background: isForge
                                                    ? "rgba(7,26,47,0.04)"
                                                    : "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
                                                border: isForge
                                                    ? "1px solid rgba(7,26,47,0.06)"
                                                    : "none",
                                                fontSize: isForge ? 13 : 12,
                                                fontFamily: isForge
                                                    ? "var(--tekori-font-ui)"
                                                    : "var(--tekori-font-ui)",
                                                lineHeight: 1.7,
                                                color: isForge ? "var(--color-text-soft)" : "#fff",
                                            }}
                                        >
                                            <div style={{ whiteSpace: "pre-wrap" }}>
                                                {(msg.text || "")
                                                    .replace(/\[STAGE_REF:\d+\]/g, "")
                                                    .replace(/\[\/STAGE_REF\]/g, "")}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

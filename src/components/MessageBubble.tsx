import ForgeAvatar from "./ForgeAvatar";

export default function MessageBubble({ msg, onStageRef, onGlossaryTap, renderWithBold, userName = "You", onAction = null }) {
    const isForge = msg.role === "forge" || msg.role === "assistant";
    const senderName = isForge ? "Forge" : userName;

    return (
        <div
            style={{
                display: "flex",
                justifyContent: isForge ? "flex-start" : "flex-end",
                alignItems: "flex-start",
                gap: 10,
                animation: "fadeSlideUp 0.3s ease",
            }}
        >
            {isForge && <ForgeAvatar size={32} />}
            <div
                style={{
                    maxWidth: "88%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isForge ? "flex-start" : "flex-end",
                }}
            >
                <div
                    style={{
                        fontSize: 11,
                        lineHeight: 1.2,
                        marginBottom: 6,
                        color: isForge ? "#8E867D" : "rgba(240,237,232,0.72)",
                        letterSpacing: "0.04em",
                        fontFamily: "'DM Sans', sans-serif",
                    }}
                >
                    {senderName}
                </div>
                <div
                    style={{
                        padding: isForge ? "12px 16px" : "9px 14px",
                        borderRadius: isForge ? "4px 16px 16px 16px" : "16px 16px 4px 16px",
                        background: isForge
                            ? "rgba(255,255,255,0.04)"
                            : "linear-gradient(135deg, #E8622A, #c9521e)",
                        border: isForge ? "1px solid rgba(255,255,255,0.07)" : "none",
                        fontSize: isForge ? 14 : 13,
                        fontFamily: isForge ? "'Lora', Georgia, serif" : "'DM Sans', sans-serif",
                        lineHeight: 1.75,
                        color: isForge ? "#D8D4CE" : "#fff",
                    }}
                >
                    {isForge ? (
                        renderWithBold(msg.text, onStageRef, onGlossaryTap)
                    ) : (
                        <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
                    )}
                </div>
                {isForge && Array.isArray(msg.actions) && msg.actions.length > 0 && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            marginTop: 10,
                            width: "100%",
                        }}
                    >
                        {msg.actions.map((action) => (
                            <button
                                key={action.id}
                                onClick={() => onAction && onAction(action)}
                                style={{
                                    width: "100%",
                                    padding: action.variant === "primary" ? "14px" : "12px",
                                    background: action.variant === "primary"
                                        ? "linear-gradient(135deg, #E8622A, #c9521e)"
                                        : "transparent",
                                    border: action.variant === "primary"
                                        ? "none"
                                        : "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 10,
                                    color: action.variant === "primary" ? "#fff" : "#888",
                                    fontSize: action.variant === "primary" ? 14 : 13,
                                    fontFamily: "'Lora', Georgia, serif",
                                    fontWeight: action.variant === "primary" ? 600 : 500,
                                    cursor: "pointer",
                                    boxShadow: action.variant === "primary"
                                        ? "0 4px 20px rgba(232,98,42,0.3)"
                                        : "none",
                                }}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

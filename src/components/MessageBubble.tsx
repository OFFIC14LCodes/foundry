import ForgeAvatar from "./ForgeAvatar";

export default function MessageBubble({ msg, onStageRef, onGlossaryTap, renderWithBold, userName = "You" }) {
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
            </div>
        </div>
    );
}

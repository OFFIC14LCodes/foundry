import ForgeAvatar from "./ForgeAvatar";

export default function MessageBubble({ msg, onStageRef, onGlossaryTap, renderWithBold }) {
    const isForge = msg.role === "forge" || msg.role === "assistant";

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
    );
}
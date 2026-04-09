import { useEffect, useMemo, useState } from "react";
import ForgeAvatar from "./ForgeAvatar";
import { cleanAIText } from "../lib/cleanAIText";

function getAnimatedDisplayText(text) {
    return cleanAIText(text || "")
        .replace(/\[STAGE_REF:\d+\]/g, "")
        .replace(/\[\/STAGE_REF\]/g, "")
        .replace(/\*\*/g, "");
}

function splitAnimatedLine(line) {
    return line.split(/(\s+)/).filter((token) => token.length > 0);
}

function AnimatedForgeText({ text, renderWithBold, onStageRef, onGlossaryTap, createdAt }) {
    const displayText = useMemo(() => getAnimatedDisplayText(text), [text]);
    const isFreshMessage = createdAt ? (Date.now() - new Date(createdAt).getTime()) < 20000 : true;
    const [visibleCount, setVisibleCount] = useState(isFreshMessage ? 0 : displayText.length);
    const [settled, setSettled] = useState(!isFreshMessage);
    const [lastMutationAt, setLastMutationAt] = useState(Date.now());

    useEffect(() => {
        if (!isFreshMessage) {
            setVisibleCount(displayText.length);
            setSettled(true);
            return;
        }

        setSettled(false);
        setLastMutationAt(Date.now());
    }, [displayText, isFreshMessage]);

    useEffect(() => {
        if (settled || visibleCount >= displayText.length) return;

        const timer = window.setTimeout(() => {
            setVisibleCount((count) => Math.min(displayText.length, count + 2));
        }, 14);

        return () => window.clearTimeout(timer);
    }, [displayText.length, settled, visibleCount]);

    useEffect(() => {
        if (!isFreshMessage || visibleCount < displayText.length) return;

        const settleTimer = window.setTimeout(() => {
            if (Date.now() - lastMutationAt >= 700) {
                setSettled(true);
            }
        }, 760);

        return () => window.clearTimeout(settleTimer);
    }, [displayText.length, isFreshMessage, lastMutationAt, visibleCount]);

    if (settled) {
        return renderWithBold(text, onStageRef, onGlossaryTap);
    }

    const visibleText = displayText.slice(0, visibleCount);
    const paragraphs = visibleText.split(/\n\n+/);
    let charIndex = 0;

    return (
        <>
            <style>{`
                @keyframes forgeLetterCool {
                    0% {
                        color: #ff6a3d;
                        text-shadow: 0 0 10px rgba(232,98,42,0.42), 0 0 18px rgba(245,168,67,0.18);
                    }
                    35% {
                        color: #f59a69;
                        text-shadow: 0 0 7px rgba(232,98,42,0.24);
                    }
                    100% {
                        color: #d8d4ce;
                        text-shadow: none;
                    }
                }
            `}</style>
            {paragraphs.map((para, pIdx) => {
                const lines = para.split("\n");
                return (
                    <p key={`anim-p-${pIdx}`} style={{ margin: pIdx === 0 ? 0 : "10px 0 0 0" }}>
                        {lines.map((line, lIdx) => (
                            <span key={`anim-p-${pIdx}-l-${lIdx}`}>
                                {lIdx > 0 && <br />}
                                {splitAnimatedLine(line).map((token, tokenIdx) => {
                                    if (/^\s+$/.test(token)) {
                                        return (
                                            <span
                                                key={`anim-space-${pIdx}-${lIdx}-${tokenIdx}`}
                                                style={{ whiteSpace: "pre-wrap" }}
                                            >
                                                {token}
                                            </span>
                                        );
                                    }

                                    return (
                                        <span
                                            key={`anim-word-${pIdx}-${lIdx}-${tokenIdx}`}
                                            style={{
                                                display: "inline-flex",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {Array.from(token).map((char) => {
                                                const currentIndex = charIndex++;
                                                return (
                                                    <span
                                                        key={`anim-char-${currentIndex}`}
                                                        style={{
                                                            color: "#D8D4CE",
                                                            animation: "forgeLetterCool 1s ease forwards",
                                                            display: "inline-block",
                                                        }}
                                                    >
                                                        {char}
                                                    </span>
                                                );
                                            })}
                                        </span>
                                    );
                                })}
                            </span>
                        ))}
                    </p>
                );
            })}
        </>
    );
}

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
                        <AnimatedForgeText
                            text={msg.text}
                            renderWithBold={renderWithBold}
                            onStageRef={onStageRef}
                            onGlossaryTap={onGlossaryTap}
                            createdAt={msg.createdAt}
                        />
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

import { useEffect, useMemo, useState } from "react";
import ForgeAvatar from "./ForgeAvatar";
import TypingDots from "./TypingDots";
import { cleanAIText } from "../lib/cleanAIText";
import { MessageActions, parseBoldSegments } from "./AnimatedChatText";
import type { ForgeMessageFeedbackContext } from "../lib/messageFeedback";

function getAnimatedDisplayText(text) {
    return cleanAIText(text || "")
        .replace(/\[STAGE_REF:\d+\]/g, "")
        .replace(/\[\/STAGE_REF\]/g, "")
        .replace(/\[CONCEPT\](.*?)\[\/CONCEPT\]/gs, "$1");
}

function splitAnimatedLine(line) {
    return line.split(/(\s+)/).filter((token) => token.length > 0);
}

function AnimatedForgeText({ text, renderWithBold, onStageRef, onGlossaryTap, onConceptTap, createdAt }) {
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
        return renderWithBold(text, onStageRef, onGlossaryTap, onConceptTap);
    }

    const visibleText = displayText.slice(0, visibleCount);
    const paragraphs = visibleText.split(/\n\n+/);
    let charIndex = 0;

    return (
        <div style={{ textAlign: "left", width: "100%" }}>
            <style>{`
                @keyframes forgeLetterCool {
                    0% {
                        color: #ff6a3d;
                        text-shadow: 0 0 10px rgba(216,155,43,0.42), 0 0 18px rgba(244,199,106,0.18);
                    }
                    35% {
                        color: #f59a69;
                        text-shadow: 0 0 7px rgba(216,155,43,0.24);
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
                    <p key={`anim-p-${pIdx}`} style={{ margin: pIdx === 0 ? 0 : "10px 0 0 0", textAlign: "left" }}>
                        {lines.map((line, lIdx) => (
                            <span key={`anim-p-${pIdx}-l-${lIdx}`}>
                                {lIdx > 0 && <br />}
                                {parseBoldSegments(line).map((seg, segIdx) => {
                                    const tokens = splitAnimatedLine(seg.text);
                                    const renderedTokens = tokens.map((token, tokenIdx) => {
                                        if (/^\s+$/.test(token)) {
                                            return (
                                                <span
                                                    key={`anim-space-${pIdx}-${lIdx}-${segIdx}-${tokenIdx}`}
                                                    style={{ whiteSpace: "pre-wrap" }}
                                                >
                                                    {token}
                                                </span>
                                            );
                                        }
                                        return (
                                            <span
                                                key={`anim-word-${pIdx}-${lIdx}-${segIdx}-${tokenIdx}`}
                                                style={{ display: "inline-flex", whiteSpace: "nowrap" }}
                                            >
                                                {Array.from(token).map((char) => {
                                                    const currentIndex = charIndex++;
                                                    return (
                                                        <span
                                                            key={`anim-char-${currentIndex}`}
                                                            style={{
                                                                color: seg.bold ? "var(--color-text)" : "var(--color-text)",
                                                                fontWeight: seg.bold ? 700 : undefined,
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
                                    });
                                    return seg.bold
                                        ? <strong key={`anim-seg-${pIdx}-${lIdx}-${segIdx}`} style={{ color: "var(--color-text)", fontWeight: 700 }}>{renderedTokens}</strong>
                                        : <span key={`anim-seg-${pIdx}-${lIdx}-${segIdx}`}>{renderedTokens}</span>;
                                })}
                            </span>
                        ))}
                    </p>
                );
            })}
        </div>
    );
}

export default function MessageBubble({ msg, onStageRef, onGlossaryTap, onConceptTap, renderWithBold, userName = "You", onAction = null, onApplyToContext = null, feedbackContext = undefined }) {
    const isForge = msg.role === "forge" || msg.role === "assistant";
    const senderName = isForge ? "Navi" : userName;
    const feedbackMessageId = feedbackContext?.messageId || msg.id;
    const messageFeedbackContext: ForgeMessageFeedbackContext = {
        ...(feedbackContext ?? {}),
        messageId: feedbackMessageId ? String(feedbackMessageId) : undefined,
    };

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
                        color: isForge ? "var(--color-text-muted)" : "rgba(7,26,47,0.88)",
                        letterSpacing: "0.04em",
                        fontFamily: "var(--tekori-font-ui)",
                    }}
                >
                    {senderName}
                </div>
                <div
                    style={{
                        padding: isForge ? "12px 16px" : "9px 14px",
                        borderRadius: isForge ? "4px 16px 16px 16px" : "16px 16px 4px 16px",
                        background: isForge
                            ? "rgba(7,26,47,0.04)"
                            : "linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))",
                        border: isForge ? "1px solid rgba(7,26,47,0.07)" : "none",
                        fontSize: isForge ? 14 : 13,
                        fontFamily: isForge ? "var(--tekori-font-ui)" : "var(--tekori-font-ui)",
                        lineHeight: 1.75,
                        color: isForge ? "var(--color-text)" : "var(--tekori-white)",
                        textAlign: "left",
                    }}
                >
                    {isForge ? (
                        !msg.text ? <TypingDots /> : (
                        <AnimatedForgeText
                            text={msg.text}
                            renderWithBold={renderWithBold}
                            onStageRef={onStageRef}
                            onGlossaryTap={onGlossaryTap}
                            onConceptTap={onConceptTap}
                            createdAt={msg.createdAt}
                        />
                        )
                    ) : (
                        <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
                    )}
                </div>
                {isForge && <MessageActions text={msg.text} feedbackContext={messageFeedbackContext} onApplyToContext={msg.text && onApplyToContext ? () => onApplyToContext(msg) : undefined} />}
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
                                        ? "linear-gradient(135deg, var(--tekori-gold), var(--tekori-soft-gold))"
                                        : "transparent",
                                    border: action.variant === "primary"
                                        ? "none"
                                        : "1px solid rgba(7,26,47,0.1)",
                                    borderRadius: 10,
                                    color: action.variant === "primary" ? "var(--color-primary)" : "var(--color-text-muted)",
                                    fontSize: action.variant === "primary" ? 14 : 13,
                                    fontFamily: "var(--tekori-font-ui)",
                                    fontWeight: action.variant === "primary" ? 800 : 500,
                                    cursor: "pointer",
                                    boxShadow: action.variant === "primary"
                                        ? "0 4px 20px rgba(216,155,43,0.3)"
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

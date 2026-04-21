import { type ReactNode, useEffect, useState, useCallback } from "react";
import { cleanAIText } from "../lib/cleanAIText";

export function getDisplayText(text: string) {
    return cleanAIText(text || "")
        .replace(/\[CONCEPT\](.*?)\[\/CONCEPT\]/gs, "$1")
        .replace(/\[TERM\](.*?)\[\/TERM\]/gs, "$1")
        .replace(/\[STAGE_REF:\d+\](.*?)\[\/STAGE_REF\]/gs, "$1");
}

function renderInline(text: string, keyPrefix: string) {
    return text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return (
                <strong key={`${keyPrefix}-b-${index}`} style={{ color: "#F0EDE8", fontWeight: 700 }}>
                    {part.slice(2, -2)}
                </strong>
            );
        }

        return part.split("\n").map((line, lineIndex) => (
            <span key={`${keyPrefix}-t-${index}-${lineIndex}`}>
                {lineIndex > 0 && <br />}
                {line}
            </span>
        ));
    });
}

export function renderText(text: string) {
    const cleaned = getDisplayText(text);
    if (!cleaned) return null;

    const lines = cleaned.split("\n");
    const blocks: ReactNode[] = [];
    let paragraphLines: string[] = [];
    let i = 0;

    const flushParagraph = () => {
        if (paragraphLines.length === 0) return;
        const content = paragraphLines.join("\n").trim();
        if (!content) {
            paragraphLines = [];
            return;
        }

        blocks.push(
            <p key={`p-${blocks.length}`} style={{ margin: blocks.length === 0 ? 0 : "12px 0 0 0", textAlign: "left" }}>
                {renderInline(content, `p-${blocks.length}`)}
            </p>
        );
        paragraphLines = [];
    };

    while (i < lines.length) {
        const line = lines[i];
        const headingTwoMatch = line.match(/^##\s+(.*)$/);
        const headingThreeMatch = line.match(/^###\s+(.*)$/);

        if (!line.trim()) {
            flushParagraph();
            i++;
            continue;
        }

        if (headingTwoMatch) {
            flushParagraph();
            blocks.push(
                <div
                    key={`h2-${blocks.length}`}
                    style={{
                        margin: blocks.length === 0 ? 0 : "14px 0 0 0",
                        fontSize: 15.5,
                        lineHeight: 1.35,
                        fontWeight: 700,
                        color: "#F0EDE8",
                        textAlign: "left",
                    }}
                >
                    {renderInline(headingTwoMatch[1], `h2-${blocks.length}`)}
                </div>
            );
            i++;
            continue;
        }

        if (headingThreeMatch) {
            flushParagraph();
            blocks.push(
                <div
                    key={`h3-${blocks.length}`}
                    style={{
                        margin: blocks.length === 0 ? 0 : "12px 0 0 0",
                        fontSize: 13.5,
                        lineHeight: 1.4,
                        fontWeight: 700,
                        color: "#F0EDE8",
                        textAlign: "left",
                    }}
                >
                    {renderInline(headingThreeMatch[1], `h3-${blocks.length}`)}
                </div>
            );
            i++;
            continue;
        }

        const bulletMatch = line.match(/^[-*]\s+(.*)$/);
        const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);

        if (bulletMatch) {
            flushParagraph();
            const items: string[] = [];
            while (i < lines.length) {
                const match = lines[i].match(/^[-*]\s+(.*)$/);
                if (!match) break;
                items.push(match[1]);
                i++;
            }
            blocks.push(
                <ul key={`ul-${blocks.length}`} style={{ margin: blocks.length === 0 ? "0 0 0 18px" : "12px 0 0 18px", padding: 0, textAlign: "left" }}>
                    {items.map((item, index) => (
                        <li key={`ul-item-${index}`} style={{ marginBottom: 6 }}>
                            {renderInline(item, `ul-${index}`)}
                        </li>
                    ))}
                </ul>
            );
            continue;
        }

        if (numberedMatch) {
            flushParagraph();
            const items: { value: number; content: string }[] = [];
            while (i < lines.length) {
                const match = lines[i].match(/^(\d+)\.\s+(.*)$/);
                if (!match) break;
                items.push({ value: Number(match[1]), content: match[2] });
                i++;
            }
            blocks.push(
                <ol key={`ol-${blocks.length}`} start={items[0]?.value || 1} style={{ margin: blocks.length === 0 ? "0 0 0 18px" : "12px 0 0 18px", padding: 0, textAlign: "left" }}>
                    {items.map((item, index) => (
                        <li key={`ol-item-${index}`} style={{ marginBottom: 6 }}>
                            {renderInline(item.content, `ol-${index}`)}
                        </li>
                    ))}
                </ol>
            );
            continue;
        }

        paragraphLines.push(line);
        i++;
    }

    flushParagraph();
    return <div style={{ textAlign: "left", width: "100%" }}>{blocks}</div>;
}

function splitAnimatedLine(line: string) {
    return line.split(/(\s+)/).filter((token) => token.length > 0);
}

export function AnimatedChatText({ text, createdAt }: { text: string; createdAt?: string }) {
    const displayText = getDisplayText(text);
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
        return renderText(text);
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
                    <p key={`anim-p-${pIdx}`} style={{ margin: pIdx === 0 ? 0 : "10px 0 0 0", textAlign: "left" }}>
                        {lines.map((line, lIdx) => (
                            <span key={`anim-p-${pIdx}-l-${lIdx}`}>
                                {lIdx > 0 && <br />}
                                {splitAnimatedLine(line).map((token, tokenIdx) => {
                                    if (/^\s+$/.test(token)) {
                                        return (
                                            <span key={`anim-space-${pIdx}-${lIdx}-${tokenIdx}`} style={{ whiteSpace: "pre-wrap" }}>
                                                {token}
                                            </span>
                                        );
                                    }

                                    return (
                                        <span key={`anim-word-${pIdx}-${lIdx}-${tokenIdx}`} style={{ display: "inline-flex", whiteSpace: "nowrap" }}>
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
        </div>
    );
}

export function MessageActions({ text }: { text: string }) {
    const [reaction, setReaction] = useState<"up" | "down" | null>(null);
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(() => {
        const plain = getDisplayText(text);
        navigator.clipboard.writeText(plain).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [text]);

    const toggleReaction = (dir: "up" | "down") => {
        setReaction(prev => prev === dir ? null : dir);
    };

    const btnBase: React.CSSProperties = {
        background: "none",
        border: "none",
        padding: "2px 4px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 5,
        transition: "color 0.15s",
        lineHeight: 1,
    };

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 5, marginLeft: 2 }}>
            {/* Thumbs up */}
            <button
                onClick={() => toggleReaction("up")}
                title="Good response"
                style={{ ...btnBase, color: reaction === "up" ? "#F0EDE8" : "#3a3a3a" }}
                onMouseEnter={e => { if (reaction !== "up") e.currentTarget.style.color = "#888"; }}
                onMouseLeave={e => { if (reaction !== "up") e.currentTarget.style.color = "#3a3a3a"; }}
            >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 14H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2m4-1V4a2 2 0 0 0-2-2L5 7v7h7.2a1 1 0 0 0 1-.8l.8-5a1 1 0 0 0-1-1.2H9Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill={reaction === "up" ? "currentColor" : "none"} fillOpacity={reaction === "up" ? 0.15 : 0} />
                </svg>
            </button>

            {/* Thumbs down */}
            <button
                onClick={() => toggleReaction("down")}
                title="Bad response"
                style={{ ...btnBase, color: reaction === "down" ? "#F0EDE8" : "#3a3a3a" }}
                onMouseEnter={e => { if (reaction !== "down") e.currentTarget.style.color = "#888"; }}
                onMouseLeave={e => { if (reaction !== "down") e.currentTarget.style.color = "#3a3a3a"; }}
            >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M11 2h2a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2M7 9v2a2 2 0 0 0 2 2l4-6V1H5.8a1 1 0 0 0-1 .8l-.8 5a1 1 0 0 0 1 1.2H7Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill={reaction === "down" ? "currentColor" : "none"} fillOpacity={reaction === "down" ? 0.15 : 0} />
                </svg>
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.08)", margin: "0 2px" }} />

            {/* Copy */}
            <button
                onClick={handleCopy}
                title={copied ? "Copied!" : "Copy message"}
                style={{ ...btnBase, color: copied ? "#4CAF8A" : "#3a3a3a" }}
                onMouseEnter={e => { if (!copied) e.currentTarget.style.color = "#888"; }}
                onMouseLeave={e => { if (!copied) e.currentTarget.style.color = "#3a3a3a"; }}
            >
                {copied ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ) : (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <rect x="5" y="5" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                        <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                )}
            </button>
        </div>
    );
}

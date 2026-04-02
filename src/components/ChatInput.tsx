import { useLayoutEffect, useRef } from "react";

export default function ChatInput({ value, onChange, onSend, onKeyDown, loading, placeholder }) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = "auto";

        const computed = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(computed.lineHeight) || 20;
        const maxHeight = lineHeight * 10;
        const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

        textarea.style.height = `${nextHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    }, [value]);

    return (
        <div
            style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-end",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: "10px 12px 10px 14px",
            }}
        >
            <textarea
                ref={textareaRef}
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                placeholder={placeholder || "Talk to Forge..."}
                rows={1}
                style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    color: "#F0EDE8",
                    fontSize: 13,
                    fontFamily: "'DM Sans', sans-serif",
                    lineHeight: 1.5,
                    height: "auto",
                    minHeight: 20,
                    maxHeight: 195,
                    overflowY: "hidden",
                    boxSizing: "border-box",
                }}
            />
            <button
                onClick={onSend}
                disabled={loading || !value.trim()}
                style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    flexShrink: 0,
                    background:
                        loading || !value.trim()
                            ? "rgba(255,255,255,0.05)"
                            : "linear-gradient(135deg, #E8622A, #c9521e)",
                    border: "none",
                    color: "#fff",
                    fontSize: 14,
                    opacity: loading || !value.trim() ? 0.4 : 1,
                    cursor: loading || !value.trim() ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                }}
            >
                ↑
            </button>
        </div>
    );
}

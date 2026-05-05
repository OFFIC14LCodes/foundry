import { useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";

type HelpTooltipProps = {
    content: ReactNode;
    label?: string;
    side?: "top" | "bottom" | "left" | "right";
};

export default function HelpTooltip({
    content,
    label = "More information",
    side = "top",
}: HelpTooltipProps) {
    const [open, setOpen] = useState(false);
    if (!content) return null;

    const position =
        side === "bottom"
            ? { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" }
            : side === "left"
                ? { right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" }
                : side === "right"
                    ? { left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" }
                    : { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" };

    return (
        <span
            style={{ position: "relative", display: "inline-flex", alignItems: "center", verticalAlign: "middle", flexShrink: 0 }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onClick={(event) => event.stopPropagation()}
        >
            <span
                role="button"
                tabIndex={0}
                aria-label={label}
                style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(255,255,255,0.055)",
                    color: "#8D857C",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "help",
                    outline: "none",
                }}
            >
                <CircleHelp size={13} strokeWidth={2.1} />
            </span>
            {open && (
                <span
                    role="tooltip"
                    style={{
                        position: "absolute",
                        zIndex: 5000,
                        ...position,
                        width: "max-content",
                        maxWidth: 260,
                        padding: "9px 11px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(13,13,16,0.98)",
                        boxShadow: "0 12px 36px rgba(0,0,0,0.42)",
                        color: "#C8C4BE",
                        fontSize: 11,
                        fontFamily: "'DM Sans', system-ui, sans-serif",
                        lineHeight: 1.55,
                        letterSpacing: 0,
                        textTransform: "none",
                        textAlign: "left",
                        whiteSpace: "pre-line",
                        pointerEvents: "none",
                    }}
                >
                    {content}
                </span>
            )}
        </span>
    );
}

import { useEffect, useRef, useState } from "react";
import { formatReportDate, type MarketReport } from "./shared";

export default function StructuredReportSelector({
    reportHistory,
    currentReport,
    onSelect,
}: {
    reportHistory: MarketReport[];
    currentReport: MarketReport | null;
    onSelect: (report: MarketReport) => void;
}) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    if (reportHistory.length === 0) return null;

    return (
        <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
                onClick={() => setOpen((prev) => !prev)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: open ? "rgba(232,98,42,0.08)" : "rgba(255,255,255,0.03)",
                    border: open ? "1px solid rgba(232,98,42,0.22)" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    padding: "7px 11px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
            >
                <span style={{ fontSize: 11, color: "#666", fontWeight: 500 }}>Report:</span>
                <span style={{ fontSize: 12, color: "#E8622A", fontWeight: 700 }}>
                    {currentReport ? formatReportDate(currentReport.date) : "None"}
                </span>
                <span style={{ fontSize: 9, color: "#555", marginLeft: 2 }}>{open ? "▲" : "▼"}</span>
            </button>

            {open && (
                <div style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    background: "#111213",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    padding: 8,
                    zIndex: 200,
                    minWidth: 210,
                    maxHeight: 340,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                }}>
                    {reportHistory.map((entry) => {
                        const selected = currentReport?.date === entry.date;
                        return (
                            <button
                                key={entry.date}
                                onClick={() => { onSelect(entry); setOpen(false); }}
                                style={{
                                    width: "100%",
                                    textAlign: "left",
                                    background: selected ? "rgba(232,98,42,0.12)" : "transparent",
                                    border: selected ? "1px solid rgba(232,98,42,0.22)" : "1px solid transparent",
                                    borderRadius: 8,
                                    padding: "9px 11px",
                                    color: "#F0EDE8",
                                    cursor: "pointer",
                                }}
                            >
                                <div style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: selected ? "#E8622A" : "#C8C4BE",
                                    fontFamily: "'DM Sans', system-ui, sans-serif",
                                }}>
                                    {formatReportDate(entry.date)}
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

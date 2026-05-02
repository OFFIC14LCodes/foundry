import type { MarketTab } from "./shared";

export default function MarketIntelligenceTabs({
    activeTab,
    onSelect,
}: {
    activeTab: MarketTab;
    onSelect: (tab: MarketTab) => void;
}) {
    return (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, flex: 1 }}>
            {[
                { key: "brief", label: "Daily Brief" },
                { key: "competitors", label: "Competitors" },
                { key: "trends", label: "Trends" },
                { key: "benchmarks", label: "Benchmarks" },
                { key: "sources", label: "Sources" },
            ].map((tab) => {
                const selected = activeTab === tab.key;
                return (
                    <button
                        key={tab.key}
                        onClick={() => onSelect(tab.key as MarketTab)}
                        style={{
                            flexShrink: 0,
                            background: selected ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.03)",
                            border: selected ? "1px solid rgba(232,98,42,0.24)" : "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 999,
                            padding: "8px 14px",
                            color: selected ? "#E8622A" : "#A8A4A0",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}

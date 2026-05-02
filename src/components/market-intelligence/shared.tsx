import { useState, type ReactNode } from "react";
import { cleanAIText } from "../../lib/cleanAIText";
import type { NormalizedMarketIntelligence } from "../../db";
import type { MarketIntelligenceExtractionScore } from "../../lib/marketIntelligenceExtractor";

export interface MarketReport {
    id?: string;
    content: string;
    industry: string;
    date: string;
    createdAt?: string;
    searchQueries?: string[];
}

export type MarketTab = "brief" | "competitors" | "trends" | "benchmarks" | "sources";

export type ExtractionDebugPreview = {
    rawText: string;
    rawJsonValid: boolean;
    warnings: string[];
    parsed: Pick<NormalizedMarketIntelligence, "competitors" | "trends" | "benchmarks" | "sources">;
    quality: MarketIntelligenceExtractionScore;
};

export function hasUsableContent(report: MarketReport | null | undefined): boolean {
    if (!report?.content) return false;
    const content = report.content.trim();
    return content.length > 0 && content !== "Something went wrong.";
}

export function formatReportDate(date: string): string {
    const d = new Date(`${date}T12:00:00`);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function InlineCitationLink({ href, children }: { href: string; children: string }) {
    const [hovered, setHovered] = useState(false);

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                color: "#E8622A",
                fontSize: "inherit",
                textDecoration: hovered ? "underline" : "none",
                textUnderlineOffset: 3,
            }}
        >
            {children.replace(/^Source:\s*/i, "").trim()}
        </a>
    );
}

function renderLinks(text: string, keyPrefix: string) {
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    const elements: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            elements.push(<span key={`${keyPrefix}-text-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
        }

        elements.push(
            <InlineCitationLink key={`${keyPrefix}-link-${match.index}`} href={match[2]}>
                {match[1]}
            </InlineCitationLink>,
        );
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        elements.push(<span key={`${keyPrefix}-text-${lastIndex}`}>{text.slice(lastIndex)}</span>);
    }

    return elements;
}

function renderInline(text: string) {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.flatMap((part, i) =>
        i % 2 === 1
            ? [<strong key={`bold-${i}`} style={{ color: "#F0EDE8", fontWeight: 700 }}>{renderLinks(part, `bold-${i}`)}</strong>]
            : renderLinks(part, `plain-${i}`),
    );
}

export function getReportPreview(content: string, maxLength = 110) {
    const cleaned = cleanAIText(content)
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/`{1,3}/g, "")
        .replace(/^[-*]\s+/gm, "")
        .replace(/\s+/g, " ")
        .trim();

    if (cleaned.length <= maxLength) return cleaned;
    return `${cleaned.slice(0, maxLength).trim()}...`;
}

export function ReportSection({ content }: { content: string }) {
    const lines = cleanAIText(content).split("\n");
    const elements: ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith("## ")) {
            elements.push(
                <div key={i} style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#E8622A", fontWeight: 700, marginTop: i > 0 ? 26 : 0, marginBottom: 8, paddingBottom: 5, borderBottom: "1px solid rgba(232,98,42,0.15)", fontFamily: "'Lora', Georgia, serif" }}>
                    {line.slice(3)}
                </div>,
            );
        } else if (line.startsWith("**") && line.endsWith("**")) {
            elements.push(
                <div key={i} style={{ fontSize: 12, fontWeight: 700, color: "#C8C4BE", marginTop: 10, marginBottom: 4, fontFamily: "'Lora', Georgia, serif" }}>
                    {renderInline(line)}
                </div>,
            );
        } else if (line.startsWith("- ") || line.startsWith("* ")) {
            const bullets: string[] = [];
            while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
                bullets.push(lines[i].slice(2));
                i++;
            }
            elements.push(
                <ul key={`ul-${i}`} style={{ margin: "4px 0 8px 14px", padding: 0 }}>
                    {bullets.map((b, j) => (
                        <li key={j} style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.75, marginBottom: 4, fontFamily: "'Lora', Georgia, serif" }}>
                            {renderInline(b)}
                        </li>
                    ))}
                </ul>,
            );
            continue;
        } else if (line.trim() !== "") {
            elements.push(
                <p key={i} style={{ fontSize: 13, color: "#C8C4BE", lineHeight: 1.8, marginBottom: 8, fontFamily: "'Lora', Georgia, serif" }}>
                    {renderInline(line)}
                </p>,
            );
        }

        i++;
    }

    return <>{elements}</>;
}

export function StructuredEmptyState({ title, body }: { title: string; body: string }) {
    return (
        <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            padding: "22px 20px",
        }}>
            <div style={{ fontSize: 16, fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, marginBottom: 6 }}>
                {title}
            </div>
            <div style={{ fontSize: 12, color: "#888", lineHeight: 1.7 }}>
                {body}
            </div>
        </div>
    );
}

import type { ReactNode } from "react";
import { STAGE_COLORS } from "../constants/glossary";
import type { GlossaryTerm } from "./glossaryDb";

type LearnedGlossaryTerm = {
    term?: string;
};

// Builds a lookup map from every matchable alias → GlossaryTerm.
// Terms like "CAC (Customer Acquisition Cost)" register three keys:
//   full form, abbreviation ("CAC"), and expansion ("Customer Acquisition Cost").
function buildAliasMap(terms: GlossaryTerm[]): Map<string, GlossaryTerm> {
    const map = new Map<string, GlossaryTerm>();
    for (const t of terms) {
        map.set(t.term.toLowerCase(), t);
        const m = t.term.match(/^([^(]+)\s*\(([^)]+)\)$/);
        if (m) {
            map.set(m[1].trim().toLowerCase(), t);
            map.set(m[2].trim().toLowerCase(), t);
        }
    }
    return map;
}

function getAliases(term: GlossaryTerm): string[] {
    const aliases = [term.term.toLowerCase()];
    const m = term.term.match(/^([^(]+)\s*\(([^)]+)\)$/);
    if (m) {
        aliases.push(m[1].trim().toLowerCase(), m[2].trim().toLowerCase());
    }
    return aliases;
}

export function applyGlossaryHighlights(
    text: string,
    onGlossaryTap: ((term: string, entry: GlossaryTerm) => void) | null | undefined,
    glossaryTerms: GlossaryTerm[] = [],
    learnedTerms: LearnedGlossaryTerm[] = [],
) {
    if (!onGlossaryTap || glossaryTerms.length === 0) {
        return [<span key="plain">{text}</span>];
    }

    const aliasMap = buildAliasMap(glossaryTerms);
    const learnedSet = new Set(
        learnedTerms
            .map((item) => item.term?.toLowerCase().trim())
            .filter(Boolean) as string[],
    );
    const keys = Array.from(aliasMap.keys()).sort((a, b) => b.length - a.length);
    if (keys.length === 0) return [<span key="plain">{text}</span>];

    const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const pattern = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

    const parts: ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;

    pattern.lastIndex = 0;

    while ((m = pattern.exec(text)) !== null) {
        if (m.index === pattern.lastIndex) {
            pattern.lastIndex++;
        }

        if (m.index > last) {
            parts.push(<span key={last}>{text.slice(last, m.index)}</span>);
        }

        const matched = m[1];
        const entry = aliasMap.get(matched.toLowerCase());
        const stageColor = entry
            ? STAGE_COLORS[entry.stage_unlock as keyof typeof STAGE_COLORS] ?? "#F5A843"
            : "#F5A843";
        const learned = entry ? getAliases(entry).some((alias) => learnedSet.has(alias)) : false;
        const color = learned ? "#4CAF8A" : stageColor;

        parts.push(
            <span
                key={m.index}
                onClick={() => entry && onGlossaryTap(matched, entry)}
                style={{
                    color,
                    borderBottom: learned ? "1px solid currentColor" : "1px dotted currentColor",
                    cursor: entry ? "pointer" : "default",
                    opacity: learned ? 1 : 0.9,
                    transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = learned ? "1" : "0.9"; }}
                title={entry ? `${learned ? "Learned" : "Learn"}: ${entry.term}` : undefined}
            >
                {matched}
            </span>
        );

        last = pattern.lastIndex;
    }

    if (last < text.length) {
        parts.push(<span key={`${last}-end`}>{text.slice(last)}</span>);
    }

    return parts.length > 0 ? parts : [<span key="plain">{text}</span>];
}

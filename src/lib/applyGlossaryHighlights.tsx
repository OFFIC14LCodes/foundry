import { GLOSSARY, STAGE_COLORS } from "../constants/glossary";

export function applyGlossaryHighlights(text, onGlossaryTap) {
    if (!onGlossaryTap) return [<span key="plain">{text}</span>];

    const terms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

    if (terms.length === 0) {
        return [<span key="plain">{text}</span>];
    }

    const escapedTerms = terms.map((t) =>
        t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );

    const pattern = new RegExp(`\\b(${escapedTerms.join("|")})\\b`, "gi");

    const parts = [];
    let last = 0;
    let m;

    pattern.lastIndex = 0;

    while ((m = pattern.exec(text)) !== null) {
        if (m.index === pattern.lastIndex) {
            pattern.lastIndex++;
        }

        if (m.index > last) {
            parts.push(<span key={last}>{text.slice(last, m.index)}</span>);
        }

        const matched = m[1];
        const key = matched.toLowerCase();
        const entry = GLOSSARY[key];

        parts.push(
            <span
                key={m.index}
                onClick={() => entry && onGlossaryTap(key, entry)}
                style={{
                    color: entry ? STAGE_COLORS[entry.stage] || "#F5A843" : "#F5A843",
                    borderBottom: "1px dotted currentColor",
                    cursor: entry ? "pointer" : "default",
                    opacity: 0.9,
                    transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "0.9";
                }}
                title={entry ? `Learn: ${matched}` : undefined}
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
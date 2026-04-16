function stripCodeFence(raw: string) {
    const trimmed = raw.trim();
    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

function stripPreviewMarkdown(raw: string) {
    return raw
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/^\s*[-*]\s+/gm, "")
        .replace(/^\s*\d+\.\s+/gm, "")
        .trim();
}

function tryParseJsonObject(raw: string) {
    const stripped = stripCodeFence(raw);

    try {
        return JSON.parse(stripped);
    } catch {
        const firstBrace = stripped.indexOf("{");
        const lastBrace = stripped.lastIndexOf("}");
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

        try {
            return JSON.parse(stripped.slice(firstBrace, lastBrace + 1));
        } catch {
            return null;
        }
    }
}

export function parseArchiveSummaryPayload(raw: string, fallbackTitle: string) {
    const parsed = tryParseJsonObject(raw);
    if (parsed && typeof parsed === "object") {
        return {
            title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : fallbackTitle,
            summary: typeof parsed.summary === "string" && parsed.summary.trim()
                ? parsed.summary.trim()
                : stripCodeFence(raw),
        };
    }

    return {
        title: fallbackTitle,
        summary: stripCodeFence(raw),
    };
}

export function getArchiveDisplaySummary(raw: string) {
    const parsed = tryParseJsonObject(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.summary === "string" && parsed.summary.trim()) {
        return parsed.summary.trim();
    }

    return stripCodeFence(raw);
}

export function getArchivePreviewText(raw: string) {
    return stripPreviewMarkdown(getArchiveDisplaySummary(raw));
}

export function getArchiveDisplayTitle(title: string, rawSummary: string, fallbackTitle = "Saved Archive") {
    const cleanTitle = String(title || "").trim();
    const parsed = tryParseJsonObject(rawSummary);

    if (parsed && typeof parsed === "object" && typeof parsed.title === "string" && parsed.title.trim()) {
        if (!cleanTitle || cleanTitle === "```json" || cleanTitle === "json" || cleanTitle.startsWith("```")) {
            return parsed.title.trim();
        }
    }

    return cleanTitle || fallbackTitle;
}

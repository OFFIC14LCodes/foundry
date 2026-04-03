export function summarizeBusinessIdea(
    businessName?: string | null,
    idea?: string | null,
    maxWords = 10
): string {
    const primary = (businessName ?? "").trim();
    if (primary) {
        return trimToWordLimit(primary, maxWords);
    }

    const rawIdea = (idea ?? "").trim();
    if (!rawIdea) return "Your business";

    const firstSentence = rawIdea.split(/[.!?]/)[0]?.trim() || rawIdea;
    const normalized = firstSentence
        .replace(/^(i\s*(want|would like|plan|am planning)\s+to\s+(build|start|create|launch)\s+)/i, "")
        .replace(/^(i'?m\s+(building|starting|creating|launching)\s+)/i, "")
        .replace(/^(my\s+(idea|business)\s+is\s+)/i, "")
        .replace(/^(it'?s\s+)/i, "")
        .replace(/\s+/g, " ")
        .trim();

    return trimToWordLimit(normalized || rawIdea, maxWords);
}

function trimToWordLimit(value: string, maxWords: number): string {
    const words = value
        .split(/\s+/)
        .map((word) => word.trim())
        .filter(Boolean);

    if (words.length <= maxWords) return words.join(" ");
    return `${words.slice(0, maxWords).join(" ")}...`;
}

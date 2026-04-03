const BRACKETED_META = /\[(?:COACH|NOTE|PAUSE|STAGE|SYSTEM|VOICE|EMPHASIS).*?\]/gi;
const MARKDOWN_LINKS = /\[([^\]]+)\]\(([^)]+)\)/g;
const MARKDOWN_EMPHASIS = /(\*\*|__|\*|_|`|~~)/g;
const BULLET_PREFIX = /^\s*[-*]\s+/gm;
const MULTISPACE = /\s+/g;
const REPEATED_BREAKS = /\n{3,}/g;
const EMOJI_OR_SYMBOLS = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

export interface ExtractedSpeechSegments {
    segments: string[];
    remainder: string;
}

export function cleanTextForSpeech(text: string): string {
    return text
        .replace(MARKDOWN_LINKS, "$1")
        .replace(BRACKETED_META, " ")
        .replace(MARKDOWN_EMPHASIS, "")
        .replace(BULLET_PREFIX, "")
        .replace(EMOJI_OR_SYMBOLS, " ")
        .replace(/[•▪◦]/g, " ")
        .replace(/[“”]/g, "\"")
        .replace(/[‘’]/g, "'")
        .replace(/\s*[:]\s*\n/g, ": ")
        .replace(REPEATED_BREAKS, "\n\n")
        .replace(/\n/g, " ")
        .replace(MULTISPACE, " ")
        .trim();
}

export function normalizeSpeechCacheKey(text: string): string {
    return cleanTextForSpeech(text)
        .toLowerCase()
        .replace(/[^a-z0-9.!?]+/g, " ")
        .trim();
}

export function splitIntoSentences(text: string): string[] {
    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return [];

    const parts = cleaned.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [cleaned];
    return parts
        .map((part) => part.trim())
        .filter(Boolean);
}

export function extractSpeakableSegments(text: string, isFinal: boolean): ExtractedSpeechSegments {
    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return { segments: [], remainder: "" };

    const matches = [...cleaned.matchAll(/[^.!?]+[.!?]+/g)];
    const segments = matches
        .map((match) => match[0]?.trim() ?? "")
        .filter(isWorthSpeaking);

    const lastConsumedIndex = matches.length
        ? (matches[matches.length - 1].index ?? 0) + matches[matches.length - 1][0].length
        : 0;

    const remainder = cleaned.slice(lastConsumedIndex).trim();

    if (isFinal && isWorthSpeaking(remainder)) {
        segments.push(remainder);
        return { segments, remainder: "" };
    }

    return { segments, remainder };
}

export function isWorthSpeaking(text: string): boolean {
    const cleaned = cleanTextForSpeech(text);
    if (!cleaned) return false;
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length >= 4) return true;
    return cleaned.length >= 18;
}

export function estimatePauseMs(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    const lastChar = trimmed[trimmed.length - 1];
    if (lastChar === "?") return 360;
    if (lastChar === "!") return 320;
    if (lastChar === ".") return 280;
    if (lastChar === ",") return 180;
    if (lastChar === ":") return 220;
    return 140;
}


type MessageContent = string | Array<Record<string, unknown>>;

const STRONG_PROFANITY_PATTERNS = [
    /\bfuck(?:er|ers|ed|ing|in)?\b/gi,
    /\bshit(?:ty|ting|ted|head|heads)?\b/gi,
    /\bbitch(?:es|y)?\b/gi,
    /\basshole(?:s)?\b/gi,
    /\bbastard(?:s)?\b/gi,
    /\bdick(?:head|heads|ish)?\b/gi,
    /\bcunt(?:s)?\b/gi,
    /\bmotherfucker(?:s)?\b/gi,
];

function censorWord(word: string) {
    if (word.length <= 2) return "*".repeat(word.length);
    return `${word[0]}${"*".repeat(word.length - 1)}`;
}

export function censorStrongProfanity(text: string) {
    let censored = text;
    for (const pattern of STRONG_PROFANITY_PATTERNS) {
        censored = censored.replace(pattern, (match) => censorWord(match));
    }
    return censored;
}

export function hasStrongProfanity(text: string) {
    return STRONG_PROFANITY_PATTERNS.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(text);
    });
}

export function moderateUserText(text: string) {
    const containsStrongProfanity = hasStrongProfanity(text);
    return {
        containsStrongProfanity,
        censoredText: containsStrongProfanity ? censorStrongProfanity(text) : text,
    };
}

export function getLanguageWarning(text: string) {
    if (!hasStrongProfanity(text)) return null;
    return "This message uses stronger profanity. Edit it for a more professional exchange, or press send again to continue.";
}

export function moderateMessageContent(content: MessageContent): MessageContent {
    if (typeof content === "string") return censorStrongProfanity(content);

    return content.map((part) => {
        if (part?.type === "text" && typeof part.text === "string") {
            return { ...part, text: censorStrongProfanity(part.text) };
        }
        return part;
    });
}

export function applyLanguageGuidance(systemPrompt: string, messages: Array<{ role: string; content: MessageContent }>) {
    const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (!latestUserMessage) return systemPrompt;

    const latestText = extractPlainText(latestUserMessage.content);
    if (!latestText || !hasStrongProfanity(latestText)) return systemPrompt;

    return `${systemPrompt}

Tone note: if the founder uses strong profanity, respond with one brief calm sentence that lightly resets the tone, then continue helping normally. Do not moralize, escalate, or refuse unless there is a genuine threat or hateful abuse.`;
}

function extractPlainText(content: MessageContent) {
    if (typeof content === "string") return content;

    return content
        .map((part) => {
            if (typeof part?.text === "string") return part.text;
            return "";
        })
        .join("\n");
}

import { applyLanguageGuidance, moderateMessageContent } from "./languageModeration";

// Shared API helpers for all Forge-powered interactions.
// Extracted here so PitchPracticeScreen and ForgeScreen can both use them
// without duplication or coupling to App.tsx.

type MessageContent = string | Array<Record<string, unknown>>;

export type ForgeApiUsage = { inputTokens: number; outputTokens: number };

export async function callForgeAPI(
    messages: Array<{ role: string; content: MessageContent }>,
    systemPrompt: string,
    maxTokens = 1000,
    onUsage?: (usage: ForgeApiUsage) => void,
): Promise<string> {
    const moderatedMessages = messages.map((message) => (
        message.role === "user"
            ? { ...message, content: moderateMessageContent(message.content) }
            : message
    ));
    const effectiveSystemPrompt = applyLanguageGuidance(systemPrompt, messages);
    const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: maxTokens,
            system: effectiveSystemPrompt,
            messages: moderatedMessages,
        }),
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    if (onUsage && data.usage) {
        onUsage({ inputTokens: data.usage.input_tokens ?? 0, outputTokens: data.usage.output_tokens ?? 0 });
    }
    return data.content?.map((b: any) => b.text || "").join("") || "Something went wrong.";
}

export async function streamForgeAPI(
    messages: Array<{ role: string; content: MessageContent }>,
    systemPrompt: string,
    onChunk: (text: string) => void,
    maxTokens = 2000,
    signal?: AbortSignal,
    onUsage?: (usage: ForgeApiUsage) => void,
): Promise<string> {
    const moderatedMessages = messages.map((message) => (
        message.role === "user"
            ? { ...message, content: moderateMessageContent(message.content) }
            : message
    ));
    const effectiveSystemPrompt = applyLanguageGuidance(systemPrompt, messages);
    const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: maxTokens,
            stream: true,
            system: effectiveSystemPrompt,
            messages: moderatedMessages,
        }),
        signal,
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";
    let inputTokens = 0;
    let outputTokens = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
                const parsed = JSON.parse(data);
                if (parsed.type === "message_start" && parsed.message?.usage) {
                    inputTokens = parsed.message.usage.input_tokens ?? 0;
                } else if (parsed.type === "message_delta" && parsed.usage) {
                    outputTokens = parsed.usage.output_tokens ?? 0;
                } else if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                    fullText += parsed.delta.text;
                    onChunk(fullText);
                }
            } catch { /* skip malformed chunks */ }
        }
    }
    if (onUsage && (inputTokens > 0 || outputTokens > 0)) {
        onUsage({ inputTokens, outputTokens });
    }
    return fullText || "Something went wrong.";
}

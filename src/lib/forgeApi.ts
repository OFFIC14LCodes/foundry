// Shared API helpers for all Forge-powered interactions.
// Extracted here so PitchPracticeScreen and ForgeScreen can both use them
// without duplication or coupling to App.tsx.

type MessageContent = string | Array<Record<string, unknown>>;

export async function callForgeAPI(messages: Array<{ role: string; content: MessageContent }>, systemPrompt: string, maxTokens = 1000): Promise<string> {
    const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
        }),
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.content?.map((b: any) => b.text || "").join("") || "Something went wrong.";
}

export async function streamForgeAPI(
    messages: Array<{ role: string; content: MessageContent }>,
    systemPrompt: string,
    onChunk: (text: string) => void,
    maxTokens = 1000
): Promise<string> {
    const res = await fetch("/api/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: maxTokens,
            stream: true,
            system: systemPrompt,
            messages,
        }),
    });
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";
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
                if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                    fullText += parsed.delta.text;
                    onChunk(fullText);
                }
            } catch { /* skip malformed chunks */ }
        }
    }
    return fullText || "Something went wrong.";
}

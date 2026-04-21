export async function deliverMessage(
    text,
    setLoading,
    addMessage,
    options = {}
) {
    const {
        initialDelayMs = 600,
        msPerWord = 80,
        minDurationMs = 1200,
        maxDurationMs = 3000,
    } = options;

    await new Promise((r) => setTimeout(r, initialDelayMs));
    setLoading(true);
    const words = text.split(" ").length;
    const duration = Math.min(Math.max(words * msPerWord, minDurationMs), maxDurationMs);
    await new Promise((r) => setTimeout(r, duration));
    setLoading(false);
    addMessage(text);
}

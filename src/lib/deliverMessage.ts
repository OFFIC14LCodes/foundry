export async function deliverMessage(text, setLoading, addMessage) {
    await new Promise((r) => setTimeout(r, 600));
    setLoading(true);
    const words = text.split(" ").length;
    const duration = Math.min(Math.max(words * 80, 1200), 3000);
    await new Promise((r) => setTimeout(r, duration));
    setLoading(false);
    addMessage(text);
}
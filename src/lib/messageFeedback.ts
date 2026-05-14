import { supabase } from "../supabase";

export type ForgeMessageReaction = "up" | "down";

export type ForgeMessageFeedbackContext = {
    surface?: string;
    conversationTitle?: string;
    stageId?: number | null;
    messageId?: string;
    pageUrl?: string;
};

export async function sendForgeMessageFeedback(input: {
    reaction: ForgeMessageReaction;
    messageText: string;
    context?: ForgeMessageFeedbackContext;
}) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
        throw new Error("You must be signed in to send message feedback.");
    }

    const response = await fetch("/api/message-feedback", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Feedback email failed: ${text.slice(0, 180)}`);
    }
}

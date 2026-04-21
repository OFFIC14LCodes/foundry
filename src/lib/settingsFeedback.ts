import { supabase } from "../supabase";

export async function submitSettingsFeedback(input: {
    kind: "support" | "suggestion";
    message: string;
    profileName?: string | null;
    businessName?: string | null;
    marketFocus?: string | null;
}) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
        throw new Error("Missing active session");
    }

    const response = await fetch("/api/settings-feedback", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(payload?.error || "Unable to send message right now.");
    }

    return payload;
}

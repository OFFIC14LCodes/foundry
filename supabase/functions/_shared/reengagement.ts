export const REENGAGEMENT_INACTIVITY_DAYS = 3;
export const REENGAGEMENT_COOLDOWN_DAYS = 5;

export type ReminderVariant = {
    id: string;
    subject: string;
    title: string;
    body: string;
};

export const REMINDER_VARIANTS: ReminderVariant[] = [
    {
        id: "forge-ready",
        subject: "Forge is ready when you are",
        title: "Forge is ready when you are.",
        body: "Forge is ready when you are. Your next step is waiting. Come back into Foundry, check in with Forge, and keep building with clarity instead of guessing alone.",
    },
    {
        id: "three-days-change",
        subject: "A lot can change in 3 days",
        title: "A lot can change in 3 days.",
        body: "A lot can change in 3 days. Check back in, update Forge on what shifted, and keep the build moving. Momentum does not have to be dramatic to be real.",
    },
    {
        id: "next-move",
        subject: "Your business just needs your next move",
        title: "Your business does not need perfect momentum.",
        body: "Your business does not need perfect momentum. It just needs your next move. Open Foundry, tell Forge where things stand, and let the next step get specific again.",
    },
];

export function pickReminderVariant(daysInactive: number): ReminderVariant {
    if (daysInactive >= 10) return REMINDER_VARIANTS[2];
    if (daysInactive >= 6) return REMINDER_VARIANTS[1];
    return REMINDER_VARIANTS[0];
}

export function buildReminderEmail(name: string | null, daysInactive: number) {
    const variant = pickReminderVariant(daysInactive);
    const greeting = name?.trim() ? `${name},` : "Founder,";

    return {
        ...variant,
        html: `
            <div style="font-family:Arial,sans-serif;background:#080809;color:#F0EDE8;padding:32px;">
                <div style="max-width:560px;margin:0 auto;background:#111214;border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:28px;">
                    <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#E8622A;margin-bottom:10px;">Foundry</div>
                    <h1 style="margin:0 0 14px;font-size:28px;line-height:1.1;font-family:Georgia,serif;color:#F0EDE8;">${variant.title}</h1>
                    <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#D4CEC4;">${greeting}</p>
                    <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#D4CEC4;">${variant.body}</p>
                    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#D4CEC4;">You have been away from Foundry for ${daysInactive} day${daysInactive === 1 ? "" : "s"}. If your business moved, stalled, shifted, or got messy, that is exactly the kind of update Forge is there for.</p>
                    <a href="https://foundryandforge.app" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#E8622A;color:#fff;text-decoration:none;font-weight:700;">Return to Foundry</a>
                </div>
            </div>
        `.trim(),
    };
}

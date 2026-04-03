export type NotificationType = "reengagement" | "system" | "milestone";
export type NotificationChannel = "email" | "in_app";
export type NotificationStatus = "pending" | "sent" | "failed";

export type AppNotification = {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    channel: NotificationChannel;
    status: NotificationStatus;
    sentAt: string | null;
    readAt: string | null;
    createdAt: string;
};

export type UserNotificationPreferences = {
    reengagementEnabled: boolean;
    productUpdatesEnabled: boolean;
    emailNotificationsEnabled: boolean;
    inAppNotificationsEnabled: boolean;
};

export type AdminNotificationSettings = {
    id: string;
    reengagementEnabled: boolean;
    reengagementDelayDays: number;
    maxRemindersPerUser: number;
};

export const DEFAULT_USER_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
    reengagementEnabled: true,
    productUpdatesEnabled: true,
    emailNotificationsEnabled: true,
    inAppNotificationsEnabled: true,
};

export const DEFAULT_ADMIN_NOTIFICATION_SETTINGS: AdminNotificationSettings = {
    id: "global",
    reengagementEnabled: true,
    reengagementDelayDays: 3,
    maxRemindersPerUser: 1,
};

export const MEANINGFUL_ACTIVITY_THROTTLE_MS = 10 * 60 * 1000;

export type ReminderVariant = {
    id: string;
    subject: string;
    title: string;
    message: string;
};

export const REENGAGEMENT_REMINDER_VARIANTS: ReminderVariant[] = [
    {
        id: "forge-ready",
        subject: "Forge is ready when you are",
        title: "Forge is ready when you are.",
        message: "Your next step is waiting. Come back into Foundry, check in with Forge, and keep building with clarity instead of guessing alone.",
    },
    {
        id: "three-days-change",
        subject: "A lot can change in 3 days",
        title: "A lot can change in 3 days.",
        message: "Check back in, update Forge on what shifted, and keep the build moving. Momentum does not have to be dramatic to be real.",
    },
    {
        id: "next-move",
        subject: "Your business just needs your next move",
        title: "Your business does not need perfect momentum.",
        message: "It just needs your next move. Open Foundry, tell Forge where things stand, and let the next step get specific again.",
    },
];

export function getReengagementVariant(daysInactive: number): ReminderVariant {
    if (daysInactive >= 10) return REENGAGEMENT_REMINDER_VARIANTS[2];
    if (daysInactive >= 6) return REENGAGEMENT_REMINDER_VARIANTS[1];
    return REENGAGEMENT_REMINDER_VARIANTS[0];
}

export function getReengagementThresholdCopy(delayDays: number) {
    return `${delayDays}+ day inactivity reminders`;
}

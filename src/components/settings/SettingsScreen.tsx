import type { BillingSubscription } from "../../lib/accessGate";
import { roleLabel } from "../../lib/roles";
import { getReengagementThresholdCopy, type AppNotification, type UserNotificationPreferences } from "../../lib/notifications";
import { REFUND_POLICY, SUPPORT_EMAIL } from "../../config/pricing";
import {
    SettingsButton,
    SettingsCard,
    SettingsRow,
    SettingsScreenShell,
    SettingsSection,
} from "./SettingsPrimitives";

type SettingsScreenProps = {
    profile: any;
    authEmail: string | null;
    accessSummary?: {
        planName: string;
        statusLabel: string;
        note: string;
        canAccessPaidStages: boolean;
    } | null;
    billingSubscription: BillingSubscription | null;
    onBack: () => void;
    onOpenTerms: () => void;
    onOpenPrivacy: () => void;
    notificationPreferences: UserNotificationPreferences;
    onNotificationPreferencesChange: (next: UserNotificationPreferences) => void;
    notifications: AppNotification[];
    onMarkNotificationRead: (notificationId: string) => void;
    onOpenManageSubscription: () => void;
    billingActionMessage: string | null;
    billingPortalLoading: boolean;
    onLogout: () => void;
};

export default function SettingsScreen({
    profile,
    authEmail,
    accessSummary,
    billingSubscription,
    onBack,
    onOpenTerms,
    onOpenPrivacy,
    notificationPreferences,
    onNotificationPreferencesChange,
    notifications,
    onMarkNotificationRead,
    onOpenManageSubscription,
    billingActionMessage,
    billingPortalLoading,
    onLogout,
}: SettingsScreenProps) {
    const email = authEmail ?? profile?.email ?? "Not available";
    const planName = accessSummary?.planName ?? "Free";
    const billingStatus = accessSummary?.statusLabel ?? "Pending";
    const version = "Foundry v1";
    const intervalLabel = billingSubscription?.billing_interval
        ? billingSubscription.billing_interval === "yearly" ? "Yearly" : "Monthly"
        : "Not set";
    const renewalLabel = billingSubscription?.current_period_end
        ? new Date(billingSubscription.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "Not available";
    const cancellationNote = !billingSubscription?.current_period_end
        ? "No Stripe billing period is on file yet for this account."
        : billingSubscription?.cancel_at_period_end
            ? `Scheduled to cancel at the end of the current period on ${renewalLabel}.`
            : `Renews automatically on ${renewalLabel}.`;

    return (
        <SettingsScreenShell
            title="Settings"
            subtitle="Manage your account, billing posture, and workspace policies in one place."
            onBack={onBack}
            footer={<div style={{ fontSize: 11, color: "#555", textAlign: "center" }}>{version}</div>}
        >
            <div style={{ display: "grid", gap: 18 }}>
                <SettingsSection
                    title="Account Details"
                    description="Core account identity and profile metadata. Editable profile fields can expand here later."
                >
                    <SettingsCard>
                        <SettingsRow label="Signed-in email" value={email} />
                        <SettingsRow label="Profile name" value={profile?.name || "Not set yet"} />
                        <SettingsRow label="Role" value={roleLabel(profile?.role)} />
                        <SettingsRow
                            label="Editable fields"
                            value="Coming soon"
                            hint="Display name, workspace preferences, and account metadata can be managed here in a later release."
                        />
                    </SettingsCard>
                </SettingsSection>

                <SettingsSection
                    title="Subscription / Billing"
                    description="Live billing state synced from Stripe webhooks."
                >
                    <SettingsCard>
                        <SettingsRow label="Current plan" value={planName} />
                        <SettingsRow label="Billing interval" value={intervalLabel} />
                        <SettingsRow label="Billing status" value={billingStatus} hint={accessSummary?.note ?? "Billing status will appear here once a subscription exists."} />
                        <SettingsRow label="Renewal / access window" value={renewalLabel} hint={cancellationNote} />
                        <SettingsRow
                            label="Manage subscription"
                            hint={`Use Stripe Customer Portal to change plans, cancel, update payment methods, and view invoices. Refunds: ${REFUND_POLICY.summary}`}
                            action={<SettingsButton onClick={onOpenManageSubscription} disabled={billingPortalLoading || !billingSubscription?.stripe_customer_id}>Manage Subscription</SettingsButton>}
                        />
                        <SettingsRow label="Refund policy" value={REFUND_POLICY.summary} />
                        <SettingsRow label="Billing support" value={SUPPORT_EMAIL} />
                        {billingActionMessage && (
                            <div style={{ fontSize: 12, color: "#C8C4BE", lineHeight: 1.7 }}>
                                {billingActionMessage}
                            </div>
                        )}
                    </SettingsCard>
                </SettingsSection>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
                    <SettingsSection title="Terms of Service" description="Platform usage terms and account responsibilities.">
                        <SettingsCard>
                            <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.7, marginBottom: 14 }}>
                                Review the legal terms that govern use of Foundry.
                            </div>
                            <SettingsButton onClick={onOpenTerms}>Open Terms</SettingsButton>
                        </SettingsCard>
                    </SettingsSection>

                    <SettingsSection title="Privacy Policy" description="How account, workspace, and AI-processed data are handled.">
                        <SettingsCard>
                            <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.7, marginBottom: 14 }}>
                                View the current privacy policy for data collection, storage, and AI processing.
                            </div>
                            <SettingsButton onClick={onOpenPrivacy}>Open Privacy Policy</SettingsButton>
                        </SettingsCard>
                    </SettingsSection>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
                    <SettingsSection title="Notifications / Preferences" description="Delivery preferences and product-level personalizations.">
                        <SettingsCard>
                            <SettingsRow
                                label="Re-engagement reminders"
                                hint={`Founder check-in reminders after ${getReengagementThresholdCopy(3)}.`}
                                action={
                                    <PreferenceToggle
                                        enabled={notificationPreferences.reengagementEnabled}
                                        onChange={(enabled) => onNotificationPreferencesChange({
                                            ...notificationPreferences,
                                            reengagementEnabled: enabled,
                                        })}
                                    />
                                }
                            />
                            <SettingsRow
                                label="Product updates"
                                hint="General release notes and product announcements."
                                action={
                                    <PreferenceToggle
                                        enabled={notificationPreferences.productUpdatesEnabled}
                                        onChange={(enabled) => onNotificationPreferencesChange({
                                            ...notificationPreferences,
                                            productUpdatesEnabled: enabled,
                                        })}
                                    />
                                }
                            />
                            <SettingsRow
                                label="In-app reminders"
                                hint="Prepared for future in-product notification surfaces."
                                action={
                                    <PreferenceToggle
                                        enabled={notificationPreferences.inAppNotificationsEnabled}
                                        onChange={(enabled) => onNotificationPreferencesChange({
                                            ...notificationPreferences,
                                            inAppNotificationsEnabled: enabled,
                                        })}
                                    />
                                }
                            />
                            <SettingsRow
                                label="Email notifications"
                                hint="Controls whether Foundry can deliver notification emails to this account."
                                action={
                                    <PreferenceToggle
                                        enabled={notificationPreferences.emailNotificationsEnabled}
                                        onChange={(enabled) => onNotificationPreferencesChange({
                                            ...notificationPreferences,
                                            emailNotificationsEnabled: enabled,
                                        })}
                                    />
                                }
                            />
                        </SettingsCard>
                    </SettingsSection>

                    <SettingsSection title="Security" description="Authentication controls and account protection.">
                        <SettingsCard>
                            <SettingsRow label="Password / auth controls" value="Placeholder" />
                            <SettingsRow label="Session review" value="Coming soon" />
                            <SettingsRow label="Two-factor authentication" value="Planned" />
                        </SettingsCard>
                    </SettingsSection>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
                    <SettingsSection title="Support / Contact" description="Foundry support and account assistance.">
                        <SettingsCard>
                            <SettingsRow label="Contact" value={SUPPORT_EMAIL} />
                            <SettingsRow label="Support portal" value="Billing and account help via email" />
                            <SettingsRow label="Priority support" value="Available through the Pro plan and direct support workflows" />
                        </SettingsCard>
                    </SettingsSection>

                    <SettingsSection title="Danger Zone" description="Reserved for destructive account actions and irreversible controls.">
                        <SettingsCard>
                            <SettingsRow label="Delete account" value="Placeholder" hint="Account deletion is not implemented yet. This section is intentionally isolated for future destructive actions." />
                        </SettingsCard>
                    </SettingsSection>
                </div>

                <SettingsSection title="Log Out" description="End the current session and return to sign in.">
                    <SettingsCard>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap", textAlign: "center" }}>
                            <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.7, maxWidth: 620 }}>
                                Signing out clears local Foundry state for this session and routes you back to the sign-in screen.
                            </div>
                            <SettingsButton onClick={onLogout} tone="danger">Log Out</SettingsButton>
                        </div>
                    </SettingsCard>
                </SettingsSection>

                <SettingsSection title="Recent Notifications" description="Latest delivery attempts and in-app notifications for this workspace.">
                    <SettingsCard>
                        {notifications.length === 0 ? (
                            <div style={{ fontSize: 13, color: "#6B665F", lineHeight: 1.7 }}>
                                No notifications yet.
                            </div>
                        ) : (
                            <div style={{ display: "grid", gap: 10 }}>
                                {notifications.slice(0, 5).map((notification) => (
                                    <div key={notification.id} style={{ paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, marginBottom: 6, alignItems: "center" }}>
                                            <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 600 }}>{notification.title}</div>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                                                <div style={{ fontSize: 10, color: notification.readAt ? "#666" : "#E8622A", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                                    {notification.readAt ? "Read" : "Unread"}
                                                </div>
                                                {!notification.readAt && (
                                                    <SettingsButton onClick={() => onMarkNotificationRead(notification.id)}>Mark read</SettingsButton>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 12, color: "#A8A4A0", lineHeight: 1.7, marginBottom: 4 }}>
                                            {notification.message}
                                        </div>
                                        <div style={{ fontSize: 10, color: "#666" }}>
                                            {notification.channel.replace("_", " ")} · {notification.status} · {new Date(notification.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SettingsCard>
                </SettingsSection>
            </div>
        </SettingsScreenShell>
    );
}

function PreferenceToggle({
    enabled,
    onChange,
}: {
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}) {
    return (
        <button
            onClick={() => onChange(!enabled)}
            style={{
                minWidth: 68,
                padding: "8px 12px",
                borderRadius: 999,
                border: enabled ? "1px solid rgba(76,175,138,0.3)" : "1px solid rgba(255,255,255,0.08)",
                background: enabled ? "rgba(76,175,138,0.14)" : "rgba(255,255,255,0.03)",
                color: enabled ? "#4CAF8A" : "#888",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
            }}
        >
            {enabled ? "On" : "Off"}
        </button>
    );
}

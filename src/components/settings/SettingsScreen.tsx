import { useState } from "react";
import type { BillingSubscription } from "../../lib/accessGate";
import { roleLabel } from "../../lib/roles";
import { getReengagementThresholdCopy, type AppNotification, type UserNotificationPreferences } from "../../lib/notifications";
import { REFUND_POLICY, SUPPORT_EMAIL } from "../../config/pricing";
import { submitSettingsFeedback } from "../../lib/settingsFeedback";
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
    onOpenPrivacy: () => void;
    onOpenEula: () => void;
    onOpenTermsAndConditions: () => void;
    onOpenAcceptableUse: () => void;
    onOpenDisclaimer: () => void;
    notificationPreferences: UserNotificationPreferences;
    onNotificationPreferencesChange: (next: UserNotificationPreferences) => void;
    notifications: AppNotification[];
    onMarkNotificationRead: (notificationId: string) => void;
    onOpenManageSubscription: () => void;
    billingActionMessage: string | null;
    billingPortalLoading: boolean;
    onProfileSave: (updates: { displayName: string; businessName: string; marketFocus: string }) => Promise<void>;
    onLogout: () => void;
};

export default function SettingsScreen({
    profile,
    authEmail,
    accessSummary,
    billingSubscription,
    onBack,
    onOpenPrivacy,
    onOpenEula,
    onOpenTermsAndConditions,
    onOpenAcceptableUse,
    onOpenDisclaimer,
    notificationPreferences,
    onNotificationPreferencesChange,
    notifications,
    onMarkNotificationRead,
    onOpenManageSubscription,
    billingActionMessage,
    billingPortalLoading,
    onProfileSave,
    onLogout,
}: SettingsScreenProps) {
    const email = authEmail ?? profile?.email ?? "Not available";

    const [displayName, setDisplayName] = useState(profile?.name ?? "");
    const [businessName, setBusinessName] = useState(profile?.businessName ?? "");
    const [marketFocus, setMarketFocus] = useState(profile?.industry ?? "");
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const [supportMessage, setSupportMessage] = useState("");
    const [supportSubmitting, setSupportSubmitting] = useState(false);
    const [supportStatus, setSupportStatus] = useState<string | null>(null);
    const [suggestionMessage, setSuggestionMessage] = useState("");
    const [suggestionSubmitting, setSuggestionSubmitting] = useState(false);
    const [suggestionStatus, setSuggestionStatus] = useState<string | null>(null);

    const handleProfileSave = async () => {
        setProfileSaving(true);
        setProfileSaved(false);
        await onProfileSave({
            displayName: displayName.trim(),
            businessName: businessName.trim(),
            marketFocus: marketFocus.trim(),
        });
        setProfileSaving(false);
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2500);
    };

    const handleSupportSubmit = async () => {
        if (!supportMessage.trim() || supportSubmitting) return;
        setSupportSubmitting(true);
        setSupportStatus(null);
        try {
            await submitSettingsFeedback({
                kind: "support",
                message: supportMessage.trim(),
                profileName: displayName.trim() || profile?.name || "",
                businessName: businessName.trim() || profile?.businessName || "",
                marketFocus: marketFocus.trim() || profile?.industry || "",
            });
            setSupportMessage("");
            setSupportStatus("Support ticket sent.");
        } catch (error) {
            setSupportStatus(error instanceof Error ? error.message : "Unable to send support ticket.");
        } finally {
            setSupportSubmitting(false);
        }
    };

    const handleSuggestionSubmit = async () => {
        if (!suggestionMessage.trim() || suggestionSubmitting) return;
        setSuggestionSubmitting(true);
        setSuggestionStatus(null);
        try {
            await submitSettingsFeedback({
                kind: "suggestion",
                message: suggestionMessage.trim(),
                profileName: displayName.trim() || profile?.name || "",
                businessName: businessName.trim() || profile?.businessName || "",
                marketFocus: marketFocus.trim() || profile?.industry || "",
            });
            setSuggestionMessage("");
            setSuggestionStatus("Suggestion sent.");
        } catch (error) {
            setSuggestionStatus(error instanceof Error ? error.message : "Unable to send suggestion.");
        } finally {
            setSuggestionSubmitting(false);
        }
    };

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
                    description="Core account identity and the business context Foundry uses across the workspace."
                >
                    <SettingsCard>
                        <SettingsRow label="Signed-in email" value={email} />
                        <SettingsRow label="Role" value={roleLabel(profile?.role)} />
                        <SettingsRow
                            label="Display name"
                            hint="Your name shown across the Foundry workspace."
                            action={
                                <input
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Enter your name"
                                    style={{
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: 8,
                                        color: "#F0EDE8",
                                        fontSize: 13,
                                        padding: "8px 12px",
                                        outline: "none",
                                        width: 220,
                                        textAlign: "left",
                                    }}
                                />
                            }
                        />
                        <SettingsRow
                            label="Business name"
                            hint="Your startup or company name used throughout Foundry."
                            action={
                                <input
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    placeholder="Enter business name"
                                    style={{
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: 8,
                                        color: "#F0EDE8",
                                        fontSize: 13,
                                        padding: "8px 12px",
                                        outline: "none",
                                        width: 220,
                                        textAlign: "left",
                                    }}
                                />
                            }
                        />
                        <SettingsRow
                            label="Business / market"
                            hint="Auto-filled from onboarding. Update this whenever your business focus or market changes."
                            action={
                                <input
                                    value={marketFocus}
                                    onChange={(e) => setMarketFocus(e.target.value)}
                                    placeholder="Example: B2B SaaS for law firms"
                                    style={{
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: 8,
                                        color: "#F0EDE8",
                                        fontSize: 13,
                                        padding: "8px 12px",
                                        outline: "none",
                                        width: 260,
                                        textAlign: "left",
                                    }}
                                />
                            }
                        />
                        <div className="foundry-inline-actions" style={{ paddingTop: 14, justifyContent: "flex-start" }}>
                            <SettingsButton
                                tone="primary"
                                onClick={handleProfileSave}
                                disabled={profileSaving}
                            >
                                {profileSaving ? "Saving…" : "Save Changes"}
                            </SettingsButton>
                            {profileSaved && (
                                <span style={{ fontSize: 12, color: "#4CAF8A" }}>Saved</span>
                            )}
                        </div>
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

                <div className="foundry-grid-2">
                    <SettingsSection title="Privacy Policy" description="How account, workspace, and AI-processed data are handled.">
                        <SettingsCard>
                            <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.7, marginBottom: 14 }}>
                                View the current privacy policy for data collection, storage, and AI processing.
                            </div>
                            <SettingsButton onClick={onOpenPrivacy}>Open Privacy Policy</SettingsButton>
                        </SettingsCard>
                    </SettingsSection>

                    <SettingsSection title="Terms & Conditions" description="The terms and conditions governing your use of Foundry.">
                        <SettingsCard>
                            <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.7, marginBottom: 14 }}>
                                Review the Terms & Conditions for Foundry.
                            </div>
                            <SettingsButton onClick={onOpenTermsAndConditions}>Open Terms & Conditions</SettingsButton>
                        </SettingsCard>
                    </SettingsSection>
                </div>

                <div className="foundry-grid-2">
                    <SettingsSection title="End User License Agreement" description="The EULA governing your license to use the Foundry platform.">
                        <SettingsCard>
                            <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.7, marginBottom: 14 }}>
                                Review the End User License Agreement for Foundry.
                            </div>
                            <SettingsButton onClick={onOpenEula}>Open EULA</SettingsButton>
                        </SettingsCard>
                    </SettingsSection>

                    <SettingsSection title="Acceptable Use Policy" description="Guidelines for appropriate use of the Foundry platform.">
                        <SettingsCard>
                            <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.7, marginBottom: 14 }}>
                                Review the Acceptable Use Policy for Foundry.
                            </div>
                            <SettingsButton onClick={onOpenAcceptableUse}>Open Acceptable Use Policy</SettingsButton>
                        </SettingsCard>
                    </SettingsSection>
                </div>

                <div className="foundry-grid-2">
                    <SettingsSection title="Disclaimer" description="Important disclaimers regarding the use of Foundry.">
                        <SettingsCard>
                            <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.7, marginBottom: 14 }}>
                                Review the Disclaimer for Foundry.
                            </div>
                            <SettingsButton onClick={onOpenDisclaimer}>Open Disclaimer</SettingsButton>
                        </SettingsCard>
                    </SettingsSection>
                </div>

                <div className="foundry-grid-2">
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
                </div>

                <div className="foundry-grid-2">
                    <SettingsSection title="Support Ticket" description="Send a message inside the app when you need help with billing, access, or product issues.">
                        <SettingsCard>
                            <div style={{ display: "grid", gap: 12 }}>
                                <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.7 }}>
                                    This sends an email directly to {SUPPORT_EMAIL}. Include what happened, what screen you were on, and what you expected instead.
                                </div>
                                <textarea
                                    value={supportMessage}
                                    onChange={(event) => setSupportMessage(event.target.value)}
                                    placeholder="Tell us what you need help with..."
                                    rows={6}
                                    style={{
                                        width: "100%",
                                        resize: "vertical",
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: 12,
                                        color: "#F0EDE8",
                                        fontSize: 13,
                                        lineHeight: 1.7,
                                        padding: 14,
                                        outline: "none",
                                        fontFamily: "inherit",
                                        boxSizing: "border-box",
                                    }}
                                />
                                <div className="foundry-inline-actions">
                                    <SettingsButton tone="primary" onClick={handleSupportSubmit} disabled={supportSubmitting || !supportMessage.trim()}>
                                        {supportSubmitting ? "Sending..." : "Submit Support Ticket"}
                                    </SettingsButton>
                                    {supportStatus && (
                                        <span style={{ fontSize: 12, color: supportStatus === "Support ticket sent." ? "#4CAF8A" : "#D28B76" }}>
                                            {supportStatus}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </SettingsCard>
                    </SettingsSection>

                    <SettingsSection title="Suggestions" description="Tell us what would make Foundry more useful from a founder's perspective.">
                        <SettingsCard>
                            <div style={{ display: "grid", gap: 12 }}>
                                <div style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.7 }}>
                                    If there is a feature, workflow, or improvement you want in Foundry, send it here.
                                </div>
                                <textarea
                                    value={suggestionMessage}
                                    onChange={(event) => setSuggestionMessage(event.target.value)}
                                    placeholder="What would be a strong addition to Foundry?"
                                    rows={6}
                                    style={{
                                        width: "100%",
                                        resize: "vertical",
                                        background: "rgba(255,255,255,0.04)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: 12,
                                        color: "#F0EDE8",
                                        fontSize: 13,
                                        lineHeight: 1.7,
                                        padding: 14,
                                        outline: "none",
                                        fontFamily: "inherit",
                                        boxSizing: "border-box",
                                    }}
                                />
                                <div className="foundry-inline-actions">
                                    <SettingsButton tone="primary" onClick={handleSuggestionSubmit} disabled={suggestionSubmitting || !suggestionMessage.trim()}>
                                        {suggestionSubmitting ? "Sending..." : "Submit Suggestion"}
                                    </SettingsButton>
                                    {suggestionStatus && (
                                        <span style={{ fontSize: 12, color: suggestionStatus === "Suggestion sent." ? "#4CAF8A" : "#D28B76" }}>
                                            {suggestionStatus}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </SettingsCard>
                    </SettingsSection>
                </div>

                <SettingsSection title="Log Out" description="End the current session and return to sign in.">
                    <SettingsCard>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", gap: 16, flexWrap: "wrap", textAlign: "left" }}>
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
                                    <div key={notification.id} style={{ paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.05)", textAlign: "left" }}>
                                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                                            <div style={{ fontSize: 13, color: "#F0EDE8", fontWeight: 600 }}>{notification.title}</div>
                                            <div className="foundry-inline-actions">
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

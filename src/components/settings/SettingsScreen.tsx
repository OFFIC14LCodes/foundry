import { useState } from "react";
import MicButton from "../MicButton";
import type { BillingSubscription } from "../../lib/accessGate";
import { roleLabel } from "../../lib/roles";
import { getReengagementThresholdCopy, type AppNotification, type UserNotificationPreferences } from "../../lib/notifications";
import { REFUND_POLICY, SUPPORT_EMAIL } from "../../config/pricing";
import { submitSettingsFeedback } from "../../lib/settingsFeedback";
import { VENTURE_MODE_CARDS } from "../../constants/onboarding";
import { normalizeVentureMode } from "../../lib/ventureMode";
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
    onProfileSave: (updates: {
        displayName: string;
        businessName: string;
        marketFocus: string;
        ventureMode: string;
        ventureGoal: string;
        weeklyHoursAvailable: number | null;
        targetMonthlyIncome: number | null;
    }) => Promise<void>;
    onResetAccount: () => Promise<void>;
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
    onResetAccount,
    onLogout,
}: SettingsScreenProps) {
    const email = authEmail ?? profile?.email ?? "Not available";

    const [displayName, setDisplayName] = useState(profile?.name ?? "");
    const [businessName, setBusinessName] = useState(profile?.businessName ?? "");
    const [marketFocus, setMarketFocus] = useState(profile?.industry ?? "");
    const [ventureMode, setVentureMode] = useState(normalizeVentureMode(profile?.ventureMode));
    const [ventureGoal, setVentureGoal] = useState(profile?.ventureGoal ?? "");
    const [weeklyHoursAvailable, setWeeklyHoursAvailable] = useState(profile?.weeklyHoursAvailable != null ? String(profile.weeklyHoursAvailable) : "");
    const [targetMonthlyIncome, setTargetMonthlyIncome] = useState(profile?.targetMonthlyIncome != null ? String(profile.targetMonthlyIncome) : "");
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const [supportMessage, setSupportMessage] = useState("");
    const [supportSubmitting, setSupportSubmitting] = useState(false);
    const [supportStatus, setSupportStatus] = useState<string | null>(null);
    const [suggestionMessage, setSuggestionMessage] = useState("");
    const [suggestionSubmitting, setSuggestionSubmitting] = useState(false);
    const [suggestionStatus, setSuggestionStatus] = useState<string | null>(null);
    const [resetConfirmation, setResetConfirmation] = useState("");
    const [resettingAccount, setResettingAccount] = useState(false);
    const [resetStatus, setResetStatus] = useState<string | null>(null);

    const handleProfileSave = async () => {
        setProfileSaving(true);
        setProfileSaved(false);
        await onProfileSave({
            displayName: displayName.trim(),
            businessName: businessName.trim(),
            marketFocus: marketFocus.trim(),
            ventureMode,
            ventureGoal: ventureGoal.trim(),
            weeklyHoursAvailable: weeklyHoursAvailable.trim() ? Number(weeklyHoursAvailable) : null,
            targetMonthlyIncome: targetMonthlyIncome.trim() ? Number(targetMonthlyIncome) : null,
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

    const handleResetAccount = async () => {
        if (resettingAccount || resetConfirmation.trim().toUpperCase() !== "RESET") return;
        setResettingAccount(true);
        setResetStatus(null);
        try {
            await onResetAccount();
        } catch (error) {
            setResetStatus(error instanceof Error ? error.message : "Unable to reset this account right now.");
            setResettingAccount(false);
        }
    };

    const planName = accessSummary?.planName ?? "Free";
    const billingStatus = accessSummary?.statusLabel ?? "Pending";
    const version = "Tekori v1";
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
            footer={<div style={{ fontSize: 11, color: "var(--foundry-text-muted)", textAlign: "center" }}>{version}</div>}
        >
            <div style={{ display: "grid", gap: 18 }}>
                <SettingsSection
                    title="Account Details"
                    description="Core account identity and the venture context Tekori uses across the workspace."
                >
                    <SettingsCard>
                        <SettingsRow label="Signed-in email" value={email} />
                        <SettingsRow label="Role" value={roleLabel(profile?.role)} />
                        <SettingsRow
                            label="Display name"
                            hint="Your name shown across the Tekori workspace."
                            action={
                                <input
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Enter your name"
                                    style={{
                                        background: "rgba(7,26,47,0.04)",
                                        border: "1px solid rgba(7,26,47,0.1)",
                                        borderRadius: 8,
                                        color: "var(--color-text)",
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
                            hint="This is where you officially declare or update the startup, company, project, or side hustle name Navi should use."
                            action={
                                <input
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    placeholder="Enter name when ready"
                                    style={{
                                        background: "rgba(7,26,47,0.04)",
                                        border: "1px solid rgba(7,26,47,0.1)",
                                        borderRadius: 8,
                                        color: "var(--color-text)",
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
                            hint="Use this to declare the market, audience, or business direction once Navi helps you clarify it."
                            action={
                                <input
                                    value={marketFocus}
                                    onChange={(e) => setMarketFocus(e.target.value)}
                                    placeholder="Example: B2B SaaS for law firms"
                                    style={{
                                        background: "rgba(7,26,47,0.04)",
                                        border: "1px solid rgba(7,26,47,0.1)",
                                        borderRadius: 8,
                                        color: "var(--color-text)",
                                        fontSize: 13,
                                        padding: "8px 12px",
                                        outline: "none",
                                        width: 260,
                                        textAlign: "left",
                                    }}
                                />
                            }
                        />
                        <SettingsRow
                            label="Path"
                            hint="This changes how Navi frames advice: company, side hustle, full-time transition, or exploration."
                            action={
                                <select
                                    value={ventureMode}
                                    onChange={(e) => setVentureMode(normalizeVentureMode(e.target.value))}
                                    style={{
                                        background: "rgba(7,26,47,0.04)",
                                        border: "1px solid rgba(7,26,47,0.1)",
                                        borderRadius: 8,
                                        color: "var(--color-text)",
                                        fontSize: 13,
                                        padding: "8px 12px",
                                        outline: "none",
                                        width: 260,
                                    }}
                                >
                                    {VENTURE_MODE_CARDS.map((card) => (
                                        <option key={card.id} value={card.id} style={{ background: "var(--color-surface-elevated)", color: "var(--color-text)" }}>
                                            {card.label}
                                        </option>
                                    ))}
                                </select>
                            }
                        />
                        <SettingsRow
                            label="Goal / constraints"
                            hint="Examples: $2,000/mo in 8 hours/week, validate before quitting, keep this part-time."
                            action={
                                <input
                                    value={ventureGoal}
                                    onChange={(e) => setVentureGoal(e.target.value)}
                                    placeholder="What would make this a win?"
                                    style={{
                                        background: "rgba(7,26,47,0.04)",
                                        border: "1px solid rgba(7,26,47,0.1)",
                                        borderRadius: 8,
                                        color: "var(--color-text)",
                                        fontSize: 13,
                                        padding: "8px 12px",
                                        outline: "none",
                                        width: 300,
                                        textAlign: "left",
                                    }}
                                />
                            }
                        />
                        <SettingsRow
                            label="Weekly hours"
                            hint="For side hustles, this helps Navi protect your schedule and calculate whether the work is worth it."
                            action={
                                <input
                                    type="number"
                                    min={0}
                                    max={168}
                                    value={weeklyHoursAvailable}
                                    onChange={(e) => setWeeklyHoursAvailable(e.target.value)}
                                    placeholder="8"
                                    style={{
                                        background: "rgba(7,26,47,0.04)",
                                        border: "1px solid rgba(7,26,47,0.1)",
                                        borderRadius: 8,
                                        color: "var(--color-text)",
                                        fontSize: 13,
                                        padding: "8px 12px",
                                        outline: "none",
                                        width: 100,
                                        textAlign: "left",
                                    }}
                                />
                            }
                        />
                        <SettingsRow
                            label="Target monthly income"
                            hint="Used for side hustle and full-time transition planning."
                            action={
                                <input
                                    type="number"
                                    min={0}
                                    value={targetMonthlyIncome}
                                    onChange={(e) => setTargetMonthlyIncome(e.target.value)}
                                    placeholder="2000"
                                    style={{
                                        background: "rgba(7,26,47,0.04)",
                                        border: "1px solid rgba(7,26,47,0.1)",
                                        borderRadius: 8,
                                        color: "var(--color-text)",
                                        fontSize: 13,
                                        padding: "8px 12px",
                                        outline: "none",
                                        width: 140,
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
                                <span style={{ fontSize: 12, color: "var(--color-success)" }}>Saved</span>
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
                            <div style={{ fontSize: 12, color: "var(--color-text-soft)", lineHeight: 1.7 }}>
                                {billingActionMessage}
                            </div>
                        )}
                    </SettingsCard>
                </SettingsSection>

                <div className="foundry-grid-2">
                    <SettingsSection title="Privacy Policy" description="How account, workspace, and AI-processed data are handled.">
                        <SettingsCard>
                            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.7, marginBottom: 14 }}>
                                View the current privacy policy for data collection, storage, and AI processing.
                            </div>
                            <SettingsButton onClick={onOpenPrivacy}>Open Privacy Policy</SettingsButton>
                        </SettingsCard>
                    </SettingsSection>

                    <SettingsSection title="Terms & Conditions" description="The terms and conditions governing your use of Tekori.">
                        <SettingsCard>
                            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.7, marginBottom: 14 }}>
                                Review the Terms & Conditions for Tekori.
                            </div>
                            <SettingsButton onClick={onOpenTermsAndConditions}>Open Terms & Conditions</SettingsButton>
                        </SettingsCard>
                    </SettingsSection>
                </div>

                <div className="foundry-grid-2">
                    <SettingsSection title="End User License Agreement" description="The EULA governing your license to use the Tekori platform.">
                        <SettingsCard>
                            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.7, marginBottom: 14 }}>
                                Review the End User License Agreement for Tekori.
                            </div>
                            <SettingsButton onClick={onOpenEula}>Open EULA</SettingsButton>
                        </SettingsCard>
                    </SettingsSection>

                    <SettingsSection title="Acceptable Use Policy" description="Guidelines for appropriate use of the Tekori platform.">
                        <SettingsCard>
                            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.7, marginBottom: 14 }}>
                                Review the Acceptable Use Policy for Tekori.
                            </div>
                            <SettingsButton onClick={onOpenAcceptableUse}>Open Acceptable Use Policy</SettingsButton>
                        </SettingsCard>
                    </SettingsSection>
                </div>

                <div className="foundry-grid-2">
                    <SettingsSection title="Disclaimer" description="Important disclaimers regarding the use of Tekori.">
                        <SettingsCard>
                            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.7, marginBottom: 14 }}>
                                Review the Disclaimer for Tekori.
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
                                hint="Controls whether Tekori can deliver notification emails to this account."
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
                                <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
                                    This sends an email directly to {SUPPORT_EMAIL}. Include what happened, what screen you were on, and what you expected instead.
                                </div>
                                <div style={{ position: "relative" }}>
                                    <textarea
                                        value={supportMessage}
                                        onChange={(event) => setSupportMessage(event.target.value)}
                                        placeholder="Tell us what you need help with..."
                                        rows={6}
                                        style={{
                                            width: "100%",
                                            resize: "vertical",
                                            background: "rgba(7,26,47,0.04)",
                                            border: "1px solid rgba(7,26,47,0.1)",
                                            borderRadius: 12,
                                            color: "var(--color-text)",
                                            fontSize: 13,
                                            lineHeight: 1.7,
                                            padding: 14,
                                            paddingTop: 36,
                                            outline: "none",
                                            fontFamily: "inherit",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                    <div style={{ position: "absolute", top: 8, right: 8 }}>
                                        <MicButton value={supportMessage} onChange={setSupportMessage} size={16} idleColor="var(--color-text-muted)" />
                                    </div>
                                </div>
                                <div className="foundry-inline-actions">
                                    <SettingsButton tone="primary" onClick={handleSupportSubmit} disabled={supportSubmitting || !supportMessage.trim()}>
                                        {supportSubmitting ? "Sending..." : "Submit Support Ticket"}
                                    </SettingsButton>
                                    {supportStatus && (
                                        <span style={{ fontSize: 12, color: supportStatus === "Support ticket sent." ? "var(--color-success)" : "var(--color-danger)" }}>
                                            {supportStatus}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </SettingsCard>
                    </SettingsSection>

                    <SettingsSection title="Suggestions" description="Tell us what would make Tekori more useful from a founder's perspective.">
                        <SettingsCard>
                            <div style={{ display: "grid", gap: 12 }}>
                                <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
                                    If there is a feature, workflow, or improvement you want in Tekori, send it here.
                                </div>
                                <div style={{ position: "relative" }}>
                                    <textarea
                                        value={suggestionMessage}
                                        onChange={(event) => setSuggestionMessage(event.target.value)}
                                        placeholder="What would be a strong addition to Tekori?"
                                        rows={6}
                                        style={{
                                            width: "100%",
                                            resize: "vertical",
                                            background: "rgba(7,26,47,0.04)",
                                            border: "1px solid rgba(7,26,47,0.1)",
                                            borderRadius: 12,
                                            color: "var(--color-text)",
                                            fontSize: 13,
                                            lineHeight: 1.7,
                                            padding: 14,
                                            paddingTop: 36,
                                            outline: "none",
                                            fontFamily: "inherit",
                                            boxSizing: "border-box",
                                        }}
                                    />
                                    <div style={{ position: "absolute", top: 8, right: 8 }}>
                                        <MicButton value={suggestionMessage} onChange={setSuggestionMessage} size={16} idleColor="var(--color-text-muted)" />
                                    </div>
                                </div>
                                <div className="foundry-inline-actions">
                                    <SettingsButton tone="primary" onClick={handleSuggestionSubmit} disabled={suggestionSubmitting || !suggestionMessage.trim()}>
                                        {suggestionSubmitting ? "Sending..." : "Submit Suggestion"}
                                    </SettingsButton>
                                    {suggestionStatus && (
                                        <span style={{ fontSize: 12, color: suggestionStatus === "Suggestion sent." ? "var(--color-success)" : "var(--color-danger)" }}>
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
                            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.7, maxWidth: 620 }}>
                                Signing out clears local Tekori state for this session and routes you back to the sign-in screen.
                            </div>
                            <SettingsButton onClick={onLogout} tone="danger">Log Out</SettingsButton>
                        </div>
                    </SettingsCard>
                </SettingsSection>

                <SettingsSection title="Start Over" description="Reset this account back to onboarding while keeping the same login and access level.">
                    <SettingsCard>
                        <div style={{ display: "grid", gap: 14, textAlign: "left" }}>
                            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.7, maxWidth: 700 }}>
                                This wipes your onboarding progress, chat history, archives, Academy progress, business data, workspace memory, documents, and saved venture context so you can start a new business from scratch. Billing and account access stay in place.
                            </div>
                            <div style={{ fontSize: 12, color: "var(--color-danger)", lineHeight: 1.7, fontWeight: 600 }}>
                                This cannot be undone.
                            </div>
                            <div style={{ display: "grid", gap: 8, maxWidth: 320 }}>
                                <div style={{ fontSize: 11, color: "var(--foundry-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                    Type RESET to confirm
                                </div>
                                <input
                                    value={resetConfirmation}
                                    onChange={(event) => setResetConfirmation(event.target.value)}
                                    placeholder="RESET"
                                    autoCapitalize="characters"
                                    spellCheck={false}
                                    style={{
                                        background: "rgba(7,26,47,0.04)",
                                        border: "1px solid rgba(7,26,47,0.1)",
                                        borderRadius: 8,
                                        color: "var(--color-text)",
                                        fontSize: 13,
                                        padding: "10px 12px",
                                        outline: "none",
                                        width: "100%",
                                        boxSizing: "border-box",
                                    }}
                                />
                            </div>
                            <div className="foundry-inline-actions">
                                <SettingsButton
                                    onClick={handleResetAccount}
                                    tone="danger"
                                    disabled={resettingAccount || resetConfirmation.trim().toUpperCase() !== "RESET"}
                                >
                                    {resettingAccount ? "Resetting..." : "Reset Account"}
                                </SettingsButton>
                                {resetStatus && (
                                    <span style={{ fontSize: 12, color: "var(--color-danger)" }}>
                                        {resetStatus}
                                    </span>
                                )}
                            </div>
                        </div>
                    </SettingsCard>
                </SettingsSection>

                <SettingsSection title="Recent Notifications" description="Latest delivery attempts and in-app notifications for this workspace.">
                    <SettingsCard>
                        {notifications.length === 0 ? (
                            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.7 }}>
                                No notifications yet.
                            </div>
                        ) : (
                            <div style={{ display: "grid", gap: 10 }}>
                                {notifications.slice(0, 5).map((notification) => (
                                    <div key={notification.id} style={{ paddingBottom: 10, borderBottom: "1px solid rgba(7,26,47,0.05)", textAlign: "left" }}>
                                        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                                            <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>{notification.title}</div>
                                            <div className="foundry-inline-actions">
                                                <div style={{ fontSize: 10, color: notification.readAt ? "var(--color-text-muted)" : "var(--tekori-gold)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                                    {notification.readAt ? "Read" : "Unread"}
                                                </div>
                                                {!notification.readAt && (
                                                    <SettingsButton onClick={() => onMarkNotificationRead(notification.id)}>Mark read</SettingsButton>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.7, marginBottom: 4 }}>
                                            {notification.message}
                                        </div>
                                        <div style={{ fontSize: 10, color: "var(--foundry-text-secondary)" }}>
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
                border: enabled ? "1px solid rgba(115,135,123,0.30)" : "1px solid rgba(7,26,47,0.08)",
                background: enabled ? "rgba(115,135,123,0.14)" : "rgba(7,26,47,0.03)",
                color: enabled ? "var(--color-success)" : "var(--color-text-muted)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
            }}
        >
            {enabled ? "On" : "Off"}
        </button>
    );
}

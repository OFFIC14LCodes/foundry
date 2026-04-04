import { SettingsScreenShell } from "./SettingsPrimitives";
import TermlyEmbed from "./TermlyEmbed";

export default function PrivacyPolicyScreen({ onBack }: { onBack: () => void }) {
    return (
        <SettingsScreenShell
            title="Privacy Policy"
            subtitle="How we collect, store, and handle your personal data."
            onBack={onBack}
        >
            <TermlyEmbed policyId="0d176e23-aaa4-4ddb-a2ae-cdcb0620d79d" />
        </SettingsScreenShell>
    );
}

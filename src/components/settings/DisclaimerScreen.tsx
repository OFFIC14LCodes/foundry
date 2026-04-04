import { SettingsScreenShell } from "./SettingsPrimitives";
import TermlyEmbed from "./TermlyEmbed";

export default function DisclaimerScreen({ onBack }: { onBack: () => void }) {
    return (
        <SettingsScreenShell
            title="Disclaimer"
            subtitle="Important disclaimers regarding the use of Foundry."
            onBack={onBack}
        >
            <TermlyEmbed policyId="e567f0a7-ec8a-4759-bbd4-b0d7c124aec0" />
        </SettingsScreenShell>
    );
}

import { SettingsScreenShell } from "./SettingsPrimitives";
import TermlyEmbed from "./TermlyEmbed";

export default function AcceptableUsePolicyScreen({ onBack }: { onBack: () => void }) {
    return (
        <SettingsScreenShell
            title="Acceptable Use Policy"
            subtitle="Guidelines for appropriate use of the Foundry platform."
            onBack={onBack}
        >
            <TermlyEmbed policyId="90925d9f-b9b8-4c79-b03b-4913f9f43cf4" />
        </SettingsScreenShell>
    );
}

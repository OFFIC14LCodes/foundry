import { SettingsScreenShell } from "./SettingsPrimitives";
import TermlyEmbed from "./TermlyEmbed";

export default function TermsAndConditionsScreen({ onBack }: { onBack: () => void }) {
    return (
        <SettingsScreenShell
            title="Terms & Conditions"
            subtitle="The terms and conditions governing your use of Foundry."
            onBack={onBack}
        >
            <TermlyEmbed policyId="86781f48-f94d-4df9-a489-ec4b6046a6d7" />
        </SettingsScreenShell>
    );
}

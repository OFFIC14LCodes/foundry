import { SettingsScreenShell } from "./SettingsPrimitives";
import TermlyEmbed from "./TermlyEmbed";

export default function EulaScreen({ onBack }: { onBack: () => void }) {
    return (
        <SettingsScreenShell
            title="End User License Agreement"
            subtitle="The EULA governing your license to use the Foundry platform."
            onBack={onBack}
        >
            <TermlyEmbed policyId="fc9d5081-8999-4ce0-9052-5d51888df5c9" />
        </SettingsScreenShell>
    );
}

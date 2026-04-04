import { useEffect } from "react";
import { SettingsScreenShell } from "./SettingsPrimitives";

export default function AcceptableUsePolicyScreen({ onBack }: { onBack: () => void }) {
    useEffect(() => {
        const scriptId = "termly-jssdk";
        if (!document.getElementById(scriptId)) {
            const script = document.createElement("script");
            script.id = scriptId;
            script.src = "https://app.termly.io/embed-policy.min.js";
            document.body.appendChild(script);
        } else {
            (window as any).termly?.initialize?.();
        }
    }, []);

    return (
        <SettingsScreenShell
            title="Acceptable Use Policy"
            subtitle="Guidelines for appropriate use of the Foundry platform."
            onBack={onBack}
        >
            <div
                style={{
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 12,
                    padding: "24px",
                    border: "1px solid rgba(255,255,255,0.07)",
                    color: "#C8C4BE",
                    fontSize: 13,
                    lineHeight: 1.75,
                }}
            >
                <div
                    name="termly-embed"
                    data-id="90925d9f-b9b8-4c79-b03b-4913f9f43cf4"
                />
            </div>
        </SettingsScreenShell>
    );
}

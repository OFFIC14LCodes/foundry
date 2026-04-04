import { useEffect } from "react";
import { SettingsScreenShell } from "./SettingsPrimitives";

export default function TermsAndConditionsScreen({ onBack }: { onBack: () => void }) {
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
            title="Terms & Conditions"
            subtitle="The terms and conditions governing your use of Foundry."
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
                    data-id="86781f48-f94d-4df9-a489-ec4b6046a6d7"
                />
            </div>
        </SettingsScreenShell>
    );
}

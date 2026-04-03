import { SettingsCard, SettingsScreenShell } from "./SettingsPrimitives";

type LegalSection = {
    heading: string;
    body: string[];
};

type LegalDocumentScreenProps = {
    title: string;
    intro: string;
    sections: LegalSection[];
    onBack: () => void;
};

export default function LegalDocumentScreen({
    title,
    intro,
    sections,
    onBack,
}: LegalDocumentScreenProps) {
    return (
        <SettingsScreenShell
            title={title}
            subtitle="Legal information for your Foundry account and workspace."
            onBack={onBack}
        >
            <SettingsCard>
                <div style={{ fontSize: 14, color: "#C8C4BE", lineHeight: 1.75, marginBottom: 20 }}>
                    {intro}
                </div>
                {sections.map((section, index) => (
                    <div key={section.heading} style={{ paddingTop: index === 0 ? 0 : 18, borderTop: index === 0 ? "none" : "1px solid rgba(255,255,255,0.06)", marginTop: index === 0 ? 0 : 18 }}>
                        <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 8 }}>
                            {section.heading}
                        </div>
                        {section.body.map((paragraph, paragraphIndex) => (
                            <div key={paragraphIndex} style={{ fontSize: 13, color: "#A8A4A0", lineHeight: 1.8, marginBottom: paragraphIndex === section.body.length - 1 ? 0 : 10, whiteSpace: "pre-line" }}>
                                {paragraph}
                            </div>
                        ))}
                    </div>
                ))}
            </SettingsCard>
        </SettingsScreenShell>
    );
}

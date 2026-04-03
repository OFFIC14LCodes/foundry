import LegalDocumentScreen from "./LegalDocumentScreen";

const PRIVACY_SECTIONS = [
    {
        heading: "1. Information We Collect",
        body: [
            "- Account information (email, profile data)\n- Business inputs (ideas, documents, messages)\n- Usage data (interactions, features used)",
        ],
    },
    {
        heading: "2. How We Use Information",
        body: [
            "- To provide and improve the platform\n- To personalize your experience\n- To maintain system performance and security",
        ],
    },
    {
        heading: "3. AI Processing",
        body: [
            "Your inputs may be processed by AI systems to generate outputs and guidance within the platform.",
        ],
    },
    {
        heading: "4. Data Storage",
        body: [
            "Data is stored securely using services such as Supabase and related infrastructure.",
        ],
    },
    {
        heading: "5. Third-Party Services",
        body: [
            "We may use services like Supabase (auth/database) and Stripe (billing). These providers may process data as needed.",
        ],
    },
    {
        heading: "6. Data Retention",
        body: [
            "We retain your data as long as your account is active or as needed to provide services.",
        ],
    },
    {
        heading: "7. Security",
        body: [
            "We take reasonable measures to protect your data but cannot guarantee absolute security.",
        ],
    },
    {
        heading: "8. Your Rights",
        body: [
            "You may request access, updates, or deletion of your data by contacting us.",
        ],
    },
    {
        heading: "9. Changes to Policy",
        body: [
            "We may update this policy over time.",
        ],
    },
    {
        heading: "10. Contact",
        body: [
            "foundryandforge.app@gmail.com",
        ],
    },
];

export default function PrivacyPolicyScreen({ onBack }: { onBack: () => void }) {
    return (
        <LegalDocumentScreen
            title="Foundry Privacy Policy"
            intro="Your privacy is important to us. This policy explains how we collect and use your data."
            sections={PRIVACY_SECTIONS}
            onBack={onBack}
        />
    );
}

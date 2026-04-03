import LegalDocumentScreen from "./LegalDocumentScreen";

const TERMS_SECTIONS = [
    {
        heading: "1. Purpose of Foundry",
        body: [
            "Foundry is an AI-powered platform designed to help users explore, structure, and build business ideas through guided stages, tools, and educational systems.",
            "Foundry is intended to support users in developing their own businesses, but it does not guarantee success, outcomes, or results.",
        ],
    },
    {
        heading: "2. Eligibility",
        body: [
            "You must be at least 18 years old to use Foundry.",
            "By using the platform, you represent that you meet this requirement.",
        ],
    },
    {
        heading: "3. Account Registration and Responsibility",
        body: [
            "You are responsible for:\n\nMaintaining the confidentiality of your account\nAll activity that occurs under your account\nProviding accurate and current information",
            "You agree not to share your account access with others unless explicitly permitted (e.g., future cofounder features).",
        ],
    },
    {
        heading: "4. Acceptable Use",
        body: [
            "You agree not to:\n\nUse Foundry for illegal, harmful, or fraudulent activities\nAttempt to reverse engineer, exploit, or disrupt the platform\nInterfere with other users’ experience\nUse the platform in a way that violates applicable laws",
            "We reserve the right to suspend or terminate accounts that violate these rules.",
        ],
    },
    {
        heading: "5. AI-Generated Content Disclaimer",
        body: [
            "Foundry uses artificial intelligence to generate guidance, suggestions, and content.",
            "You understand and agree:\n\nOutputs may be incomplete, inaccurate, or not applicable to your situation\nYou are responsible for evaluating and verifying any information provided\nYou should not rely on Foundry as a sole source of truth for critical decisions",
        ],
    },
    {
        heading: "6. No Professional Advice",
        body: [
            "Foundry does not provide:\n\nLegal advice\nFinancial or investment advice\nTax advice\nLicensed professional services",
            "You are responsible for consulting qualified professionals where necessary.",
        ],
    },
    {
        heading: "7. User Content and Ownership",
        body: [
            "You retain ownership of:\n\nYour business ideas\nDocuments\nInputs and content you create within Foundry",
            "By using Foundry, you grant us a limited license to:\n\nProcess your content to provide the service\nImprove system functionality (in aggregated or anonymized form)",
            "We do not claim ownership of your business ideas.",
        ],
    },
    {
        heading: "8. Platform Ownership",
        body: [
            "All aspects of Foundry, including:\n\nSoftware\nDesign\nBranding\nSystems (including the Foundry Method and Forge)\n\nare owned by Foundry and protected by intellectual property laws.",
            "You may not copy, reproduce, or distribute these without permission.",
        ],
    },
    {
        heading: "9. Subscriptions and Billing",
        body: [
            "Certain features require a paid subscription.",
            "By subscribing, you agree:\n\nBilling may be recurring (monthly or otherwise specified)\nPricing and plans will be clearly presented before purchase\nYou may cancel at any time, but refunds are not guaranteed unless required by law",
            "If pricing changes in the future, existing users will be treated according to the plan they selected, including any founding offers where applicable.",
        ],
    },
    {
        heading: "10. Fair Use and Platform Integrity",
        body: [
            "We aim to provide a high-quality experience for all users.",
            "We may limit or restrict usage if:\n\nActivity is abusive or excessively burdens system resources\nUsage patterns suggest exploitation of the platform",
            "These decisions will be made reasonably and in good faith.",
        ],
    },
    {
        heading: "11. Termination and Suspension",
        body: [
            "We may suspend or terminate your account if:\n\nYou violate these Terms\nYour activity poses risk to the platform or other users",
            "You may stop using Foundry at any time.",
        ],
    },
    {
        heading: "12. Disclaimers",
        body: [
            "Foundry is provided “as is” and “as available.”",
            "We do not guarantee:\n\nContinuous availability\nError-free operation\nSpecific outcomes or business success",
        ],
    },
    {
        heading: "13. Limitation of Liability",
        body: [
            "To the maximum extent permitted by law:",
            "Foundry shall not be liable for:\n\nBusiness losses\nLost profits or opportunities\nDecisions made based on platform content\nIndirect or consequential damages",
            "Our total liability will not exceed the amount you paid to use Foundry in the past 12 months.",
        ],
    },
    {
        heading: "14. Indemnification",
        body: [
            "You agree to indemnify and hold harmless Foundry from claims arising from:\n\nYour use of the platform\nYour violation of these Terms\nYour business activities",
        ],
    },
    {
        heading: "15. Changes to the Service",
        body: [
            "We may:\n\nImprove, modify, or discontinue features\nIntroduce new tools or pricing structures",
            "We will make reasonable efforts to communicate significant changes.",
        ],
    },
    {
        heading: "16. Changes to These Terms",
        body: [
            "We may update these Terms from time to time.",
            "If we make material changes, we will notify users appropriately.\nContinued use of Foundry means you accept the updated Terms.",
        ],
    },
    {
        heading: "17. Governing Law",
        body: [
            "These Terms are governed by the laws of the United States and the applicable state in which the company operates.",
        ],
    },
    {
        heading: "18. Contact",
        body: [
            "If you have questions about these Terms, contact:\n\nfoundryandforge.app@gmail.com",
        ],
    },
];

export default function TermsOfServiceScreen({ onBack }: { onBack: () => void }) {
    return (
        <LegalDocumentScreen
            title="Foundry Terms of Service"
            intro={"Effective Date: April 2, 2026\n\nWelcome to Foundry. These Terms of Service (“Terms”) govern your use of the Foundry platform, including all features, content, and services provided through the application (“Foundry,” “we,” “us,” or “our”).\n\nBy accessing or using Foundry, you agree to these Terms. If you do not agree, you may not use the platform."}
            sections={TERMS_SECTIONS}
            onBack={onBack}
        />
    );
}

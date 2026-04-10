import type { DocCategory, DocItem } from "../constants/docCategories";
import { US_STATES } from "../constants/docCategories";
import { formatLegalDate, getIsoDate } from "./legalDate";

export type DocumentFieldType =
    | "text"
    | "textarea"
    | "select"
    | "date"
    | "email"
    | "phone"
    | "number"
    | "currency"
    | "percentage"
    | "checkbox"
    | "list";

export interface DocumentField {
    id: string;
    label: string;
    type: DocumentFieldType;
    required?: boolean;
    placeholder?: string;
    help?: string;
    options?: string[];
    minItems?: number;
    rows?: number;
}

export interface DocumentFieldGroup {
    id: string;
    title: string;
    description?: string;
    fields: DocumentField[];
}

export interface DocumentRequirement {
    docId: string;
    title: string;
    groups: DocumentFieldGroup[];
}

export interface DocumentValidationResult {
    valid: boolean;
    missingRequired: string[];
    errors: Record<string, string>;
}

export interface SuggestedDocumentSettings {
    audience: string;
    tone: string;
}

const COMMON_FIELDS: DocumentFieldGroup = {
    id: "core",
    title: "Core document information",
    description: "These details help Forge produce a complete document instead of a generic draft.",
    fields: [
        {
            id: "legalBusinessName",
            label: "Legal business name",
            type: "text",
            required: true,
            placeholder: "Example: Northstar Coffee LLC",
            help: "Use the exact legal name that should appear in the official document. Foundry does not auto-fill this from your business idea.",
        },
        {
            id: "primaryContactName",
            label: "Primary founder / signer full name",
            type: "text",
            required: true,
            placeholder: "First and last legal name",
            help: "Enter the person who will sign, submit, or own responsibility for this document.",
        },
        {
            id: "primaryContactTitle",
            label: "Title / role",
            type: "text",
            required: true,
            placeholder: "Founder, CEO, Managing Member, Owner",
            help: "Use the role that should appear in the document, not necessarily your Foundry account role.",
        },
        {
            id: "documentDate",
            label: "Document date",
            type: "date",
            required: true,
            help: "Defaults to today. Turn off auto-fill if this document needs a different effective/signing date.",
        },
    ],
};

const STATE_FIELD: DocumentField = {
    id: "jurisdictionState",
    label: "State / jurisdiction",
    type: "select",
    required: true,
    options: US_STATES,
    placeholder: "Select the state this document should follow",
    help: "Forge will use this as the controlling jurisdiction context. State-specific legal review may still be required.",
};

const CATEGORY_GROUPS: Record<string, DocumentFieldGroup[]> = {
    "business-planning": [
        {
            id: "business-detail",
            title: "Business substance",
            fields: [
                { id: "targetAudienceDetail", label: "Specific reader or recipient", type: "text", placeholder: "Example: loan officer, angel investor, strategic partner", help: "If you know the exact person or organization receiving this, enter it here." },
                { id: "tractionSummary", label: "Traction / proof points", type: "textarea", rows: 3, placeholder: "Revenue, waitlist, pilots, customers, partnerships, testimonials", help: "Include concrete numbers where you can. Leave blank if you are pre-launch." },
                { id: "fundingAmount", label: "Funding amount or ask", type: "currency", placeholder: "Example: $75,000", help: "Only needed if this document should include a funding or capital request." },
            ],
        },
    ],
    "legal-formation": [
        {
            id: "formation-detail",
            title: "Entity and filing details",
            fields: [
                { id: "entityType", label: "Entity type", type: "select", required: true, options: ["LLC", "Corporation", "S-Corporation", "C-Corporation", "Partnership", "Sole Proprietorship", "Other"], help: "Choose the legal structure this document should assume." },
                { id: "businessAddress", label: "Principal business address", type: "textarea", required: true, rows: 2, placeholder: "Street address, city, state, ZIP", help: "Use the official business address. If you do not have one yet, use the address intended for filings." },
                { id: "registeredAgentName", label: "Registered agent full name or company", type: "text", placeholder: "Example: Jane Smith or Acme Registered Agents Inc.", help: "A registered agent receives official legal/government notices. Many filings require this." },
                { id: "registeredAgentAddress", label: "Registered agent street address", type: "textarea", rows: 2, placeholder: "Street address, city, state, ZIP", help: "Usually must be a physical address in the filing state, not a P.O. box." },
                { id: "ownersOrMembers", label: "Owners / members / shareholders", type: "list", required: true, minItems: 1, placeholder: "Jane Smith - 60%\nAlex Lee - 40%", help: "Enter one person or entity per line. Include ownership percentages if known." },
                { id: "managementStructure", label: "Management structure", type: "select", options: ["Member-managed", "Manager-managed", "Board-managed", "Founder-managed", "Not sure"], help: "For LLCs, member-managed means owners manage directly; manager-managed means appointed managers run operations." },
            ],
        },
    ],
    "tax-federal": [
        {
            id: "tax-detail",
            title: "Tax and federal details",
            fields: [
                { id: "taxpayerName", label: "Taxpayer / entity legal name", type: "text", required: true, help: "Use the name that appears, or will appear, on tax filings." },
                { id: "taxId", label: "EIN or SSN last four", type: "text", placeholder: "Only enter what is safe and necessary", help: "Do not enter a full SSN unless you are comfortable doing so. Last four or EIN is usually enough for drafting context." },
                { id: "taxClassification", label: "Tax classification", type: "select", options: ["Sole proprietor", "Single-member LLC", "Partnership", "C-Corporation", "S-Corporation", "Nonprofit", "Not sure"], help: "If unsure, choose Not sure and have a tax professional confirm before filing." },
                { id: "taxYear", label: "Tax year", type: "text", placeholder: "Example: 2026" },
            ],
        },
    ],
    "banking-finance": [
        {
            id: "finance-detail",
            title: "Financial details",
            fields: [
                { id: "bankOrCounterparty", label: "Bank, lender, investor, or counterparty", type: "text", placeholder: "If known" },
                { id: "authorizedSigners", label: "Authorized signers / approvers", type: "list", minItems: 1, placeholder: "Jane Smith - Managing Member - up to $10,000", help: "Enter one person per line. Include first and last name, title, and any approval limit." },
                { id: "amount", label: "Amount involved", type: "currency", placeholder: "Loan, contribution, investment, purchase price, or invoice amount", help: "Use the total amount the document should reference, if any." },
                { id: "paymentTerms", label: "Payment or repayment terms", type: "textarea", rows: 3, placeholder: "Due date, interest, repayment schedule, late fees, milestones" },
            ],
        },
    ],
    "contracts-agreements": [
        {
            id: "agreement-detail",
            title: "Agreement details",
            fields: [
                { id: "parties", label: "Parties to the agreement", type: "list", required: true, minItems: 2, placeholder: "Northstar Coffee LLC - Company - 123 Main St, Austin, TX\nJane Smith - Contractor - 456 Oak Ave, Austin, TX", help: "Enter one party per line. Include legal name, role, and address if available." },
                { id: "effectiveDate", label: "Effective date", type: "date", required: true },
                { id: "termOrDuration", label: "Term / duration", type: "text", placeholder: "Example: 12 months, until project completion, at-will" },
                { id: "compensation", label: "Compensation / consideration", type: "textarea", rows: 3, placeholder: "Payment amount, equity, services exchanged, or other consideration" },
                { id: "governingLaw", label: "Governing law", type: "select", options: US_STATES, help: "The state law that should govern the agreement. If unsure, use your business state and have counsel confirm." },
            ],
        },
    ],
    "employment-hr": [
        {
            id: "employment-detail",
            title: "Employment details",
            fields: [
                { id: "employeeOrContractorName", label: "Worker / employee full name", type: "text", required: true, placeholder: "First and last legal name" },
                { id: "roleTitle", label: "Role title", type: "text", required: true },
                { id: "startDate", label: "Start date", type: "date" },
                { id: "compensation", label: "Compensation", type: "textarea", rows: 2, placeholder: "Salary, hourly rate, bonus, equity, benefits" },
            ],
        },
    ],
    "communication-marketing": [
        {
            id: "communication-detail",
            title: "Communication details",
            fields: [
                { id: "recipientName", label: "Recipient / publication / audience", type: "text", placeholder: "If known", help: "Use the person, organization, publication, or audience this should address." },
                { id: "keyMessage", label: "Key message", type: "textarea", required: true, rows: 3, placeholder: "The main point this document must communicate" },
                { id: "callToAction", label: "Call to action", type: "text", placeholder: "Example: schedule a meeting, remit payment, publish announcement" },
            ],
        },
    ],
    "dissolution-exit": [
        {
            id: "exit-detail",
            title: "Exit / dissolution details",
            fields: [
                { id: "decisionDate", label: "Decision or closing date", type: "date" },
                { id: "assetsOrObligations", label: "Assets, debts, claims, or obligations", type: "textarea", rows: 3, placeholder: "Summarize what must be transferred, paid, assigned, or wound down" },
                { id: "parties", label: "Relevant parties", type: "list", placeholder: "Owners, buyer, creditors, employees, or advisors" },
            ],
        },
    ],
};

const DOCUMENT_OVERRIDES: Record<string, DocumentFieldGroup[]> = {
    "articles-of-organization": [
        {
            id: "filing-specific",
            title: "Filing-specific details",
            fields: [
                { id: "organizerName", label: "Organizer full name", type: "text", required: true, placeholder: "First and last legal name", help: "The organizer is the person or company preparing/submitting the formation filing." },
                { id: "llcDuration", label: "LLC duration", type: "select", options: ["Perpetual", "Specific end date", "Not sure"] },
                { id: "professionalLlc", label: "Is this a professional LLC?", type: "checkbox", help: "Applies to some regulated professions." },
            ],
        },
    ],
    "operating-agreement": [
        {
            id: "agreement-specific",
            title: "Operating agreement terms",
            fields: [
                { id: "profitSplit", label: "Profit / loss split", type: "textarea", required: true, rows: 2, placeholder: "Equal, pro rata by ownership, or custom terms" },
                { id: "votingRules", label: "Voting and approval rules", type: "textarea", rows: 3, placeholder: "Majority, unanimous for major decisions, manager approval, etc." },
                { id: "memberExitRules", label: "Member exit / buyout rules", type: "textarea", rows: 3 },
            ],
        },
    ],
    "banking-resolution": [
        {
            id: "banking-specific",
            title: "Banking authority",
            fields: [
                { id: "accountTypes", label: "Account types authorized", type: "list", required: true, placeholder: "Checking, savings, credit card, merchant account, line of credit" },
                { id: "approvalLimits", label: "Approval limits", type: "textarea", rows: 2, placeholder: "Example: single signer under $5,000; two signers above $5,000" },
            ],
        },
    ],
    "invoice-template": [
        {
            id: "invoice-specific",
            title: "Invoice details",
            fields: [
                { id: "clientName", label: "Client name", type: "text", required: true },
                { id: "invoiceItems", label: "Invoice line items", type: "list", required: true, placeholder: "One per line. Example: Strategy consulting - 10 hours - $1,500" },
                { id: "paymentDueDate", label: "Payment due date", type: "date" },
                { id: "paymentMethods", label: "Accepted payment methods", type: "list", placeholder: "ACH, check, Stripe link, wire transfer" },
            ],
        },
    ],
    "promissory-note": [
        {
            id: "note-specific",
            title: "Loan terms",
            fields: [
                { id: "borrowerName", label: "Borrower name", type: "text", required: true },
                { id: "lenderName", label: "Lender name", type: "text", required: true },
                { id: "principalAmount", label: "Principal amount", type: "currency", required: true },
                { id: "interestRate", label: "Interest rate", type: "percentage" },
                { id: "maturityDate", label: "Maturity date", type: "date" },
            ],
        },
    ],
    "nda": [
        {
            id: "nda-specific",
            title: "NDA terms",
            fields: [
                { id: "ndaType", label: "NDA type", type: "select", required: true, options: ["Mutual", "One-way: we disclose", "One-way: they disclose"] },
                { id: "confidentialInfo", label: "Confidential information covered", type: "textarea", required: true, rows: 3 },
                { id: "confidentialityTerm", label: "Confidentiality term", type: "text", placeholder: "Example: 2 years, 5 years, indefinite for trade secrets" },
            ],
        },
    ],
};

function cloneGroup(group: DocumentFieldGroup): DocumentFieldGroup {
    return {
        ...group,
        fields: group.fields.map((field) => ({ ...field, options: field.options ? [...field.options] : undefined })),
    };
}

function uniqueGroups(groups: DocumentFieldGroup[]) {
    const seen = new Set<string>();
    return groups.map((group) => {
        const fields = group.fields.filter((field) => {
            if (seen.has(field.id)) return false;
            seen.add(field.id);
            return true;
        });
        return { ...group, fields };
    }).filter((group) => group.fields.length > 0);
}

function inferGroups(doc: DocItem, category: DocCategory): DocumentFieldGroup[] {
    const docText = `${doc.id} ${doc.name}`.toLowerCase();
    const groups: DocumentFieldGroup[] = [cloneGroup(COMMON_FIELDS)];

    if (doc.isStateAware || category.isStateAware) {
        groups[0].fields.push({ ...STATE_FIELD });
    }

    groups.push(...(CATEGORY_GROUPS[category.id] || []).map(cloneGroup));
    groups.push(...(DOCUMENT_OVERRIDES[doc.id] || []).map(cloneGroup));

    if (docText.includes("signature") || docText.includes("resolution") || docText.includes("agreement") || docText.includes("letter")) {
        groups.push({
            id: "signature",
            title: "Execution and signature details",
            fields: [
                { id: "signatureName", label: "Signature full name", type: "text", required: true, placeholder: "First and last legal name", help: "This is the printed name that should appear under the signature line." },
                { id: "signatureTitle", label: "Signature title", type: "text", placeholder: "Title under the signature line" },
                { id: "signatureDate", label: "Signature date", type: "date", help: "Leave blank to use the document date." },
            ],
        });
    }

    if (docText.includes("notary") || docText.includes("articles") || docText.includes("dissolution") || docText.includes("formation")) {
        groups.push({
            id: "official",
            title: "Official / notary details",
            fields: [
                { id: "county", label: "County", type: "text", placeholder: "County for filing or acknowledgment, if applicable" },
                { id: "notaryRequired", label: "Include notary acknowledgment section if appropriate", type: "checkbox" },
                { id: "filingOffice", label: "Filing office", type: "text", placeholder: "Secretary of State, county clerk, court, etc." },
            ],
        });
    }

    return uniqueGroups(groups);
}

export function getDocumentRequirement(doc: DocItem, category: DocCategory): DocumentRequirement {
    return {
        docId: doc.id,
        title: doc.name,
        groups: inferGroups(doc, category),
    };
}

export function createDocumentInputDefaults(doc: DocItem, category: DocCategory, profile: any): Record<string, any> {
    const requirement = getDocumentRequirement(doc, category);
    const defaults: Record<string, any> = {
        legalBusinessName: "",
        primaryContactName: profile.name || "",
        primaryContactTitle: profile.role && typeof profile.role === "string" && profile.role !== "user" ? profile.role : "Founder",
        documentDate: getIsoDate(),
        jurisdictionState: "",
        entityType: "",
        taxpayerName: "",
        signatureName: profile.name || "",
        signatureTitle: "Founder",
        signatureDate: getIsoDate(),
    };

    requirement.groups.forEach((group) => {
        group.fields.forEach((field) => {
            if (defaults[field.id] !== undefined) return;
            defaults[field.id] = field.type === "checkbox" ? false : field.type === "date" ? getIsoDate() : "";
        });
    });

    return defaults;
}

export function getSuggestedDocumentSettings(doc: DocItem, category: DocCategory): SuggestedDocumentSettings {
    const text = `${doc.id} ${doc.name} ${category.id} ${category.name}`.toLowerCase();

    if (text.includes("press") || text.includes("media")) {
        return { audience: "Media/Press", tone: "Professional" };
    }

    if (text.includes("investor") || text.includes("safe") || text.includes("pitch") || text.includes("capital")) {
        return { audience: "Investor", tone: "Persuasive" };
    }

    if (text.includes("funding") || text.includes("loan") || text.includes("bank") || text.includes("promissory") || text.includes("w-9") || text.includes("ein") || text.includes("tax")) {
        return { audience: "Bank", tone: "Formal" };
    }

    if (text.includes("agreement") || text.includes("articles") || text.includes("bylaws") || text.includes("resolution") || text.includes("registered agent") || text.includes("dissolution") || text.includes("compliance") || text.includes("policy") || text.includes("privacy") || text.includes("terms")) {
        return { audience: "Attorney", tone: "Formal" };
    }

    if (text.includes("offer") || text.includes("employee") || text.includes("contractor") || text.includes("severance") || text.includes("handbook")) {
        return { audience: "Internal", tone: "Professional" };
    }

    if (text.includes("cold") || text.includes("follow-up") || text.includes("testimonial") || text.includes("quote") || text.includes("invoice") || text.includes("proposal")) {
        return { audience: "Customers", tone: "Friendly" };
    }

    if (text.includes("partnership") || text.includes("sponsorship")) {
        return { audience: "Partner", tone: "Persuasive" };
    }

    if (category.id === "business-planning") {
        return { audience: "Investor", tone: "Premium" };
    }

    return { audience: "General", tone: "Professional" };
}

function isBlank(value: unknown) {
    if (Array.isArray(value)) return value.filter((item) => String(item).trim()).length === 0;
    if (typeof value === "boolean") return false;
    return String(value ?? "").trim().length === 0;
}

function listItems(value: unknown) {
    if (Array.isArray(value)) return value.map(String).filter((item) => item.trim().length > 0);
    return String(value ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
}

function formatListForPrompt(field: DocumentField, value: unknown) {
    const items = listItems(value);
    if (!items.length) return "";

    if (field.id === "ownersOrMembers") {
        const rows = items.map((item) => {
            const parts = item.split(/\s+-\s+/);
            const name = parts[0]?.trim() || item;
            const ownershipOrRole = parts.slice(1).join(" - ").trim() || "As provided";
            return `| ${name} | ${ownershipOrRole} |`;
        });

        return `- ${field.label}:\n  Render these as a clean member/ownership table in the final document.\n\n| Member / Owner | Ownership / Role |\n| --- | --- |\n${rows.join("\n")}`;
    }

    return `- ${field.label}:\n${items.map((item) => `  - ${item}`).join("\n")}`;
}

export function validateDocumentInputs(requirement: DocumentRequirement, values: Record<string, any>): DocumentValidationResult {
    const missingRequired: string[] = [];
    const errors: Record<string, string> = {};

    requirement.groups.forEach((group) => {
        group.fields.forEach((field) => {
            const value = values[field.id];
            if (field.required && isBlank(value)) {
                missingRequired.push(field.label);
                errors[field.id] = field.id === "legalBusinessName"
                    ? "Legal Business Name is required for official documents"
                    : "Required";
                return;
            }

            if (isBlank(value)) return;

            if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
                errors[field.id] = "Enter a valid email address";
            }

            if (field.type === "date" && Number.isNaN(new Date(String(value)).getTime())) {
                errors[field.id] = "Enter a valid date";
            }

            if (["number", "currency", "percentage"].includes(field.type) && Number.isNaN(Number(String(value).replace(/[$,%\s,]/g, "")))) {
                errors[field.id] = "Enter a valid number";
            }

            if (field.type === "phone" && String(value).replace(/\D/g, "").length < 10) {
                errors[field.id] = "Enter a valid phone number";
            }

            if (field.type === "list" && field.minItems && listItems(value).length < field.minItems) {
                errors[field.id] = `Add at least ${field.minItems} item${field.minItems === 1 ? "" : "s"}`;
            }
        });
    });

    return {
        valid: missingRequired.length === 0 && Object.keys(errors).length === 0,
        missingRequired,
        errors,
    };
}

export function formatDocumentInputsForPrompt(requirement: DocumentRequirement, values: Record<string, any>) {
    const legalDocumentDate = formatLegalDate(values.documentDate || getIsoDate());
    const legalBusinessName = String(values.legalBusinessName || "").trim();

    return requirement.groups.map((group) => {
        const lines = group.fields
            .map((field) => {
                const value = values[field.id];
                if (field.type === "checkbox") return `- ${field.label}: ${value ? "Yes" : "No"}`;
                if (field.type === "list") {
                    return formatListForPrompt(field, value);
                }
                if (isBlank(value)) return "";
                if (field.type === "date") {
                    return `- ${field.label}: ${formatLegalDate(value)} (${value})`;
                }
                return `- ${field.label}: ${value}`;
            })
            .filter(Boolean);

        return lines.length ? `${group.title}:\n${lines.join("\n")}` : "";
    }).filter(Boolean).join("\n\n") + `\n\nLegal business name source of truth: ${legalBusinessName || "[Legal Business Name required]"}\nUse this exact Legal Business Name for the title block, FOR line, entity name section, signature references, and repeated legal references. Do not use the onboarding business idea as the entity name.\n\nLegal date phrase to use wherever the document needs a formal date: ${legalDocumentDate}`;
}

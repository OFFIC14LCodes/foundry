import { DOC_CATEGORIES } from "../constants/docCategories";
import type { VaultDocument } from "../db";

export type DocumentNeedGoal =
    | "starting_a_business"
    | "preparing_to_launch"
    | "hiring"
    | "getting_funding"
    | "working_with_clients"
    | "protecting_ip"
    | "taxes_finance"
    | "other";

export type RecommendationAction = "generate" | "review_existing" | "upload" | "send_for_signature";

export interface DocumentNeedWizardInput {
    entityType: string;
    state: string;
    currentStage: number;
    goal: DocumentNeedGoal;
    notes: string;
    businessName?: string;
    industry?: string;
}

export interface DocumentNeedRecommendationItem {
    key: string;
    categoryId: string;
    categoryName: string;
    documentId: string;
    documentName: string;
    whyItMatters: string;
    suggestedStage: number;
    existsInVault: boolean;
    existingDocumentId: string | null;
    recommendedAction: RecommendationAction;
}

export interface DocumentNeedRecommendationResult {
    generatedBy: "ai" | "fallback";
    disclaimer: string;
    summary: string;
    mustHave: DocumentNeedRecommendationItem[];
    shouldHave: DocumentNeedRecommendationItem[];
    optionalFuture: DocumentNeedRecommendationItem[];
}

type CatalogDoc = {
    categoryId: string;
    categoryName: string;
    documentId: string;
    documentName: string;
    whenToUse: string;
};

const DISCLAIMER = "Foundry can help you identify common documents, but this does not replace legal or tax advice.";

const CATALOG: CatalogDoc[] = DOC_CATEGORIES.flatMap((category) => (
    category.documents.map((document) => ({
        categoryId: category.id,
        categoryName: category.name,
        documentId: document.id,
        documentName: document.name,
        whenToUse: document.whenToUse,
    }))
));

const GOAL_LABELS: Record<DocumentNeedGoal, string> = {
    starting_a_business: "starting a business",
    preparing_to_launch: "preparing to launch",
    hiring: "hiring",
    getting_funding: "getting funding",
    working_with_clients: "working with clients",
    protecting_ip: "protecting IP",
    taxes_finance: "taxes and finance",
    other: "other priorities",
};

const GOAL_QUERY_MAP: Record<DocumentNeedGoal, {
    must: string[];
    should: string[];
    optional: string[];
}> = {
    starting_a_business: {
        must: ["articles organization llc", "operating agreement", "ein", "banking resolution"],
        should: ["registered agent", "business summary", "w-9", "sales tax"],
        optional: ["good standing", "member resolution", "insurance"],
    },
    preparing_to_launch: {
        must: ["business summary", "privacy", "terms", "sales tax"],
        should: ["business license", "insurance", "w-9", "service agreement"],
        optional: ["ada", "refund", "website disclaimer"],
    },
    hiring: {
        must: ["employment offer", "independent contractor", "background check", "employee handbook"],
        should: ["invention assignment", "non-disclosure", "non-solicitation", "confidentiality"],
        optional: ["non-compete", "employee warning", "termination"],
    },
    getting_funding: {
        must: ["investor overview", "funding request", "profit and loss", "cash flow"],
        should: ["balance sheet", "cap table", "founder stock", "83(b)"],
        optional: ["board consent", "purchase agreement", "financial statement"],
    },
    working_with_clients: {
        must: ["service agreement", "statement of work", "master service", "w-9"],
        should: ["non-disclosure", "invoice", "change order", "proposal"],
        optional: ["demand letter", "purchase agreement", "terms"],
    },
    protecting_ip: {
        must: ["trademark", "invention assignment", "non-disclosure", "copyright"],
        should: ["confidentiality", "contractor", "employment offer", "cease and desist"],
        optional: ["assignment", "license", "trade secret"],
    },
    taxes_finance: {
        must: ["ein", "w-9", "profit and loss", "quarterly tax"],
        should: ["balance sheet", "cash flow", "s-corporation", "expense policy"],
        optional: ["home office", "1099", "loan package"],
    },
    other: {
        must: ["business summary", "operating agreement", "service agreement", "w-9"],
        should: ["privacy", "non-disclosure", "profit and loss", "banking resolution"],
        optional: ["insurance", "sales tax", "good standing"],
    },
};

function normalize(value: string) {
    return String(value || "").trim().toLowerCase();
}

function buildVaultLookup(vaultDocuments: VaultDocument[]) {
    return vaultDocuments.map((document) => {
        const metadata = document.metadata && typeof document.metadata === "object" ? document.metadata : {};
        return {
            id: document.id,
            docType: normalize(document.docType),
            title: normalize(document.title),
            templateId: typeof metadata.templateId === "string" ? normalize(metadata.templateId) : "",
        };
    });
}

function findExistingVaultDocument(documentId: string, documentName: string, vaultDocuments: VaultDocument[]) {
    const lookup = buildVaultLookup(vaultDocuments);
    const normalizedDocId = normalize(documentId);
    const normalizedDocName = normalize(documentName);
    const match = lookup.find((document) => (
        document.templateId === normalizedDocId
        || document.docType === normalizedDocName
        || document.title === normalizedDocName
    ));
    return match?.id ?? null;
}

function findCatalogDocument(query: string, usedIds: Set<string>) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return CATALOG.find((document) => (
        !usedIds.has(document.documentId)
        && terms.every((term) => (
            normalize(document.documentName).includes(term)
            || normalize(document.whenToUse).includes(term)
        ))
    )) ?? null;
}

function buildRecommendationItem(
    document: CatalogDoc,
    tier: "must" | "should" | "optional",
    input: DocumentNeedWizardInput,
    vaultDocuments: VaultDocument[],
): DocumentNeedRecommendationItem {
    const existingDocumentId = findExistingVaultDocument(document.documentId, document.documentName, vaultDocuments);
    const existsInVault = Boolean(existingDocumentId);
    const stageByTier = tier === "must"
        ? Math.max(1, input.currentStage)
        : tier === "should"
            ? Math.max(1, input.currentStage + (input.currentStage < 3 ? 0 : 1))
            : Math.max(2, input.currentStage + 1);

    let recommendedAction: RecommendationAction = "generate";
    if (existsInVault) {
        recommendedAction = "review_existing";
    } else if (tier === "optional" && (input.goal === "working_with_clients" || input.goal === "protecting_ip")) {
        recommendedAction = "upload";
    } else if (tier !== "optional" && (
        normalize(document.documentName).includes("agreement")
        || normalize(document.documentName).includes("offer")
        || normalize(document.documentName).includes("nda")
    )) {
        recommendedAction = "send_for_signature";
    }

    return {
        key: `${tier}:${document.documentId}`,
        categoryId: document.categoryId,
        categoryName: document.categoryName,
        documentId: document.documentId,
        documentName: document.documentName,
        whyItMatters: document.whenToUse,
        suggestedStage: stageByTier,
        existsInVault,
        existingDocumentId,
        recommendedAction,
    };
}

function buildTierRecommendations(
    queries: string[],
    tier: "must" | "should" | "optional",
    input: DocumentNeedWizardInput,
    vaultDocuments: VaultDocument[],
    usedIds: Set<string>,
) {
    return queries
        .map((query) => findCatalogDocument(query, usedIds))
        .filter((document): document is CatalogDoc => Boolean(document))
        .map((document) => {
            usedIds.add(document.documentId);
            return buildRecommendationItem(document, tier, input, vaultDocuments);
        });
}

export function buildDocumentNeedFallbackRecommendations(
    input: DocumentNeedWizardInput,
    vaultDocuments: VaultDocument[],
): DocumentNeedRecommendationResult {
    const queries = GOAL_QUERY_MAP[input.goal];
    const usedIds = new Set<string>();
    const mustHave = buildTierRecommendations(queries.must, "must", input, vaultDocuments, usedIds);
    const shouldHave = buildTierRecommendations(queries.should, "should", input, vaultDocuments, usedIds);
    const optionalFuture = buildTierRecommendations(queries.optional, "optional", input, vaultDocuments, usedIds);

    return {
        generatedBy: "fallback",
        disclaimer: DISCLAIMER,
        summary: `Based on your current stage and goal of ${GOAL_LABELS[input.goal]}, these are the common documents founders usually prioritize next.`,
        mustHave,
        shouldHave,
        optionalFuture,
    };
}

export function buildDocumentNeedWizardPrompt(input: DocumentNeedWizardInput, vaultDocuments: VaultDocument[]) {
    const catalog = CATALOG.map((document) => ({
        categoryId: document.categoryId,
        categoryName: document.categoryName,
        documentId: document.documentId,
        documentName: document.documentName,
    }));
    const existingDocs = vaultDocuments.map((document) => ({
        id: document.id,
        title: document.title,
        docType: document.docType,
        category: document.category,
        status: document.status,
        metadata: document.metadata,
    }));

    return [
        "You are Foundry's document recommendation engine.",
        "Identify common founder documents. Do not give legal or tax advice.",
        "Use this wording in the summary or disclaimer conceptually: Foundry can help identify common documents, but this does not replace legal or tax advice.",
        "Return JSON only with this exact shape:",
        JSON.stringify({
            summary: "string",
            mustHave: [{
                documentId: "string",
                whyItMatters: "string",
                suggestedStage: 1,
            }],
            shouldHave: [{
                documentId: "string",
                whyItMatters: "string",
                suggestedStage: 1,
            }],
            optionalFuture: [{
                documentId: "string",
                whyItMatters: "string",
                suggestedStage: 1,
            }],
        }, null, 2),
        "Only use documentId values from the catalog provided below.",
        `Founder context:\n${JSON.stringify(input, null, 2)}`,
        `Current vault documents:\n${JSON.stringify(existingDocs, null, 2)}`,
        `Catalog:\n${JSON.stringify(catalog, null, 2)}`,
    ].join("\n\n");
}

export function parseDocumentNeedRecommendationResponse(
    raw: string,
    input: DocumentNeedWizardInput,
    vaultDocuments: VaultDocument[],
): DocumentNeedRecommendationResult | null {
    try {
        const normalizedRaw = raw.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
        const parsed = JSON.parse(normalizedRaw) as {
            summary?: string;
            mustHave?: Array<{ documentId?: string; whyItMatters?: string; suggestedStage?: number }>;
            shouldHave?: Array<{ documentId?: string; whyItMatters?: string; suggestedStage?: number }>;
            optionalFuture?: Array<{ documentId?: string; whyItMatters?: string; suggestedStage?: number }>;
        };

        const buildItems = (
            rows: Array<{ documentId?: string; whyItMatters?: string; suggestedStage?: number }> | undefined,
            tier: "must" | "should" | "optional",
        ) => (rows ?? []).map((row) => {
            const document = CATALOG.find((entry) => entry.documentId === row.documentId);
            if (!document) return null;
            const item = buildRecommendationItem(document, tier, input, vaultDocuments);
            return {
                ...item,
                whyItMatters: row.whyItMatters?.trim() || item.whyItMatters,
                suggestedStage: Number.isFinite(row.suggestedStage) ? Math.max(1, Number(row.suggestedStage)) : item.suggestedStage,
            };
        }).filter((item): item is DocumentNeedRecommendationItem => Boolean(item));

        return {
            generatedBy: "ai",
            disclaimer: DISCLAIMER,
            summary: typeof parsed.summary === "string" && parsed.summary.trim()
                ? parsed.summary.trim()
                : `Foundry identified common next documents for ${GOAL_LABELS[input.goal]}.`,
            mustHave: buildItems(parsed.mustHave, "must"),
            shouldHave: buildItems(parsed.shouldHave, "should"),
            optionalFuture: buildItems(parsed.optionalFuture, "optional"),
        };
    } catch {
        return null;
    }
}

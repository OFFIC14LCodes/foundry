export const BUSINESS_MODEL_CANVAS_SECTIONS = [
    "customer_segments",
    "value_propositions",
    "channels",
    "customer_relationships",
    "revenue_streams",
    "key_activities",
    "key_resources",
    "key_partners",
    "cost_structure",
] as const;

export type BusinessModelCanvasSectionKey = typeof BUSINESS_MODEL_CANVAS_SECTIONS[number];

export type BusinessModelCanvasEntry = {
    id: string;
    text: string;
    source: string | null;
    createdAt: string;
    updatedAt: string;
};

export type BusinessModelCanvasRecord = {
    id: string;
    userId: string;
    stageId: number;
    version: number;
    createdAt: string | null;
    updatedAt: string | null;
    persisted: boolean;
} & Record<BusinessModelCanvasSectionKey, BusinessModelCanvasEntry[]>;

export type BusinessModelCanvasWeakness = {
    section: BusinessModelCanvasSectionKey;
    severity: "empty" | "weak" | "broad";
    message: string;
};

export const BUSINESS_MODEL_CANVAS_LABELS: Record<BusinessModelCanvasSectionKey, string> = {
    customer_segments: "Customer Segments",
    value_propositions: "Value Propositions",
    channels: "Channels",
    customer_relationships: "Customer Relationships",
    revenue_streams: "Revenue Streams",
    key_activities: "Key Activities",
    key_resources: "Key Resources",
    key_partners: "Key Partners",
    cost_structure: "Cost Structure",
};

const GENERIC_PATTERNS = [
    /\beveryone\b/i,
    /\banyone\b/i,
    /\ball businesses\b/i,
    /\bcustomers\b/i,
    /\bcompanies\b/i,
    /\bmake money\b/i,
    /\bgrow\b/i,
    /\bmarketing\b/i,
    /\bonline\b/i,
];

function makeEntryId() {
    return `bmc-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function normalizeCanvasText(value: string) {
    return value
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function getEmptyBusinessModelCanvas(userId: string, stageId = 2): BusinessModelCanvasRecord {
    const base = {
        id: `canvas-${userId}-${stageId}`,
        userId,
        stageId,
        version: 1,
        createdAt: null,
        updatedAt: null,
        persisted: false,
    } as BusinessModelCanvasRecord;

    BUSINESS_MODEL_CANVAS_SECTIONS.forEach((section) => {
        (base as any)[section] = [];
    });

    return base;
}

export function normalizeCanvasEntries(value: unknown, defaultSource: string | null = null): BusinessModelCanvasEntry[] {
    if (!Array.isArray(value)) return [];
    const now = new Date().toISOString();
    const seen = new Set<string>();
    const entries: BusinessModelCanvasEntry[] = [];

    for (const raw of value) {
        const text = typeof raw === "string"
            ? raw.trim()
            : typeof raw === "object" && raw && typeof (raw as any).text === "string"
                ? String((raw as any).text).trim()
                : "";
        if (!text) continue;
        const normalized = normalizeCanvasText(text);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        entries.push({
            id: typeof raw === "object" && raw && typeof (raw as any).id === "string" ? String((raw as any).id) : makeEntryId(),
            text,
            source: typeof raw === "object" && raw && typeof (raw as any).source === "string"
                ? String((raw as any).source)
                : defaultSource,
            createdAt: typeof raw === "object" && raw && typeof (raw as any).createdAt === "string"
                ? String((raw as any).createdAt)
                : now,
            updatedAt: typeof raw === "object" && raw && typeof (raw as any).updatedAt === "string"
                ? String((raw as any).updatedAt)
                : now,
        });
    }

    return entries;
}

export function mergeCanvasEntries(
    existing: BusinessModelCanvasEntry[],
    incoming: Array<string | Partial<BusinessModelCanvasEntry>>,
    source: string | null = "forge",
) {
    const current = normalizeCanvasEntries(existing);
    const seen = new Map(current.map((entry) => [normalizeCanvasText(entry.text), entry]));
    let changed = false;
    const now = new Date().toISOString();

    for (const raw of incoming) {
        const text = typeof raw === "string" ? raw.trim() : String(raw?.text || "").trim();
        if (!text) continue;
        const normalized = normalizeCanvasText(text);
        if (!normalized) continue;
        const existingEntry = seen.get(normalized);
        if (existingEntry) {
            const refinedText = text.length > existingEntry.text.length + 6 ? text : existingEntry.text;
            const nextSource = typeof raw === "object" && raw?.source != null ? String(raw.source) : (existingEntry.source || source);
            if (refinedText !== existingEntry.text || nextSource !== existingEntry.source) {
                existingEntry.text = refinedText;
                existingEntry.source = nextSource;
                existingEntry.updatedAt = now;
                changed = true;
            }
            continue;
        }

        const nextEntry: BusinessModelCanvasEntry = {
            id: typeof raw === "object" && typeof raw?.id === "string" ? String(raw.id) : makeEntryId(),
            text,
            source: typeof raw === "object" && raw?.source != null ? String(raw.source) : source,
            createdAt: now,
            updatedAt: now,
        };
        current.push(nextEntry);
        seen.set(normalized, nextEntry);
        changed = true;
    }

    return {
        entries: current,
        changed,
    };
}

export function buildBusinessModelCanvasContext(canvas: BusinessModelCanvasRecord) {
    const weakSections = detectWeakBusinessModelCanvasSections(canvas);
    const weakLookup = new Map(weakSections.map((item) => [item.section, item]));
    const missingSections = BUSINESS_MODEL_CANVAS_SECTIONS.filter((section) => (canvas[section] || []).length === 0);

    const sectionLines = BUSINESS_MODEL_CANVAS_SECTIONS.map((section) => {
        const entries = canvas[section] || [];
        const label = BUSINESS_MODEL_CANVAS_LABELS[section];
        const weakness = weakLookup.get(section);
        if (!entries.length) return `- ${label}: missing`;
        return `- ${label}: ${entries.map((entry) => entry.text).slice(0, 5).join(" | ")}${weakness ? ` (${weakness.message})` : ""}`;
    }).join("\n");

    return `[BMC_CONTEXT]
Business Model Canvas version: ${canvas.version}
Current sections:
${sectionLines}
Missing sections: ${missingSections.length > 0 ? missingSections.map((section) => BUSINESS_MODEL_CANVAS_LABELS[section]).join(", ") : "None"}
Weak areas: ${weakSections.length > 0 ? weakSections.map((item) => `${BUSINESS_MODEL_CANVAS_LABELS[item.section]} — ${item.message}`).join(" | ") : "None obvious"}
If the conversation turns toward business model clarity, use this context to tighten vague entries, fill missing sections, and ask one targeted question where the canvas is weak.
[/BMC_CONTEXT]`;
}

export function detectWeakBusinessModelCanvasSections(canvas: BusinessModelCanvasRecord): BusinessModelCanvasWeakness[] {
    const weaknesses: BusinessModelCanvasWeakness[] = [];

    for (const section of BUSINESS_MODEL_CANVAS_SECTIONS) {
        const entries = canvas[section] || [];
        if (!entries.length) {
            weaknesses.push({
                section,
                severity: "empty",
                message: "No clear entry yet.",
            });
            continue;
        }

        const allShort = entries.every((entry) => entry.text.trim().length < 18);
        const allGeneric = entries.every((entry) => GENERIC_PATTERNS.some((pattern) => pattern.test(entry.text)));

        if (allShort) {
            weaknesses.push({
                section,
                severity: "weak",
                message: "Still too thin to guide decisions.",
            });
            continue;
        }

        if (allGeneric) {
            weaknesses.push({
                section,
                severity: "broad",
                message: "Feels broad or generic.",
            });
        }
    }

    return weaknesses;
}

export function buildBusinessModelCanvasSectionPrompt(
    section: BusinessModelCanvasSectionKey,
    canvas: BusinessModelCanvasRecord,
    profile: any,
) {
    const label = BUSINESS_MODEL_CANVAS_LABELS[section];
    const currentEntries = (canvas[section] || []).map((entry) => `- ${entry.text}`).join("\n") || "- Nothing solid here yet";
    const weakSections = detectWeakBusinessModelCanvasSections(canvas)
        .filter((item) => item.section !== section)
        .slice(0, 3)
        .map((item) => `${BUSINESS_MODEL_CANVAS_LABELS[item.section]} (${item.message})`)
        .join(", ");

    return `You are helping the founder refine their ${label} inside the Business Model Canvas for Stage 2.

Business: ${profile?.businessName || profile?.idea || "Still being clarified"}
Industry: ${profile?.industry || "Early stage"}
Strategy mode: ${profile?.strategyLabel || profile?.strategy || "Not specified"}

Current ${label} entries:
${currentEntries}

Other weak canvas areas: ${weakSections || "None obvious"}

Improve clarity and specificity. Ask targeted questions that sharpen the business model rather than brainstorming wildly. Keep the founder focused on concrete choices, tradeoffs, and what would make this section stronger.`;
}

export function buildBusinessModelCanvasExportHtml(canvas: BusinessModelCanvasRecord, profile: any) {
    const updatedAt = canvas.updatedAt
        ? new Date(canvas.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "Not yet saved";

    const cards = BUSINESS_MODEL_CANVAS_SECTIONS.map((section) => {
        const entries = canvas[section] || [];
        const bullets = entries.length
            ? `<ul>${entries.map((entry) => `<li>${escapeHtml(entry.text)}</li>`).join("")}</ul>`
            : `<p class="empty">Still being clarified with Forge.</p>`;
        return `
<section class="card">
  <div class="card-label">${escapeHtml(BUSINESS_MODEL_CANVAS_LABELS[section])}</div>
  ${bullets}
</section>`;
    }).join("");

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Business Model Canvas</title>
<style>
  @page { size: letter portrait; margin: 1in; }
  body { margin: 0; font-family: Georgia, "Times New Roman", serif; color: #201c18; background: #f7f2ea; }
  .shell { padding: 0.2in 0; }
  .header { margin-bottom: 0.35in; }
  .eyebrow { text-transform: uppercase; letter-spacing: 0.16em; font-size: 11px; color: #9a5a36; margin-bottom: 10px; }
  h1 { margin: 0 0 8px; font-size: 28px; }
  .meta { font-size: 12px; color: #5d554d; line-height: 1.6; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .card { break-inside: avoid; border: 1px solid #d8c6b8; border-radius: 14px; background: #fffdf9; padding: 14px 16px; min-height: 130px; }
  .card-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #9a5a36; margin-bottom: 10px; }
  ul { margin: 0; padding-left: 18px; }
  li { margin: 0 0 7px; font-size: 13px; line-height: 1.5; }
  .empty { margin: 0; font-size: 13px; line-height: 1.6; color: #7a726a; font-style: italic; }
  .footer { margin-top: 0.3in; font-size: 11px; line-height: 1.6; color: #6a635d; }
</style>
</head>
<body>
  <main class="shell">
    <header class="header">
      <div class="eyebrow">Foundry Stage 2 · Living Business Model Canvas</div>
      <h1>${escapeHtml(profile?.businessName || profile?.idea || "Business Model Canvas")}</h1>
      <div class="meta">
        Version ${canvas.version} · Updated ${escapeHtml(updatedAt)}<br />
        Founder: ${escapeHtml(profile?.name || "Founder")} · Industry: ${escapeHtml(profile?.industry || "Early stage")} · Strategy: ${escapeHtml(profile?.strategyLabel || profile?.strategy || "Not specified")}
      </div>
    </header>
    <section class="grid">${cards}</section>
    <div class="footer">
      This canvas is a living strategic system generated and refined with Forge. It reflects working assumptions, not accounting, legal, or investment advice.
    </div>
  </main>
</body>
</html>`;
}

export function printBusinessModelCanvasPdf(canvas: BusinessModelCanvasRecord, profile: any) {
    const popup = window.open("", "_blank", "width=1100,height=900");
    if (!popup) return;
    popup.document.open();
    popup.document.write(buildBusinessModelCanvasExportHtml(canvas, profile));
    popup.document.close();
    popup.focus();
    popup.setTimeout(() => popup.print(), 250);
}

function escapeHtml(value: string) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function tryParseBusinessModelCanvasPatch(raw: string) {
    const trimmed = raw.trim();
    const candidate = trimmed.match(/\{[\s\S]*\}/)?.[0] || trimmed;
    try {
        const parsed = JSON.parse(candidate);
        return typeof parsed === "object" && parsed ? parsed as Partial<Record<BusinessModelCanvasSectionKey, string[]>> : {};
    } catch {
        return {};
    }
}

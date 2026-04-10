import { formatLegalDate } from "./legalDate";

export interface DocumentExportMeta {
    title: string;
    businessName: string;
    docType: string;
    date: string;
    legalDate?: string;
    state?: string;
}

interface MarkdownRenderOptions {
    skipFirstHeading?: boolean;
}

const BODY_FONT = "Georgia, 'Times New Roman', serif";
const UI_FONT = "'DM Sans', 'Aptos', 'Segoe UI', Arial, sans-serif";

export const DOCUMENT_PREVIEW_CSS = `
.foundry-document {
    color: #2a2a2a;
    font-family: ${BODY_FONT};
    font-size: 13.5px;
    line-height: 1.9;
}
.foundry-title-block {
    margin: 0 0 30px;
    padding: 0 0 20px;
    border-bottom: 1px solid #d8d1c8;
    text-align: center;
    color: #111;
    font-family: ${BODY_FONT};
    break-after: avoid;
    page-break-after: avoid;
}
.foundry-title-line {
    display: block;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.075em;
    line-height: 1.35;
    text-transform: uppercase;
}
.foundry-title-for {
    display: block;
    margin: 10px 0 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
}
.foundry-title-company,
.foundry-title-state {
    display: block;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.08em;
    line-height: 1.45;
    text-transform: uppercase;
}
.foundry-title-state {
    margin-top: 6px;
    font-size: 13px;
}
.foundry-document h1 {
    color: #1a1a1a;
    font-family: ${BODY_FONT};
    font-size: 21px;
    font-weight: 700;
    line-height: 1.3;
    text-align: center;
    margin: 0 0 18px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    break-after: avoid;
    page-break-after: avoid;
}
.foundry-document h2 {
    color: #1f1f1f;
    font-family: ${BODY_FONT};
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.05em;
    line-height: 1.55;
    margin: 30px 0 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #cfc7bc;
    text-transform: uppercase;
    break-after: avoid;
    page-break-after: avoid;
}
.foundry-document h3 {
    color: #222;
    font-family: ${BODY_FONT};
    font-size: 13.5px;
    font-style: italic;
    font-weight: 700;
    line-height: 1.55;
    margin: 20px 0 7px;
    break-after: avoid;
    page-break-after: avoid;
}
.foundry-document p {
    margin: 0 0 12px;
    orphans: 3;
    widows: 3;
}
.foundry-document strong {
    color: #151515;
    font-weight: 700;
}
.foundry-document em {
    color: #3a342e;
    font-style: italic;
}
.foundry-document ul,
.foundry-document ol {
    margin: 8px 0 14px 28px;
    padding: 0;
}
.foundry-document li {
    margin: 0 0 6px;
    padding-left: 4px;
}
.foundry-document blockquote,
.foundry-document .callout {
    margin: 16px 0;
    padding: 12px 14px;
    border-left: 3px solid #E8622A;
    background: rgba(232, 98, 42, 0.07);
    color: #2f2924;
}
.foundry-document .signature-block,
.foundry-document .notary-block {
    margin: 28px 0;
    padding: 18px 20px;
    border: 1px solid #cfc7bc;
    background: #fff;
    break-inside: avoid;
    page-break-inside: avoid;
}
.foundry-document .signature-line {
    display: grid;
    grid-template-columns: minmax(120px, 0.28fr) 1fr;
    gap: 20px;
    align-items: end;
    margin: 24px 0 14px;
    font-family: ${BODY_FONT};
    font-size: 12px;
    color: #3a342e;
}
.foundry-document .signature-line span:last-child {
    min-height: 30px;
    border-bottom: 1px solid #2f2924;
}
.foundry-document .office-use-block {
    margin: 24px 0;
    padding: 16px 18px;
    border: 1px solid #2f2924;
    break-inside: avoid;
    page-break-inside: avoid;
}
.foundry-document .office-use-block p {
    display: grid;
    grid-template-columns: 180px 1fr;
    gap: 16px;
    margin-bottom: 12px;
}
.foundry-document .office-use-block p::after {
    content: "";
    border-bottom: 1px solid #2f2924;
    min-height: 20px;
}
.foundry-document h2.signature-heading,
.foundry-document h2.notary-heading,
.foundry-document h2.office-use-heading {
    margin-top: 34px;
    break-after: avoid;
    page-break-after: avoid;
}
.foundry-document h2.notary-heading {
    color: #4d4036;
}
.foundry-document h2.office-use-heading {
    border: 1px solid #2f2924;
    padding: 8px 10px;
    text-align: center;
}
.foundry-document hr {
    border: 0;
    border-top: 1px solid #ded8cf;
    margin: 24px 0;
}
.foundry-document table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0 18px;
    font-family: ${UI_FONT};
    font-size: 11px;
    line-height: 1.55;
    break-inside: avoid;
    page-break-inside: avoid;
}
.foundry-document th,
.foundry-document td {
    border: 1px solid #d8d1c8;
    padding: 8px 9px;
    text-align: left;
    vertical-align: top;
}
.foundry-document th {
    background: #ebe5dc;
    color: #222;
    font-weight: 700;
}
.foundry-document td {
    background: rgba(255, 255, 255, 0.42);
}
.foundry-document code {
    font-family: 'Aptos Mono', Consolas, monospace;
    font-size: 0.9em;
    background: rgba(0, 0, 0, 0.06);
    border-radius: 4px;
    padding: 1px 4px;
}
`;

const PRINT_DOCUMENT_CSS = `
:root {
    color-scheme: light;
}
* {
    box-sizing: border-box;
}
body {
    margin: 0;
    background: #ede7de;
    color: #2a2a2a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}
.foundry-export-shell {
    min-height: 100vh;
    padding: 0;
}
.foundry-export-paper {
    width: min(8.5in, 100%);
    margin: 0 auto;
    background: #fff;
    padding: 0.72in 0.78in;
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.2);
}
${DOCUMENT_PREVIEW_CSS}
@page {
    size: letter;
    margin: 1in;
}
@media print {
    html,
    body {
        background: #fff;
        margin: 0;
        padding: 0;
    }
    .foundry-export-shell {
        padding: 0;
    }
    .foundry-export-paper {
        width: auto;
        margin: 0;
        min-height: auto;
        padding: 0;
        box-shadow: none;
        background: #fff;
    }
    .foundry-title-block {
        margin-top: 0;
        break-inside: avoid;
        page-break-inside: avoid;
    }
    .foundry-document h1,
    .foundry-document h2,
    .foundry-document h3 {
        break-after: avoid;
        page-break-after: avoid;
        break-inside: avoid;
        page-break-inside: avoid;
    }
    .foundry-document h1 + p,
    .foundry-document h1 + ul,
    .foundry-document h1 + ol,
    .foundry-document h1 + table,
    .foundry-document h2 + p,
    .foundry-document h2 + ul,
    .foundry-document h2 + ol,
    .foundry-document h2 + table,
    .foundry-document h3 + p,
    .foundry-document h3 + ul,
    .foundry-document h3 + ol,
    .foundry-document h3 + table {
        break-before: avoid;
        page-break-before: avoid;
    }
    .foundry-document p,
    .foundry-document ul,
    .foundry-document ol,
    .foundry-document li,
    .foundry-document blockquote {
        orphans: 3;
        widows: 3;
    }
    .foundry-document table,
    .foundry-document blockquote,
    .foundry-document .callout,
    .foundry-document .signature-block,
    .foundry-document .notary-block,
    .foundry-document .office-use-block {
        break-inside: avoid;
        page-break-inside: avoid;
    }
}
`;

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderInlineMarkdown(value: string) {
    const escaped = escapeHtml(value);
    return escaped
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/_([^_]+)_/g, "<em>$1</em>");
}

function isTableRow(line: string) {
    const trimmed = line.trim();
    return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|", 1);
}

function isTableDivider(line: string) {
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function tableCells(line: string) {
    return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function headingClass(value: string) {
    const lower = value.toLowerCase();
    if (lower.includes("notary") || lower.includes("acknowledgment")) return ' class="notary-heading"';
    if (lower.includes("office use")) return ' class="office-use-heading"';
    if (lower.includes("signature") || lower.includes("execution")) return ' class="signature-heading"';
    return "";
}

function isSignatureLine(value: string) {
    return /_{4,}|-{4,}/.test(value) && /(signature|printed name|name|title|date|by:|its:)/i.test(value);
}

function renderSignatureLine(value: string) {
    const cleaned = value.replace(/[*_`]/g, "").replace(/[-_]{4,}/g, "____________").trim();
    const [label] = cleaned.split("____________");
    return `<div class="signature-line"><span>${renderInlineMarkdown(label.trim() || "Signature")}</span><span></span></div>`;
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanTitle(value: string) {
    return (value || "Document")
        .replace(/^#+\s*/, "")
        .replace(/\*\*/g, "")
        .replace(/FOUNDRY\.\s*I AM THE INVENTOR BEH/gi, "")
        .trim();
}

function getLegalDatePhrase(meta: DocumentExportMeta) {
    return meta.legalDate || formatLegalDate(new Date());
}

function getOfficialBusinessName(meta: DocumentExportMeta) {
    return (meta.businessName || "").trim() || "[LEGAL BUSINESS NAME REQUIRED]";
}

function getSimplifiedOfficialTitle(meta: DocumentExportMeta) {
    const businessName = getOfficialBusinessName(meta);
    return cleanTitle(meta.title)
        .replace(new RegExp(`\\s+(?:OF|FOR)\\s+${escapeRegExp(businessName)}`, "gi"), "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

function normalizeSignatureAndNotaryFormatting(markdown: string, meta: DocumentExportMeta) {
    const organizerSignatureHeading = /articles of organization/i.test(meta.docType || meta.title)
        ? "## Organizer Signature"
        : "## Signature";

    return markdown
        .replace(/^##\s+(signature|execution)\s*$/gim, organizerSignatureHeading)
        .replace(/^Signature:\s*Date:\s*$/gim, "Signature: ___________________________\n\nDate: _______________________________")
        .replace(/^Signature:\s*$/gim, "Signature: ___________________________")
        .replace(/^Date:\s*$/gim, "Date: _______________________________")
        .replace(/^Seal:\s*$/gim, "Seal: ______________________")
        .replace(/^\[Notary Seal\]\s*$/gim, "Seal: ______________________");
}

export function sanitizeDocumentMarkdown(markdown: string, meta: DocumentExportMeta) {
    const legalDate = getLegalDatePhrase(meta);
    const cleaned = (markdown || "")
        .replace(/FOUNDRY\.\s*I AM THE INVENTOR BEH\.?/gi, "")
        .replace(/^\s*(FOR|TO):\s+.+$/gim, "")
        .replace(/On this\s+day\s+of\s*,?\s*(?:20\d{2})?/gi, legalDate)
        .replace(/On this\s+_{2,}\s+day\s+of\s+_{2,}\s*,?\s*(?:20\d{2})?/gi, legalDate)
        .replace(/On this\s+\[?\s*day\s*\]?\s+of\s+\[?\s*month\s*\]?\s*,?\s*(?:20\d{2})?/gi, legalDate)
        .replace(/this\s+day\s+of\s*,?\s*2024/gi, legalDate.replace(/^On /, ""))
        .replace(/^\s*\[Notary Seal\]\s*$/gim, "Seal: ______________________")
        .replace(/\[([^\]\n]{2,140})\]/g, (_match, content: string) => {
            const lower = content.toLowerCase();
            if (lower.includes("notary seal")) return "Seal: ______________________";
            if (lower.includes("legal business name required")) return "[LEGAL BUSINESS NAME REQUIRED]";
            return "______________________________";
        })
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return normalizeSignatureAndNotaryFormatting(cleaned, meta);
}

export function buildOfficialTitleBlockHtml(meta: DocumentExportMeta) {
    const title = getSimplifiedOfficialTitle(meta);
    return `<header class="foundry-title-block">
<span class="foundry-title-line">${escapeHtml(title)}</span>
<span class="foundry-title-for">For</span>
<span class="foundry-title-company">${escapeHtml(getOfficialBusinessName(meta))}</span>
${meta.state ? `<span class="foundry-title-state">State of ${escapeHtml(meta.state)}</span>` : ""}
</header>`;
}

export function markdownToDocumentHtml(markdown: string, options: MarkdownRenderOptions = {}) {
    const lines = (markdown || "").replace(/\r\n/g, "\n").split("\n");
    const html: string[] = [];
    let i = 0;
    let skippedFirstHeading = false;
    let inOfficeUseBlock = false;
    let inSignatureBlock = false;
    let inNotaryBlock = false;

    const closeOpenBlocks = () => {
        if (inOfficeUseBlock) {
            html.push("</div>");
            inOfficeUseBlock = false;
        }
        if (inSignatureBlock) {
            html.push("</div>");
            inSignatureBlock = false;
        }
        if (inNotaryBlock) {
            html.push("</div>");
            inNotaryBlock = false;
        }
    };

    const closeSectionBlocks = () => {
        if (inOfficeUseBlock) {
            html.push("</div>");
            inOfficeUseBlock = false;
        }
        if (inSignatureBlock) {
            html.push("</div>");
            inSignatureBlock = false;
        }
        if (inNotaryBlock) {
            html.push("</div>");
            inNotaryBlock = false;
        }
    };

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            i += 1;
            continue;
        }

        if (/^---+$/.test(trimmed)) {
            closeSectionBlocks();
            html.push("<hr />");
            i += 1;
            continue;
        }

        if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
            closeSectionBlocks();
            const headers = tableCells(line);
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length && isTableRow(lines[i])) {
                rows.push(tableCells(lines[i]));
                i += 1;
            }
            html.push(`<table><thead><tr>${headers.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
            continue;
        }

        if (trimmed.startsWith("# ")) {
            closeSectionBlocks();
            if (options.skipFirstHeading && !skippedFirstHeading) {
                skippedFirstHeading = true;
                i += 1;
                continue;
            }
            html.push(`<h1>${renderInlineMarkdown(trimmed.slice(2))}</h1>`);
            i += 1;
            continue;
        }

        if (trimmed.startsWith("## ")) {
            closeSectionBlocks();
            const heading = trimmed.slice(3);
            html.push(`<h2${headingClass(heading)}>${renderInlineMarkdown(heading)}</h2>`);
            const lowerHeading = heading.toLowerCase();
            if (lowerHeading.includes("office use")) {
                html.push('<div class="office-use-block">');
                inOfficeUseBlock = true;
            } else if (lowerHeading.includes("signature") || lowerHeading.includes("execution")) {
                html.push('<div class="signature-block">');
                inSignatureBlock = true;
            } else if (lowerHeading.includes("notary") || lowerHeading.includes("acknowledgment")) {
                html.push('<div class="notary-block">');
                inNotaryBlock = true;
            }
            i += 1;
            continue;
        }

        if (trimmed.startsWith("### ")) {
            html.push(`<h3>${renderInlineMarkdown(trimmed.slice(4))}</h3>`);
            i += 1;
            continue;
        }

        if (trimmed.startsWith("> ")) {
            const quoteLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith("> ")) {
                quoteLines.push(lines[i].trim().slice(2));
                i += 1;
            }
            html.push(`<blockquote>${quoteLines.map(renderInlineMarkdown).join("<br />")}</blockquote>`);
            continue;
        }

        if (/^[-*]\s+/.test(trimmed)) {
            const items: string[] = [];
            while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
                i += 1;
            }
            html.push(`<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
            continue;
        }

        if (/^\d+[.)]\s+/.test(trimmed)) {
            const items: string[] = [];
            while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ""));
                i += 1;
            }
            html.push(`<ol>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ol>`);
            continue;
        }

        if (isSignatureLine(trimmed)) {
            html.push(renderSignatureLine(trimmed));
            i += 1;
            continue;
        }

        const paragraphLines = [trimmed];
        i += 1;
        while (
            i < lines.length &&
            lines[i].trim() &&
            !/^#{1,3}\s+/.test(lines[i].trim()) &&
            !/^[-*]\s+/.test(lines[i].trim()) &&
            !/^\d+[.)]\s+/.test(lines[i].trim()) &&
            !lines[i].trim().startsWith("> ") &&
            !isTableRow(lines[i]) &&
            !/^---+$/.test(lines[i].trim())
        ) {
            paragraphLines.push(lines[i].trim());
            i += 1;
        }
        html.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
    }

    closeSectionBlocks();
    return html.join("\n");
}

function getDownloadName(title: string, extension: string) {
    return `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.${extension}`;
}

function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

export function buildStyledDocumentHtml(markdown: string, meta: DocumentExportMeta) {
    const safeMarkdown = sanitizeDocumentMarkdown(markdown, meta);
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(meta.title)}</title>
<style>${PRINT_DOCUMENT_CSS}</style>
</head>
<body>
<main class="foundry-export-shell">
<article class="foundry-export-paper">
${buildOfficialTitleBlockHtml(meta)}
<section class="foundry-document">
${markdownToDocumentHtml(safeMarkdown, { skipFirstHeading: true })}
</section>
</article>
</main>
</body>
</html>`;
}

export function downloadStyledHtml(markdown: string, meta: DocumentExportMeta) {
    downloadBlob(
        new Blob([buildStyledDocumentHtml(markdown, meta)], { type: "text/html;charset=utf-8" }),
        getDownloadName(meta.title, "html")
    );
}

export function printStyledPdf(markdown: string, meta: DocumentExportMeta) {
    const popup = window.open("", "_blank", "width=900,height=1100");
    if (!popup) {
        downloadStyledHtml(markdown, meta);
        return;
    }

    popup.document.open();
    popup.document.write(buildStyledDocumentHtml(markdown, meta));
    popup.document.close();
    try {
        popup.history.replaceState(null, cleanTitle(meta.title), `/document-export/${encodeURIComponent(getDownloadName(meta.title, "pdf"))}`);
    } catch {
        // Some browsers disallow replacing the print window URL; the print stylesheet still controls document margins.
    }
    popup.focus();
    popup.setTimeout(() => popup.print(), 250);
}

function xmlEscape(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function docxRun(text: string, options: { bold?: boolean; italic?: boolean; color?: string; size?: number } = {}) {
    const props = [
        options.bold ? "<w:b/>" : "",
        options.italic ? "<w:i/>" : "",
        options.color ? `<w:color w:val="${options.color}"/>` : "",
        options.size ? `<w:sz w:val="${options.size}"/>` : "",
    ].join("");
    return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function docxRuns(markdown: string, defaults: { size?: number; color?: string } = {}) {
    return markdown.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g).filter(Boolean).map((part) => {
        if (part.startsWith("**") && part.endsWith("**")) return docxRun(part.slice(2, -2), { ...defaults, bold: true });
        if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) return docxRun(part.slice(1, -1), { ...defaults, italic: true });
        if (part.startsWith("`") && part.endsWith("`")) return docxRun(part.slice(1, -1), { ...defaults, color: "5F554B" });
        return docxRun(part, defaults);
    }).join("");
}

function docxParagraph(runs: string, props = "") {
    return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${runs}</w:p>`;
}

function docxOfficialTitleBlock(meta: DocumentExportMeta) {
    const lines = [
        getSimplifiedOfficialTitle(meta).toUpperCase(),
        "FOR",
        getOfficialBusinessName(meta).toUpperCase(),
        meta.state ? `STATE OF ${meta.state.toUpperCase()}` : "",
    ].filter(Boolean);

    return lines.map((line, index) => docxParagraph(
        docxRun(line, { bold: true, size: index === 0 ? 36 : index === 1 ? 20 : 26 }),
        `<w:jc w:val="center"/><w:spacing w:after="${index === lines.length - 1 ? 420 : 120}"/>`
    )).join("");
}

function docxTable(headers: string[], rows: string[][]) {
    const rowXml = (cells: string[], header = false) => `<w:tr>${cells.map((cell) => `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/><w:shd w:fill="${header ? "EBE5DC" : "F8F5F0"}"/></w:tcPr>${docxParagraph(docxRuns(cell, { size: header ? 21 : 20 }), header ? "<w:spacing w:after=\"60\"/>" : "<w:spacing w:after=\"40\"/>")}</w:tc>`).join("")}</w:tr>`;
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D8D1C8"/><w:left w:val="single" w:sz="4" w:color="D8D1C8"/><w:bottom w:val="single" w:sz="4" w:color="D8D1C8"/><w:right w:val="single" w:sz="4" w:color="D8D1C8"/><w:insideH w:val="single" w:sz="4" w:color="D8D1C8"/><w:insideV w:val="single" w:sz="4" w:color="D8D1C8"/></w:tblBorders></w:tblPr>${rowXml(headers, true)}${rows.map((row) => rowXml(row)).join("")}</w:tbl>`;
}

function markdownToDocxBody(markdown: string) {
    const lines = (markdown || "").replace(/\r\n/g, "\n").split("\n");
    const body: string[] = [];
    let i = 0;

    while (i < lines.length) {
        const trimmed = lines[i].trim();
        if (!trimmed) {
            i += 1;
            continue;
        }

        if (isTableRow(lines[i]) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
            const headers = tableCells(lines[i]);
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length && isTableRow(lines[i])) {
                rows.push(tableCells(lines[i]));
                i += 1;
            }
            body.push(docxTable(headers, rows));
            continue;
        }

        if (trimmed.startsWith("# ")) {
            body.push(docxParagraph(docxRuns(trimmed.slice(2), { size: 34 }), '<w:jc w:val="center"/><w:spacing w:after="180"/>'));
        } else if (trimmed.startsWith("## ")) {
            body.push(docxParagraph(docxRuns(trimmed.slice(3).toUpperCase(), { size: 22 }), '<w:spacing w:before="360" w:after="120"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:color="D8D1C8"/></w:pBdr>'));
        } else if (trimmed.startsWith("### ")) {
            body.push(docxParagraph(docxRuns(trimmed.slice(4), { size: 24 }), '<w:spacing w:before="240" w:after="80"/>'));
        } else if (/^[-*]\s+/.test(trimmed)) {
            body.push(docxParagraph(docxRun("- ", { size: 22 }) + docxRuns(trimmed.replace(/^[-*]\s+/, ""), { size: 22 }), '<w:ind w:left="720" w:hanging="360"/><w:spacing w:after="70"/>'));
        } else if (/^\d+[.)]\s+/.test(trimmed)) {
            body.push(docxParagraph(docxRun(`${trimmed.match(/^(\d+)/)?.[1]}. `, { size: 22 }) + docxRuns(trimmed.replace(/^\d+[.)]\s+/, ""), { size: 22 }), '<w:ind w:left="720" w:hanging="360"/><w:spacing w:after="70"/>'));
        } else if (trimmed.startsWith("> ")) {
            body.push(docxParagraph(docxRuns(trimmed.slice(2), { size: 22, color: "3A342E" }), '<w:spacing w:before="120" w:after="120"/><w:ind w:left="360"/><w:pBdr><w:left w:val="single" w:sz="12" w:color="E8622A"/></w:pBdr>'));
        } else if (isSignatureLine(trimmed)) {
            const cleaned = trimmed.replace(/[*_`]/g, "").replace(/[-_]{4,}/g, "").trim();
            body.push(docxParagraph(docxRuns(cleaned, { size: 21 }), '<w:spacing w:before="180" w:after="80"/><w:pBdr><w:bottom w:val="single" w:sz="6" w:color="2F2924"/></w:pBdr>'));
        } else if (/^---+$/.test(trimmed)) {
            body.push(docxParagraph("", '<w:pBdr><w:bottom w:val="single" w:sz="4" w:color="D8D1C8"/></w:pBdr><w:spacing w:before="180" w:after="180"/>'));
        } else {
            body.push(docxParagraph(docxRuns(trimmed, { size: 22 }), '<w:spacing w:after="120"/><w:jc w:val="both"/>'));
        }
        i += 1;
    }

    return body.join("");
}

const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
        let c = i;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[i] = c >>> 0;
    }
    return table;
})();

function crc32(bytes: Uint8Array) {
    let crc = 0xffffffff;
    bytes.forEach((byte) => { crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); });
    return (crc ^ 0xffffffff) >>> 0;
}

function uint16(value: number) {
    return [value & 0xff, (value >>> 8) & 0xff];
}

function uint32(value: number) {
    return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function createZip(files: Array<{ name: string; content: string }>) {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const centralChunks: Uint8Array[] = [];
    let offset = 0;

    files.forEach((file) => {
        const nameBytes = encoder.encode(file.name);
        const data = encoder.encode(file.content);
        const crc = crc32(data);
        const localHeader = new Uint8Array([
            ...uint32(0x04034b50), ...uint16(20), ...uint16(0), ...uint16(0), ...uint16(0), ...uint16(0),
            ...uint32(crc), ...uint32(data.length), ...uint32(data.length), ...uint16(nameBytes.length), ...uint16(0),
        ]);
        const centralHeader = new Uint8Array([
            ...uint32(0x02014b50), ...uint16(20), ...uint16(20), ...uint16(0), ...uint16(0), ...uint16(0), ...uint16(0),
            ...uint32(crc), ...uint32(data.length), ...uint32(data.length), ...uint16(nameBytes.length), ...uint16(0),
            ...uint16(0), ...uint16(0), ...uint16(0), ...uint32(0), ...uint32(offset),
        ]);

        chunks.push(localHeader, nameBytes, data);
        centralChunks.push(centralHeader, nameBytes);
        offset += localHeader.length + nameBytes.length + data.length;
    });

    const centralOffset = offset;
    const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const endRecord = new Uint8Array([
        ...uint32(0x06054b50), ...uint16(0), ...uint16(0), ...uint16(files.length), ...uint16(files.length),
        ...uint32(centralSize), ...uint32(centralOffset), ...uint16(0),
    ]);

    return new Blob([...chunks, ...centralChunks, endRecord], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

export function downloadStyledDocx(markdown: string, meta: DocumentExportMeta) {
    const safeMarkdown = sanitizeDocumentMarkdown(markdown, meta);
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${docxOfficialTitleBlock(meta)}
${markdownToDocxBody(safeMarkdown.replace(/^#\s+.*(?:\r?\n)?/, ""))}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr>
</w:body>
</w:document>`;
    const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
    const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    downloadBlob(createZip([
        { name: "[Content_Types].xml", content: contentTypes },
        { name: "_rels/.rels", content: rels },
        { name: "word/document.xml", content: documentXml },
    ]), getDownloadName(meta.title, "docx"));
}

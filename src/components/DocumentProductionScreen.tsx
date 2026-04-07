import { useState, useRef, useEffect } from "react";
import { streamForgeAPI } from "../lib/forgeApi";
import { buildDocSystemPrompt, buildDocRequest, buildRefinementRequest } from "../constants/docPrompt";
import { loadProducedDocuments, saveProducedDocument, type ProducedDocument } from "../db";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Phase = "request" | "studio";

interface GenRecord {
    instruction: string;
    doc: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const DOC_TYPES = [
    { id: "Business Summary", emoji: "📄", sub: "Bank or investor ready" },
    { id: "Executive Summary", emoji: "📊", sub: "Strategic overview" },
    { id: "Investor Overview", emoji: "💼", sub: "Funding round support" },
    { id: "Funding Request", emoji: "💰", sub: "Loan or investment ask" },
    { id: "Partnership Proposal", emoji: "🤝", sub: "Strategic partnership" },
    { id: "Founder Profile", emoji: "👤", sub: "Background & credentials" },
    { id: "Concept Overview", emoji: "💡", sub: "One-page pitch" },
    { id: "Custom Document", emoji: "✏️", sub: "You describe it" },
];

const AUDIENCES = ["Bank", "Investor", "Partner", "General", "Grant Body", "Internal"];
const TONES = ["Professional", "Formal", "Persuasive", "Conservative", "Modern", "Premium"];

// ─────────────────────────────────────────────────────────────
// Inline text renderer: handles **bold**
// ─────────────────────────────────────────────────────────────
function renderInline(text: string) {
    const parts = text.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
        i % 2 === 1
            ? <strong key={i} style={{ fontWeight: 700 }}>{part}</strong>
            : <span key={i}>{part}</span>
    );
}

// ─────────────────────────────────────────────────────────────
// Document preview renderer — markdown → styled JSX
// ─────────────────────────────────────────────────────────────
function DocPreview({ content }: { content: string }) {
    if (!content) return null;

    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith("# ")) {
            elements.push(
                <h1 key={i} style={{ fontSize: 20, fontFamily: "'Georgia', serif", fontWeight: 700, color: "#1a1a1a", textAlign: "center", marginBottom: 4, lineHeight: 1.3 }}>
                    {renderInline(line.slice(2))}
                </h1>
            );
        } else if (line.startsWith("## ")) {
            elements.push(
                <h2 key={i} style={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", fontWeight: 700, color: "#333", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 28, marginBottom: 8, paddingBottom: 5, borderBottom: "1px solid #ddd" }}>
                    {renderInline(line.slice(3))}
                </h2>
            );
        } else if (line.startsWith("### ")) {
            elements.push(
                <h3 key={i} style={{ fontSize: 13, fontFamily: "'Georgia', serif", fontWeight: 700, color: "#222", marginTop: 18, marginBottom: 5, fontStyle: "italic" }}>
                    {renderInline(line.slice(4))}
                </h3>
            );
        } else if (line.startsWith("- ") || line.startsWith("* ")) {
            const bullets: string[] = [];
            while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
                bullets.push(lines[i].slice(2));
                i++;
            }
            elements.push(
                <ul key={`ul-${i}`} style={{ margin: "6px 0 12px 20px", padding: 0 }}>
                    {bullets.map((b, j) => (
                        <li key={j} style={{ fontSize: 13, color: "#2a2a2a", lineHeight: 1.75, marginBottom: 4, fontFamily: "'Georgia', serif" }}>
                            {renderInline(b)}
                        </li>
                    ))}
                </ul>
            );
            continue;
        } else if (line.trim() === "") {
            // blank line — spacing handled by element margins
        } else {
            elements.push(
                <p key={i} style={{ fontSize: 13, color: "#2a2a2a", lineHeight: 1.85, marginBottom: 10, fontFamily: "'Georgia', serif" }}>
                    {renderInline(line)}
                </p>
            );
        }

        i++;
    }

    return <>{elements}</>;
}

// ─────────────────────────────────────────────────────────────
// Download utilities
// ─────────────────────────────────────────────────────────────
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

function plainTextFromMarkdown(markdown: string) {
    return markdown
        .replace(/^#{1,3}\s+/gm, "")
        .replace(/^\s*[-*]\s+/gm, "• ")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .trim();
}

function wrapText(text: string, maxChars: number) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";

    words.forEach((word) => {
        const next = line ? `${line} ${word}` : word;
        if (next.length > maxChars && line) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    });

    if (line) lines.push(line);
    return lines;
}

function pdfEscape(value: string) {
    return value
        .replace(/[^\x20-\x7E\n]/g, "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");
}

function downloadPdf(content: string, title: string, meta: string) {
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 54;
    const lineHeight = 15;
    const lines = [meta, "", ...plainTextFromMarkdown(content).split("\n").flatMap(line => line.trim() ? wrapText(line, 86) : [""])];
    const pages: string[][] = [];
    let page: string[] = [];

    lines.forEach((line) => {
        if (page.length >= 44) {
            pages.push(page);
            page = [];
        }
        page.push(line);
    });
    if (page.length) pages.push(page);

    const objects: string[] = [];
    const addObject = (body: string) => {
        objects.push(body);
        return objects.length;
    };

    const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
    const pagesId = addObject("");
    const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>");
    const pageIds: number[] = [];

    pages.forEach((pageLines) => {
        const streamLines = ["BT", `/F1 11 Tf`, `1 0 0 1 ${margin} ${pageHeight - margin} Tm`];
        pageLines.forEach((line, index) => {
            const fontSize = index === 0 ? 9 : 11;
            streamLines.push(`/${fontSize === 9 ? "F1 9 Tf" : "F1 11 Tf"}`);
            streamLines.push(`(${pdfEscape(line)}) Tj`);
            streamLines.push(`0 -${lineHeight} Td`);
        });
        streamLines.push("ET");

        const stream = streamLines.join("\n");
        const streamId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
        const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`);
        pageIds.push(pageId);
    });

    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

    const chunks = [`%PDF-1.4\n`];
    const offsets = [0];
    objects.forEach((body, index) => {
        offsets.push(chunks.join("").length);
        chunks.push(`${index + 1} 0 obj\n${body}\nendobj\n`);
    });

    const xrefOffset = chunks.join("").length;
    chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
    offsets.slice(1).forEach(offset => chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`));
    chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    const pdfString = chunks.join("");
    const bytes = new Uint8Array(pdfString.length);
    for (let i = 0; i < pdfString.length; i++) bytes[i] = pdfString.charCodeAt(i) & 0xff;
    downloadBlob(new Blob([bytes], { type: "application/pdf" }), getDownloadName(title, "pdf"));
}

function drawWrappedCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";
    let nextY = y;

    words.forEach((word) => {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width > maxWidth && line) {
            ctx.fillText(line, x, nextY);
            nextY += lineHeight;
            line = word;
        } else {
            line = next;
        }
    });

    if (line) {
        ctx.fillText(line, x, nextY);
        nextY += lineHeight;
    }

    return nextY;
}

function downloadImage(content: string, title: string, meta: string, format: "png" | "jpg") {
    const lines = [meta, "", ...plainTextFromMarkdown(content).split("\n")];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 1200;
    const margin = 90;
    const maxWidth = width - margin * 2;
    let height = 180;

    ctx.font = "30px Georgia, serif";
    lines.forEach((line) => {
        height += line.trim() ? Math.max(34, wrapText(line, 80).length * 34) : 22;
    });
    canvas.width = width;
    canvas.height = Math.max(height, 700);

    ctx.fillStyle = "#F8F5F0";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#999";
    ctx.font = "22px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(meta.toUpperCase(), width / 2, 70);
    ctx.strokeStyle = "#e0dbd4";
    ctx.beginPath();
    ctx.moveTo(margin, 100);
    ctx.lineTo(width - margin, 100);
    ctx.stroke();

    let y = 155;
    ctx.textAlign = "left";
    lines.slice(2).forEach((line) => {
        if (!line.trim()) {
            y += 22;
            return;
        }

        if (line.startsWith("# ")) {
            ctx.fillStyle = "#1a1a1a";
            ctx.font = "bold 34px Georgia, serif";
            y = drawWrappedCanvasText(ctx, plainTextFromMarkdown(line), margin, y, maxWidth, 42) + 8;
        } else if (line.startsWith("## ")) {
            ctx.fillStyle = "#333";
            ctx.font = "bold 22px Arial, sans-serif";
            y += 22;
            y = drawWrappedCanvasText(ctx, plainTextFromMarkdown(line).toUpperCase(), margin, y, maxWidth, 30) + 4;
        } else {
            ctx.fillStyle = "#2a2a2a";
            ctx.font = "26px Georgia, serif";
            y = drawWrappedCanvasText(ctx, plainTextFromMarkdown(line), margin, y, maxWidth, 34);
        }
    });

    canvas.toBlob((blob) => {
        if (!blob) return;
        downloadBlob(blob, getDownloadName(title, format));
    }, format === "png" ? "image/png" : "image/jpeg", 0.92);
}

function xmlEscape(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function docxRuns(text: string) {
    return text.split(/(\*\*.+?\*\*)/g).filter(Boolean).map(part => {
        const bold = part.startsWith("**") && part.endsWith("**");
        const value = bold ? part.slice(2, -2) : part;
        return `<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${xmlEscape(value)}</w:t></w:r>`;
    }).join("");
}

function docxParagraph(line: string) {
    if (line.startsWith("# ")) return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="180"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>${xmlEscape(line.slice(2))}</w:t></w:r></w:p>`;
    if (line.startsWith("## ")) return `<w:p><w:pPr><w:spacing w:before="360" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:caps/><w:sz w:val="22"/></w:rPr><w:t>${xmlEscape(line.slice(3))}</w:t></w:r></w:p>`;
    if (line.startsWith("### ")) return `<w:p><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:i/><w:sz w:val="24"/></w:rPr><w:t>${xmlEscape(line.slice(4))}</w:t></w:r></w:p>`;
    if (line.startsWith("- ") || line.startsWith("* ")) return `<w:p><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:r><w:t>• </w:t></w:r>${docxRuns(line.slice(2))}</w:p>`;
    if (!line.trim()) return "<w:p/>";
    return `<w:p>${docxRuns(line)}</w:p>`;
}

const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[i] = c >>> 0;
    }
    return table;
})();

function crc32(bytes: Uint8Array) {
    let crc = 0xffffffff;
    bytes.forEach(byte => { crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); });
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

function downloadDocx(content: string, title: string, meta: string) {
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="360"/></w:pPr><w:r><w:rPr><w:sz w:val="18"/><w:color w:val="888888"/></w:rPr><w:t>${xmlEscape(meta)}</w:t></w:r></w:p>
${content.split("\n").map(docxParagraph).join("")}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
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
    ]), getDownloadName(title, "docx"));
}

async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

// ─────────────────────────────────────────────────────────────
// Chip selector — reused for type / audience / tone
// ─────────────────────────────────────────────────────────────
function ChipRow({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (v: string) => void }) {
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {options.map(opt => (
                <button
                    key={opt}
                    onClick={() => onSelect(opt)}
                    style={{
                        padding: "5px 13px",
                        borderRadius: 20,
                        border: selected === opt ? "1px solid rgba(232,98,42,0.5)" : "1px solid rgba(255,255,255,0.08)",
                        background: selected === opt ? "rgba(232,98,42,0.12)" : "rgba(255,255,255,0.03)",
                        color: selected === opt ? "#E8622A" : "#888",
                        fontSize: 12,
                        fontWeight: selected === opt ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontFamily: "'DM Sans', sans-serif",
                    }}
                >
                    {opt}
                </button>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function DocumentProductionScreen({ userId, profile, onBack }: { userId: string; profile: any; onBack: () => void }) {
    // Phase
    const [phase, setPhase] = useState<Phase>("request");

    // Request phase state
    const [docType, setDocType] = useState("Business Summary");
    const [audience, setAudience] = useState("General");
    const [tone, setTone] = useState("Professional");
    const [request, setRequest] = useState("");

    // Studio phase state
    const [currentDoc, setCurrentDoc] = useState("");
    const [generating, setGenerating] = useState(false);
    const [refineInput, setRefineInput] = useState("");
    const [refining, setRefining] = useState(false);
    const [history, setHistory] = useState<GenRecord[]>([]);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<"preview" | "refine">("preview");
    const [documents, setDocuments] = useState<ProducedDocument[]>([]);
    const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
    const [documentsLoading, setDocumentsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "unavailable">("idle");

    const previewRef = useRef<HTMLDivElement>(null);
    const refineRef = useRef<HTMLTextAreaElement>(null);
    const saveStatusResetRef = useRef<number | null>(null);

    // Scroll preview to top when doc changes
    useEffect(() => {
        previewRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentDoc]);

    useEffect(() => {
        let cancelled = false;

        setDocumentsLoading(true);
        loadProducedDocuments(userId).then((rows) => {
            if (cancelled) return;
            setDocuments(rows);
            setDocumentsLoading(false);
        });

        return () => { cancelled = true; };
    }, [userId]);

    useEffect(() => {
        return () => {
            if (saveStatusResetRef.current) window.clearTimeout(saveStatusResetRef.current);
        };
    }, []);

    const upsertDocumentList = (saved: ProducedDocument) => {
        setDocuments(prev => [saved, ...prev.filter(doc => doc.id !== saved.id)]);
    };

    const getDocTitle = (content: string, fallbackDocType = docType) => {
        return content.split("\n")[0].replace(/^#+\s*/, "").trim() || fallbackDocType;
    };

    const persistDocument = async (content: string, nextHistory: GenRecord[], existingId = currentDocumentId) => {
        if (!content.trim()) return null;

        setSaveStatus("saving");
        const saved = await saveProducedDocument(userId, {
            id: existingId,
            title: getDocTitle(content),
            docType,
            audience,
            tone,
            request,
            content,
            history: nextHistory,
        });

        if (!saved) {
            setSaveStatus("unavailable");
            return null;
        }

        setCurrentDocumentId(saved.id);
        upsertDocumentList(saved);
        setSaveStatus("saved");
        if (saveStatusResetRef.current) window.clearTimeout(saveStatusResetRef.current);
        saveStatusResetRef.current = window.setTimeout(() => setSaveStatus("idle"), 2000);
        return saved;
    };

    const openSavedDocument = (doc: ProducedDocument) => {
        setCurrentDocumentId(doc.id);
        setDocType(doc.docType);
        setAudience(doc.audience);
        setTone(doc.tone);
        setRequest(doc.request ?? "");
        setCurrentDoc(doc.content);
        setHistory(doc.history?.length ? doc.history : [{ instruction: doc.request || doc.docType, doc: doc.content }]);
        setPhase("studio");
        setActiveTab("preview");
        setSaveStatus("idle");
    };

    // ── Generate initial document ──
    const generate = async () => {
        if (generating) return;
        setGenerating(true);
        setCurrentDoc("");
        setHistory([]);
        setPhase("studio");
        setActiveTab("preview");

        const systemPrompt = buildDocSystemPrompt(profile);
        const userContent = buildDocRequest(docType, audience, tone, request);

        try {
            const final = await streamForgeAPI(
                [{ role: "user", content: userContent }],
                systemPrompt,
                (chunk) => setCurrentDoc(chunk)
            );
            const nextHistory = [{ instruction: userContent, doc: final }];
            setCurrentDoc(final);
            setHistory(nextHistory);
            await persistDocument(final, nextHistory, null);
        } catch {
            setCurrentDoc("# Document Generation Failed\n\nSomething went wrong. Try again or adjust your request.");
        }
        setGenerating(false);
    };

    // ── Refine existing document ──
    const refine = async () => {
        if (!refineInput.trim() || refining || generating) return;
        const instruction = refineInput.trim();
        setRefineInput("");
        setRefining(true);
        setActiveTab("preview");

        const systemPrompt = buildDocSystemPrompt(profile);
        const userContent = buildRefinementRequest(currentDoc, instruction);

        try {
            const final = await streamForgeAPI(
                [{ role: "user", content: userContent }],
                systemPrompt,
                (chunk) => setCurrentDoc(chunk)
            );
            const nextHistory = [...history, { instruction, doc: final }];
            setCurrentDoc(final);
            setHistory(nextHistory);
            await persistDocument(final, nextHistory);
        } catch {
            // Restore last good doc on failure
            const last = history[history.length - 1];
            if (last) setCurrentDoc(last.doc);
        }
        setRefining(false);
    };

    const reset = () => {
        setPhase("request");
        setCurrentDoc("");
        setHistory([]);
        setCurrentDocumentId(null);
        setRefineInput("");
        setGenerating(false);
        setRefining(false);
        setSaveStatus("idle");
    };

    const handleCopy = async () => {
        const ok = await copyToClipboard(currentDoc);
        if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    };

    const docTitle = currentDoc.split("\n")[0].replace(/^#+\s*/, "").trim() || docType;
    const businessName = profile.businessName || profile.idea?.slice(0, 30) || "Foundry";
    const todayDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const saveLabel = saveStatus === "saving"
        ? "Saving..."
        : saveStatus === "saved"
            ? "Saved"
            : saveStatus === "unavailable"
                ? "Save unavailable"
                : "";

    // ═══════════════════════════════════════════════════════════
    // REQUEST PHASE
    // ═══════════════════════════════════════════════════════════
    if (phase === "request") {
        return (
            <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8" }}>
                {/* Header */}
                <div style={{ padding: "max(14px, calc(8px + env(safe-area-inset-top))) 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)", zIndex: 10 }}>
                    <button onClick={onBack} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 12px", color: "#888", fontSize: 13, cursor: "pointer" }}>← Back</button>
                    <div>
                        <div style={{ fontSize: 16, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700 }}>Document Production</div>
                        <div style={{ fontSize: 10, color: "#555" }}>Professional document studio</div>
                    </div>
                </div>

                <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 16px 80px" }}>
                    {/* Intro */}
                    <div style={{ marginBottom: 28, animation: "fadeSlideUp 0.4s ease both", textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, marginBottom: 6, lineHeight: 1.25 }}>
                            What do you need built?
                        </div>
                        <div style={{ fontSize: 13, color: "#666", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", lineHeight: 1.7 }}>
                            Forge will generate a professional document tailored to your business, audience, and purpose — ready for real use.
                        </div>
                    </div>

                    {/* Saved documents */}
                    <div style={{ marginBottom: 26, animation: "fadeSlideUp 0.4s ease 0.02s both" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Saved Documents</div>
                            <div style={{ fontSize: 10, color: "#444" }}>
                                {documentsLoading ? "Loading..." : `${documents.length} saved`}
                            </div>
                        </div>
                        {documents.length === 0 && !documentsLoading ? (
                            <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", color: "#555", fontSize: 12, lineHeight: 1.6 }}>
                                Generated and refined documents will save here automatically when Forge finishes writing.
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {documents.map(doc => (
                                    <button
                                        key={doc.id}
                                        onClick={() => openSavedDocument(doc)}
                                        style={{ width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.025)", textAlign: "left", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
                                            <span style={{ fontSize: 12, color: "#C8C4BE", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</span>
                                            <span style={{ fontSize: 10, color: "#555", flexShrink: 0 }}>{new Date(doc.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                                        </div>
                                        <div style={{ fontSize: 10, color: "#555" }}>{doc.docType} · {doc.audience} · {doc.tone}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Document Type */}
                    <div style={{ marginBottom: 22, animation: "fadeSlideUp 0.4s ease 0.04s both" }}>
                        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Document Type</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            {DOC_TYPES.map(d => (
                                <button
                                    key={d.id}
                                    onClick={() => setDocType(d.id)}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        padding: "11px 13px", borderRadius: 11, textAlign: "left",
                                        border: docType === d.id ? "1px solid rgba(232,98,42,0.5)" : "1px solid rgba(255,255,255,0.06)",
                                        background: docType === d.id ? "rgba(232,98,42,0.08)" : "rgba(255,255,255,0.02)",
                                        cursor: "pointer", transition: "all 0.15s", width: "100%",
                                    }}
                                >
                                    <span style={{ fontSize: 18, flexShrink: 0 }}>{d.emoji}</span>
                                    <div>
                                        <div style={{ fontSize: 12, color: docType === d.id ? "#E8622A" : "#C8C4BE", fontWeight: 600, marginBottom: 1 }}>{d.id}</div>
                                        <div style={{ fontSize: 10, color: "#555" }}>{d.sub}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Audience */}
                    <div style={{ marginBottom: 18, animation: "fadeSlideUp 0.4s ease 0.08s both" }}>
                        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Audience</div>
                        <ChipRow options={AUDIENCES} selected={audience} onSelect={setAudience} />
                    </div>

                    {/* Tone */}
                    <div style={{ marginBottom: 20, animation: "fadeSlideUp 0.4s ease 0.12s both" }}>
                        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Tone</div>
                        <ChipRow options={TONES} selected={tone} onSelect={setTone} />
                    </div>

                    {/* Special instructions */}
                    <div style={{ marginBottom: 24, animation: "fadeSlideUp 0.4s ease 0.16s both" }}>
                        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Special Instructions</div>
                        <textarea
                            value={request}
                            onChange={e => setRequest(e.target.value)}
                            placeholder={`Describe anything specific:\n— key points to include\n— special requirements\n— purpose or context\n\nLeave blank to let Forge decide based on your profile.`}
                            rows={5}
                            style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, boxSizing: "border-box" }}
                        />
                    </div>

                    {/* Generate */}
                    <button
                        onClick={generate}
                        style={{ width: "100%", padding: "15px", background: "linear-gradient(135deg, #E8622A, #c9521e)", border: "none", borderRadius: 14, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", animation: "fadeSlideUp 0.4s ease 0.2s both" }}
                    >
                        Generate Document →
                    </button>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════
    // STUDIO PHASE
    // ═══════════════════════════════════════════════════════════
    return (
        <div style={{ minHeight: "100vh", background: "#080809", fontFamily: "'DM Sans', sans-serif", color: "#F0EDE8", display: "flex", flexDirection: "column" }}>
            {/* Studio Header */}
            <div style={{ padding: "max(12px, calc(6px + env(safe-area-inset-top))) 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "rgba(8,8,9,0.95)", backdropFilter: "blur(12px)", zIndex: 10, position: "sticky", top: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={onBack} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 11px", color: "#888", fontSize: 12, cursor: "pointer" }}>← Hub</button>
                    <div>
                        <div style={{ fontSize: 14, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, lineHeight: 1.2 }}>Document Studio</div>
                        <div style={{ fontSize: 10, color: "#555" }}>
                            {docType} · {audience} · {tone}{saveLabel ? ` · ${saveLabel}` : ""}
                        </div>
                    </div>
                </div>
                <button onClick={reset} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "5px 12px", color: "#666", fontSize: 11, cursor: "pointer" }}>
                    New Doc
                </button>
            </div>

            {/* Tab bar */}
            <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
                {(["preview", "refine"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{ flex: 1, padding: "10px", background: "none", border: "none", borderBottom: activeTab === tab ? "2px solid #E8622A" : "2px solid transparent", color: activeTab === tab ? "#E8622A" : "#555", fontSize: 12, fontWeight: activeTab === tab ? 600 : 400, cursor: "pointer", textTransform: "capitalize", transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif" }}
                    >
                        {tab === "preview" ? "Document Preview" : `Refine${history.length > 1 ? ` (${history.length - 1})` : ""}`}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }} ref={previewRef}>
                {/* ── PREVIEW TAB ── */}
                {activeTab === "preview" && (
                    <>
                        {/* Generating state */}
                        {generating && !currentDoc && (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "80px 0", color: "#555" }}>
                                <div style={{ display: "flex", gap: 6 }}>
                                    {[0, 1, 2].map(i => (
                                        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#E8622A", animation: "forgePulse 1.4s infinite ease-in-out", animationDelay: `${i * 0.2}s` }} />
                                    ))}
                                </div>
                                <div style={{ fontSize: 13, color: "#555", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic" }}>Forge is drafting your document...</div>
                            </div>
                        )}

                        {/* Document paper */}
                        {currentDoc && (
                            <div style={{ maxWidth: 680, margin: "0 auto" }}>
                                {/* Paper */}
                                <div style={{
                                    background: "#F8F5F0",
                                    borderRadius: 12,
                                    padding: "36px 40px",
                                    boxShadow: "0 4px 40px rgba(0,0,0,0.5)",
                                    marginBottom: 16,
                                    animation: generating ? "none" : "fadeSlideUp 0.4s ease both",
                                    position: "relative",
                                }}>
                                    {/* Streaming badge */}
                                    {generating && (
                                        <div style={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 5, background: "rgba(232,98,42,0.1)", border: "1px solid rgba(232,98,42,0.3)", borderRadius: 20, padding: "3px 10px" }}>
                                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#E8622A", animation: "forgePulse 1.2s infinite" }} />
                                            <span style={{ fontSize: 10, color: "#E8622A", fontFamily: "'DM Sans', sans-serif" }}>Writing</span>
                                        </div>
                                    )}

                                    {/* Document meta line */}
                                    <div style={{ textAlign: "center", fontSize: 10, color: "#999", fontFamily: "'DM Sans', sans-serif", marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid #e0dbd4", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                                        {businessName} · {docType} · {todayDate}
                                    </div>

                                    <DocPreview content={currentDoc} />

                                    {/* Footer line */}
                                    {!generating && (
                                        <div style={{ marginTop: 32, paddingTop: 14, borderTop: "1px solid #e0dbd4", fontSize: 10, color: "#bbb", fontFamily: "'DM Sans', sans-serif", textAlign: "center", letterSpacing: "0.04em" }}>
                                            Generated by Forge · Foundry Document Studio
                                        </div>
                                    )}
                                </div>

                                {/* Download controls */}
                                {!generating && (
                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24, animation: "fadeSlideUp 0.3s ease 0.1s both" }}>
                                        <button
                                            onClick={handleCopy}
                                            style={{ flex: 1, minWidth: 100, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: copied ? "#4CAF8A" : "#C8C4BE", fontSize: 12, cursor: "pointer", transition: "all 0.2s", fontFamily: "'DM Sans', sans-serif" }}
                                        >
                                            {copied ? "✓ Copied" : "Copy Text"}
                                        </button>
                                        <button
                                            onClick={() => downloadPdf(currentDoc, docTitle, `${businessName} · ${docType} · ${todayDate}`)}
                                            style={{ flex: 1, minWidth: 100, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#C8C4BE", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                                        >
                                            PDF
                                        </button>
                                        <button
                                            onClick={() => downloadImage(currentDoc, docTitle, `${businessName} · ${docType} · ${todayDate}`, "png")}
                                            style={{ flex: 1, minWidth: 100, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#C8C4BE", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                                        >
                                            PNG
                                        </button>
                                        <button
                                            onClick={() => downloadImage(currentDoc, docTitle, `${businessName} · ${docType} · ${todayDate}`, "jpg")}
                                            style={{ flex: 1, minWidth: 100, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#C8C4BE", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                                        >
                                            JPG
                                        </button>
                                        <button
                                            onClick={() => downloadDocx(currentDoc, docTitle, `${businessName} · ${docType} · ${todayDate}`)}
                                            style={{ flex: 1, minWidth: 100, padding: "10px 14px", background: "rgba(232,98,42,0.08)", border: "1px solid rgba(232,98,42,0.2)", borderRadius: 10, color: "#E8622A", fontSize: 12, cursor: "pointer", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}
                                        >
                                            DOCX
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* ── REFINE TAB ── */}
                {activeTab === "refine" && (
                    <div style={{ maxWidth: 600, margin: "0 auto" }}>
                        <div style={{ marginBottom: 20, animation: "fadeSlideUp 0.3s ease both" }}>
                            <div style={{ fontSize: 15, fontFamily: "'Lora', Georgia, serif", fontWeight: 600, color: "#F0EDE8", marginBottom: 4 }}>Refine your document</div>
                            <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>
                                Give Forge a direction and it will revise the entire document. Your previous version is preserved in history.
                            </div>
                        </div>

                        {/* Refinement quick chips */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, animation: "fadeSlideUp 0.3s ease 0.05s both" }}>
                            {[
                                "Make it more formal",
                                "Make it more persuasive",
                                "Make it shorter",
                                "Expand the market section",
                                "Make it more investor-friendly",
                                "Make it bank-ready",
                                "Add a stronger executive summary",
                                "Make the language more premium",
                                "Make it more concise",
                                "Improve the structure",
                            ].map(chip => (
                                <button
                                    key={chip}
                                    onClick={() => setRefineInput(chip)}
                                    style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", background: refineInput === chip ? "rgba(232,98,42,0.1)" : "rgba(255,255,255,0.02)", color: refineInput === chip ? "#E8622A" : "#666", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>

                        <textarea
                            ref={refineRef}
                            value={refineInput}
                            onChange={e => setRefineInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); refine(); } }}
                            placeholder="Or describe your own refinement instruction..."
                            rows={4}
                            disabled={refining}
                            style={{ width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", color: "#F0EDE8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, boxSizing: "border-box", opacity: refining ? 0.5 : 1, marginBottom: 10, animation: "fadeSlideUp 0.3s ease 0.1s both" }}
                        />

                        <div style={{ display: "flex", gap: 8, animation: "fadeSlideUp 0.3s ease 0.15s both" }}>
                            <button
                                onClick={() => setActiveTab("preview")}
                                style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#666", fontSize: 13, cursor: "pointer" }}
                            >
                                View Current
                            </button>
                            <button
                                onClick={refine}
                                disabled={!refineInput.trim() || refining}
                                style={{ flex: 2, padding: "12px", background: refineInput.trim() && !refining ? "linear-gradient(135deg, #E8622A, #c9521e)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 10, color: refineInput.trim() && !refining ? "#fff" : "#444", fontSize: 13, fontWeight: 600, cursor: refineInput.trim() && !refining ? "pointer" : "not-allowed", transition: "all 0.15s", fontFamily: "'DM Sans', sans-serif" }}
                            >
                                {refining ? "Refining..." : "Refine Document"}
                            </button>
                        </div>

                        {/* Refinement history */}
                        {history.length > 1 && (
                            <div style={{ marginTop: 28 }}>
                                <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Refinement History</div>
                                {history.slice(1).map((rec, i) => (
                                    <div key={i} style={{ padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                                        <div style={{ fontSize: 12, color: "#666", flex: 1 }}>"{rec.instruction}"</div>
                                        <button
                                            onClick={() => {
                                                setCurrentDoc(rec.doc);
                                                const nextHistory = history.slice(0, i + 2);
                                                setHistory(nextHistory);
                                                persistDocument(rec.doc, nextHistory);
                                            }}
                                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, padding: "3px 10px", color: "#555", fontSize: 10, cursor: "pointer", flexShrink: 0 }}
                                        >
                                            Restore
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ height: 40 }} />
                    </div>
                )}
            </div>
        </div>
    );
}

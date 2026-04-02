import { useState, useRef, useEffect } from "react";
import { streamForgeAPI } from "../lib/forgeApi";
import { buildDocSystemPrompt, buildDocRequest, buildRefinementRequest } from "../constants/docPrompt";

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
function downloadTxt(content: string, title: string) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function downloadHtml(content: string, meta: { businessName: string; docType: string; date: string }) {
    const title = content.split("\n")[0].replace(/^#+\s*/, "").trim() || meta.docType;

    // Convert markdown to basic HTML
    const bodyHtml = content
        .split("\n")
        .map(line => {
            if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
            if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
            if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
            if (line.startsWith("- ") || line.startsWith("* ")) return `<li>${line.slice(2)}</li>`;
            if (line.trim() === "") return "";
            return `<p>${line}</p>`;
        })
        .join("\n")
        // Wrap consecutive <li> blocks in <ul>
        .replace(/(<li>.*<\/li>\n?)+/g, "<ul>\n$&</ul>\n")
        // Bold
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body{font-family:Georgia,serif;max-width:750px;margin:50px auto;padding:40px 50px;color:#1a1a1a;line-height:1.7}
  h1{font-size:22px;text-align:center;margin-bottom:6px;font-weight:700}
  .doc-meta{text-align:center;font-size:11px;color:#888;margin-bottom:36px;border-bottom:1px solid #ddd;padding-bottom:14px}
  h2{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-top:32px;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:4px;color:#333}
  h3{font-size:13px;font-weight:700;font-style:italic;margin-top:20px;margin-bottom:5px}
  p{margin:0 0 10px;font-size:13px}
  ul{margin:4px 0 12px 22px;font-size:13px}
  li{margin-bottom:5px}
  strong{font-weight:700}
  @media print{body{margin:20px;padding:0}}
</style>
</head>
<body>
<div class="doc-meta">${meta.businessName} &middot; ${meta.docType} &middot; ${meta.date}</div>
${bodyHtml}
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
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
export default function DocumentProductionScreen({ profile, onBack }: { profile: any; onBack: () => void }) {
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

    const previewRef = useRef<HTMLDivElement>(null);
    const refineRef = useRef<HTMLTextAreaElement>(null);

    // Scroll preview to top when doc changes
    useEffect(() => {
        previewRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentDoc]);

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
            setCurrentDoc(final);
            setHistory([{ instruction: userContent, doc: final }]);
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
            setCurrentDoc(final);
            setHistory(prev => [...prev, { instruction, doc: final }]);
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
        setRefineInput("");
        setGenerating(false);
        setRefining(false);
    };

    const handleCopy = async () => {
        const ok = await copyToClipboard(currentDoc);
        if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    };

    const docTitle = currentDoc.split("\n")[0].replace(/^#+\s*/, "").trim() || docType;
    const businessName = profile.businessName || profile.idea?.slice(0, 30) || "Foundry";
    const todayDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

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
                    <div style={{ marginBottom: 28, animation: "fadeSlideUp 0.4s ease both" }}>
                        <div style={{ fontSize: 22, fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700, marginBottom: 6, lineHeight: 1.25 }}>
                            What do you need built?
                        </div>
                        <div style={{ fontSize: 13, color: "#666", fontFamily: "'Lora', Georgia, serif", fontStyle: "italic", lineHeight: 1.7 }}>
                            Forge will generate a professional document tailored to your business, audience, and purpose — ready for real use.
                        </div>
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
                        <div style={{ fontSize: 10, color: "#555" }}>{docType} · {audience} · {tone}</div>
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
                                            onClick={() => downloadTxt(currentDoc, docTitle)}
                                            style={{ flex: 1, minWidth: 100, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#C8C4BE", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                                        >
                                            Download .txt
                                        </button>
                                        <button
                                            onClick={() => downloadHtml(currentDoc, { businessName, docType, date: todayDate })}
                                            style={{ flex: 1, minWidth: 100, padding: "10px 14px", background: "rgba(232,98,42,0.08)", border: "1px solid rgba(232,98,42,0.2)", borderRadius: 10, color: "#E8622A", fontSize: 12, cursor: "pointer", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}
                                        >
                                            Download .html
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
                                            onClick={() => setCurrentDoc(rec.doc)}
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

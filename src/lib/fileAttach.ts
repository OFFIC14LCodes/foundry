// ─────────────────────────────────────────────────────────────
// FILE ATTACHMENT HELPERS
// Processes files for Forge chat — images use vision, PDFs use
// Anthropic document blocks, text files are embedded as text.
// ─────────────────────────────────────────────────────────────

export interface AttachedFile {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    /** Base64 data (no data-URL prefix) for images/PDFs; plain text for text files */
    content: string;
    isImage: boolean;
    isPDF: boolean;
    isText: boolean;
    /** Object URL for image thumbnail preview (revoke on cleanup) */
    previewUrl?: string;
}

const IMAGE_MIME = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const TEXT_EXTS = ["txt", "md", "csv", "json", "js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "h", "css", "html", "xml", "yaml", "yml", "sh", "rb", "go", "rs", "swift", "kt"];

export function isImageMime(mimeType: string) {
    return IMAGE_MIME.includes(mimeType) || mimeType.startsWith("image/");
}

export function isPDFMime(mimeType: string) {
    return mimeType === "application/pdf";
}

export function isTextFile(mimeType: string, name: string) {
    if (mimeType.startsWith("text/")) return true;
    if (mimeType === "application/json") return true;
    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    return TEXT_EXTS.includes(ext);
}

function readAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

function readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(",")[1] ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

const MAX_TEXT_CHARS = 20_000;

export async function processFile(file: File): Promise<AttachedFile> {
    const mimeType = file.type || "application/octet-stream";
    const isImage = isImageMime(mimeType);
    const isPDF = isPDFMime(mimeType);
    const isTxt = isTextFile(mimeType, file.name);

    let content = "";
    let previewUrl: string | undefined;

    if (isImage) {
        content = await readAsBase64(file);
        previewUrl = URL.createObjectURL(file);
    } else if (isPDF) {
        content = await readAsBase64(file);
    } else if (isTxt) {
        const raw = await readAsText(file);
        content = raw.length > MAX_TEXT_CHARS ? raw.slice(0, MAX_TEXT_CHARS) + "\n[...truncated]" : raw;
    } else {
        try {
            const raw = await readAsText(file);
            content = raw.length > MAX_TEXT_CHARS ? raw.slice(0, MAX_TEXT_CHARS) + "\n[...truncated]" : raw;
        } catch {
            content = "[Binary file — content not readable as text]";
        }
    }

    return {
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        mimeType,
        size: file.size,
        content,
        isImage,
        isPDF,
        isText: isTxt,
        previewUrl,
    };
}

/**
 * Build the Anthropic API `content` value for a message that may include files.
 * Returns a plain string if no files, or a content-block array otherwise.
 */
export function buildMessageContent(
    text: string,
    files: AttachedFile[]
): string | Array<Record<string, unknown>> {
    if (files.length === 0) return text;

    const parts: Array<Record<string, unknown>> = [];

    for (const file of files) {
        if (file.isImage) {
            parts.push({
                type: "image",
                source: {
                    type: "base64",
                    media_type: file.mimeType,
                    data: file.content,
                },
            });
        } else if (file.isPDF) {
            parts.push({
                type: "document",
                source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: file.content,
                },
            });
        } else {
            parts.push({
                type: "text",
                text: `[Attached file: ${file.name}]\n\`\`\`\n${file.content}\n\`\`\``,
            });
        }
    }

    if (text.trim()) {
        parts.push({ type: "text", text });
    }

    return parts;
}

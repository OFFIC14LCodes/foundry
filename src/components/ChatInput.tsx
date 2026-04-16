import { useLayoutEffect, useRef } from "react";
import { processFile } from "../lib/fileAttach";
import type { AttachedFile } from "../lib/fileAttach";

interface ChatInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onSend: () => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    loading?: boolean;
    placeholder?: string;
    attachedFiles?: AttachedFile[];
    onFilesChange?: (files: AttachedFile[]) => void;
    allowAttachments?: boolean;
}

export default function ChatInput({
    value,
    onChange,
    onSend,
    onKeyDown,
    loading,
    placeholder,
    attachedFiles = [],
    onFilesChange,
    allowAttachments = true,
}: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useLayoutEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = "auto";
        const computed = window.getComputedStyle(textarea);
        const lineHeight = parseFloat(computed.lineHeight) || 20;
        const maxHeight = lineHeight * 10;
        const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
        textarea.style.height = `${nextHeight}px`;
        textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
    }, [value]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        const processed = await Promise.all(files.map(processFile));
        onFilesChange?.([...attachedFiles, ...processed]);
        e.target.value = "";
    };

    const removeFile = (id: string) => {
        const removed = attachedFiles.find(f => f.id === id);
        if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
        onFilesChange?.(attachedFiles.filter(f => f.id !== id));
    };

    const canSend = !loading && (value.trim().length > 0 || attachedFiles.length > 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Attached file chips */}
            {allowAttachments && attachedFiles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 2 }}>
                    {attachedFiles.map(file => (
                        <div
                            key={file.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                                background: "rgba(232,98,42,0.08)",
                                border: "1px solid rgba(232,98,42,0.2)",
                                borderRadius: 8,
                                padding: "4px 8px 4px 5px",
                                maxWidth: 220,
                            }}
                        >
                            {file.isImage && file.previewUrl ? (
                                <img
                                    src={file.previewUrl}
                                    alt={file.name}
                                    style={{ width: 20, height: 20, borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
                                />
                            ) : (
                                <span style={{ fontSize: 13, flexShrink: 0 }}>
                                    {file.isPDF ? "📄" : "📝"}
                                </span>
                            )}
                            <span
                                style={{
                                    fontSize: 11,
                                    color: "#C8C4BE",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: 140,
                                }}
                            >
                                {file.name}
                            </span>
                            <button
                                onClick={() => removeFile(file.id)}
                                title="Remove"
                                style={{
                                    background: "none",
                                    border: "none",
                                    color: "#888",
                                    cursor: "pointer",
                                    padding: 0,
                                    fontSize: 14,
                                    lineHeight: 1,
                                    flexShrink: 0,
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input row */}
            <div
                style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-end",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14,
                    padding: "10px 12px 10px 10px",
                }}
            >
                {/* Paperclip button */}
                {allowAttachments && (
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach file"
                        style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: attachedFiles.length > 0 ? "#E8622A" : "#555",
                            padding: "4px 2px",
                            flexShrink: 0,
                            display: "flex",
                            alignItems: "center",
                            transition: "color 0.15s",
                        }}
                        onMouseEnter={e => { if (attachedFiles.length === 0) e.currentTarget.style.color = "#C8C4BE"; }}
                        onMouseLeave={e => { if (attachedFiles.length === 0) e.currentTarget.style.color = "#555"; }}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path
                                d="M13.5 7.5L7 14c-1.657 1.657-4.343 1.657-6 0-1.657-1.657-1.657-4.343 0-6L8 1c1.105-1.105 2.895-1.105 4 0 1.105 1.105 1.105 2.895 0 4L5.5 11.5C4.948 12.052 4.052 12.052 3.5 11.5 2.948 10.948 2.948 10.052 3.5 9.5L9 4"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                )}

                {allowAttachments && (
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.txt,.md,.csv,.json,.js,.ts,.jsx,.tsx,.py,.java,.c,.cpp,.h,.css,.html,.xml,.yaml,.yml,.sh,.rb,.go,.rs,.swift,.kt"
                        style={{ display: "none" }}
                        onChange={handleFileChange}
                    />
                )}

                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder || "Talk to Forge..."}
                    rows={1}
                    style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        color: "#F0EDE8",
                        fontSize: 13,
                        fontFamily: "'Lora', Georgia, serif",
                        lineHeight: 1.5,
                        height: "auto",
                        minHeight: 20,
                        maxHeight: 195,
                        overflowY: "hidden",
                        boxSizing: "border-box",
                        outline: "none",
                        resize: "none",
                    }}
                />

                <button
                    onClick={onSend}
                    disabled={!canSend}
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        flexShrink: 0,
                        background: canSend
                            ? "linear-gradient(135deg, #E8622A, #c9521e)"
                            : "rgba(255,255,255,0.05)",
                        border: "none",
                        color: "#fff",
                        fontSize: 14,
                        opacity: canSend ? 1 : 0.4,
                        cursor: canSend ? "pointer" : "default",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s",
                    }}
                >
                    ↑
                </button>
            </div>
        </div>
    );
}

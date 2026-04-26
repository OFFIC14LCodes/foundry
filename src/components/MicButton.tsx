import { useState, useRef } from "react";

interface MicButtonProps {
    value: string;
    onChange: (v: string) => void;
    disabled?: boolean;
    size?: number;
    idleColor?: string;
}

// Words that typically open a question — used to end chunks with ? vs .
const QUESTION_STARTERS = /^(what|where|when|who|why|how|is|are|was|were|do|does|did|can|could|would|should|will|have|has|am|may|might|shall)\b/i;

// Spoken punctuation commands (e.g. saying "comma" inserts a literal comma)
function applyVerbalPunctuation(text: string): string {
    return text
        .replace(/\bcomma\b/gi, ",")
        .replace(/\bperiod\b/gi, ".")
        .replace(/\bquestion mark\b/gi, "?")
        .replace(/\bexclamation( point| mark)?\b/gi, "!")
        .replace(/\bnew line\b/gi, "\n")
        .replace(/\bnew paragraph\b/gi, "\n\n");
}

// Called on each isFinal chunk. Adds capitalization and terminal punctuation.
function normalizeFinalChunk(rawText: string, prevAccumulated: string): string {
    const text = applyVerbalPunctuation(rawText.trim());
    if (!text) return "";

    const prev = prevAccumulated.trim();
    const isNewSentence = prev === "" || /[.!?]$/.test(prev);

    // Capitalize the first letter when starting a new sentence
    const result = isNewSentence
        ? text.charAt(0).toUpperCase() + text.slice(1)
        : text;

    // If the chunk already ends with terminal punctuation, leave it alone
    if (/[.!?,;:]$/.test(result)) return result;

    // Choose ? for question-opening phrases, . otherwise
    const terminator = isNewSentence && QUESTION_STARTERS.test(result) ? "?" : ".";
    return result + terminator;
}

export default function MicButton({ value, onChange, disabled, size = 18, idleColor = "#444" }: MicButtonProps) {
    const [listening, setListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const baseValueRef = useRef("");
    const finalAccumRef = useRef("");

    const supported = typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

    if (!supported) return null;

    const toggle = () => {
        if (listening) {
            recognitionRef.current?.stop();
            setListening(false);
            return;
        }

        baseValueRef.current = value;
        finalAccumRef.current = "";

        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "en-US";

        rec.onresult = (e: any) => {
            let currentInterim = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript;
                if (e.results[i].isFinal) {
                    const normalized = normalizeFinalChunk(t, finalAccumRef.current);
                    if (normalized) {
                        finalAccumRef.current += (finalAccumRef.current ? " " : "") + normalized;
                    }
                } else {
                    currentInterim += t;
                }
            }
            const spoken = finalAccumRef.current +
                (finalAccumRef.current && currentInterim ? " " : "") +
                currentInterim;
            const base = baseValueRef.current;
            onChange(base + (base.trim() && spoken ? " " : "") + spoken);
        };

        rec.onend = () => {
            setListening(false);
            recognitionRef.current = null;
            finalAccumRef.current = "";
        };

        recognitionRef.current = rec;
        rec.start();
        setListening(true);
    };

    return (
        <button
            type="button"
            onClick={toggle}
            disabled={disabled}
            title={listening ? "Stop recording" : "Voice input"}
            style={{
                background: "none",
                border: "none",
                cursor: disabled ? "default" : "pointer",
                color: listening ? "#E8622A" : idleColor,
                padding: "4px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "color 0.15s",
                opacity: disabled ? 0.4 : 1,
                animation: listening ? "micPulse 1.2s ease-in-out infinite" : "none",
            }}
        >
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2" />
                <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="9" y1="22" x2="15" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
        </button>
    );
}

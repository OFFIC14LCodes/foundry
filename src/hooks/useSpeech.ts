import { useState, useRef, useEffect } from "react";

export interface SpeechHook {
    supported: boolean;
    listening: boolean;
    speaking: boolean;
    startListening: (onResult: (text: string) => void, onError?: () => void) => void;
    stopListening: () => void;
    speak: (text: string, onEnd?: () => void) => void;
    cancelSpeech: () => void;
}

export function useSpeech(): SpeechHook {
    const [supported] = useState(() =>
        typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
    const [listening, setListening] = useState(false);
    const [speaking, setSpeaking] = useState(false);
    const recognitionRef = useRef<any>(null);

    const startListening = (onResult: (text: string) => void, onError?: () => void) => {
        if (!supported) { onError?.(); return; }
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (e: any) => {
            const transcript = e.results[0]?.[0]?.transcript || "";
            if (transcript) onResult(transcript);
        };
        recognition.onerror = () => {
            setListening(false);
            onError?.();
        };
        recognition.onend = () => setListening(false);

        recognitionRef.current = recognition;
        recognition.start();
        setListening(true);
    };

    const stopListening = () => {
        recognitionRef.current?.stop();
        setListening(false);
    };

    const speak = (text: string, onEnd?: () => void) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        // Strip markdown markers before speaking
        const clean = text
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/\[COACH\]/g, "")
            .replace(/\[.*?\]/g, "")
            .trim();
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => { setSpeaking(false); onEnd?.(); };
        utterance.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    const cancelSpeech = () => {
        window.speechSynthesis?.cancel();
        setSpeaking(false);
    };

    useEffect(() => {
        return () => {
            recognitionRef.current?.stop();
            window.speechSynthesis?.cancel();
        };
    }, []);

    return { supported, listening, speaking, startListening, stopListening, speak, cancelSpeech };
}

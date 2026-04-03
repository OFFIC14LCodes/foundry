import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserSpeechProvider, ServerTtsProvider, type TtsClientProvider } from "../lib/tts/client";
import {
    cleanTextForSpeech,
    estimatePauseMs,
    extractSpeakableSegments,
    isWorthSpeaking,
    splitIntoSentences,
} from "../lib/tts/speechText";

interface QueueItem {
    id: string;
    text: string;
    previousText?: string;
    nextText?: string;
}

export interface ConversationalTtsController {
    speaking: boolean;
    provider: string | null;
    speakText: (text: string) => Promise<void>;
    beginStream: () => void;
    ingestStreamText: (fullText: string) => void;
    finalizeStream: (finalText: string) => Promise<void>;
    cancel: () => void;
}

function delay(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function selectBestBrowserVoice(): SpeechSynthesisVoice | null {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const preferredMaleMatch = [
        /Davis/i,
        /Guy/i,
        /Roger/i,
        /Andrew/i,
        /Brian/i,
        /Jason/i,
        /Matthew/i,
        /Christopher/i,
        /Eric/i,
        /Male/i,
        /Google UK English Male/i,
        /Google US English/i,
    ];

    for (const pattern of preferredMaleMatch) {
        const matched = voices.find((voice) => pattern.test(voice.name) && /en/i.test(voice.lang));
        if (matched) return matched;
    }

    return voices.find((voice) => /en/i.test(voice.lang)) ?? voices[0] ?? null;
}

export function useConversationalTts(enabled: boolean): ConversationalTtsController {
    const [speaking, setSpeaking] = useState(false);
    const [provider, setProvider] = useState<string | null>(null);

    const serverProvider = useMemo(() => new ServerTtsProvider(), []);
    const browserProvider = useMemo(() => new BrowserSpeechProvider(), []);
    const providersRef = useRef<TtsClientProvider[]>([serverProvider, browserProvider]);

    const queueRef = useRef<QueueItem[]>([]);
    const activeRunIdRef = useRef(0);
    const processingRef = useRef(false);
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);
    const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const streamRemainderRef = useRef("");
    const spokenKeysRef = useRef(new Set<string>());
    const providerFailureRef = useRef<Set<string>>(new Set());
    const lastObservedStreamTextRef = useRef("");

    const stopCurrentPlayback = useCallback(() => {
        currentAudioRef.current?.pause();
        currentAudioRef.current = null;

        if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        currentUtteranceRef.current = null;
    }, []);

    const cancel = useCallback(() => {
        activeRunIdRef.current += 1;
        queueRef.current = [];
        streamRemainderRef.current = "";
        lastObservedStreamTextRef.current = "";
        spokenKeysRef.current.clear();
        processingRef.current = false;
        stopCurrentPlayback();
        setSpeaking(false);
    }, [stopCurrentPlayback]);

    const playAudioClip = useCallback(async (objectUrl: string, runId: number) => {
        await new Promise<void>((resolve, reject) => {
            const audio = new Audio(objectUrl);
            currentAudioRef.current = audio;
            audio.onended = () => {
                if (activeRunIdRef.current === runId) currentAudioRef.current = null;
                resolve();
            };
            audio.onerror = () => {
                if (activeRunIdRef.current === runId) currentAudioRef.current = null;
                reject(new Error("Audio playback failed"));
            };
            audio.play().catch(reject);
        });
    }, []);

    const playBrowserSpeech = useCallback(async (text: string, runId: number) => {
        await new Promise<void>((resolve, reject) => {
            if (typeof window === "undefined" || !window.speechSynthesis) {
                reject(new Error("Browser speech synthesis unavailable"));
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.92;
            utterance.pitch = 1;
            utterance.volume = 1;
            utterance.voice = selectBestBrowserVoice();
            currentUtteranceRef.current = utterance;

            utterance.onend = () => {
                if (activeRunIdRef.current === runId) currentUtteranceRef.current = null;
                resolve();
            };
            utterance.onerror = () => {
                if (activeRunIdRef.current === runId) currentUtteranceRef.current = null;
                reject(new Error("Browser TTS playback failed"));
            };

            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
        });
    }, []);

    const synthesizeAndPlay = useCallback(async (item: QueueItem, runId: number) => {
        let lastError: Error | null = null;

        for (const candidate of providersRef.current) {
            if (candidate.name !== "browser" && providerFailureRef.current.has(candidate.name)) {
                continue;
            }

            try {
                const clip = await candidate.synthesize({
                    text: item.text,
                    previousText: item.previousText,
                    nextText: item.nextText,
                });

                setProvider(clip.provider);

                if (clip.kind === "audio") {
                    await playAudioClip(clip.objectUrl, runId);
                } else {
                    await playBrowserSpeech(clip.text, runId);
                }

                return;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error("Unknown TTS error");
                if (candidate.name !== "browser") {
                    providerFailureRef.current.add(candidate.name);
                }
            }
        }

        throw lastError ?? new Error("No TTS provider available");
    }, [playAudioClip, playBrowserSpeech]);

    const processQueue = useCallback(async (runId: number) => {
        if (processingRef.current || !enabled) return;

        processingRef.current = true;
        setSpeaking(true);

        try {
            while (activeRunIdRef.current === runId && queueRef.current.length > 0) {
                const item = queueRef.current.shift();
                if (!item) continue;

                await synthesizeAndPlay(item, runId);

                if (activeRunIdRef.current !== runId) break;
                await delay(estimatePauseMs(item.text));
            }
        } finally {
            if (activeRunIdRef.current === runId) {
                setSpeaking(false);
                currentAudioRef.current = null;
                currentUtteranceRef.current = null;
            }
            processingRef.current = false;
        }
    }, [enabled, synthesizeAndPlay]);

    const enqueueSegments = useCallback((segments: string[]) => {
        const cleanedSegments = segments
            .map((segment) => cleanTextForSpeech(segment))
            .filter(isWorthSpeaking);

        if (!cleanedSegments.length) return;

        const items = cleanedSegments
            .filter((segment) => {
                const key = segment.toLowerCase();
                if (spokenKeysRef.current.has(key)) return false;
                spokenKeysRef.current.add(key);
                return true;
            })
            .map((segment, index, all) => ({
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                text: segment,
                previousText: index > 0 ? all[index - 1] : undefined,
                nextText: index < all.length - 1 ? all[index + 1] : undefined,
            }));

        if (!items.length) return;

        queueRef.current.push(...items);
        void processQueue(activeRunIdRef.current);
    }, [processQueue]);

    const beginStream = useCallback(() => {
        cancel();
        providerFailureRef.current.clear();
        activeRunIdRef.current += 1;
        streamRemainderRef.current = "";
        lastObservedStreamTextRef.current = "";
        spokenKeysRef.current.clear();
        queueRef.current = [];
    }, [cancel]);

    const ingestStreamText = useCallback((fullText: string) => {
        if (!enabled) return;

        const incoming = cleanTextForSpeech(fullText);
        if (!incoming || incoming === lastObservedStreamTextRef.current) return;
        lastObservedStreamTextRef.current = incoming;

        const { segments, remainder } = extractSpeakableSegments(incoming, false);
        streamRemainderRef.current = remainder;
        enqueueSegments(segments);
    }, [enabled, enqueueSegments]);

    const finalizeStream = useCallback(async (finalText: string) => {
        if (!enabled) return;

        const { segments } = extractSpeakableSegments(cleanTextForSpeech(finalText), true);
        streamRemainderRef.current = "";
        enqueueSegments(segments);
        await processQueue(activeRunIdRef.current);
    }, [enabled, enqueueSegments, processQueue]);

    const speakText = useCallback(async (text: string) => {
        if (!enabled) return;

        beginStream();
        const segments = splitIntoSentences(text);
        enqueueSegments(segments);
        await processQueue(activeRunIdRef.current);
    }, [beginStream, enabled, enqueueSegments, processQueue]);

    useEffect(() => {
        if (!enabled) cancel();
    }, [cancel, enabled]);

    useEffect(() => {
        if (typeof window === "undefined" || !window.speechSynthesis) return;

        const loadVoices = () => {
            window.speechSynthesis.getVoices();
        };

        loadVoices();
        window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
        return () => {
            window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
        };
    }, []);

    useEffect(() => () => cancel(), [cancel]);

    return {
        speaking,
        provider,
        speakText,
        beginStream,
        ingestStreamText,
        finalizeStream,
        cancel,
    };
}

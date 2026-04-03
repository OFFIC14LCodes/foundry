import { cleanTextForSpeech, normalizeSpeechCacheKey } from "./speechText";

export interface TtsSynthesisRequest {
    text: string;
    previousText?: string;
    nextText?: string;
}

export interface TtsAudioResult {
    kind: "audio";
    objectUrl: string;
    provider: string;
}

export interface BrowserSpeechResult {
    kind: "browser";
    text: string;
    provider: "browser";
}

export type TtsSynthesisResult = TtsAudioResult | BrowserSpeechResult;

export interface TtsClientProvider {
    readonly name: string;
    synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult>;
}

const audioCache = new Map<string, TtsAudioResult>();

export class ServerTtsProvider implements TtsClientProvider {
    readonly name = "server";

    async synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
        const cleanedText = cleanTextForSpeech(request.text);
        const cacheKey = normalizeSpeechCacheKey(cleanedText);
        const cached = audioCache.get(cacheKey);
        if (cached) return cached;

        const response = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: cleanedText,
                previousText: request.previousText ? cleanTextForSpeech(request.previousText) : undefined,
                nextText: request.nextText ? cleanTextForSpeech(request.nextText) : undefined,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`TTS ${response.status}: ${errorText.slice(0, 200)}`);
        }

        const audioBlob = await response.blob();
        const objectUrl = URL.createObjectURL(audioBlob);
        const result: TtsAudioResult = {
            kind: "audio",
            objectUrl,
            provider: response.headers.get("x-tts-provider") || "server",
        };
        audioCache.set(cacheKey, result);
        return result;
    }
}

export class BrowserSpeechProvider implements TtsClientProvider {
    readonly name = "browser";

    async synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
        return {
            kind: "browser",
            provider: "browser",
            text: cleanTextForSpeech(request.text),
        };
    }
}


const DEFAULT_ELEVEN_MODEL = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const OWNER_EMAIL = "foundryandforge.app@gmail.com";

export function getTtsConfig() {
  return {
    provider: process.env.TTS_PROVIDER || "elevenlabs",
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || "",
    elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID || "",
    elevenlabsVoiceName: process.env.ELEVENLABS_VOICE_NAME || "",
    elevenlabsModelId: DEFAULT_ELEVEN_MODEL,
    elevenlabsOutputFormat: process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128",
  };
}

export function cleanTtsInput(text) {
  return String(text || "")
    .replace(/\[(?:COACH|NOTE|PAUSE|STAGE|SYSTEM|VOICE|EMPHASIS).*?\]/gi, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/(\*\*|__|\*|_|`|~~)/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/[•▪◦]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateTtsText(text) {
  const cleaned = cleanTtsInput(text);
  if (!cleaned) {
    throw createTtsError(400, "Text is required");
  }
  if (cleaned.length > 1200) {
    throw createTtsError(400, "Text chunk too long");
  }
  return cleaned;
}

export async function synthesizeSpeech({ text, previousText, nextText }) {
  const config = getTtsConfig();
  const cleanedText = validateTtsText(text);

  if (config.provider !== "elevenlabs") {
    throw createTtsError(500, `Unsupported TTS provider: ${config.provider}`);
  }

  if (!config.elevenlabsApiKey) {
    throw createTtsError(503, "Primary TTS provider is not configured");
  }

  const voiceId = await resolveElevenLabsVoiceId(config);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${encodeURIComponent(config.elevenlabsOutputFormat)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": config.elevenlabsApiKey,
      },
      body: JSON.stringify({
        text: cleanedText,
        model_id: config.elevenlabsModelId,
        previous_text: previousText ? cleanTtsInput(previousText) : undefined,
        next_text: nextText ? cleanTtsInput(nextText) : undefined,
        voice_settings: {
          stability: 0.42,
          similarity_boost: 0.82,
          style: 0.08,
          use_speaker_boost: true,
          speed: 0.94,
        },
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw createTtsError(response.status, detail || "TTS generation failed");
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    provider: "elevenlabs",
    contentType: response.headers.get("content-type") || "audio/mpeg",
    audioBuffer: Buffer.from(arrayBuffer),
  };
}

export async function getElevenLabsUsage() {
  const config = getTtsConfig();
  if (!config.elevenlabsApiKey) {
    throw createTtsError(503, "ElevenLabs is not configured");
  }

  const baseUsage = {
    provider: "elevenlabs",
    tier: "unknown",
    status: "configured",
    usedCredits: 0,
    totalCredits: 0,
    remainingCredits: 0,
    billingPeriod: null,
    resetAtUnix: null,
    currentVoiceName: config.elevenlabsVoiceName || config.elevenlabsVoiceId || null,
    voiceSlotsUsed: null,
    voiceLimit: null,
    recentCreditUsage: [],
    recentUsageTimestamps: [],
    usageAccessLimited: false,
    usageAccessMessage: null,
  };

  const [subscriptionRes, creditUsageRes] = await Promise.all([
    fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": config.elevenlabsApiKey },
    }),
    fetch("https://api.elevenlabs.io/v1/usage/character-stats?metric=credits&aggregation_interval=day&aggregation_bucket_size=30&breakdown_type=none", {
      headers: { "xi-api-key": config.elevenlabsApiKey },
    }),
  ]);

  if (!subscriptionRes.ok) {
    const detail = await subscriptionRes.text();
    if (subscriptionRes.status === 403 && /missing_permissions|user_read/i.test(detail || "")) {
      return {
        ...baseUsage,
        status: "voice ready",
        usageAccessLimited: true,
        usageAccessMessage: "Voice playback is configured, but usage metrics are unavailable because this ElevenLabs API key is missing the user_read permission.",
      };
    }
    throw createTtsError(subscriptionRes.status, detail || "Unable to load ElevenLabs subscription usage");
  }

  const subscription = await subscriptionRes.json();
  const creditUsage = creditUsageRes.ok ? await creditUsageRes.json() : null;
  const usedCredits = Number(subscription.character_count ?? 0);
  const totalCredits = Number(subscription.character_limit ?? 0);

  return {
    ...baseUsage,
    tier: subscription.tier ?? "unknown",
    status: subscription.status ?? "unknown",
    usedCredits,
    totalCredits,
    remainingCredits: Math.max(totalCredits - usedCredits, 0),
    billingPeriod: subscription.billing_period ?? null,
    resetAtUnix: subscription.next_character_count_reset_unix ?? null,
    voiceSlotsUsed: subscription.voice_slots_used ?? null,
    voiceLimit: subscription.voice_limit ?? null,
    recentCreditUsage: Array.isArray(creditUsage?.usage?.All) ? creditUsage.usage.All : [],
    recentUsageTimestamps: Array.isArray(creditUsage?.time) ? creditUsage.time : [],
  };
}

export async function verifyAdminRequest(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    throw createTtsError(401, "Missing authorization token");
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw createTtsError(500, "Supabase auth verification is not configured");
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw createTtsError(401, "Invalid Supabase session");
  }

  const user = await response.json();
  const email = String(user?.email || "").trim().toLowerCase();

  if (email !== OWNER_EMAIL) {
    throw createTtsError(403, "Admin access required");
  }

  return user;
}

async function resolveElevenLabsVoiceId(config) {
  if (config.elevenlabsVoiceId) return config.elevenlabsVoiceId;
  if (!config.elevenlabsVoiceName) {
    throw createTtsError(503, "No ElevenLabs voice is configured");
  }

  const response = await fetch(`https://api.elevenlabs.io/v2/voices?search=${encodeURIComponent(config.elevenlabsVoiceName)}&page_size=25`, {
    headers: {
      "xi-api-key": config.elevenlabsApiKey,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw createTtsError(response.status, detail || "Unable to resolve ElevenLabs voice");
  }

  const payload = await response.json();
  const voices = Array.isArray(payload?.voices) ? payload.voices : [];
  const matchedVoice = voices.find((voice) => String(voice?.name || "").trim().toLowerCase() === config.elevenlabsVoiceName.trim().toLowerCase());

  if (!matchedVoice?.voice_id) {
    throw createTtsError(404, `Unable to find ElevenLabs voice named "${config.elevenlabsVoiceName}"`);
  }

  return matchedVoice.voice_id;
}

function createTtsError(status, message) {
  const error = new Error(message);
  error.statusCode = status;
  return error;
}

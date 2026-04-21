import { getElevenLabsUsage, getTtsConfig, verifyAdminRequest } from "./_lib/tts.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    await verifyAdminRequest(req);
    try {
      const usage = await getElevenLabsUsage();
      res.status(200).json(usage);
    } catch (error) {
      const config = getTtsConfig();
      if (config.provider === "elevenlabs" && (config.elevenlabsVoiceName || config.elevenlabsVoiceId || config.elevenlabsApiKey)) {
        res.status(200).json({
          provider: "elevenlabs",
          tier: "unknown",
          status: "voice ready",
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
          usageAccessLimited: true,
          usageAccessMessage: error instanceof Error
            ? `Voice playback is configured, but ElevenLabs usage details could not be loaded: ${error.message}`
            : "Voice playback is configured, but ElevenLabs usage details could not be loaded.",
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Unable to load ElevenLabs usage",
    });
  }
}

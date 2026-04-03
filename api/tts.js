import { synthesizeSpeech } from "./_lib/tts.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const result = await synthesizeSpeech({
      text: req.body?.text,
      previousText: req.body?.previousText,
      nextText: req.body?.nextText,
    });

    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-TTS-Provider", result.provider);
    res.status(200).send(result.audioBuffer);
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "TTS request failed",
    });
  }
}

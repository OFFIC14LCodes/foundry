import { getElevenLabsUsage, verifyAdminRequest } from "./_lib/tts.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    await verifyAdminRequest(req);
    const usage = await getElevenLabsUsage();
    res.status(200).json(usage);
  } catch (error) {
    const statusCode = error?.statusCode || 500;
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Unable to load ElevenLabs usage",
    });
  }
}

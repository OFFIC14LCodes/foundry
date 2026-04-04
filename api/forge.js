export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
    return;
  }

  try {
    const payload = await readJsonBody(req);
    const isStreaming = payload?.stream === true;

    if (!payload || !Array.isArray(payload.messages) || payload.messages.length === 0) {
      res.status(400).json({ error: "Invalid Forge payload: messages array is required" });
      return;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (isStreaming) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.status(response.status);

      if (!response.body) {
        const errorText = await response.text();
        res.write(`data: ${JSON.stringify({ error: errorText || "Empty Anthropic response body" })}\n\n`);
        res.end();
        return;
      }

      for await (const chunk of response.body) {
        res.write(chunk);
      }
      res.end();
    } else {
      const raw = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { error: raw || "Unexpected non-JSON response from Anthropic" };
      }
      res.status(response.status).json(parsed);
    }
  } catch (err) {
    console.error("Forge error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

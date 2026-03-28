const https = require("https");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
    return;
  }

  const body = JSON.stringify(req.body);
  const isStreaming = req.body && req.body.stream === true;

  const options = {
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  };

  return new Promise((resolve, reject) => {
    const apiReq = https.request(options, (apiRes) => {
      if (isStreaming) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.status(apiRes.statusCode);
        apiRes.pipe(res);
        apiRes.on("end", resolve);
      } else {
        let data = "";
        apiRes.on("data", (chunk) => { data += chunk; });
        apiRes.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            res.status(apiRes.statusCode).json(parsed);
          } catch (e) {
            res.status(500).json({ error: "Failed to parse response" });
          }
          resolve();
        });
      }
    });

    apiReq.on("error", (err) => {
      console.error("API request error:", err);
      res.status(500).json({ error: err.message });
      resolve();
    });

    apiReq.write(body);
    apiReq.end();
  });
};

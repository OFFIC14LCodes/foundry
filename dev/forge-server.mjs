import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getElevenLabsUsage, synthesizeSpeech, verifyAdminRequest } from "../api/_lib/tts.js";
import settingsFeedbackHandler from "../api/settings-feedback.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

loadEnvFile(path.join(repoRoot, ".env.local"));
loadEnvFile(path.join(repoRoot, ".env"));

const PORT = Number(process.env.FORGE_PORT || 3001);
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error("ANTHROPIC_API_KEY not set in .env.local, .env, or process environment.");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  enhanceResponse(res);

  if (!req.url) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing request URL" }));
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
    res.end();
    return;
  }

  if (req.url !== "/api/forge" && req.url !== "/api/tts" && req.url !== "/api/tts-usage" && req.url !== "/api/settings-feedback") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  if (req.url === "/api/settings-feedback") {
    try {
      const bodyText = req.method === "POST" ? await readBody(req) : "";
      req.body = bodyText ? JSON.parse(bodyText) : {};
      await settingsFeedbackHandler(req, res);
    } catch (error) {
      const statusCode = typeof error?.statusCode === "number" ? error.statusCode : 500;
      res.writeHead(statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : "Unable to handle settings feedback",
      }));
    }
    return;
  }

  if (req.url === "/api/tts-usage" && req.method === "GET") {
    try {
      await verifyAdminRequest(req);
      const usage = await getElevenLabsUsage();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(usage));
    } catch (error) {
      const statusCode = typeof error?.statusCode === "number" ? error.statusCode : 500;
      res.writeHead(statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: error instanceof Error ? error.message : "Unable to load ElevenLabs usage",
      }));
    }
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const bodyText = await readBody(req);
    const payload = bodyText ? JSON.parse(bodyText) : {};

    if (req.url === "/api/tts") {
      const result = await synthesizeSpeech({
        text: payload?.text,
        previousText: payload?.previousText,
        nextText: payload?.nextText,
      });

      res.writeHead(200, {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
        "X-TTS-Provider": result.provider,
      });
      res.end(result.audioBuffer);
      return;
    }

    const isStreaming = payload?.stream === true;

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    if (isStreaming) {
      res.writeHead(upstream.status, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      if (!upstream.body) {
        res.end();
        return;
      }

      for await (const chunk of upstream.body) {
        res.write(chunk);
      }
      res.end();
      return;
    }

    const responseText = await upstream.text();
    res.writeHead(upstream.status, { "Content-Type": "application/json" });
    res.end(responseText);
  } catch (error) {
    const statusCode = typeof error?.statusCode === "number" ? error.statusCode : 500;
    res.writeHead(statusCode, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: error instanceof Error ? error.message : "Unexpected Forge server error",
    }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Forge dev server listening on http://127.0.0.1:${PORT}/api/forge`);
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function loadEnvFile(filepath) {
  if (!fs.existsSync(filepath)) return;
  const raw = fs.readFileSync(filepath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = stripWrappingQuotes(value);
    }
  }
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function enhanceResponse(res) {
  if (typeof res.status !== "function") {
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
  }

  if (typeof res.json !== "function") {
    res.json = (payload) => {
      if (!res.headersSent && !res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json");
      }
      res.end(JSON.stringify(payload));
      return res;
    };
  }

  if (typeof res.send !== "function") {
    res.send = (payload) => {
      if (Buffer.isBuffer(payload) || payload instanceof Uint8Array) {
        res.end(payload);
        return res;
      }

      if (typeof payload === "object" && payload !== null) {
        return res.json(payload);
      }

      res.end(payload ?? "");
      return res;
    };
  }
}

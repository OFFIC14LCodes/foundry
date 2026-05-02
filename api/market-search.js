export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};

const rateBuckets = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, results: [] });
    return;
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ ok: false, results: [] });
    return;
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("TAVILY_API_KEY not set; live market search unavailable.");
    res.status(200).json({ ok: false, results: [] });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const queries = Array.isArray(body?.queries)
      ? body.queries
        .filter((query) => typeof query === "string")
        .map((query) => query.trim())
        .filter(Boolean)
        .slice(0, 5)
      : [];

    if (queries.length === 0) {
      res.status(400).json({ ok: false, results: [] });
      return;
    }

    const searchResponses = await Promise.all(queries.map((query) => searchTavily(query, apiKey)));
    if (searchResponses.some((result) => result === null)) {
      res.status(200).json({ ok: false, results: [] });
      return;
    }

    const results = searchResponses;
    res.status(200).json({ ok: true, results });
  } catch (error) {
    console.error("Market search error:", error);
    res.status(200).json({ ok: false, results: [] });
  }
}

async function searchTavily(query, apiKey) {
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 5,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`Tavily search failed for "${query}": ${response.status} ${text}`);
      return null;
    }

    const payload = await response.json();
    const sources = Array.isArray(payload?.results)
      ? payload.results.map(normalizeSource).filter(Boolean)
      : [];

    return { query, sources };
  } catch (error) {
    console.warn(`Tavily search unavailable for "${query}":`, error);
    return null;
  }
}

function normalizeSource(result) {
  if (!result || typeof result !== "object") return null;

  const title = typeof result.title === "string" ? result.title.trim() : "";
  const url = typeof result.url === "string" ? result.url.trim() : "";
  const snippet = typeof result.content === "string" ? result.content.trim() : "";
  const publishedDate =
    typeof result.published_date === "string"
      ? result.published_date
      : typeof result.publishedDate === "string"
        ? result.publishedDate
        : null;

  if (!title || !url) return null;
  return { title, url, snippet, publishedDate };
}

function isRateLimited(ip) {
  const now = Date.now();
  const current = rateBuckets.get(ip);

  if (!current || now - current.startedAt > WINDOW_MS) {
    rateBuckets.set(ip, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  return current.count > MAX_REQUESTS;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
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

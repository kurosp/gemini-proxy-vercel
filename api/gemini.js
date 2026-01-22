export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*"); // muốn chặt domain thì nói mình, mình chỉnh
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: { message: "Method not allowed" } });

  // ===== Read env keys =====
  const raw = (process.env.GEMINI_API_KEYS || "").trim();
  const keys = raw.split(",").map(s => s.trim()).filter(Boolean);
  if (!keys.length) return res.status(500).json({ error: { message: "Missing GEMINI_API_KEYS" } });

  // ===== Input =====
  let body = req.body;
  if (!body || typeof body !== "object") {
    try { body = JSON.parse(req.body); } catch {}
  }

  const model = (body?.model || "gemini-2.5-flash").trim();
  const payload = body?.payload;
  if (!payload || typeof payload !== "object") {
    return res.status(400).json({ error: { message: "Missing payload" } });
  }

  // ===== Helpers =====
  const retrySecondsFromMessage = (msg) => {
    const m = String(msg || "").match(/retry in\\s+([0-9.]+)s/i);
    if (!m) return 0;
    const sec = Number(m[1]);
    return Number.isFinite(sec) ? Math.ceil(sec) : 0;
  };

  const isQuotaError = (status, msg) =>
    status === 429 || /quota|exceed|rate|limit|RESOURCE_EXHAUSTED|Too Many Requests/i.test(String(msg || ""));

  // ===== Rotate keys on quota =====
  let lastErr = null;

  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (r.ok) return res.status(200).json(data);

    const msg = data?.error?.message || data?.raw || `http ${r.status}`;
    lastErr = { status: r.status, msg };

    // quota/rate limit -> try next key
    if (isQuotaError(r.status, msg)) continue;

    // 401/403 => key invalid/restricted; still try next key (đỡ chết toàn bộ)
    if (r.status === 401 || r.status === 403) continue;

    // other errors -> stop
    return res.status(r.status).json({ error: { message: msg, status: r.status } });
  }

  // all keys failed
  const wait = retrySecondsFromMessage(lastErr?.msg) || 30;
  res.setHeader("Retry-After", String(wait));
  return res.status(429).json({
    error: {
      message: `All keys exhausted or rate-limited. Retry in ${wait}s.`,
      retry_after_seconds: wait,
      last_error: lastErr
    }
  });
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const text = (req.query.text || "").toString().trim();
    const tl = (req.query.lang || "vi").toString(); // vi = tiếng Việt

    if (!text) return res.status(400).json({ error: "missing text" });

    // Google Translate TTS (unofficial)
    const url =
      "https://translate.google.com/translate_tts" +
      `?ie=UTF-8&q=${encodeURIComponent(text)}` +
      `&tl=${encodeURIComponent(tl)}` +
      `&client=tw-ob`;

    const r = await fetch(url, {
      headers: {
        // User-Agent để tránh bị chặn đơn giản
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Referer": "https://translate.google.com/",
      },
    });

    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return res.status(r.status).json({ error: "tts fetch failed", details: body.slice(0, 300) });
    }

    const audio = Buffer.from(await r.arrayBuffer());

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.status(200).send(audio);
  } catch (e) {
    return res.status(500).json({ error: "server error", details: String(e) });
  }
}

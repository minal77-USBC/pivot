const ALLOWED = [
  "https://www.basquetcatala.cat",
  "https://msstats.optimalwayconsulting.com",
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url param required" });

  const decoded = decodeURIComponent(url);
  if (!ALLOWED.some(base => decoded.startsWith(base))) {
    return res.status(403).json({ error: "domain not allowed" });
  }

  try {
    const upstream = await fetch(decoded, {
      headers: { "User-Agent": "Pivot/1.0" },
    });
    const contentType = upstream.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await upstream.json();
      res.setHeader("Content-Type", "application/json");
      return res.status(200).json(data);
    } else {
      const text = await upstream.text();
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(200).send(text);
    }
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

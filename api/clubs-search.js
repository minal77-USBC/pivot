import { Sentry } from "./_sentry.js";

// Search FCBQ clubs by name — fetches the clubs AJAX endpoint and filters client-side
export default async function handler(req, res) {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  const data = await fetch("https://www.basquetcatala.cat/clubs/ajax", {
    headers: { "User-Agent": "Mozilla/5.0" },
  })
    .then((r) => r.json())
    .catch((e) => { Sentry.captureException(e); return []; });

  const lower = q.toLowerCase();
  const matches = data
    .filter(
      (c) =>
        c.name?.toLowerCase().includes(lower) ||
        c.town?.toLowerCase().includes(lower)
    )
    .slice(0, 8)
    .map((c) => ({ id: c.id, name: c.name, town: c.town }));

  res.setHeader("Cache-Control", "public, s-maxage=3600");
  res.json(matches);
}

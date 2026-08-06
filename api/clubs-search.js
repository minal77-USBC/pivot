import { Sentry } from "./_sentry.js";
import { sbSelect, escapeFilter } from "./_supabase.js";

// Search FCBQ clubs by name or town.
//
// Previously scraped basquetcatala.cat/clubs/ajax, which now returns a bot
// challenge instead of JSON. Reads the fcbq_clubs index built by
// api/sync-index.js. Response shape is unchanged: [{ id, name, town }].
export default async function handler(req, res) {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  const term = escapeFilter(q);
  if (!term) return res.json([]);
  const pattern = `*${term}*`;

  try {
    const rows = await sbSelect(
      `fcbq_clubs?select=club_id,name,town` +
        `&or=(name.ilike.${pattern},town.ilike.${pattern})` +
        `&order=name.asc&limit=8`
    );

    res.setHeader("Cache-Control", "public, s-maxage=3600");
    res.json(rows.map((c) => ({ id: c.club_id, name: c.name, town: c.town })));
  } catch (e) {
    Sentry.captureException(e);
    res.json([]);
  }
}

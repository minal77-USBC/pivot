// Single match acta, cache-first.
//
// MatchBoxScores used to call msstats directly through /api/fcbq, bypassing the
// Supabase cache that the Game Log reads. That asymmetry meant Box Scores went
// blank whenever msstats was degraded even though the same actas were sitting
// in the cache — the exact inverse of the 2026-09 Game Log failure. Both views
// now read the same store.

import { loadBoxScores } from "./_boxscores.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { statsUuid, date } = req.query;
  if (!statsUuid) return res.status(400).json({ error: "statsUuid required" });

  const { byUuid, cachedCount, fetchedCount } = await loadBoxScores([
    { statsUuid, date: date || null },
  ]);

  const data = byUuid[statsUuid];
  if (!data) {
    // Neither cached nor retrievable — the client renders "not yet available"
    return res.status(404).json({ error: "Box score not available" });
  }

  res.setHeader("X-Cache-Stats", `cached:${cachedCount} fetched:${fetchedCount}`);
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  return res.status(200).json(data);
}

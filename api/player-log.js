const MSSTATS_BASE = "https://msstats.optimalwayconsulting.com/v1/fcbq";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { kidName, matches: matchesParam } = req.query;
  if (!kidName || !matchesParam) {
    return res.status(400).json({ error: "kidName and matches required" });
  }

  let matches;
  try {
    matches = JSON.parse(matchesParam);
  } catch {
    return res.status(400).json({ error: "matches must be valid JSON" });
  }

  const withUuid = matches.filter(m => m.statsUuid);
  if (!withUuid.length) {
    return res.status(200).json({ log: [] });
  }

  const nameUpper = kidName.toUpperCase();

  // Fetch all box scores in parallel
  const results = await Promise.all(
    withUuid.map(async (m) => {
      try {
        const r = await fetch(
          `${MSSTATS_BASE}/getJsonWithMatchStats/${m.statsUuid}`,
          { headers: { "User-Agent": "Pivot/1.0" } }
        );
        if (!r.ok) return null;
        const data = await r.json();

        // Find the player row across all teams
        let player = null;
        for (const team of data.teams || []) {
          player = (team.players || []).find(p =>
            p.name?.toUpperCase().includes(nameUpper)
          );
          if (player) break;
        }
        if (!player) return null;

        const d = player.data || {};
        return {
          date: m.date,
          opp: m.opp,
          ha: m.ha,
          win: m.win,
          matchScore: m.score,
          min: player.timePlayed ?? "—",
          pts: d.score ?? 0,
          twoM: d.shotsOfTwoSuccessful ?? 0,
          twoA: d.shotsOfTwoAttempted ?? 0,
          ftM: d.shotsOfOneSuccessful ?? 0,
          ftA: d.shotsOfOneAttempted ?? 0,
          reb: d.rebounds ?? 0,
          ast: d.assists ?? 0,
          stl: d.steals ?? 0,
          pf: d.faults ?? 0,
          plusMinus: player.inOut ?? 0,
          starting: player.starting ?? false,
        };
      } catch {
        return null;
      }
    })
  );

  const log = results
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  return res.status(200).json({ log });
}

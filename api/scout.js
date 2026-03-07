const MSSTATS_BASE = "https://msstats.optimalwayconsulting.com/v1/fcbq";
const SEASON = String(
  new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1
);

function daysUntil(dateStr) {
  return Math.round((new Date(dateStr + "T12:00:00") - new Date()) / 86400000);
}

function ftPct(made, attempted) {
  if (!attempted) return "—";
  return `${Math.round((made / attempted) * 100)}%`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { oppTeamId, ourTeamId, matchDate } = req.query;
  if (!oppTeamId || !ourTeamId || !matchDate) {
    return res.status(400).json({ error: "oppTeamId, ourTeamId, matchDate required" });
  }

  try {
    // Opponent season stats
    const statsRes = await fetch(
      `${MSSTATS_BASE}/team-stats/team/${oppTeamId}/season/${SEASON}`,
      { headers: { "User-Agent": "Pivot/1.0" } }
    );
    if (!statsRes.ok) throw new Error(`msstats ${statsRes.status}`);
    const statsData = await statsRes.json();

    const team = statsData.team;
    const ppf = team.totalScoreAvgByMatch;
    const ppa = team.sumMatches > 0
      ? Math.round((team.teamScore.ScoreAgainst / team.sumMatches) * 10) / 10
      : null;

    const topPlayers = [...(statsData.players || [])]
      .sort((a, b) => b.totalScoreAvgByMatch - a.totalScoreAvgByMatch)
      .slice(0, 3)
      .map(p => ({
        name: p.name.split(" ")[0],
        dorsal: p.dorsal || "—",
        ppg: p.totalScoreAvgByMatch,
        rpg: p.sumReboundsAvgByMatch,
        apg: p.sumAssistsAvgByMatch,
        ft: ftPct(p.sumShotsOfOneSuccessful, p.sumShotsOfOneAttempted),
        val: p.sumValorationAvgByMatch,
        gp: p.matchesPlayed,
      }));

    // H2H — only attempt if match is ≤14 days away
    let h2h = null;
    if (daysUntil(matchDate) <= 14) {
      try {
        const h2hRes = await fetch(
          `${MSSTATS_BASE}/head-to-head/full-prematch/${ourTeamId}/${oppTeamId}/${SEASON}`,
          { headers: { "User-Agent": "Pivot/1.0" } }
        );
        if (h2hRes.ok) {
          const h2hData = await h2hRes.json();
          h2h = h2hData.thisSeason || null;
        }
      } catch { /* H2H is optional — don't fail the whole response */ }
    }

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=300");
    return res.status(200).json({
      record: {
        wins: team.teamResults.wins,
        losses: team.teamResults.losses,
        gp: team.sumMatches,
        ppf,
        ppa,
      },
      topPlayers,
      h2h,
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

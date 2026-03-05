// Fetches grup IDs for a given FCBQ team ID by scraping the team page HTML
export default async function handler(req, res) {
  const { teamId } = req.query;
  if (!teamId || !/^\d+$/.test(teamId)) {
    return res.status(400).json({ error: "Invalid teamId" });
  }

  const html = await fetch(`https://www.basquetcatala.cat/equip/${teamId}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  })
    .then((r) => r.text())
    .catch(() => "");

  // Extract all grup IDs from /competicions/resultats/{id} links in order of appearance
  const grupMatches = [...html.matchAll(/\/competicions\/resultats\/(\d+)/g)];
  const grupIds = [...new Set(grupMatches.map((m) => m[1]))];

  res.setHeader("Cache-Control", "public, s-maxage=3600");
  res.json({
    fcbqTeamId: teamId,
    grupIdPhase1: grupIds[0] || null,
    grupIdPhase2: grupIds[1] || null,
  });
}

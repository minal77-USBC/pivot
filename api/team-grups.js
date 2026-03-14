import { Sentry } from "./_sentry.js";

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
    .catch((e) => { Sentry.captureException(e); return ""; });

  // Extract (label, grupId) pairs using the FCBQ page structure:
  //   <h4 id="news-sidebar">COMPETITION NAME:</h4>
  //   <h4><a href="/competicions/resultats/ID">Veure resultats</a></h4>
  const sectionRe = /id="news-sidebar"[^>]*>\s*([^<]+?)\s*<\/h4>.*?\/competicions\/resultats\/(\d+)/gs;
  const sections = [...html.matchAll(sectionRe)].map((m) => ({
    label: m[1].trim().toUpperCase(),
    grupId: m[2],
  }));

  // Deduplicate (preserve first occurrence)
  const seen = new Set();
  const unique = sections.filter(({ grupId }) => {
    if (seen.has(grupId)) return false;
    seen.add(grupId);
    return true;
  });

  // Filter out mid-season tournaments — their labels contain known keywords.
  // Teams like those in the Trofeu Molinet have 3+ grups; blindly taking [0],[1]
  // would assign the tournament grup as Phase 2 instead of the actual SEGONA FASE.
  const TOURNAMENT_KEYWORDS = ["COPA", "TORNEIG", "TROFEU", "SUPERCOPA"];
  const leaguePhases = unique.filter(
    ({ label }) => !TOURNAMENT_KEYWORDS.some((kw) => label.includes(kw))
  );

  // Expose all detected sections for debugging / manual override in Settings
  res.setHeader("Cache-Control", "public, s-maxage=3600");
  res.json({
    fcbqTeamId: teamId,
    grupIdPhase1: leaguePhases[0]?.grupId || null,
    grupIdPhase2: leaguePhases[1]?.grupId || null,
    allSections: unique.map(({ label, grupId }) => ({ label, grupId })),
  });
}

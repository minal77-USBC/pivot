import { Sentry } from "./_sentry.js";
import { sbSelect } from "./_supabase.js";

// Resolves the league-phase grup IDs for an FCBQ team.
//
// Previously scraped basquetcatala.cat/equip/{id} and guessed which grups were
// league phases by filtering tournament keywords out of the page headings. That
// page now returns a bot challenge. Reads the fcbq_teams index built by
// api/sync-index.js, where phases are already resolved from the ESB competition
// tree — so the keyword heuristic is gone and the answer is authoritative.
//
// Response shape is unchanged:
//   { fcbqTeamId, grupIdPhase1, grupIdPhase2, allSections: [{ label, grupId }] }
export default async function handler(req, res) {
  const { teamId } = req.query;
  if (!teamId || !/^\d+$/.test(teamId)) {
    return res.status(400).json({ error: "Invalid teamId" });
  }

  try {
    const [team] = await sbSelect(
      `fcbq_teams?select=team_id,category,grup_id_phase1,grup_id_phase2,` +
        `competition_phase1,competition_phase2&team_id=eq.${teamId}&limit=1`
    );

    if (!team) {
      // Either a stale team id from a previous season, or a category FCBQ has
      // not published yet. Both are "no grups", not an error.
      res.setHeader("Cache-Control", "public, s-maxage=300");
      return res.json({
        fcbqTeamId: teamId,
        grupIdPhase1: null,
        grupIdPhase2: null,
        allSections: [],
      });
    }

    const allSections = [
      { label: (team.competition_phase1 || team.category || "").toUpperCase(), grupId: team.grup_id_phase1 },
      { label: (team.competition_phase2 || "").toUpperCase(), grupId: team.grup_id_phase2 },
    ].filter((s) => s.grupId);

    res.setHeader("Cache-Control", "public, s-maxage=3600");
    res.json({
      fcbqTeamId: team.team_id,
      grupIdPhase1: team.grup_id_phase1,
      grupIdPhase2: team.grup_id_phase2,
      allSections,
    });
  } catch (e) {
    Sentry.captureException(e);
    res.status(500).json({ error: "Index unavailable" });
  }
}

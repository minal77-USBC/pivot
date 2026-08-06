import { Sentry } from "./_sentry.js";
import { sbSelect } from "./_supabase.js";

// Lists the teams belonging to an FCBQ club.
//
// Previously scraped basquetcatala.cat/club/{id}, which now returns a bot
// challenge. Reads the fcbq_teams index built by api/sync-index.js. Response
// shape is unchanged: [{ teamId, name, category }].
export default async function handler(req, res) {
  const { clubId } = req.query;
  if (!clubId || !/^\d+$/.test(clubId)) {
    return res.status(400).json({ error: "Invalid clubId" });
  }

  try {
    const rows = await sbSelect(
      `fcbq_teams?select=team_id,name,category,tier,sex` +
        `&club_id=eq.${clubId}&order=category.asc,name.asc`
    );

    res.setHeader("Cache-Control", "public, s-maxage=3600");
    res.json(
      rows.map((t) => ({
        teamId: t.team_id,
        name: t.name,
        category: t.category,
        // Additive — the Setup screen ignores unknown fields, but tier lets a
        // parent tell an A side from a 1r Any side when names are identical.
        tier: t.tier,
        sex: t.sex,
      }))
    );
  } catch (e) {
    Sentry.captureException(e);
    res.status(500).json({ error: "Index unavailable" });
  }
}

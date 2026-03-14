import { Sentry } from "./_sentry.js";

// Fetches teams for a given FCBQ club ID by scraping the club page HTML
export default async function handler(req, res) {
  const { clubId } = req.query;
  if (!clubId || !/^\d+$/.test(clubId)) {
    return res.status(400).json({ error: "Invalid clubId" });
  }

  const html = await fetch(`https://www.basquetcatala.cat/club/${clubId}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  })
    .then((r) => r.text())
    .catch((e) => { Sentry.captureException(e); return ""; });

  // Each team row looks like:
  //   CATEGORY TEXT   | <a class="c-0" href="/equip/12345">  TEAM NAME</a>
  // Capture category (before |), teamId, and team name on the same line.
  const teams = [];
  const rowRe = /([^\n|]+)\|\s*<a[^>]+href="\/equip\/(\d+)"[^>]*>\s*([^<]+?)\s*<\/a>/g;
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    const category = m[1].trim();
    const teamId = m[2];
    const name = m[3].trim();
    if (name) teams.push({ teamId, name, category });
  }

  res.setHeader("Cache-Control", "public, s-maxage=3600");
  res.json(teams);
}

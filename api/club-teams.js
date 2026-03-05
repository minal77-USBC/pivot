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
    .catch(() => "");

  // Only use headings that contain competition-specific keywords
  const isUsefulHeading = (text) =>
    /masculí|femení|copa|sènior|júnior|cadet|infantil|mini|premini|territorial|preferent|promoció/i.test(text);

  const headings = [];
  const headingRe = /<h[2-5][^>]*>([^<]+)</g;
  let m;
  while ((m = headingRe.exec(html)) !== null) {
    const text = m[1].trim();
    if (isUsefulHeading(text)) headings.push({ pos: m.index, text });
  }

  // Extract teams: /equip/{id} links with their names
  const teams = [];
  const teamRe = /href="\/equip\/(\d+)"[^>]*>([^<]+)</g;
  while ((m = teamRe.exec(html)) !== null) {
    const teamPos = m.index;
    const category = headings.filter((h) => h.pos < teamPos).pop()?.text || "";
    teams.push({ teamId: m[1], name: m[2].trim(), category });
  }

  res.setHeader("Cache-Control", "public, s-maxage=3600");
  res.json(teams);
}

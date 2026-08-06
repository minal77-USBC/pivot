/**
 * Spike: Find Grup Barna team IDs + grup IDs for season 2026/27
 *
 * Run:
 *   node --env-file=.env.local spikes/season-2026-team-discovery.mjs
 *
 * Why this exists:
 *   basquetcatala.cat HTML is now behind a bot challenge ("Verificació de
 *   seguretat"), so /api/team-grups and /api/club-teams can no longer derive
 *   IDs. The ESB API is unaffected, so we walk it directly:
 *     1. CategoryRegistered/getByZoneAndSeason/1/2026 → categories
 *     2. Competition/getCompetitionGroupVisibleWeb/{idCategoryRegistred}/1 → grups
 *     3. getAllGamesByGrupWithMatchRecords/{grupId} → teams (names + IDs)
 */

import { writeFileSync } from "fs";

const ESB = `${process.env.ESB_BASE_URL}/${process.env.ESB_API_KEY}`;
const ZONE = 1;
const SEASON = "2026";
const CLUB_MATCH = /BARNA|GRUP ESP/i;
const YOUTH = /JÚNIOR|JUNIOR|CADET|INFANTIL/i;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function esb(path) {
  const res = await fetch(`${ESB}/${path}`, { headers: { "User-Agent": "Pivot/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return JSON.parse(Buffer.from(text, "base64").toString("utf8")).messageData;
}

// rounds is keyed by round number; each round is { date, matches: { matchId: {...} } }
function flattenGames(rounds) {
  return Object.values(rounds || {})
    .flatMap((r) => Object.values(r?.matches || {}))
    .filter((g) => g && typeof g === "object");
}

const cats = (await esb(`CategoryRegistered/getByZoneAndSeason/${ZONE}/${SEASON}`))
  .filter((c) => YOUTH.test(c.categoryRegisteredName || ""));

console.log(`Season ${SEASON} — ${cats.length} youth categories\n`);

const hits = [];
const allTeams = [];

for (const cat of cats) {
  const name = cat.categoryRegisteredName;
  let grups = [];
  try {
    grups = (await esb(`Competition/getCompetitionGroupVisibleWeb/${cat.idCategoryRegistred}/${ZONE}`)) || [];
  } catch (e) {
    console.log(`  [${cat.idCategoryRegistred}] ${name} — ERROR ${e.message}`);
    continue;
  }
  console.log(`  [${cat.idCategoryRegistred}] ${name} — ${grups.length} grup(s)`);
  await delay(250);

  for (const g of grups) {
    let games = [];
    try {
      games = flattenGames((await esb(`FCBQWeb/getAllGamesByGrupWithMatchRecords/${g.idGroup}`))?.rounds);
    } catch {
      await delay(250);
      continue;
    }
    await delay(250);

    for (const m of games) {
      for (const side of ["Local", "Visitor"]) {
        const teamName = m[`name${side}Team`];
        const teamId = m[`id${side}Team`];
        if (!teamName) continue;
        allTeams.push({ teamId: String(teamId), teamName: teamName.trim(), grupId: String(g.idGroup), category: name });
        if (!CLUB_MATCH.test(teamName)) continue;
        hits.push({
          teamId: String(teamId),
          teamName: teamName.trim(),
          grupId: String(g.idGroup),
          grupName: g.grupName || g.competitionName || "",
          category: name,
          sex: cat.sex,
        });
      }
    }
  }
}

// Collapse to unique (teamId, grupId) pairs
const seen = new Set();
const unique = hits.filter((h) => {
  const k = `${h.teamId}:${h.grupId}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

console.log(`\n=== GRUP BARNA TEAMS — SEASON ${SEASON} ===`);
for (const h of unique) {
  console.log(`teamId=${h.teamId}  grupId=${h.grupId}  ${h.sex}  ${h.teamName}  |  ${h.category}`);
}
console.log(`\n${unique.length} team/grup pairs`);

const seenAll = new Set();
const allUnique = allTeams.filter((t) => {
  const k = `${t.teamId}:${t.grupId}`;
  if (seenAll.has(k)) return false;
  seenAll.add(k);
  return true;
});
console.log(`(${allUnique.length} total team/grup pairs scanned)`);

writeFileSync(
  new URL("./season-2026-team-discovery-results.json", import.meta.url),
  JSON.stringify({ barna: unique, allTeams: allUnique }, null, 2)
);

import { track } from "@vercel/analytics/server";
import { loadBoxScores, extractPlayerRow, findTeam, normalizeName } from "./_boxscores.js";

function parseTimeSecs(timeStr) {
  if (!timeStr || timeStr === "—") return 0;
  const s = String(timeStr).trim();
  const parts = s.split(":");
  if (parts.length === 2) return parseInt(parts[0]) * 60 + (parseInt(parts[1]) || 0);
  // Plain number — msstats returns timePlayed as integer minutes
  const mins = parseFloat(s);
  return isNaN(mins) ? 0 : Math.round(mins * 60);
}

function formatTimeSecs(totalSecs) {
  return String(Math.round(totalSecs / 60));
}

function accumulateTeamPlayers(playerMap, team) {
  for (const p of team.players || []) {
    // Key by uuid where present — it survives the mid-season name changes that
    // name keying does not. Falls back to the normalised name.
    const key = p.uuid || normalizeName(p.name);
    if (!key) continue;
    if (!playerMap[key]) {
      playerMap[key] = { uuid: p.uuid ?? null, name: p.name, dorsal: p.dorsal, gp: 0, pts: 0, val: 0, ftM: 0, ftA: 0, pf: 0, threeM: 0, timeSecs: 0 };
    }
    const acc = playerMap[key];
    const d = p.data || {};
    acc.gp++;
    acc.pts  += d.score               ?? 0;
    acc.val  += d.valoration          ?? 0;
    acc.ftM  += d.shotsOfOneSuccessful ?? 0;
    acc.ftA  += d.shotsOfOneAttempted  ?? 0;
    acc.pf      += d.faults                 ?? 0;
    acc.threeM  += d.shotsOfThreeSuccessful ?? 0;
    acc.timeSecs += parseTimeSecs(p.timePlayed);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { kidName, matches: matchesParam, teamId, playerUuid } = req.query;
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
    return res.status(200).json({ log: [], teamLog: [], matchedBy: null });
  }
  const start = Date.now();

  const identity = { playerUuid: playerUuid || null, name: kidName };
  const { byUuid, cachedCount, fetchedCount } = await loadBoxScores(withUuid);

  const playerMap = {};
  let matchedBy = null;

  const results = withUuid.map((m) => {
    const data = byUuid[m.statsUuid];
    if (!data) return null;

    // Aggregate all team players if teamId supplied
    if (teamId) {
      const team = findTeam(data, teamId);
      if (team) accumulateTeamPlayers(playerMap, team);
    }

    const player = extractPlayerRow(data, identity);
    if (!player) return null;
    if (!matchedBy) matchedBy = identity.playerUuid && player.uuid === identity.playerUuid ? "uuid" : "name";

    const d = player.data || {};
    return {
      date: m.date,
      opp: m.opp,
      ha: m.ha,
      win: m.win,
      matchScore: m.score,
      min: player.timePlayed ?? "—",
      pts: d.score ?? 0,
      val: d.valoration ?? 0,
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
  });

  const log = results
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Build team roster sorted by PPG desc
  const teamLog = teamId
    ? Object.values(playerMap)
        .map(p => ({
          uuid: p.uuid,
          name: p.name,
          dorsal: p.dorsal,
          gp: p.gp,
          totalPts: p.pts,
          ppg:   p.gp ? parseFloat((p.pts / p.gp).toFixed(1)) : 0,
          min:   formatTimeSecs(p.timeSecs),
          val:   p.gp ? parseFloat((p.val / p.gp).toFixed(1)) : 0,
          ftPct: p.ftA > 0 ? Math.round(p.ftM / p.ftA * 100) : null,
          threeM: p.threeM,
          pf:    p.gp ? parseFloat((p.pf  / p.gp).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.ppg - a.ppg)
    : [];

  const latencyMs = Date.now() - start;
  await track("player_log_fetched", {
    matchCount: withUuid.length,
    cacheHit: fetchedCount === 0,
    latencyMs,
    // Surfaces the silent-empty case: acta rows exist but none resolved to this kid
    matchedBy: matchedBy ?? "none",
  }, { request: req });
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  res.setHeader("X-Cache-Stats", `cached:${cachedCount} fetched:${fetchedCount}`);
  return res.status(200).json({ log, teamLog, matchedBy });
}

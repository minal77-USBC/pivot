const MSSTATS_BASE = "https://msstats.optimalwayconsulting.com/v1/fcbq";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

function sbHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function getCachedBoxScores(uuids) {
  const list = uuids.map(u => `"${u}"`).join(",");
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/match_box_scores?select=stats_uuid,data&stats_uuid=in.(${list})`,
    { headers: sbHeaders() }
  );
  if (!r.ok) return {};
  const rows = await r.json();
  return Object.fromEntries(rows.map(row => [row.stats_uuid, row.data]));
}

async function upsertBoxScores(rows) {
  await fetch(`${SUPABASE_URL}/rest/v1/match_box_scores`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify(rows),
  });
}

function extractPlayerRow(data, nameUpper) {
  for (const team of data.teams || []) {
    const player = (team.players || []).find(p =>
      p.name?.toUpperCase().includes(nameUpper)
    );
    if (player) return player;
  }
  return null;
}

function findTeam(data, teamIdStr) {
  return (data.teams || []).find(t =>
    String(t.teamId) === teamIdStr || String(t.teamIdExtern) === teamIdStr
  ) || null;
}

function accumulateTeamPlayers(playerMap, team) {
  for (const p of team.players || []) {
    const key = String(p.actorId || p.name);
    if (!playerMap[key]) {
      playerMap[key] = { name: p.name, dorsal: p.dorsal, gp: 0, pts: 0, val: 0, ftM: 0, ftA: 0, pf: 0 };
    }
    const acc = playerMap[key];
    const d = p.data || {};
    acc.gp++;
    acc.pts  += d.score               ?? 0;
    acc.val  += d.valoration          ?? 0;
    acc.ftM  += d.shotsOfOneSuccessful ?? 0;
    acc.ftA  += d.shotsOfOneAttempted  ?? 0;
    acc.pf   += d.faults              ?? 0;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { kidName, matches: matchesParam, teamId } = req.query;
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
  const allUuids = withUuid.map(m => m.statsUuid);

  // 1. Read from Supabase cache
  const cached = await getCachedBoxScores(allUuids).catch(() => ({}));
  const cachedUuids = new Set(Object.keys(cached));

  // 2. Fetch only missing box scores from msstats
  const missing = withUuid.filter(m => !cachedUuids.has(m.statsUuid));
  const freshData = {};

  if (missing.length) {
    const fetched = await Promise.all(
      missing.map(async (m) => {
        try {
          const r = await fetch(
            `${MSSTATS_BASE}/getJsonWithMatchStats/${m.statsUuid}`,
            { headers: { "User-Agent": "Pivot/1.0" } }
          );
          if (!r.ok) return null;
          const data = await r.json();
          return { statsUuid: m.statsUuid, matchDate: m.date, data };
        } catch {
          return null;
        }
      })
    );

    const toUpsert = [];
    for (const row of fetched) {
      if (!row) continue;
      freshData[row.statsUuid] = row.data;
      toUpsert.push({
        stats_uuid: row.statsUuid,
        data: row.data,
        match_date: row.matchDate,
      });
    }

    // 3. Upsert new rows — await before response (Vercel kills process on res.end)
    if (toUpsert.length) {
      await upsertBoxScores(toUpsert).catch(() => {});
    }
  }

  // 4. Combine cache + fresh, extract player rows + optionally aggregate team
  const playerMap = {};
  const teamIdStr = teamId ? String(teamId) : null;

  const results = withUuid.map((m) => {
    const data = cached[m.statsUuid] || freshData[m.statsUuid];
    if (!data) return null;

    // Aggregate all team players if teamId supplied
    if (teamIdStr) {
      const team = findTeam(data, teamIdStr);
      if (team) accumulateTeamPlayers(playerMap, team);
    }

    const player = extractPlayerRow(data, nameUpper);
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
  const teamLog = teamIdStr
    ? Object.values(playerMap)
        .map(p => ({
          name: p.name,
          dorsal: p.dorsal,
          gp: p.gp,
          ppg: p.gp ? parseFloat((p.pts  / p.gp).toFixed(1)) : 0,
          val: p.gp ? parseFloat((p.val  / p.gp).toFixed(1)) : 0,
          ftPct: p.ftA > 0 ? Math.round(p.ftM / p.ftA * 100) : null,
          pf:  p.gp ? parseFloat((p.pf   / p.gp).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.ppg - a.ppg)
    : [];

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
  res.setHeader("X-Cache-Stats", `cached:${cachedUuids.size} fetched:${missing.length}`);
  return res.status(200).json({ log, teamLog });
}

import { ESB, MSSTATS_BASE } from "./constants.js";

const SEASON = String(
  new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1
);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

function daysUntil(dateStr) {
  return Math.round((new Date(dateStr + "T12:00:00") - new Date()) / 86400000);
}

function ftPct(made, attempted) {
  if (!attempted) return "—";
  return `${Math.round((made / attempted) * 100)}%`;
}

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

function parseTimeSecs(timeStr) {
  if (!timeStr || timeStr === "—") return 0;
  const s = String(timeStr).trim();
  const parts = s.split(":");
  if (parts.length === 2) return parseInt(parts[0]) * 60 + (parseInt(parts[1]) || 0);
  const mins = parseFloat(s);
  return isNaN(mins) ? 0 : Math.round(mins * 60);
}

function findTeam(data, teamIdStr) {
  return (data.teams || []).find(t =>
    String(t.teamId) === teamIdStr || String(t.teamIdExtern) === teamIdStr
  ) || null;
}

function accumulateTeamPlayers(playerMap, team) {
  for (const p of team.players || []) {
    const key = (p.name || "").trim().toUpperCase();
    if (!playerMap[key]) {
      playerMap[key] = { name: p.name, dorsal: p.dorsal, gp: 0, pts: 0, val: 0, ftM: 0, ftA: 0, rpg: 0, apg: 0, timeSecs: 0 };
    }
    const acc = playerMap[key];
    const d = p.data || {};
    acc.gp++;
    acc.pts += d.score               ?? 0;
    acc.val += d.valoration          ?? 0;
    acc.ftM += d.shotsOfOneSuccessful ?? 0;
    acc.ftA += d.shotsOfOneAttempted  ?? 0;
    acc.rpg += d.rebounds            ?? 0;
    acc.apg += d.assists             ?? 0;
    acc.timeSecs += parseTimeSecs(p.timePlayed);
  }
}

// Returns { form: [...last5], allMatches: [...all played with statsUuid/ls/vs/isLocal] }
async function fetchFormFromGrup(grupId, oppTeamId) {
  const res = await fetch(
    `${ESB}/FCBQWeb/getAllGamesByGrupWithMatchRecords/${grupId}`,
    { headers: { "User-Agent": "Pivot/1.0" } }
  );
  const raw = await res.arrayBuffer();
  const json = Buffer.from(Buffer.from(raw).toString("ascii"), "base64").toString("utf-8");
  const rounds = JSON.parse(json).messageData.rounds;
  const matches = [];

  for (const round of Object.values(rounds)) {
    for (const m of Object.values(round.matches || {})) {
      if (!m.matchDay) continue;
      const isLocal = String(m.idLocalTeam) === String(oppTeamId);
      const isVisitor = String(m.idVisitorTeam) === String(oppTeamId);
      if (!isLocal && !isVisitor) continue;

      const ls = m.localScore != null ? parseInt(m.localScore) : null;
      const vs = m.visitorScore != null ? parseInt(m.visitorScore) : null;
      if (ls === null || vs === null) continue;

      const isWalkover = (ls === 0 && vs === 2) || (ls === 2 && vs === 0);
      const win = isLocal ? ls > vs : vs > ls;
      const [datePart] = m.matchDay.split(" ");

      matches.push({
        statsUuid: m.universallyid || null,
        date: datePart,
        opp: (isLocal ? m.nameVisitorTeam : m.nameLocalTeam) || "—",
        ha: isLocal ? "home" : "away",
        win,
        score: isWalkover ? "W/O" : `${ls}–${vs}`,
        ls,
        vs,
        isLocal,
        isWalkover,
      });
    }
  }

  const sorted = matches.sort((a, b) => b.date.localeCompare(a.date));
  return { form: sorted.slice(0, 5), allMatches: sorted };
}

async function fetchRecentForm(oppTeamId, grupId) {
  // If the match's grupId is known, use it directly — restricts form to current phase only
  if (grupId) {
    try { return await fetchFormFromGrup(grupId, oppTeamId); } catch { /* fall through */ }
  }

  // Fallback: scrape opponent's team page for their grup IDs
  const html = await fetch(`https://www.basquetcatala.cat/equip/${oppTeamId}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  }).then(r => r.text()).catch(() => "");

  const grupIds = [...new Set(
    [...html.matchAll(/\/competicions\/resultats\/(\d+)/g)].map(m => m[1])
  )].slice(0, 2);

  if (!grupIds.length) return { form: [], allMatches: [] };

  const allMatches = [];
  for (const gid of grupIds) {
    try {
      const r = await fetchFormFromGrup(gid, oppTeamId);
      allMatches.push(...r.allMatches);
    } catch { /* skip */ }
  }

  allMatches.sort((a, b) => b.date.localeCompare(a.date));
  return { form: allMatches.slice(0, 5), allMatches };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { oppTeamId, ourTeamId, matchDate, grupId } = req.query;
  if (!oppTeamId || !ourTeamId || !matchDate) {
    return res.status(400).json({ error: "oppTeamId, ourTeamId, matchDate required" });
  }

  try {
    const [statsRes, { form: recentForm, allMatches }] = await Promise.all([
      fetch(`${MSSTATS_BASE}/team-stats/team/${oppTeamId}/season/${SEASON}`, {
        headers: { "User-Agent": "Pivot/1.0" },
      }),
      fetchRecentForm(oppTeamId, grupId || null),
    ]);

    if (!statsRes.ok) throw new Error(`msstats ${statsRes.status}`);
    const statsData = await statsRes.json();

    // — Non-Preferent path: team-stats returns {} —
    if (!statsData.team) {
      // Derive record from ESB match data (exclude walkovers from scoring averages)
      const gp = allMatches.length;
      const wins = allMatches.filter(m => m.win).length;
      const losses = allMatches.filter(m => !m.win).length;
      const scoringGames = allMatches.filter(m => !m.isWalkover);
      const sg = scoringGames.length;
      const ppf = sg ? Math.round(scoringGames.reduce((s, m) => s + (m.isLocal ? m.ls : m.vs), 0) / sg * 10) / 10 : null;
      const ppa = sg ? Math.round(scoringGames.reduce((s, m) => s + (m.isLocal ? m.vs : m.ls), 0) / sg * 10) / 10 : null;

      // Fetch box scores for player threats
      const uuids = allMatches.map(m => m.statsUuid).filter(Boolean);
      let topPlayers = [];

      if (uuids.length) {
        const cached = await getCachedBoxScores(uuids).catch(() => ({}));
        const cachedSet = new Set(Object.keys(cached));
        const missing = allMatches.filter(m => m.statsUuid && !cachedSet.has(m.statsUuid));

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
              } catch { return null; }
            })
          );

          const toUpsert = [];
          for (const row of fetched) {
            if (!row) continue;
            freshData[row.statsUuid] = row.data;
            toUpsert.push({ stats_uuid: row.statsUuid, data: row.data, match_date: row.matchDate });
          }
          if (toUpsert.length) await upsertBoxScores(toUpsert).catch(() => {});
        }

        const playerMap = {};
        const oppTeamIdStr = String(oppTeamId);
        for (const m of allMatches) {
          if (!m.statsUuid) continue;
          const data = cached[m.statsUuid] || freshData[m.statsUuid];
          if (!data) continue;
          const team = findTeam(data, oppTeamIdStr);
          if (team) accumulateTeamPlayers(playerMap, team);
        }

        topPlayers = Object.values(playerMap)
          .filter(p => p.gp > 0)
          .map(p => ({
            name: p.name.split(" ").slice(0, 2).join(" "),
            dorsal: p.dorsal || "—",
            ppg: parseFloat((p.pts / p.gp).toFixed(1)),
            rpg: parseFloat((p.rpg / p.gp).toFixed(1)),
            apg: parseFloat((p.apg / p.gp).toFixed(1)),
            ft: ftPct(p.ftM, p.ftA),
            val: parseFloat((p.val / p.gp).toFixed(1)),
            gp: p.gp,
          }))
          .sort((a, b) => b.ppg - a.ppg)
          .slice(0, 5);
      }

      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=300");
      return res.status(200).json({
        record: gp > 0 ? { wins, losses, gp, ppf, ppa } : null,
        topPlayers,
        h2h: null,
        recentForm,
      });
    }

    // — Preferent path (unchanged) —
    const team = statsData.team;
    const ppf = team.totalScoreAvgByMatch;
    const ppa = team.sumMatches > 0
      ? Math.round((team.teamScore.ScoreAgainst / team.sumMatches) * 10) / 10
      : null;

    const topPlayers = [...(statsData.players || [])]
      .sort((a, b) => b.totalScoreAvgByMatch - a.totalScoreAvgByMatch)
      .slice(0, 5)
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
      } catch { /* H2H is optional */ }
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
      recentForm,
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

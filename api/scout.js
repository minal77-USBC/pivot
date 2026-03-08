import { ESB, MSSTATS_BASE } from "./constants.js";
const SEASON = String(
  new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1
);

function daysUntil(dateStr) {
  return Math.round((new Date(dateStr + "T12:00:00") - new Date()) / 86400000);
}

function ftPct(made, attempted) {
  if (!attempted) return "—";
  return `${Math.round((made / attempted) * 100)}%`;
}

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
        date: datePart,
        opp: (isLocal ? m.nameVisitorTeam : m.nameLocalTeam) || "—",
        ha: isLocal ? "home" : "away",
        win,
        score: isWalkover ? "W/O" : `${ls}–${vs}`,
      });
    }
  }

  return matches.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
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

  if (!grupIds.length) return [];

  const allMatches = [];
  for (const gid of grupIds) {
    try { allMatches.push(...await fetchFormFromGrup(gid, oppTeamId)); } catch { /* skip */ }
  }

  return allMatches.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
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
    const [statsRes, recentForm] = await Promise.all([
      fetch(`${MSSTATS_BASE}/team-stats/team/${oppTeamId}/season/${SEASON}`, {
        headers: { "User-Agent": "Pivot/1.0" },
      }),
      fetchRecentForm(oppTeamId, grupId || null),
    ]);

    if (!statsRes.ok) throw new Error(`msstats ${statsRes.status}`);
    const statsData = await statsRes.json();

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

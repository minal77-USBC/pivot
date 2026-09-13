// Resolves a team's roster from its played actas so the user can point at which
// row is their kid. Needed because FCBQ anonymises some players to initials
// ("R.T.G."), leaving no name to match on — the picker captures the stable
// player `uuid` instead. See matchPlayer() in _boxscores.js.

import { ESB } from "./constants.js";
import { loadBoxScores, findTeam, normalizeName } from "./_boxscores.js";

async function playedMatchesForTeam(grupId, teamId) {
  const res = await fetch(
    `${ESB}/FCBQWeb/getAllGamesByGrupWithMatchRecords/${grupId}`,
    { headers: { "User-Agent": "Pivot/1.0" } }
  );
  if (!res.ok) throw new Error(`ESB ${res.status}`);
  const raw = await res.arrayBuffer();
  const json = Buffer.from(Buffer.from(raw).toString("ascii"), "base64").toString("utf-8");
  const rounds = JSON.parse(json).messageData?.rounds || {};
  const want = String(teamId);
  const out = [];

  for (const round of Object.values(rounds)) {
    for (const m of Object.values(round.matches || {})) {
      if (!m.matchDay || !m.universallyid) continue;
      if (String(m.idLocalTeam) !== want && String(m.idVisitorTeam) !== want) continue;
      if (m.localScore == null || m.visitorScore == null) continue;
      out.push({ statsUuid: m.universallyid, date: m.matchDay.split(" ")[0] });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { teamId, grupId, name } = req.query;
  if (!teamId || !grupId) {
    return res.status(400).json({ error: "teamId and grupId required" });
  }

  // Accept one or more grups (a team's two league phases) — a player who joined
  // mid-season only appears in the phase they actually played.
  const grupIds = String(grupId).split(",").map(g => g.trim()).filter(Boolean);

  let matches = [];
  try {
    const perGrup = await Promise.all(
      grupIds.map(g => playedMatchesForTeam(g, teamId).catch(() => []))
    );
    const seen = new Set();
    matches = perGrup.flat().filter(m => {
      if (seen.has(m.statsUuid)) return false;
      seen.add(m.statsUuid);
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  } catch (e) {
    return res.status(502).json({ error: `fixture lookup failed: ${e.message}` });
  }

  if (!matches.length) {
    return res.status(200).json({ roster: [], matchesScanned: 0 });
  }

  // Most recent games first — the current roster matters more than a full-season
  // walk, and this keeps the msstats fan-out bounded.
  const recent = matches.slice(0, 6);
  const { byUuid } = await loadBoxScores(recent);

  const byPlayer = new Map();
  let scanned = 0;

  for (const m of recent) {
    const data = byUuid[m.statsUuid];
    if (!data) continue;
    const team = findTeam(data, teamId);
    if (!team) continue;
    scanned++;

    for (const p of team.players || []) {
      const key = p.uuid || normalizeName(p.name);
      if (!key) continue;
      const existing = byPlayer.get(key);
      if (existing) {
        existing.gp++;
        existing.pts += p.data?.score ?? 0;
      } else {
        byPlayer.set(key, {
          uuid: p.uuid ?? null,
          name: p.name || "—",
          dorsal: p.dorsal || null,
          gp: 1,
          pts: p.data?.score ?? 0,
        });
      }
    }
  }

  const wanted = normalizeName(name);
  const roster = [...byPlayer.values()]
    .map(p => ({
      ...p,
      ppg: p.gp ? parseFloat((p.pts / p.gp).toFixed(1)) : 0,
      // Anonymised rows are exactly the ones the user has to disambiguate by
      // dorsal, so flag them for the picker UI.
      anonymised: /^(?:[A-Z]\.){2,}$/.test((p.name || "").trim()),
      likely: !!wanted && normalizeName(p.name).includes(wanted),
    }))
    .sort((a, b) => {
      if (a.likely !== b.likely) return a.likely ? -1 : 1;
      return (parseInt(a.dorsal) || 99) - (parseInt(b.dorsal) || 99);
    });

  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=600");
  return res.status(200).json({ roster, matchesScanned: scanned });
}

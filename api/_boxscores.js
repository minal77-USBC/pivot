// Server-only — shared box-score cache access and player identity matching.
//
// The msstats acta is the only source of per-game player rows, and it is keyed
// by display name — which FCBQ anonymises to initials ("R.T.G.") when a player
// opts out of having their name published. Name matching therefore cannot be
// the primary key for "which row is my kid": see matchPlayer() below.

import { MSSTATS_BASE } from "./constants.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

function sbHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function getCachedBoxScores(uuids) {
  if (!uuids.length) return {};
  const list = uuids.map(u => `"${u}"`).join(",");
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/match_box_scores?select=stats_uuid,data&stats_uuid=in.(${list})`,
    { headers: sbHeaders() }
  );
  if (!r.ok) return {};
  const rows = await r.json();
  return Object.fromEntries(rows.map(row => [row.stats_uuid, row.data]));
}

export async function upsertBoxScores(rows) {
  if (!rows.length) return;
  await fetch(`${SUPABASE_URL}/rest/v1/match_box_scores`, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify(rows),
  });
}

// Fetch the box scores for a set of matches, cache-first. Returns a map of
// statsUuid -> raw acta JSON, and writes anything newly fetched back to Supabase.
export async function loadBoxScores(matches) {
  const withUuid = matches.filter(m => m.statsUuid);
  if (!withUuid.length) return { byUuid: {}, fetchedCount: 0, cachedCount: 0 };

  const cached = await getCachedBoxScores(withUuid.map(m => m.statsUuid)).catch(() => ({}));
  const cachedUuids = new Set(Object.keys(cached));
  const missing = withUuid.filter(m => !cachedUuids.has(m.statsUuid));

  const fresh = {};
  if (missing.length) {
    const fetched = await Promise.all(
      missing.map(async (m) => {
        try {
          const r = await fetch(
            `${MSSTATS_BASE}/getJsonWithMatchStats/${m.statsUuid}`,
            { headers: { "User-Agent": "Pivot/1.0" } }
          );
          if (!r.ok) return null;
          return { statsUuid: m.statsUuid, matchDate: m.date, data: await r.json() };
        } catch {
          return null;
        }
      })
    );

    const toUpsert = [];
    for (const row of fetched) {
      if (!row) continue;
      fresh[row.statsUuid] = row.data;
      toUpsert.push({ stats_uuid: row.statsUuid, data: row.data, match_date: row.matchDate });
    }
    // Await before responding — Vercel freezes the process on res.end()
    await upsertBoxScores(toUpsert).catch(() => {});
  }

  return {
    byUuid: { ...cached, ...fresh },
    cachedCount: cachedUuids.size,
    fetchedCount: missing.length,
  };
}

// Collapses the whitespace and case differences that creep in through the kid
// config form (trailing spaces, double spaces between forenames).
export function normalizeName(name) {
  return (name || "").trim().replace(/\s+/g, " ").toUpperCase();
}

// A player's `uuid` is stable across games, teams and seasons — verified for
// dorsal #7 on teams 80316 (2025/26, published as "ROHAN THOMAS GUERRA") and
// 89410 (2026/27, published as "R.T.G."), same uuid throughout. `actorId` is a
// per-game record id and must NOT be used for cross-game keying.
//
// Name matching stays as a fallback for kids onboarded before a uuid was
// resolved, but it silently fails whenever FCBQ anonymises the roster.
export function matchPlayer(players, { playerUuid, name } = {}) {
  const list = players || [];
  if (playerUuid) {
    const byUuid = list.find(p => p.uuid === playerUuid);
    if (byUuid) return byUuid;
  }
  const wanted = normalizeName(name);
  if (!wanted) return null;
  return list.find(p => normalizeName(p.name).includes(wanted)) || null;
}

// Scan every team in an acta for the kid's row.
export function extractPlayerRow(data, identity) {
  for (const team of data.teams || []) {
    const player = matchPlayer(team.players, identity);
    if (player) return player;
  }
  return null;
}

// The acta exposes the ESB team id as `teamIdExtern`; `teamId` exists only on
// the player rows, not the team object.
export function findTeam(data, teamId) {
  if (!teamId) return null;
  const want = String(teamId);
  return (data.teams || []).find(t =>
    String(t.teamIdExtern) === want || String(t.teamIdIntern) === want || String(t.teamId) === want
  ) || null;
}

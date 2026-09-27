// Server-only — durable fixture cache.
//
// /api/schedule writes through here on every successful ESB fetch and reads
// back when ESB fails, so an upstream outage degrades to stale fixtures rather
// than a 502. See supabase-migration-fixtures-cache.sql for why this exists.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

function sbHeaders() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

// DB row -> the client-facing match shape normalizeMatch() produces.
// Optional keys are omitted rather than sent as null so the payload matches the
// fresh-from-ESB shape exactly — the tabs check `'score' in m`-style truthiness.
function rowToMatch(row) {
  return {
    date: row.date,
    time: row.time || "",
    ha: row.ha,
    opp: row.opp || "—",
    venue: row.venue || "",
    city: row.city || "",
    km: row.km == null ? null : Number(row.km),
    played: !!row.played,
    ...(row.played ? { win: row.win, score: row.score } : {}),
    ...(row.stats_uuid ? { statsUuid: row.stats_uuid } : {}),
    ...(row.opp_team_id ? { oppTeamId: row.opp_team_id } : {}),
    grupId: row.grup_id,
  };
}

function matchToRow(m, grupId, teamId, matchId) {
  return {
    grup_id: String(grupId),
    match_id: String(matchId),
    team_id: String(teamId),
    date: m.date,
    time: m.time || null,
    ha: m.ha,
    opp: m.opp || null,
    venue: m.venue || null,
    city: m.city || null,
    km: m.km == null ? null : m.km,
    played: !!m.played,
    win: m.played ? !!m.win : null,
    score: m.played ? (m.score || null) : null,
    stats_uuid: m.statsUuid || null,
    opp_team_id: m.oppTeamId || null,
    fetched_at: new Date().toISOString(),
  };
}

// Upsert on the (grup_id, match_id) PK so a fixture that moves date, or a match
// that gains a score, overwrites its previous row rather than duplicating.
// Unlike match_box_scores this must NOT ignore duplicates — fixtures change.
export async function writeFixtures(rows) {
  if (!rows.length) return { ok: false, written: 0 };
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/match_fixtures?on_conflict=grup_id,match_id`,
    {
      method: "POST",
      headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(rows),
    }
  );
  return { ok: r.ok, written: r.ok ? rows.length : 0, status: r.status };
}

// Returns { matches, fetchedAt } for one team/grup pair, oldest fixture first.
export async function readFixtures(teamId, grupId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/match_fixtures` +
      `?team_id=eq.${encodeURIComponent(teamId)}` +
      `&grup_id=eq.${encodeURIComponent(grupId)}` +
      `&select=*&order=date.asc`,
    { headers: sbHeaders() }
  );
  if (!r.ok) return { matches: [], fetchedAt: null };
  const rows = await r.json();
  if (!rows.length) return { matches: [], fetchedAt: null };

  // A team plays at most once per date, so collapse duplicates on (team, date)
  // keeping the most recently fetched row. Guards two cases: rows backfilled
  // from box scores (keyed by stats_uuid) colliding with the same match arriving
  // later under its real ESB match_id, and a match re-keyed upstream.
  const byDate = new Map();
  for (const row of rows) {
    const prev = byDate.get(row.date);
    if (!prev || (row.fetched_at || "") > (prev.fetched_at || "")) byDate.set(row.date, row);
  }
  const deduped = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  const fetchedAt = deduped
    .map(x => x.fetched_at)
    .sort()
    .slice(-1)[0] || null;
  return { matches: deduped.map(rowToMatch), fetchedAt };
}

export { matchToRow };

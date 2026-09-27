// Server-only — shared ESB access + competition index builder.
//
// basquetcatala.cat serves a bot-challenge interstitial ("Verificació de
// seguretat") to HTML requests, so the old scrape-based club/team/grup lookup
// is dead. The ESB API is unaffected and exposes the whole competition tree:
//
//   CategoryRegistered/getByZoneAndSeason/{zone}/{season}   -> categories
//   Competition/getCompetitionGroupVisibleWeb/{catId}/{zone} -> grups
//   FCBQWeb/getAllGamesByGrupWithMatchRecords/{grupId}       -> matches
//
// Match records carry club id/name, team id/name and venue coordinates, so one
// walk yields everything the three onboarding endpoints need.

import { createHash } from "crypto";
import { ESB } from "./constants.js";

// FCBQ splits competitions across territorial zones. Zone 0 is an aggregate
// view that returns every category from every zone (with duplicates), so a
// single zone-0 walk is both complete and cheaper than iterating zones.
//
//   0  aggregate — all zones, duplicated per zone
//   1  Catalunya-wide (national leagues + C.C. Preferent/Interterritorial)
//   2  Barcelona            (verified: Barcelona, Badalona, L'Hospitalet, Sabadell…)
//   3  Girona               (inferred — no territory marker in grup names)
//   4  Lleida               (verified: grup names carry "LLEIDA")
//   5  Tarragona            (verified: "RT TARRAGONA")
//   9  Club tournaments     ("TORNEIGS CLUBS" — only visible via zone 0)
//
// Zones 6 and 8 return nothing; zone 7 held a single "TOT BASQUET" category in
// 2025. Walking zone 0 picks all of them up regardless.
export const AGGREGATE_ZONE = 0;

// Season label rolls in July, not September.
//
// Games start in September, but FCBQ publishes the new season's fixtures over
// the summer AND purges the previous season from ESB at the same time — as of
// 2026-08-05, every 2025/26 grup returns round skeletons with zero matches. A
// September boundary therefore leaves a dead window in July and August where
// the app asks for a season that no longer has any data.
export function currentSeason(now = new Date()) {
  return String(now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);
}

// Mid-season tournaments run alongside the league; their grups must not be
// mistaken for a league phase.
const TOURNAMENT_KEYWORDS = ["COPA", "TORNEIG", "TROFEU", "SUPERCOPA"];

export function isTournament(label) {
  const u = (label || "").toUpperCase();
  return TOURNAMENT_KEYWORDS.some((kw) => u.includes(kw));
}

export function tierOf(categoryName) {
  const n = (categoryName || "").toUpperCase();
  if (n.includes("INTERTERRITORIAL")) return "Interterritorial";
  if (n.includes("PREFERENT")) return "Preferent";
  if (n.startsWith("C.T.") || n.includes("PROMOCIÓ") || n.includes("PROMOCIO")) return "Territorial";
  return "Senior";
}

// ESB reports auth/quota failures as HTTP 200 with an UNENCODED JSON body, so
// res.ok tells you nothing and base64-decoding the body yields binary garbage
// that JSON.parse rejects with "Unexpected token '\uFFFD'" — an error naming
// nothing relevant. Every ESB caller must route its response through here.
// (Observed 2026-09: ACCESS DENIED / ERRORCODEx0008 on every endpoint.)
export function decodeEsb(b64, context = "request") {
  const head = (b64 || "").trimStart();
  if (head.startsWith("{") || head.startsWith("[")) {
    let envelope = {};
    try { envelope = JSON.parse(head); } catch { /* not the error envelope either */ }
    const detail = envelope.message || envelope.errorCode || "unrecognised plain-text response";
    throw new Error(`ESB refused ${context}: ${detail}`);
  }
  const decoded = JSON.parse(Buffer.from(head, "base64").toString("utf8"));
  if (decoded.result && decoded.result !== "OK") {
    throw new Error(`ESB error for ${context}: ${decoded.errorCode || decoded.result}`);
  }
  return decoded;
}

export async function esb(path) {
  const res = await fetch(`${ESB}/${path}`, { headers: { "User-Agent": "Pivot/1.0" } });
  if (!res.ok) throw new Error(`ESB ${res.status} ${path}`);
  const text = await res.text();
  // ESB returns base64-encoded JSON — decodeEsb also catches the plain-JSON
  // error envelope that a denied key produces.
  return decodeEsb(text, path).messageData;
}

// rounds is keyed by round number; each round is { date, matches: { matchId: {...} } }
export function flattenMatches(rounds) {
  return Object.values(rounds || {})
    .flatMap((r) => Object.values(r?.matches || {}))
    .filter((m) => m && typeof m === "object");
}

// Run tasks with bounded concurrency — the full walk is ~160 ESB calls and must
// fit inside a serverless invocation.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = await fn(items[i], i);
        } catch {
          out[i] = null;
        }
      }
    })
  );
  return out;
}

/**
 * Discover the competition structure: which categories exist and which grups
 * each contains. This is the cheap half of the walk — ~38 ESB calls versus the
 * ~126 needed to read every grup's fixtures — so sync-index runs it first and
 * uses its fingerprint to decide whether the expensive half is worth doing.
 *
 * @returns {Promise<{categories: object[], pairs: object[], calls: number, fingerprint: string}>}
 */
export async function discoverStructure({
  season = currentSeason(),
  concurrency = 4,
  onlyCategoryIds = null,
  onProgress = () => {},
} = {}) {
  let calls = 0;

  const raw = (await esb(`CategoryRegistered/getByZoneAndSeason/${AGGREGATE_ZONE}/${season}`)) || [];
  calls++;

  // Zone 0 repeats a category once per zone it runs in — dedupe by id
  const byId = new Map();
  for (const c of raw) {
    if (!byId.has(c.idCategoryRegistred)) byId.set(c.idCategoryRegistred, c);
  }
  let categories = [...byId.values()];
  if (onlyCategoryIds) {
    const want = new Set(onlyCategoryIds.map(String));
    categories = categories.filter((c) => want.has(String(c.idCategoryRegistred)));
  }
  onProgress(`${categories.length} categories (${raw.length} rows before dedupe)`);

  const grupLists = await mapLimit(categories, concurrency, async (cat) => {
    const grups = (await esb(
      `Competition/getCompetitionGroupVisibleWeb/${cat.idCategoryRegistred}/${AGGREGATE_ZONE}`
    )) || [];
    calls++;
    return grups.map((g) => ({ cat, grup: g }));
  });

  // A grup can surface under more than one category row — keep each once
  const seenGrup = new Set();
  const pairs = grupLists.filter(Boolean).flat().filter(({ grup }) => {
    if (seenGrup.has(grup.idGroup)) return false;
    seenGrup.add(grup.idGroup);
    return true;
  });
  onProgress(`${pairs.length} grups`);

  // Stable across runs: sorted category:grup pairs. Changes when a category or
  // grup is added or removed — which is exactly when a rebuild is warranted.
  const fingerprint = createHash("sha256")
    .update(pairs.map(({ cat, grup }) => `${cat.idCategoryRegistred}:${grup.idGroup}`).sort().join("|"))
    .digest("hex");

  return { categories, pairs, calls, fingerprint };
}

/**
 * Walk the ESB competition tree and build the club/team index.
 *
 * @param {object}   opts
 * @param {string}   opts.season      e.g. "2026"
 * @param {number}   opts.concurrency parallel ESB calls
 * @param {string[]} [opts.onlyCategoryIds] restrict to these category ids (for chunked runs)
 * @param {object}   [opts.structure] result of discoverStructure(), to avoid re-fetching it
 * @param {(msg: string) => void} [opts.onProgress]
 * @returns {Promise<{clubs: object[], teams: object[], stats: object}>}
 */
export async function buildIndex({
  season = currentSeason(),
  concurrency = 4,
  onlyCategoryIds = null,
  structure = null,
  onProgress = () => {},
} = {}) {
  const clubs = new Map(); // clubId -> { club_id, name, town }
  const teams = new Map(); // teamId -> team row (grups accumulated)
  let calls = 0;

  {
    const discovered =
      structure || (await discoverStructure({ season, concurrency, onlyCategoryIds, onProgress }));
    const { pairs } = discovered;
    calls += discovered.calls;

    await mapLimit(pairs, concurrency, async ({ cat, grup }) => {
      const data = await esb(`FCBQWeb/getAllGamesByGrupWithMatchRecords/${grup.idGroup}`);
      calls++;
      const matches = flattenMatches(data?.rounds);
      const competition = grup.competitionName || cat.categoryRegisteredName || "";

      for (const m of matches) {
        for (const side of ["Local", "Visitor"]) {
          const teamId = m[`id${side}Team`];
          const teamName = m[`name${side}Team`];
          const clubId = m[`id${side}Club`];
          const clubName = m[`name${side}TeamOrganization`];
          if (!teamId || !teamName) continue;

          if (clubId && clubName && !clubs.has(String(clubId))) {
            clubs.set(String(clubId), {
              club_id: String(clubId),
              name: clubName.trim(),
              town: null,
              season,
            });
          }

          const key = String(teamId);
          let team = teams.get(key);
          if (!team) {
            team = {
              team_id: key,
              club_id: clubId ? String(clubId) : "",
              name: teamName.trim(),
              category: cat.categoryRegisteredName || "",
              category_id: String(cat.idCategoryRegistred || ""),
              tier: tierOf(cat.categoryRegisteredName),
              sex: cat.sex || null,
              zone: Number(cat.zone) || null,
              season,
              venue_name: null,
              venue_lat: null,
              venue_lon: null,
              venue_town: null,
              _grups: [],
            };
            teams.set(key, team);
          }

          if (!team._grups.some((g) => g.grupId === String(grup.idGroup))) {
            team._grups.push({ grupId: String(grup.idGroup), competition });
          }

          // Home fixtures identify the team's own venue
          if (side === "Local" && !team.venue_name && m.nameField) {
            team.venue_name = m.nameField;
            team.venue_lat = m.latitudeField || null;
            team.venue_lon = m.longitudeField || null;
            team.venue_town = m.nameTown || null;
          }
        }
      }
    });
  }

  // Resolve league phases and backfill club towns from their teams' venues
  const teamRows = [...teams.values()].map((t) => {
    const league = t._grups.filter((g) => !isTournament(g.competition));
    const { _grups, ...rest } = t;
    return {
      ...rest,
      grup_id_phase1: league[0]?.grupId || null,
      grup_id_phase2: league[1]?.grupId || null,
      competition_phase1: league[0]?.competition || null,
      competition_phase2: league[1]?.competition || null,
    };
  });

  for (const t of teamRows) {
    const club = clubs.get(t.club_id);
    if (club && !club.town && t.venue_town) club.town = t.venue_town;
  }

  return {
    clubs: [...clubs.values()],
    teams: teamRows,
    stats: {
      season,
      esbCalls: calls,
      clubs: clubs.size,
      teams: teamRows.length,
      byTier: teamRows.reduce((acc, t) => ({ ...acc, [t.tier]: (acc[t.tier] || 0) + 1 }), {}),
    },
  };
}

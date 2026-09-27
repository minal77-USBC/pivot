import { ESB } from "./constants.js";
import { Sentry } from "./_sentry.js";
import { readFixtures, writeFixtures, matchToRow } from "./_fixtures.js";
import { track } from "@vercel/analytics/server";
const BARNA = ["GRUP BARNA", "BARNA VERMELL", "GRUP ESP"];

// Nau Parc Clot (home venue) coordinates
const HOME_LAT = 41.4089, HOME_LON = 2.1917;

// City km fallback for when ESB doesn't supply coordinates
const CITY_KM = {
  GRANOLLERS: 30, GIRONA: 103, BADALONA: 12, LLEIDA: 162,
  "CORNELLÀ": 14, CORNELLA: 14, MONTGAT: 18, CALELLA: 63,
  TARRAGONA: 99, CASTELLDEFELS: 24, VILADECANS: 22,
  "SANT CUGAT": 25, MANRESA: 75, "SANT FELIU": 105,
  "EL PRAT": 14, "SANT JUST": 9, "MATARÓ": 30, MATARO: 30,
  VILASSAR: 27, PARETS: 23, "ARTÉS": 68, ARTES: 68,
};

// Abbreviations to keep UPPERCASE in team/venue names
const ABBREVS = new Set(["CB", "JAC", "UE", "TGN", "BBA", "CBM", "CEM", "U15", "U13", "U12"]);

function isBarna(name) {
  const u = (name || "").toUpperCase();
  return BARNA.some(k => u.includes(k));
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function venueKm(m, isHome) {
  if (isHome) return 0;
  if (m.latitudeField && m.longitudeField) {
    const straight = haversineKm(HOME_LAT, HOME_LON, parseFloat(m.latitudeField), parseFloat(m.longitudeField));
    return Math.round(straight * 1.3);
  }
  const city = (m.nameTown || "").toUpperCase();
  for (const [key, km] of Object.entries(CITY_KM)) {
    if (city.includes(key.toUpperCase())) return km;
  }
  return 0;
}

function titleCase(s) {
  return (s || "").toLowerCase().replace(/\b\w+/g, w => {
    const up = w.toUpperCase();
    return ABBREVS.has(up) ? up : w.charAt(0).toUpperCase() + w.slice(1);
  });
}

function fmtVenue(nameField) {
  if (!nameField) return "";
  const parts = nameField.split(" - ");
  return titleCase(parts.length > 1 ? parts.slice(1).join(" - ") : nameField);
}

function normalizeMatch(m, teamId) {
  if (!m.matchDay) return null;
  let barnaLocal, barnaVisitor;
  if (teamId) {
    barnaLocal = String(m.idLocalTeam) === String(teamId);
    barnaVisitor = String(m.idVisitorTeam) === String(teamId);
  } else {
    barnaLocal = isBarna(m.nameLocalTeam);
    barnaVisitor = isBarna(m.nameVisitorTeam);
  }
  if (!barnaLocal && !barnaVisitor) return null;

  const ha = barnaLocal ? "home" : "away";
  const opp = titleCase(barnaLocal ? m.nameVisitorTeam : m.nameLocalTeam);
  const [datePart, timePart] = m.matchDay.split(" ");
  const time = (timePart || "").slice(0, 5);
  const km = venueKm(m, ha === "home");

  const ls = m.localScore != null ? parseInt(m.localScore) : null;
  const vs = m.visitorScore != null ? parseInt(m.visitorScore) : null;
  const played = ls !== null && vs !== null;
  const win = played ? (barnaLocal ? ls > vs : vs > ls) : undefined;
  const isWalkover = played && ((ls === 0 && vs === 2) || (ls === 2 && vs === 0));
  const score = played ? (isWalkover ? "W/O" : `${ls}–${vs}`) : undefined;

  return {
    date: datePart,
    time,
    ha,
    opp,
    venue: fmtVenue(m.nameField),
    city: m.nameTown || "",
    km,
    played,
    ...(played ? { win, score } : {}),
    ...(m.universallyid ? { statsUuid: m.universallyid } : {}),
    ...(m.idVisitorTeam ? { oppTeamId: String(barnaLocal ? m.idVisitorTeam : m.idLocalTeam) } : {}),
  };
}

async function fetchGrup(grupId) {
  const res = await fetch(`${ESB}/FCBQWeb/getAllGamesByGrupWithMatchRecords/${grupId}`, {
    headers: { "User-Agent": "Pivot/1.0" },
  });
  const raw = await res.arrayBuffer();
  const b64 = Buffer.from(raw).toString("ascii");

  // ESB reports auth failures as HTTP 200 with an UNENCODED JSON body, so
  // res.ok is useless here and base64-decoding it produces binary garbage that
  // JSON.parse rejects with "Unexpected token '\uFFFD'" — an error that says
  // nothing about the real cause. Detect the plain-JSON error envelope first.
  // (Observed 2026-09: ACCESS DENIED / ERRORCODEx0008 on every endpoint.)
  const head = b64.trimStart();
  if (head.startsWith("{") || head.startsWith("[")) {
    let envelope = {};
    try { envelope = JSON.parse(head); } catch { /* not the error envelope either */ }
    const detail = envelope.message || envelope.errorCode || `HTTP ${res.status}`;
    throw new Error(`ESB refused grup ${grupId}: ${detail}`);
  }

  const json = Buffer.from(b64, "base64").toString("utf-8");
  const data = JSON.parse(json);
  if (data.result && data.result !== "OK") {
    throw new Error(`ESB error for grup ${grupId}: ${data.errorCode || data.result}`);
  }
  return data;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const start = Date.now();
    // Accept dynamic kids config: ?kids=[{"id":"k1","grupIds":["19848","21202"]},...]
    // Falls back to empty if not provided
    let kids = [];
    if (req.query.kids) {
      try { kids = JSON.parse(req.query.kids); } catch { /* ignore malformed */ }
    }

    const result = {};
    const meta = {};           // per-kid: { stale, fetchedAt }
    let anyFresh = false;
    let anyStale = false;
    let lastUpstreamError = null;

    for (const kid of kids) {
      const kidMatches = [];
      let kidStale = false;
      let kidFetchedAt = null;

      for (const grupId of (kid.grupIds || [])) {
        if (!grupId) continue;

        // Each grup is attempted independently. Previously one bad grup threw
        // and killed the whole response for every kid; now a failure falls back
        // to that grup's cached rows and the rest still serves fresh data.
        try {
          const data = await fetchGrup(grupId);
          const rounds = data.messageData.rounds;
          const rows = [];
          for (const round of Object.values(rounds)) {
            // `matches` is keyed by match id — the only stable identifier for a
            // fixture that has not been played yet (statsUuid is null until
            // 24-48h after the game).
            for (const [matchId, m] of Object.entries(round.matches || {})) {
              const norm = normalizeMatch(m, kid.teamId);
              if (!norm) continue;
              kidMatches.push({ ...norm, grupId });
              rows.push(matchToRow(norm, grupId, kid.teamId, matchId));
            }
          }
          anyFresh = true;
          // Write-through. Never let a cache write failure break a good
          // response — the fixtures are already in hand.
          if (rows.length) {
            // A cache write must never break a good response — the fixtures are
            // already in hand. But it must not fail silently either, or the
            // fallback quietly stops existing and nobody finds out until the
            // next outage.
            try {
              const w = await writeFixtures(rows);
              if (!w.ok) {
                Sentry.captureException(
                  new Error(`Fixture cache write failed (HTTP ${w.status}) for grup ${grupId} — fallback will be empty`)
                );
              }
            } catch (we) {
              Sentry.captureException(we);
            }
          }
        } catch (ge) {
          lastUpstreamError = ge.message;
          Sentry.captureException(ge);
          const { matches, fetchedAt } = await readFixtures(kid.teamId, grupId).catch(
            () => ({ matches: [], fetchedAt: null })
          );
          if (matches.length) {
            kidMatches.push(...matches);
            kidStale = true;
            anyStale = true;
            if (!kidFetchedAt || (fetchedAt && fetchedAt > kidFetchedAt)) kidFetchedAt = fetchedAt;
          }
        }
      }

      kidMatches.sort((a, b) => a.date.localeCompare(b.date));
      result[kid.id] = kidMatches;
      meta[kid.id] = { stale: kidStale, fetchedAt: kidFetchedAt };
    }

    // Only a total miss is an error: upstream failed AND the cache had nothing
    // for anyone. A kid with no cached rows gets an empty list and the client
    // renders a per-kid empty state rather than failing the whole app.
    if (!anyFresh && !anyStale) {
      const err = new Error(lastUpstreamError || "No schedule available");
      Sentry.captureException(err);
      return res.status(502).json({ error: err.message });
    }

    const latencyMs = Date.now() - start;
    const grupCount = kids.reduce((n, k) => n + (k.grupIds || []).filter(Boolean).length, 0);
    await track("schedule_fetched", {
      kidCount: kids.length, grupCount, latencyMs,
      // "partial" = some grups fresh, some served from cache
      source: anyStale ? (anyFresh ? "partial" : "cache") : "live",
    }, { request: req });

    // Don't let the CDN pin a stale response for 5 minutes — when ESB recovers
    // the next request should get through and repopulate.
    res.setHeader("Cache-Control", anyStale
      ? "s-maxage=30, stale-while-revalidate=30"
      : "s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json({ ...result, _meta: { stale: anyStale, partial: anyStale && anyFresh, upstreamError: lastUpstreamError, kids: meta } });
  } catch (e) {
    Sentry.captureException(e);
    return res.status(502).json({ error: e.message });
  }
}

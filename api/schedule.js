const ESB = "https://esb.optimalwayconsulting.com/fcbq/1/jR4rgA5K6Chhh5vyfrxo9wTScdg2NT7K";
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
  const json = Buffer.from(b64, "base64").toString("utf-8");
  return JSON.parse(json);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Accept dynamic kids config: ?kids=[{"id":"k1","grupIds":["19848","21202"]},...]
    // Falls back to empty if not provided
    let kids = [];
    if (req.query.kids) {
      try { kids = JSON.parse(req.query.kids); } catch { /* ignore malformed */ }
    }

    const result = {};

    for (const kid of kids) {
      const kidMatches = [];
      for (const grupId of (kid.grupIds || [])) {
        if (!grupId) continue;
        const data = await fetchGrup(grupId);
        const rounds = data.messageData.rounds;
        for (const round of Object.values(rounds)) {
          for (const m of Object.values(round.matches || {})) {
            const norm = normalizeMatch(m, kid.teamId);
            if (norm) kidMatches.push({ ...norm, grupId });
          }
        }
      }
      kidMatches.sort((a, b) => a.date.localeCompare(b.date));
      result[kid.id] = kidMatches;
    }

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json(result);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

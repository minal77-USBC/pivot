const ESB = "https://esb.optimalwayconsulting.com/fcbq/1/jR4rgA5K6Chhh5vyfrxo9wTScdg2NT7K";
const BARNA = ["GRUP BARNA", "BARNA VERMELL", "GRUP ESP"];

// All 4 competition group IDs
const GRUPS = {
  k1: ["19848", "21202"],  // Rohan: Phase 1 + Phase 2
  k2: ["20111", "21491"],  // Sara:  Phase 1 + Phase 2
};

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

// Schedule changes (canvis badge) — update manually as needed
const CANVIS = {
  k1: new Set(["2026-03-21", "2026-03-28", "2026-04-19"]),
  k2: new Set(),
};

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
  // City name fallback
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

function normalizeMatch(m, kidId) {
  if (!m.matchDay) return null;
  const barnaLocal = isBarna(m.nameLocalTeam);
  const barnaVisitor = isBarna(m.nameVisitorTeam);
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
    venue: ha === "home" ? "Nau Parc Clot" : fmtVenue(m.nameField),
    city: m.nameTown || "",
    km,
    played,
    ...(played ? { win, score } : {}),
    ...(m.universallyid ? { statsUuid: m.universallyid } : {}),
    ...(CANVIS[kidId]?.has(datePart) ? { canvis: true } : {}),
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
    const matches = { k1: [], k2: [] };

    for (const [kidId, grupIds] of Object.entries(GRUPS)) {
      for (const grupId of grupIds) {
        const data = await fetchGrup(grupId);
        const rounds = data.messageData.rounds;
        for (const round of Object.values(rounds)) {
          for (const m of Object.values(round.matches || {})) {
            const norm = normalizeMatch(m, kidId);
            if (norm) matches[kidId].push(norm);
          }
        }
      }
      matches[kidId].sort((a, b) => a.date.localeCompare(b.date));
    }

    // 5-min CDN cache, serve stale while revalidating
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json(matches);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

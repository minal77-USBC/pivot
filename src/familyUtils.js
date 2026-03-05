// Converts a Supabase kids row into the app's kid shape (matches old KIDS format)

const ARRIVAL_BUFFERS = {
  "Premini": 45,
  "Mini": 45,
  "Infantil": 45,
  "Cadet": 60,
  "Junior": 60,
  "Sènior": 60,
};

const GENDER_SYMBOL = { M: "♂", F: "♀" };

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function buildKid(dbKid, index) {
  const color = dbKid.color || "#FF6B2B";
  const [r, g, b] = hexToRgb(color);
  const grupIds = [dbKid.grup_id_phase1, dbKid.grup_id_phase2].filter(Boolean);

  return {
    id: `k${index + 1}`,
    fcbqId: dbKid.fcbq_team_id || null,
    name: dbKid.name,
    label: dbKid.label,
    category: dbKid.category,
    gender: dbKid.gender,
    shortName: `${dbKid.category} ${GENDER_SYMBOL[dbKid.gender] || ""}`,
    arrivalBuffer: ARRIVAL_BUFFERS[dbKid.category] ?? 45,
    color,
    dimColor: `rgba(${r},${g},${b},0.15)`,
    statsAvailable: dbKid.category === "Cadet" && !!dbKid.fcbq_team_id,
    statsTeamId: dbKid.fcbq_team_id || null,
    grupIds,
    kit: {
      home: { jersey: "NEGRE", shorts: "VERMELL" },
      away: { jersey: "BLANCA", shorts: "VERMELL" },
    },
  };
}

export function buildKids(dbKids = []) {
  return dbKids.map((k, i) => buildKid(k, i));
}

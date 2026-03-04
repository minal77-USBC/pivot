export const TODAY = new Date();

export const tier = (km) =>
  km === 0 ? "home" : km <= 20 ? "local" : km <= 60 ? "metro" : "road";

export const travelMins = (km) => {
  if (km === 0) return 0;
  if (km <= 60) return Math.round(km * 1.8);
  return Math.round(km * 0.75 + 10);
};

export const leaveBy = (time, km, overrides = {}) => {
  if (km === 0) return null;
  const key = Object.keys(overrides).find(k => k.startsWith(time.slice(0, 2)));
  // overrides keyed by "venue_city"
  const mins = overrides[`${km}`] ?? travelMins(km);
  const [h, m] = time.split(":").map(Number);
  const leave = h * 60 + m - mins - 20;
  const lh = Math.floor(leave / 60);
  const lm = Math.floor((leave % 60) / 5) * 5;
  return `${String(lh).padStart(2, "0")}:${String(lm).padStart(2, "0")}`;
};

export const leaveByFromMins = (time, mins) => {
  if (!mins) return null;
  const [h, m] = time.split(":").map(Number);
  const leave = h * 60 + m - mins - 20;
  const lh = Math.floor(leave / 60);
  const lm = Math.floor((leave % 60) / 5) * 5;
  return `${String(lh).padStart(2, "0")}:${String(lm).padStart(2, "0")}`;
};

export const fmtDate = (s) =>
  new Date(s + "T12:00:00").toLocaleDateString("ca-ES", {
    weekday: "short", day: "numeric", month: "short",
  });

export const daysOut = (s) =>
  Math.round((new Date(s + "T12:00:00") - TODAY) / 86400000);

export const daysLabel = (s) => {
  const n = daysOut(s);
  if (n < 0) return `${Math.abs(n)}d ago`;
  if (n === 0) return "AVUI";
  if (n === 1) return "DEMÀ";
  if (n <= 6) return `${n}d`;
  if (n <= 13) return `${Math.ceil(n / 7)}w ${n % 7}d`;
  return `${Math.ceil(n / 7)}w`;
};

export const upcoming = (matches) =>
  matches.filter((m) => !m.played && daysOut(m.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));

export const mapsUrl = (venue, city) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue} ${city}`)}`;

// localStorage key for travel overrides: "venue_city" → minutes
export const OVERRIDES_KEY = "cancha_travel_overrides";

export const loadOverrides = () => {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || "{}"); }
  catch { return {}; }
};

export const saveOverride = (venue, city, mins) => {
  const overrides = loadOverrides();
  const key = `${venue}_${city}`;
  if (mins === null) { delete overrides[key]; }
  else { overrides[key] = mins; }
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
};

export const getOverrideMins = (venue, city) => {
  const overrides = loadOverrides();
  return overrides[`${venue}_${city}`] ?? null;
};

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

export const latestMeal = (time, arrivalBuffer) => {
  // Must eat at least 1 hour before arriving at the venue
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m - arrivalBuffer - 60;
  const lh = Math.floor(total / 60);
  const lm = Math.floor((total % 60) / 5) * 5;
  return `${String(lh).padStart(2, "0")}:${String(lm).padStart(2, "0")}`;
};

export const leaveByFromMins = (time, mins, arrivalBuffer = 20) => {
  if (!mins) return null;
  const [h, m] = time.split(":").map(Number);
  const leave = h * 60 + m - mins - arrivalBuffer;
  const lh = Math.floor(leave / 60);
  const lm = Math.floor((leave % 60) / 5) * 5;
  return `${String(lh).padStart(2, "0")}:${String(lm).padStart(2, "0")}`;
};

const LOCALE_MAP = { cat: "ca-ES", es: "es-ES", en: "en-GB" };

function getLang() {
  try { return localStorage.getItem("pivot_lang") || "cat"; } catch { return "cat"; }
}

export const fmtDate = (s) => {
  const locale = LOCALE_MAP[getLang()] || "ca-ES";
  return new Date(s + "T12:00:00").toLocaleDateString(locale, {
    weekday: "short", day: "numeric", month: "short",
  });
};

export const daysOut = (s) =>
  Math.round((new Date(s + "T12:00:00") - TODAY) / 86400000);

export const daysLabel = (s) => {
  const n = daysOut(s);
  const lang = getLang();
  const labels = {
    cat: { today: "AVUI", tomorrow: "DEMÀ", ago: (d) => `fa ${d}d` },
    es:  { today: "HOY",  tomorrow: "MAÑANA", ago: (d) => `hace ${d}d` },
    en:  { today: "TODAY", tomorrow: "TOMORROW", ago: (d) => `${d}d ago` },
  }[lang] || { today: "TODAY", tomorrow: "TOMORROW", ago: (d) => `${d}d ago` };

  if (n < 0) return labels.ago(Math.abs(n));
  if (n === 0) return labels.today;
  if (n === 1) return labels.tomorrow;
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
export const OVERRIDES_KEY = "pivot_travel_overrides";

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

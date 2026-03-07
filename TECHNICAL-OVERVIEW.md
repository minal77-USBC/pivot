# PIVOT — Technical Overview

**Last updated:** 2026-03-07
**Stack:** React 18 + Vite · Vercel (serverless) · Supabase · Google OAuth

---

## Architecture at a Glance

```
Browser (React SPA)
  ├── /api/auth          ← Google OAuth token exchange
  ├── /api/family        ← Supabase: load kids config for user or share token
  ├── /api/schedule      ← ESB (FCBQ): fetch + normalise match schedule
  ├── /api/fcbq          ← Proxy: msstats season stats + box scores
  ├── /api/brief         ← AI match briefing generation
  ├── /api/share         ← Share token creation
  ├── /api/share-manifest ← Share manifest for PWA
  ├── /api/club-teams    ← FCBQ club team lookup (setup)
  ├── /api/clubs-search  ← FCBQ club search (setup)
  └── /api/team-grups    ← FCBQ grup IDs for a team (setup)
```

---

## Data Sources

### 1. ESB — FCBQ Schedule API
- **Base URL:** `https://esb.optimalwayconsulting.com/fcbq/1/[API_KEY]`
- **Endpoint:** `FCBQWeb/getAllGamesByGrupWithMatchRecords/{grupId}`
- **Auth:** API key in URL path (stored in Vercel env)
- **Response:** Base64-encoded JSON. Decoded server-side in `api/schedule.js`.
- **Key fields normalised per match:**
  - `date`, `time`, `ha` (home/away), `opp`, `venue`, `city`, `km`
  - `played`, `win`, `score` (if result available)
  - `statsUuid` — from `m.universallyid`; used to fetch box scores from msstats
- **Team detection:** `isBarna()` — matches any of `["GRUP BARNA", "BARNA VERMELL", "GRUP ESP"]`
- **km calculation:** Haversine from Nau Parc Clot (home) if lat/lon present; else `CITY_KM` lookup table
- **Caching:** `s-maxage=300, stale-while-revalidate=60` (Vercel edge); client sessionStorage TTL 5 min

### 2. msstats — FCBQ Stats API
- **Base URL:** `https://msstats.optimalwayconsulting.com/v1/fcbq`
- **Proxied via:** `api/fcbq.js` (CORS proxy — allowlist-gated to basquetcatala.cat + msstats)
- **Endpoints used:**
  - `team-stats/team/{TEAM_ID}/season/{SEASON}` — season totals (team + player averages)
  - `getJsonWithMatchStats/{statsUuid}` — individual match box score
- **Current state:** `TEAM_ID = "80316"` and `SEASON = "2025"` are **hardcoded** in `StatsTab.jsx`
- **Availability:** Stats only available for Cadet Preferent category (`statsAvailable: category === "Cadet"`)
- **`statsUuid` source:** Populated from `m.universallyid` in ESB schedule response. May be null for future matches or if ESB omits it.

### 3. Supabase — Family / Kids Config
- **Tables:** `families` (user → family mapping, share_token), `kids` (one row per child)
- **Key kids columns:** `name`, `label`, `category`, `gender`, `color`, `fcbq_team_id`, `grup_id_phase1`, `grup_id_phase2`
- **`fcbq_team_id`:** Team ID for msstats/basquetcatala lookups. Currently used for `statsTeamId` in kid shape; `statsAvailable` gated on `category === "Cadet"` only (fcbq_team_id not required).
- **Kid shape built by:** `src/familyUtils.js:buildKid()` — converts DB row to app kid object
- **Share flow:** `share_token` → `/s/TOKEN` redirect → `sessionStorage` → `useFamily(shareToken)` → read-only view

---

## Client Architecture

### State & Data Hooks
| Hook | File | Purpose |
|------|------|---------|
| `useFamily` | `src/useFamily.js` | Load kids config from Supabase via `/api/family` |
| `useSchedule` | `src/useSchedule.js` | Fetch + cache match schedule from ESB via `/api/schedule` |

### i18n
- **Locale store:** `src/i18n.js` — inline `LOCALES` object with `cat`, `es`, `en` keys
- **Context:** `src/LangContext.jsx` — `LangProvider` + `useLang()` hook
- **Persistence:** `localStorage` key `pivot_lang`; default `"cat"`
- **Utils integration:** `fmtDate()` and `daysLabel()` in `utils.js` read `pivot_lang` directly from localStorage (avoids prop-drilling locale through 9+ call sites)
- **Checklist items:** Translated via id-keyed dicts (`nightItems`, `stdItems`, `roadItems`) in each locale; fallback to English `item.label` from `data.js`

### Match Tiers (`src/utils.js:tier()`)
| Tier | km Range | Badge | Card style |
|------|----------|-------|------------|
| `home` | 0 km | Green "Home" | Standard card |
| `local` | 1–20 km | Red "Away" | Standard card |
| `metro` | 21–60 km | Red "Away" | Standard card |
| `road` | >60 km | Amber "Road" | `roadCard` (amber border) |

### Travel Time (`utils.js:travelMins()`)
- ≤60 km: `km × 1.8` min
- >60 km: `km × 0.75 + 10` min
- User-overridable per venue+city key via `localStorage` (`pivot_travel_overrides`)

---

## Tabs & Components

| Tab | File | Data consumed |
|-----|------|---------------|
| Dashboard | `src/tabs/DashboardTab.jsx` | kids, k1Matches, k2Matches |
| Calendar | `src/tabs/CalendarTab.jsx` | kids, k1Matches, k2Matches |
| Match Day (Checklist) | `src/tabs/ChecklistTab.jsx` | kids, k1Matches, k2Matches |
| Season | `src/tabs/SeasonTab.jsx` | kids, k1Matches, k2Matches, k3Matches |
| Stats | `src/tabs/StatsTab.jsx` | kids, k1Matches (Cadet only) |

**Shared components:**
- `src/components/MatchCard.jsx` — full match card (used in Dashboard/Checklist)
- `src/styles.js` — centralised style tokens (`S.*`)

---

## Auth & Access Control

- **Auth provider:** Google OAuth via `api/auth.js`
- **Session storage:** `sessionStorage` key `pivot_auth` — stores `{ email, picture, exp }` JWT payload
- **Auto-expiry:** Checked on load; expired sessions cleared and user returned to login
- **Share mode:** `sessionStorage` key `pivot_share_token` → bypasses auth, loads family by token, read-only
- **Setup flow:** New user with no kids → `SetupScreen.jsx` → writes kids to Supabase via `/api/family`

---

## Mobile / PWA

- **Safe area:** Header padding uses `max(20px, env(safe-area-inset-top))` — clears Dynamic Island and notch
- **Viewport:** `viewport-fit=cover` in `index.html`
- **Fonts:** Barlow Condensed (display/stats) + DM Sans (body) + DM Mono (numbers) — Google Fonts CDN
- **Max width:** 520px, centred — optimised for single-hand mobile use

---

## Known Limitations / Open Items

| Area | Issue | Notes |
|------|-------|-------|
| msstats | `TEAM_ID` hardcoded to `"80316"` | Should use `kid.statsTeamId` from Supabase |
| msstats | `SEASON` hardcoded to `"2025"` | Needs auto-detection or config |
| msstats | `statsUuid` may be null | ESB sometimes omits `universallyid`; box score falls back to error message |
| msstats | Team name match in box score hardcoded | `includes("BARNA") \|\| includes("GRUP")` — breaks for other families using app |
| Stats tab | Only supports k1 (first kid) | k2 stats not wired; StatsTab receives only `k1Matches` |
| Checklist | `canvis` flag only shows ⚠ label | No push notification or alert mechanism |
| Schedule | `BARNA` team names hardcoded | `isBarna()` must be generalised for multi-family use |

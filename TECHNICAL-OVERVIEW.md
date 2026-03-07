# PIVOT — Technical Overview

**Last updated:** 2026-03-07
**Stack:** React 18 + Vite · Vercel (serverless) · Supabase · Google OAuth

---

## Architecture at a Glance

```
Browser (React SPA)
  ├── /api/auth           ← Google OAuth token exchange
  ├── /api/family         ← Supabase: load kids config for user or share token
  ├── /api/schedule       ← ESB (FCBQ): fetch + normalise match schedule
  ├── /api/fcbq           ← CORS proxy: msstats season stats + box scores
  ├── /api/scout          ← Opponent scouting: season record, top players, H2H, recent form
  ├── /api/player-log     ← Kid's per-game stats log (box score extraction)
  ├── /api/brief          ← AI match briefing generation
  ├── /api/share          ← Share token creation
  ├── /api/share-manifest ← Share manifest for PWA
  ├── /api/club-teams     ← FCBQ club team lookup (setup)
  ├── /api/clubs-search   ← FCBQ club search (setup)
  └── /api/team-grups     ← FCBQ grup IDs for a team (setup)
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
  - `oppTeamId` — from `m.idLocalTeam` / `m.idVisitorTeam`; used by scout card
- **Team detection:** `isBarna()` — matches any of `["GRUP BARNA", "BARNA VERMELL", "GRUP ESP"]`
- **km calculation:** Haversine from Nau Parc Clot (home) if lat/lon present; else `CITY_KM` lookup table
- **Caching:** `s-maxage=300, stale-while-revalidate=60` (Vercel edge); client sessionStorage TTL 5 min

### 2. msstats — FCBQ Stats API
- **Base URL:** `https://msstats.optimalwayconsulting.com/v1/fcbq`
- **Proxied via:** `api/fcbq.js` (CORS proxy — allowlist-gated to basquetcatala.cat + msstats)
- **Endpoints used:**

| Endpoint | Used by | Cache |
|---|---|---|
| `team-stats/team/{teamId}/season/{year}` | StatsTab (SeasonStats), api/scout.js | Edge 1h |
| `getJsonWithMatchStats/{statsUuid}` | StatsTab (MatchBoxScores), api/player-log.js | Edge 5min; Supabase (planned) |
| `head-to-head/full-prematch/{teamA}/{teamB}/{year}` | api/scout.js (≤14 days only) | Edge 1h |

- **SEASON derivation:** `new Date().getMonth() >= 8 ? currentYear : currentYear - 1` — auto-rolls each September
- **Availability:** Stats only available for Cadet Preferent category (`statsAvailable: category === "Cadet"`)
- **`statsUuid`:** Populated from ESB `m.universallyid` 24–48h after match is entered. Null for future or recent unprocessed matches.

### 3. Supabase — Family / Kids Config
- **Tables:** `families` (user → family mapping, share_token), `kids` (one row per child)
- **Key kids columns:** `name`, `label`, `category`, `gender`, `color`, `fcbq_team_id`, `grup_id_phase1`, `grup_id_phase2`
- **`fcbq_team_id`:** Required for stats features. Flows into `kid.statsTeamId` via `familyUtils.buildKid()`. `statsAvailable` gated on `category === "Cadet"`.
- **Kid shape built by:** `src/familyUtils.js:buildKid()` — converts DB row to app kid object
- **Share flow:** `share_token` → `/s/TOKEN` redirect → `/?share_token=TOKEN` → `resolveShareToken()` reads URL param → `useFamily(shareToken)` → read-only view
- **PWA share persistence:** `share-manifest.js` sets `start_url: /?share_token=TOKEN` so iOS always launches the PWA with the token in the URL — no storage dependency. `resolveShareToken()` reads `window.location.search` first, seeds `localStorage` as fallback for in-session SPA navigations, then falls back to `localStorage`. **Prior attempts** (sessionStorage, localStorage-only) failed because iOS standalone mode can clear sessionStorage on path navigation and may skip the redirect on fast resume. URL param in `start_url` is the only approach iOS must honour on every launch.
- **Reinstall required** when share manifest `start_url` changes — iOS caches the old manifest. User must delete home screen icon and re-add.
- **Planned:** `match_box_scores` table — cache box score JSON by `stats_uuid` to avoid re-fetching on every Game Log load. See spike: `box-score-caching.md`.

### 4. FCBQ Team Page (HTML scrape)
- Used by `api/scout.js` and `api/team-grups.js` to derive grup IDs for a given team
- `GET https://www.basquetcatala.cat/equip/{teamId}` — parses `<h4 id="news-sidebar">` competition labels + `/competicions/resultats/{grupId}` links
- Used in scout card to fetch opponent's recent form via ESB (not msstats)
- **Tournament filtering:** `api/team-grups.js` extracts (label, grupId) pairs and skips any section whose label contains `TROFEU`, `COPA`, `TORNEIG`, or `SUPERCOPA` before assigning Phase 1 / Phase 2. Teams in mid-season tournaments (e.g. Trofeu Molinet) have the tournament grup listed between Phase 1 and Phase 2 on the FCBQ page — without filtering, the tournament ID would be assigned as `grupIdPhase2`. Also returns `allSections[]` for debugging.
- **Known limitation:** `isBarna()` in `schedule.js` is hardcoded to Grup Barna team name patterns. Breaks for other clubs — generalisation needed before multi-family rollout.

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
- **Coverage:** All screens including `SettingsScreen` — language selector is present in the Settings header so users can switch locale without returning to the main app. Stat abbreviations (PTS, REB, AST etc.) stay universal.
- **Utils integration:** `fmtDate()` and `daysLabel()` in `utils.js` read `pivot_lang` directly from localStorage (avoids prop-drilling locale through all call sites)
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
| Dashboard | `src/tabs/DashboardTab.jsx` | kids, k1Matches, k2Matches, k3Matches |
| Calendar | `src/tabs/CalendarTab.jsx` | kids, k1Matches, k2Matches |
| Match Day (Checklist) | `src/tabs/ChecklistTab.jsx` | kids, k1Matches, k2Matches |
| Season | `src/tabs/SeasonTab.jsx` | kids, k1Matches, k2Matches, k3Matches |
| Stats | `src/tabs/StatsTab.jsx` | kids, k1Matches, k2Matches (Cadet only) |

**Shared components:**
- `src/components/MatchCard.jsx` — full match card (used in Dashboard/Checklist)
- `src/components/ScoutCard.jsx` — opponent scout report (used in Dashboard, Cadet kids only)
- `src/styles.js` — centralised style tokens (`S.*`)

**Screens:**
- `src/SetupScreen.jsx` — initial kid setup for new users. Exports `KidForm`, `EMPTY_KID`, `COLORS`, `inputStyle` as named exports for reuse in SettingsScreen.
- `src/SettingsScreen.jsx` — edit/delete/add kids post-setup. Accessed via ⚙ gear icon in App header. Renders as full-page replacement (not modal). Includes language selector. Saves via POST `/api/family` (same full-replace endpoint as setup). `onSave` increments `setupKey` in App to trigger `useFamily` re-fetch.

### Stats Tab — Sub-tabs
| Sub-tab | Component | Data source |
|---------|-----------|-------------|
| Season Totals | `SeasonStats` | msstats `team-stats` via `/api/fcbq` proxy |
| Box Scores | `MatchBoxScores` | msstats `getJsonWithMatchStats` via `/api/fcbq` proxy |
| Game Log | `PlayerGameLog` | `/api/player-log` — extracts kid's row from each box score |

### Dashboard — Scout Card
- Renders below each kid's MatchCard when `kid.statsAvailable && match.oppTeamId`
- Fetches from `/api/scout`: opponent season record, H2H (≤14 days), recent form (last 5), top 5 threats by PPG
- Recent form sourced from ESB via FCBQ team page scrape — not msstats
- Fully localised (EN/ES/CAT)

---

## API Endpoints Detail

### `api/scout.js`
- **Inputs:** `oppTeamId`, `ourTeamId`, `matchDate`
- **Calls:** msstats team-stats + FCBQ team page scrape + ESB match records (parallel)
- **H2H:** Only fetched if `matchDate` ≤14 days away (msstats returns 400 otherwise)
- **Returns:** `{ record, topPlayers[5], h2h|null, recentForm[5] }`
- **Cache:** `s-maxage=3600`

### `api/player-log.js`
- **Inputs:** `kidName`, `matches` (JSON array of `{statsUuid, date, opp, ha, win, score}`)
- **Calls:** msstats `getJsonWithMatchStats` in parallel for all matches with a `statsUuid`
- **Player match:** `p.name.toUpperCase().includes(kidName.toUpperCase())`
- **Returns:** `{ log: [{ date, opp, ha, win, matchScore, min, pts, twoM, twoA, ftM, ftA, reb, ast, stl, pf, plusMinus, starting }] }`
- **Cache:** `s-maxage=300` (short — new matches enter msstats 24–48h after game)
- **Known issue:** Re-fetches all box scores on every load. Supabase caching planned — see spike `box-score-caching.md`.

### `api/schedule.js`
- Normalised match fields include `oppTeamId` (added 2026-03-07) for scout card
- `statsUuid` from `m.universallyid` — populated by msstats 24–48h post-match

---

## Auth & Access Control

- **Auth provider:** Google OAuth via `api/auth.js`
- **Session storage:** `sessionStorage` key `pivot_auth` — stores `{ email, picture, exp }` JWT payload
- **Auto-expiry:** Checked on load; expired sessions cleared and user returned to login
- **Share mode:** URL param `?share_token` (set by `share.js` redirect and `start_url` in PWA manifest) → `resolveShareToken()` → bypasses auth, loads family by token, read-only
- **Setup flow:** New user with no kids → `SetupScreen.jsx` → writes kids to Supabase via `/api/family`
- **Settings flow:** Existing user → gear icon (⚙) in header → `SettingsScreen.jsx` → edit/delete/add kids → POST `/api/family` (full-replace) → re-fetches family → returns to main app
- **Shape mismatch:** `useFamily` returns kids in `buildKid()` shape (`fcbqId`, `grupIds[]`). `KidForm` expects setup shape (`fcbqTeamId`, `grupIdPhase1`, `grupIdPhase2`). `SettingsScreen` normalises via `toEditShape()` on init — do not pass raw app-shape kids directly to `KidForm`.
- **Add kid UX:** Adding a new kid in SettingsScreen auto-expands the form and shows a `setupRequired` validation hint when Save is disabled. Without this, users cannot save until name, label, and grupIdPhase1 are filled — previously showed no feedback.
- **Families are per email:** Each Google account gets its own family row in Supabase. Two users setting up the same kids creates duplicate DB rows. Share link is the correct multi-user pattern — one owner sets up, shares read-only URL with others.

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
| Performance | Cache hit latency similar to cold msstats parallel fetch | Supabase read is serial (~200–400ms); benefit is reliability + eliminating msstats dependency for historical matches. Monitor via `X-Cache-Stats` response header. |
| Schedule | `isBarna()` hardcoded to Grup Barna name patterns | Breaks for other clubs. Multi-family generalisation needed before wider rollout. |
| Grup IDs | Teams in mid-season tournaments had wrong Phase 2 ID assigned | Fixed 2026-03-07 via label-based filtering in `api/team-grups.js`. Existing DB records set up before fix may need manual correction. |
| Checklist | `canvis` flag only shows ⚠ label | No push notification or alert mechanism |
| Stats | `statsUuid` may be null for recent matches | ESB populates `universallyid` 24–48h post-game. Empty state handled. |

---

## Deploy

- **Remote:** `https://github.com/minal77-USBC/pivot.git` (branch: `main`)
- **CI/CD:** Vercel auto-deploys on push to `main` — no manual `vercel` CLI step needed
- **Process:** `git add → git commit → git push origin main` → Vercel picks up automatically
- **Config:** `vercel.json` — rewrites for `/api/*`, `/s/:token` (share redirect), and SPA fallback

---

## Spikes

| File | Status | Summary |
|------|--------|---------|
| `language-selector.md` | Complete | EN/ES/CAT i18n via inline locale objects + React context |
| `msstats-api.md` | Complete | API exploration: accessible endpoints, data quality notes, box score correction |
| `msstats-implementation-fixes.md` | Implemented | 6 hardcoded issues fixed in StatsTab + App |
| `box-score-caching.md` | Implemented | Cache box scores in Supabase — read-before-fetch in `api/player-log.js`; fire-and-forget fixed to await |
| `dark-light-mode.md` | Spike only | ThemeContext approach recommended (~L effort); light palette defined; no implementation yet |

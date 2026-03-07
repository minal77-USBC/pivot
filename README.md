# Pivot

Basketball schedule tracker for families with kids playing in FCBQ (Federació Catalana de Bàsquet) competitions. Built with React + Vite, deployed on Vercel.

## What it does

- Live schedule from FCBQ's ESB API — upcoming matches, results, road trips
- Match Day checklist with kit, leave-by time, and maps link
- Season stats, box scores, and player game log via msstats API (Preferent-tier teams only)
- Scout report on next opponent (form, top players, H2H)
- Family sharing via read-only share URL
- Multi-language: CAT / ES / EN

## Architecture

### Data flow

```
Supabase (kids config)
  → useFamily → buildKids (familyUtils.js)
    → useSchedule → /api/schedule (fetches ESB per grupId)
      → k1Matches / k2Matches / k3Matches
        → DashboardTab / CalendarTab / ChecklistTab / SeasonTab / StatsTab
```

### Kid object shape (familyUtils.js → buildKid)

Every kid in the app is built from a Supabase `kids` row into this shape:

| Field | Source | Purpose |
|-------|--------|---------|
| `id` | index → `k1`, `k2`, `k3` | React key + match map key |
| `fcbqId` | `fcbq_team_id` | FCBQ team page URL |
| `teamId` | `fcbq_team_id` | Schedule API — ID-based team matching |
| `statsTeamId` | `fcbq_team_id` | msstats API team lookup |
| `statsAvailable` | `!!fcbq_team_id` | Gates Stats tab; confirmed lazily via msstats API |
| `grupIds` | `[grup_id_phase1, grup_id_phase2]` | ESB grup IDs to fetch schedule from |

**Important:** `teamId` and `fcbqId` are the same value (`fcbq_team_id`). `teamId` is the field the schedule API uses for match filtering.

### Schedule API (`/api/schedule`)

Accepts `?kids=[{id, grupIds, teamId}]`. For each kid:

1. Fetches all matches from each `grupId` via ESB
2. Runs `normalizeMatch(match, teamId)` per match
3. If `teamId` is set: matches by `idLocalTeam` / `idVisitorTeam` — exact ID match
4. If `teamId` is null: falls back to `isBarna()` name check (legacy, only safe for Grup Barna Vermell teams)

**Why teamId matters:** Multiple kids can share a `grupId` (e.g., when one kid's Phase 1 group is another kid's competition). Without `teamId`, `isBarna()` would match the wrong team in shared groups, returning the wrong kid's results across all tabs.

### Stats availability (`statsAvailable`)

`statsAvailable` is set to `!!fcbq_team_id` — true for any kid with a configured team ID. The actual gate is the msstats API:

- `StatsTab` always attempts to load via `SeasonStats` when `statsAvailable = true`
- `SeasonStats` calls `onResult(true/false)` based on API response
- `true` (200): Season/Box/Log sub-tabs all appear
- `false` (404 — non-Preferent competition): parent shows "not available" card; Box/Log never exposed

Only Preferent-tier competitions publish data to msstats. Territorial and Promoció competitions return 404.

## Supabase schema (kids table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `family_id` | uuid | FK → families |
| `sort_order` | int | Tab order |
| `name` | text | Full name |
| `label` | text | Short display name |
| `category` | text | Premini / Mini / Infantil / Cadet / Junior / Sènior |
| `gender` | text | M / F |
| `color` | text | Hex color |
| `club_name` | text | |
| `fcbq_team_id` | text | FCBQ numeric team ID (e.g. `80316`) |
| `grup_id_phase1` | text | ESB grup ID for Phase 1 |
| `grup_id_phase2` | text | ESB grup ID for Phase 2 (optional) |

## API routes

| Route | Purpose |
|-------|---------|
| `/api/schedule` | Fetch + normalize match schedule from ESB |
| `/api/family` | GET/POST family + kids config from Supabase |
| `/api/fcbq` | Proxy for msstats API (CORS bypass) |
| `/api/scout` | Opponent scout report (msstats + ESB recent form) |
| `/api/player-log` | Player game-by-game log |
| `/api/brief` | Claude-generated pre-match briefing |
| `/api/team-grups` | Scrape grup IDs from FCBQ team page |
| `/api/club-teams` | List teams for a club (setup autocomplete) |
| `/api/clubs-search` | Club name search (setup autocomplete) |
| `/api/share` | Share URL redirect |
| `/api/share-manifest` | PWA manifest for share token |
| `/api/auth` | Google OAuth callback |

## Local development

```bash
npm install
npm run dev        # Vite dev server on localhost:5173
# API routes require Vercel CLI:
vercel dev         # localhost:3000 with API routes
```

Environment variables (set in Vercel):
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`

## Key design decisions

- **No `statsAvailable` DB field** — msstats API response is the source of truth. Box/Log sub-tabs only appear after a successful Season fetch.
- **`teamId` required for multi-kid families** — kids sharing a `grupId` (common when siblings are in the same-phase competition) will cross-contaminate without ID-based matching.
- **`isBarna()` fallback preserved** — for any kid where `fcbq_team_id` is null, name-based matching still runs. This is only correct for Grup Barna Vermell teams and should be treated as a degraded state.

-- PIVOT — migration: persistent fixture cache
--
-- Why: /api/schedule fetched every fixture live from the FCBQ ESB API on every
-- app open, with only a 300s CDN window in front and no durable copy anywhere.
-- When the ESB key stopped being authorised (2026-09, ACCESS DENIED /
-- ERRORCODEx0008 on every endpoint) the app had no memory of the thousands of
-- schedules it had already loaded successfully, so a single upstream failure
-- became a hard 502 and a Retry button that could not succeed.
--
-- This table is written through on every successful ESB fetch and read back
-- when ESB fails, turning a total outage into stale data plus a banner. It also
-- lets the app refresh ESB on an interval rather than per app open, cutting
-- upstream call volume sharply.
--
-- PK is (grup_id, match_id): ESB returns rounds keyed by round number and each
-- round's `matches` object keyed by match id, so match_id is the only stable
-- identifier available. statsUuid cannot be used — it is null until 24-48h
-- after a match is played, and future fixtures are exactly what we need to keep.

create table if not exists match_fixtures (
  grup_id      text not null,
  match_id     text not null,
  team_id      text not null,
  date         text not null,
  time         text,
  ha           text not null,
  opp          text,
  venue        text,
  city         text,
  km           numeric,
  played       boolean not null default false,
  win          boolean,
  score        text,
  stats_uuid   text,
  opp_team_id  text,
  fetched_at   timestamptz not null default now(),
  primary key (grup_id, match_id)
);

-- Read path is always "every fixture for this team in this grup", ordered by date
create index if not exists match_fixtures_team_grup_idx
  on match_fixtures (team_id, grup_id, date);

alter table match_fixtures enable row level security;
create policy "allow all" on match_fixtures for all using (true) with check (true);

-- Backfill convention
--
-- Rows reconstructed from match_box_scores (played matches only, where no ESB
-- fixture was ever cached) use stats_uuid as match_id, since an acta carries no
-- ESB match id. Their fetched_at is set to the match date rather than now(), for
-- two reasons: any later real ESB fetch is newer and therefore wins the
-- (team_id, date) dedupe in readFixtures(), and the stale banner then reports a
-- date that honestly reflects how current the data is.
--
-- Backfilled rows have no time, venue or km. That is safe because upcoming() in
-- src/utils.js filters on !played, so they never reach the departure-time
-- calculation — but it does mean they are results-only, not logistics.

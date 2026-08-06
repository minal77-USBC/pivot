-- PIVOT — migration for the 2026/27 season refresh
--
-- Run this against the EXISTING (restored) project, not a fresh one.
-- supabase-schema.sql is the from-scratch path and will error here, because it
-- creates tables that already exist.
--
-- Everything below is idempotent — safe to run more than once.

-- ─── 1. share_token ──────────────────────────────────────────────────────────
-- Read by api/family.js, api/share.js and api/share-manifest.js but never
-- written by the app, so it needs a DB-level default. It was missing from
-- supabase-schema.sql; it should already exist on the restored project, but add
-- it defensively. Existing rows keep their tokens, so share links survive.
alter table families
  add column if not exists share_token uuid unique default gen_random_uuid();

update families set share_token = gen_random_uuid() where share_token is null;

-- ─── 2. FCBQ competition index ───────────────────────────────────────────────
-- basquetcatala.cat HTML now serves a bot challenge, so clubs-search,
-- club-teams and team-grups can no longer scrape it. api/sync-index.js walks the
-- ESB API instead (aggregate zone 0 -> categories -> grups -> matches) and
-- materialises the result here. Covers every tier FCBQ publishes: Preferent,
-- Interterritorial, Territorial/Promoció and senior/national.

create table if not exists fcbq_clubs (
  club_id    text primary key,
  name       text not null,
  town       text,
  season     text not null,
  updated_at timestamptz default now()
);

create table if not exists fcbq_teams (
  team_id            text primary key,
  club_id            text not null,
  name               text not null,
  category           text not null,
  category_id        text,
  tier               text,              -- Preferent | Interterritorial | Territorial | Senior
  sex                text,
  zone               smallint,
  grup_id_phase1     text,
  grup_id_phase2     text,
  competition_phase1 text,
  competition_phase2 text,
  venue_name         text,
  venue_lat          text,
  venue_lon          text,
  venue_town         text,
  season             text not null,
  updated_at         timestamptz default now()
);

-- Club search is a substring match (ilike '%query%'), which needs trigrams
create extension if not exists pg_trgm;
create index if not exists fcbq_clubs_name_trgm on fcbq_clubs using gin (name gin_trgm_ops);
create index if not exists fcbq_clubs_town_trgm on fcbq_clubs using gin (town gin_trgm_ops);
create index if not exists fcbq_teams_club_idx  on fcbq_teams (club_id);

alter table fcbq_clubs enable row level security;
alter table fcbq_teams enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'fcbq_clubs' and policyname = 'allow all') then
    create policy "allow all" on fcbq_clubs for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'fcbq_teams' and policyname = 'allow all') then
    create policy "allow all" on fcbq_teams for all using (true) with check (true);
  end if;
end $$;

-- ─── 3. Roll the kids onto their 2026/27 teams ───────────────────────────────
-- FCBQ reissues team and grup IDs every season, so last season's values are
-- dead. Both kids are Interterritorial this season (Rohan was relegated from
-- Cadet Preferent; Sara moved up from Infantil Promoció).
--
-- SCOPED BY FAMILY EMAIL. There are 13 families in this database and a separate
-- account (rohanthomasguerra@gmail.com) has a kid also named Rohan — an
-- unscoped `where name ilike 'rohan%'` would rewrite another family's row.
--
-- grup_id_phase2 is deliberately null — FCBQ has published only FASE PRÈVIA so
-- far. api/sync-index.js will fill in second phases when they appear.

update kids k set
  fcbq_team_id   = '89410',
  grup_id_phase1 = '23354',
  grup_id_phase2 = null,
  category       = 'Cadet',
  club_name      = 'C.B. Grup Barna'
from families f
where f.id = k.family_id
  and f.email = 'kiranjacob@gmail.com'
  and k.name ilike 'rohan%';

update kids k set
  fcbq_team_id   = '90465',
  grup_id_phase1 = '23462',
  grup_id_phase2 = null,
  category       = 'Infantil',
  club_name      = 'C.B. Grup Barna'
from families f
where f.id = k.family_id
  and f.email = 'kiranjacob@gmail.com'
  and k.name ilike 'sara%';

-- Nora (currently team 80317, grup 19856) is NOT rolled — her 2026/27 team is
-- unconfirmed. Her fixtures stay empty until it is.

-- ─── 4. Verify ───────────────────────────────────────────────────────────────
-- Every kid still on a 2025/26 team id has dead fixtures. Expect only Rohan and
-- Sara to show 2026/27 ids (89410 / 90465); the other 20 rows are the backlog.
select f.email, k.name, k.category, k.fcbq_team_id, k.grup_id_phase1,
       case when k.fcbq_team_id in ('89410','90465') then 'rolled' else 'stale' end as season_status
from kids k join families f on f.id = k.family_id
order by season_status, f.email, k.sort_order;

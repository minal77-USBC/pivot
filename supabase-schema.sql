-- PIVOT — Supabase Schema
-- Run this in your Supabase project: SQL Editor → New Query → Paste → Run

create table families (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  -- Read by api/family.js, api/share.js, api/share-manifest.js; never written by the
  -- app, so it must be defaulted here. share.js validates it as a 36-char UUID.
  share_token uuid unique default gen_random_uuid(),
  created_at timestamptz default now()
);

create table kids (
  id uuid default gen_random_uuid() primary key,
  family_id uuid references families(id) on delete cascade not null,
  sort_order smallint not null default 0,
  name text not null,
  label text not null,
  club_name text,
  fcbq_team_id text,
  category text not null,
  gender text not null default 'M',
  grup_id_phase1 text,
  grup_id_phase2 text,
  color text not null default '#FF6B2B',
  created_at timestamptz default now()
);

-- Allow all operations via anon key (auth enforced at Vercel layer via Google OAuth + ALLOWED_EMAILS)
alter table families enable row level security;
alter table kids enable row level security;

create policy "allow all" on families for all using (true) with check (true);
create policy "allow all" on kids for all using (true) with check (true);

-- Box score cache — avoids re-fetching msstats on every Game Log load
-- stats_uuid is the natural PK (m.universallyid from ESB, populated 24-48h post-game)
-- data stores the full raw box score JSON so any family's kid can be extracted from the same row
create table match_box_scores (
  stats_uuid   text primary key,
  data         jsonb not null,
  match_date   text not null,
  fetched_at   timestamptz default now()
);

alter table match_box_scores enable row level security;
create policy "allow all" on match_box_scores for all using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- FCBQ competition index — powers club/team/grup lookup during onboarding.
--
-- basquetcatala.cat HTML is behind a bot challenge, so clubs-search, club-teams
-- and team-grups can no longer scrape it. Instead api/sync-index.js walks the
-- ESB API (zones -> categories -> grups -> matches) and materialises the result
-- here. Covers every tier FCBQ publishes: Preferent, Interterritorial,
-- Territorial/Promoció and senior/national.
-- ─────────────────────────────────────────────────────────────────────────────

create table fcbq_clubs (
  club_id    text primary key,
  name       text not null,
  town       text,
  season     text not null,
  updated_at timestamptz default now()
);

create table fcbq_teams (
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

-- Trigram indexes: club search is a substring match (ilike '%query%'), which a
-- tsvector index cannot serve.
create extension if not exists pg_trgm;
create index fcbq_clubs_name_trgm on fcbq_clubs using gin (name gin_trgm_ops);
create index fcbq_clubs_town_trgm on fcbq_clubs using gin (town gin_trgm_ops);
create index fcbq_teams_club_idx  on fcbq_teams (club_id);

alter table fcbq_clubs enable row level security;
alter table fcbq_teams enable row level security;
create policy "allow all" on fcbq_clubs for all using (true) with check (true);
create policy "allow all" on fcbq_teams for all using (true) with check (true);

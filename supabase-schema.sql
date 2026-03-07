-- PIVOT — Supabase Schema
-- Run this in your Supabase project: SQL Editor → New Query → Paste → Run

create table families (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
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

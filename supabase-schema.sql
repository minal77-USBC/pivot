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

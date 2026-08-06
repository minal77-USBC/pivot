-- PIVOT — sync state for the FCBQ index cron
--
-- Run this AFTER supabase-migration-2026-season.sql. Idempotent.
--
-- Lets api/sync-index.js skip the expensive half of its work. Each run first
-- discovers the competition structure (~38 ESB calls) and fingerprints it. If
-- the fingerprint is unchanged since the last run, the ~126 fixture fetches are
-- skipped and the run finishes in seconds instead of a minute.
--
-- A full rebuild is forced regardless once every FULL_REBUILD_DAYS, because a
-- team joining an existing grup does not change the fingerprint.

create table if not exists fcbq_sync_state (
  id             smallint primary key default 1,
  season         text not null,
  fingerprint    text,
  category_count integer,
  grup_count     integer,
  last_full_at   timestamptz,
  last_run_at    timestamptz default now(),
  constraint fcbq_sync_state_single_row check (id = 1)
);

alter table fcbq_sync_state enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'fcbq_sync_state' and policyname = 'allow all') then
    create policy "allow all" on fcbq_sync_state for all using (true) with check (true);
  end if;
end $$;

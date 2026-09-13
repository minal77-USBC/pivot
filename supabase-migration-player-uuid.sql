-- PIVOT — migration: stable FCBQ player identity
--
-- Why: the Game Log resolves a kid's row out of the msstats acta by display
-- name. FCBQ anonymises opted-out players to initials ("R.T.G."), so from
-- 2026/27 the name lookup returns nothing and the Game Log renders empty while
-- Box Scores and Season Totals — which draw the whole roster — keep working.
--
-- The player `uuid` in the acta is stable across games, teams and seasons
-- (verified: dorsal #7 carries uuid 0171fd09-98d1-11e9-a2a5-0216824770c2 on
-- team 80316 in 2025/26 as "ROHAN THOMAS GUERRA" and on team 89410 in 2026/27
-- as "R.T.G."). Store it per kid and match on it first.
--
-- NB: `actorId` in the same payload is a per-game record id — not usable here.

alter table kids add column if not exists fcbq_player_uuid text;

comment on column kids.fcbq_player_uuid is
  'Stable msstats/FCBQ player uuid, resolved via the roster picker during onboarding. Primary key for locating this kid''s row in a match acta; display-name matching is the fallback.';

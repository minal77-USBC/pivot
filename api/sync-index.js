// Rebuilds the FCBQ club/team index into Supabase.
//
// Invoked by the daily Vercel cron (see vercel.json) and manually for backfills.
// Requires `Authorization: Bearer ${CRON_SECRET}` — Vercel sends this header
// automatically on cron invocations when CRON_SECRET is set in the environment.
//
// Why this exists: basquetcatala.cat serves a bot challenge to HTML requests, so
// clubs-search / club-teams / team-grups can no longer scrape it. They now read
// fcbq_clubs / fcbq_teams, which this endpoint populates from the ESB API.
//
// Running daily also means categories FCBQ has not yet published — all the
// Territorial/Promoció tiers as of August 2026 — appear in onboarding the day
// they go live, with no redeploy.
//
// Most runs are cheap. Structure discovery costs ~38 ESB calls; only if its
// fingerprint changed (or the weekly full rebuild is due) do we spend the ~126
// fixture fetches needed to read team and club names.
//
// Query params:
//   season          override the season (defaults to current)
//   force=1         rebuild even if the fingerprint is unchanged
//   categoryOffset  skip the first N categories   } for chunking a run that
//   categoryLimit   process at most N categories  } would exceed maxDuration
//   dryRun=1        build but do not write

import { Sentry } from "./_sentry.js";
import { buildIndex, discoverStructure, currentSeason } from "./_fcbq.js";

export const config = { maxDuration: 300 };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

// A team joining an existing grup leaves the fingerprint untouched, so rebuild
// unconditionally at least this often.
const FULL_REBUILD_DAYS = 7;

function sbHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function upsert(table, rows, chunkSize = 200) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(rows.slice(i, i + chunkSize)),
    });
    if (!res.ok) {
      throw new Error(`${table} upsert ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
  }
}

async function readState() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/fcbq_sync_state?id=eq.1&select=*`, {
      headers: sbHeaders(),
    });
    if (!res.ok) return null;
    const [row] = await res.json();
    return row || null;
  } catch {
    return null;
  }
}

async function writeState(row) {
  await fetch(`${SUPABASE_URL}/rest/v1/fcbq_sync_state`, {
    method: "POST",
    headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify([{ id: 1, ...row }]),
  }).catch(() => {});
}

function daysSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const season = req.query.season || currentSeason();
  const offset = parseInt(req.query.categoryOffset || "0", 10);
  const limit = req.query.categoryLimit ? parseInt(req.query.categoryLimit, 10) : null;
  const dryRun = req.query.dryRun === "1";
  const force = req.query.force === "1";

  const started = Date.now();
  const log = [];

  try {
    // ── Cheap half: what categories and grups exist right now ────────────────
    const structure = await discoverStructure({
      season,
      onProgress: (m) => log.push(m),
    });

    const state = await readState();
    const staleness = daysSince(state?.last_full_at);
    const reasons = [];
    if (force) reasons.push("force=1");
    if (!state) reasons.push("no previous run");
    else if (state.season !== season) reasons.push(`season changed ${state.season}->${season}`);
    else if (state.fingerprint !== structure.fingerprint) reasons.push("structure changed");
    // Only meaningful once there is a prior full rebuild to be stale relative to
    if (state?.last_full_at && staleness >= FULL_REBUILD_DAYS) {
      reasons.push(`${Math.floor(staleness)}d since last full rebuild`);
    }

    // Chunked runs are always partial by definition — never skip them
    const chunked = Boolean(offset || limit);
    if (chunked) reasons.push("chunked run");

    if (!reasons.length) {
      log.push("structure unchanged — skipping fixture walk");
      if (!dryRun) await writeState({ season, last_run_at: new Date().toISOString() });
      return res.status(200).json({
        ok: true,
        skipped: true,
        season,
        esbCalls: structure.calls,
        categories: structure.categories.length,
        grups: structure.pairs.length,
        elapsedMs: Date.now() - started,
        log,
      });
    }

    log.push(`rebuilding: ${reasons.join("; ")}`);

    // ── Expensive half: read every grup's fixtures for team and club names ───
    let onlyCategoryIds = null;
    let scoped = structure;
    if (chunked) {
      const ids = [...new Set(structure.categories.map((c) => String(c.idCategoryRegistred)))];
      onlyCategoryIds = ids.slice(offset, limit ? offset + limit : undefined);
      const want = new Set(onlyCategoryIds);
      scoped = {
        ...structure,
        pairs: structure.pairs.filter(({ cat }) => want.has(String(cat.idCategoryRegistred))),
      };
      log.push(`chunk: categories ${offset}..${offset + onlyCategoryIds.length} of ${ids.length}`);
    }

    const { clubs, teams, stats } = await buildIndex({
      season,
      structure: scoped,
      onProgress: (m) => log.push(m),
    });

    if (!dryRun) {
      await upsert("fcbq_clubs", clubs);
      await upsert("fcbq_teams", teams);
      await writeState({
        season,
        fingerprint: structure.fingerprint,
        category_count: structure.categories.length,
        grup_count: structure.pairs.length,
        // A chunked run only covered part of the tree — don't reset the clock
        ...(chunked ? {} : { last_full_at: new Date().toISOString() }),
        last_run_at: new Date().toISOString(),
      });
    }

    // A season with nothing in it means the walk failed, not that FCBQ is empty —
    // surface it rather than reporting a successful no-op.
    if (!teams.length) {
      Sentry.captureMessage(`sync-index produced 0 teams for season ${season}`);
    }

    return res.status(200).json({
      ok: true,
      skipped: false,
      dryRun,
      rebuiltBecause: reasons,
      elapsedMs: Date.now() - started,
      ...stats,
      log,
    });
  } catch (err) {
    Sentry.captureException(err);
    return res.status(500).json({
      ok: false,
      error: err.message,
      elapsedMs: Date.now() - started,
      log,
    });
  }
}

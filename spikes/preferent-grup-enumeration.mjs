/**
 * Spike: Enumerate all Preferent grup IDs via ESB API
 *
 * Run:
 *   node --env-file=.env.local spikes/preferent-grup-enumeration.mjs
 *
 * Output:
 *   Console summary + spikes/preferent-grup-enumeration-results.json
 *
 * Discovery path:
 *   1. CategoryRegistered/getByZoneAndSeason/1/2025 → 13 Preferent categories
 *   2. Competition/getCompetitionGroupVisibleWeb/{categoryId}/1 → grupIds per category
 *
 * basquetcatala.cat is a fully client-rendered SPA — HTML scraping does not work.
 * Both endpoints discovered by reading /react/dist/main.js React bundle.
 */

import { writeFileSync } from "fs";

if (!process.env.ESB_BASE_URL || !process.env.ESB_API_KEY) {
  throw new Error("ESB_BASE_URL and ESB_API_KEY required — run with `node --env-file=.env.local`");
}
const ESB_BASE = `${process.env.ESB_BASE_URL}/${process.env.ESB_API_KEY}`;

const ZONE   = 1;      // FCBQ zone (all Preferent categories live here)
const SEASON = String(
  new Date().getMonth() >= 8 ? new Date().getFullYear() : new Date().getFullYear() - 1
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function esbGet(path) {
  const res = await fetch(`${ESB_BASE}/${path}`, { headers: { "User-Agent": "Dorsal/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  const raw = await res.arrayBuffer();
  const json = Buffer.from(Buffer.from(raw).toString("ascii"), "base64").toString("utf-8");
  return JSON.parse(json).messageData ?? null;
}

function classifyGender(name) {
  const t = (name || "").toUpperCase();
  if (/FEMEN[IÍ]/.test(t)) return "F";
  if (/MASCUL[IÍ]/.test(t)) return "M";
  return null;
}

function classifyAgeGroup(name) {
  const t = (name || "").toUpperCase();
  if (t.includes("SOTS-20") || t.includes("U20")) return "u20";
  if (/J[UÚ]NIOR/.test(t))                        return "junior";
  if (t.includes("CADET"))                          return "cadet";
  if (t.includes("INFANTIL"))                       return "infantil";
  if (/S[EÈ]NIOR/.test(t))                         return "senior";
  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nDorsal — Preferent grup enumeration`);
  console.log(`Season: ${SEASON} | Zone: ${ZONE}\n`);

  // ── Step 1: Get all Preferent categories ──────────────────────────────────
  console.log("Step 1: Fetching categories...");
  const allCats = await esbGet(`CategoryRegistered/getByZoneAndSeason/${ZONE}/${SEASON}`);
  const preferentCats = (Array.isArray(allCats) ? allCats : [])
    .filter(c => (c.categoryRegisteredName || "").toUpperCase().includes("PREFERENT"));
  console.log(`  ${preferentCats.length} Preferent categories (of ${Array.isArray(allCats) ? allCats.length : "?"} total)\n`);

  // ── Step 2: Get all grups for each category ────────────────────────────────
  console.log("Step 2: Fetching grups per category...\n");

  const results = [];

  for (const cat of preferentCats) {
    const catName = cat.categoryRegisteredName;
    const catId   = cat.idCategoryRegistred;
    process.stdout.write(`  [cat:${String(catId).padEnd(5)}] ${catName.padEnd(45)} `);

    let grups = [];
    try {
      const data = await esbGet(`Competition/getCompetitionGroupVisibleWeb/${catId}/${ZONE}`);
      grups = Array.isArray(data) ? data : [];
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      await delay(300);
      continue;
    }

    console.log(`${grups.length} grup(s)`);

    for (const g of grups) {
      results.push({
        grup_id:          String(g.idGroup),
        season:           SEASON,
        category_name:    catName,
        category_id:      catId,
        competition_name: g.competitionName || "",
        grup_name:        g.grupName || "",
        gender:           classifyGender(catName),
        age_group:        classifyAgeGroup(catName),
        is_first_year:    catName.toUpperCase().includes("1R. ANY"),
      });
    }
    await delay(250);
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log(`TOTAL PREFERENT GRUP IDs: ${results.length}`);
  console.log("═".repeat(60) + "\n");

  // Group by age_group + gender
  const byCategory = {};
  for (const r of results) {
    const key = `${r.age_group || "unknown"} ${r.gender || "?"}`;
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(r);
  }

  for (const [cat, items] of Object.entries(byCategory).sort()) {
    const byComp = {};
    for (const i of items) {
      const k = i.category_name;
      if (!byComp[k]) byComp[k] = [];
      byComp[k].push(i);
    }
    console.log(`${cat}:`);
    for (const [compName, its] of Object.entries(byComp)) {
      console.log(`  ${compName} (${its.length} grups)`);
      its.forEach(i => console.log(`    ${i.grup_id.padEnd(7)} ${i.competition_name} - ${i.grup_name}`));
    }
    console.log();
  }

  const mainLeagueGrups = results.filter(r =>
    /FASE PR[EÈ]VIA|PRIMERA FASE|SEGONA FASE/i.test(r.competition_name)
  );
  const tournamentGrups = results.filter(r => /TORNEIG/i.test(r.competition_name));
  const eliminatoryGrups = results.filter(r => /ELIMIN|PLAYOFF/i.test(r.competition_name));

  console.log(`Main league grups (FASE PRÈVIA / PRIMERA FASE / SEGONA FASE): ${mainLeagueGrups.length}`);
  console.log(`Tournament grups: ${tournamentGrups.length}`);
  console.log(`Eliminatory/playoff grups: ${eliminatoryGrups.length}`);
  console.log();

  // Sync job estimate — weekend-only schedule
  // Each main-league team plays ~22 games over the season
  const estTeams      = mainLeagueGrups.length * 8;  // rough: ~8 teams/grup
  const estGames      = estTeams * 22 / 2;            // games = team-games / 2
  const estESBPerRun  = mainLeagueGrups.length;       // one getAllGames call per grup
  const estMsPerRun   = mainLeagueGrups.length * 2;   // ~2 new box scores per grup per weekend
  console.log(`Sync estimate (Mon/Tue incremental run, main league only):`);
  console.log(`  ${estESBPerRun} ESB calls + ~${estMsPerRun} msstats box score fetches`);
  console.log(`  At 350ms/req: ~${Math.ceil((estESBPerRun + estMsPerRun) * 350 / 1000)}s per run`);
  console.log(`  Cold sync (full season backfill): ~${estTeams} teams × ~22 games = ~${estGames} box scores`);

  // Write output
  const out = {
    generated_at:   new Date().toISOString(),
    season:         SEASON,
    zone:           ZONE,
    total_grups:    results.length,
    main_league:    mainLeagueGrups.length,
    tournaments:    tournamentGrups.length,
    eliminatories:  eliminatoryGrups.length,
    grups:          results,
  };

  const outPath = "spikes/preferent-grup-enumeration-results.json";
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nResults written to ${outPath}`);
}

main().catch(e => { console.error("\n✗", e.message); process.exit(1); });

#!/usr/bin/env node
/**
 * backfill_categories.mjs — one-time data migration.
 *
 * Reassign every Milestone/Program row still tagged with the retired
 * PROCUREMENT_CONTRACT category to a real mission domain (or OTHER). The domain
 * is inferred from the item text with the SAME ordered, whole-word keyword rules
 * the scrapers use (scrapers/rss.py :: infer_category) — encoding whole-word,
 * first-match-wins matching in SQL is fragile, so the rules are ported to JS.
 *
 * Runs over HTTPS via Neon's serverless driver (port 443), like the other
 * scripts here — see docs/QUERYING_NEON.md.
 *
 * ORDERING (mandatory): run AFTER migration `add_other_category` (so OTHER
 * exists) and BEFORE `remove_procurement_category` (which drops the value and
 * would fail while rows still reference it).
 *
 *   set -a && source .env.vercel.local && set +a
 *   node scripts/backfill_categories.mjs            # dry run (default)
 *   node scripts/backfill_categories.mjs --commit   # write changes
 */
import { neon } from "@neondatabase/serverless";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("No DIRECT_URL/DATABASE_URL set. Run: set -a && source .env.vercel.local && set +a");
  process.exit(1);
}
const sql = neon(url);
const commit = process.argv.includes("--commit");

// Ordered keyword -> Category rules (first match wins). MUST stay in sync with
// scrapers/rss.py :: CATEGORY_RULES. Specific domains precede the broad UNMANNED
// platform rule; no PROCUREMENT_CONTRACT rule; unmatched -> OTHER.
const CATEGORY_RULES = [
  ["TARGETING", ["targeting", "target recognition", "atr", "sensor-to-shooter", "fires", "weapon", "weapons", "kinetic", "munition", "strike"]],
  ["ISR", ["isr", "surveillance", "reconnaissance", "sensor", "sensors"]],
  ["CYBER", ["cyber", "electronic warfare", "signals", "deepfake", "incident response"]],
  ["COMMAND_CONTROL", ["command and control", "c2", "battle management", "jadc2"]],
  ["SPACE", ["space", "satellite", "orbital"]],
  ["UNMANNED_SYSTEMS", ["unmanned", "drone", "drones", "uav", "uas", "uuv", "usv", "auv", "underwater", "maritime", "naval", "vessel", "swarm", "swarming", "robot", "robotics", "autonomous vehicle"]],
  ["LOGISTICS_SUSTAINMENT", ["logistics", "sustainment", "maintenance", "supply", "acquisition"]],
  ["TRAINING_SIMULATION", ["wargame", "training", "simulation", "exercise", "tabletop"]],
  ["MEDICAL", ["medical", "casualty", "health"]],
  ["POLICY_DIRECTIVE", ["policy", "directive", "executive order", "strategy", "memorandum", "guidance"]],
];
const DEFAULT_CATEGORY = "OTHER";

const escapeRe = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text, kw) => new RegExp(`(?<!\\w)${escapeRe(kw)}(?!\\w)`).test(text);
const stripHtml = (s) => (s ?? "").replace(/<[^>]*>/g, " ");

function inferCategory(text) {
  const t = text.toLowerCase();
  for (const [cat, kws] of CATEGORY_RULES) {
    if (kws.some((k) => hasWord(t, k))) return cat;
  }
  return DEFAULT_CATEGORY;
}

async function backfill(table) {
  const rows = await sql.query(
    `SELECT id, name, description FROM "${table}" WHERE category = 'PROCUREMENT_CONTRACT'`,
  );
  const buckets = {};
  for (const r of rows) {
    const cat = inferCategory(`${r.name} ${stripHtml(r.description)}`);
    (buckets[cat] ??= []).push(r.id);
  }

  console.log(`\n${table}: ${rows.length} PROCUREMENT_CONTRACT row(s)`);
  for (const [cat, ids] of Object.entries(buckets).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  -> ${cat.padEnd(22)} ${ids.length}`);
  }

  if (commit) {
    for (const [cat, ids] of Object.entries(buckets)) {
      await sql.query(`UPDATE "${table}" SET category = $1::"Category" WHERE id = ANY($2)`, [cat, ids]);
    }
    console.log(`  committed ${rows.length} update(s).`);
  }
  return rows.length;
}

try {
  console.log(commit ? "=== COMMIT MODE ===" : "=== DRY RUN (pass --commit to write) ===");
  const m = await backfill("Milestone");
  const p = await backfill("Program");
  console.log(`\nTotal: ${m + p} row(s) ${commit ? "updated" : "would be updated"}.`);
  if (!commit) console.log("No changes written. Re-run with --commit to apply.");
} catch (e) {
  console.error("backfill failed:", e.message);
  process.exit(1);
}

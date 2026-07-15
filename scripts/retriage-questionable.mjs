#!/usr/bin/env node
/**
 * One-time re-triage: move clearly-non-milestone items that were auto-approved
 * (video/podcast promos, competition-result announcements, a celebrity visit)
 * back to PENDING so an admin can decide. These slipped through because a
 * registry alias matched incidental body text, or the news rubric over-approved
 * a promo. See the issue write-up; "targeted only" per the product owner.
 *
 * USAGE:
 *   set -a && source .env.vercel.local && set +a
 *   node scripts/retriage-questionable.mjs           # dry-run (prints plan)
 *   node scripts/retriage-questionable.mjs --apply    # perform the update
 */
import { neon } from "@neondatabase/serverless";

const IDS = [
  "cmrmdp4uf002r12487ordaek0", // VIDEO: A New Generation of AI Assistants
  "cmrmdp4ko001v1248hh5iirk7", // Video: Researchers Develop Missing LINC…
  "cmrmdp4vp002z1248k1v8bhwn", // Voices from DARPA Podcast Episode 61: Manta Ray
  "cmrmdp6qp00ad1248axv27pqt", // DARPA Celebrates Cyber Grand Challenge Winners
  "cmrmdp5n000661248on8eloac", // Teams CoSTAR and BARCS Take Top Spots (Subterranean Challenge)
  "cmrm9gg1y003ljf9ygpwamiik", // 'Night Agent' Star Basso visits Fort Polk
];
const REASON =
  "manual-retriage: promo/competition/visit — not an AI-adoption milestone (moved to PENDING for review)";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("No DIRECT_URL/DATABASE_URL. Run: set -a && source .env.vercel.local && set +a");
  process.exit(1);
}
const sql = neon(url);
const apply = process.argv.includes("--apply");

const rows = await sql`
  select id, "entryStatus", "sourceName", name from "Milestone" where id = any(${IDS})`;
console.log(`Matched ${rows.length}/${IDS.length} rows:`);
for (const r of rows) console.log(`  [${r.entryStatus}] ${r.sourceName} — ${r.name}`);

if (!apply) {
  console.log("\n(dry-run) pass --apply to set these to PENDING.");
  process.exit(0);
}

const res = await sql`
  update "Milestone"
  set "entryStatus" = 'PENDING', "verifyReason" = ${REASON}
  where id = any(${IDS}) and "entryStatus" = 'APPROVED'
  returning id`;
console.log(`\nUpdated ${res.length} row(s) → PENDING.`);

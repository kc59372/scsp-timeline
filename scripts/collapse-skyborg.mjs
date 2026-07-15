#!/usr/bin/env node
/**
 * One-time cleanup: the Skyborg (SPEAD) program has 14 near-identical sub-$5K
 * "kick-off meeting" award line items (2020) that clutter the lifecycle. Collapse
 * them into ONE representative "initial vendor kick-off awards" event (keeping the
 * earliest row, deleting the other 13). The substantial follow-on awards
 * (Kratos $37.77M, General Atomics $15.72M, Boeing $5.04M, Lockheed $799K VISTA)
 * and the X-62A VISTA news event are left untouched as separate events.
 *
 * USAGE:
 *   set -a && source .env.vercel.local && set +a
 *   node scripts/collapse-skyborg.mjs           # dry-run
 *   node scripts/collapse-skyborg.mjs --apply
 */
import { neon } from "@neondatabase/serverless";

// The 14 tiny SPEAD kick-off awards. The first is repurposed as the summary
// event; the rest are deleted.
const KEEPER = "cmrm9gfbp000xjf9yxfj1gw76"; // Boeing FA869420F0401, 2020-07-23
const COLLAPSE = [
  KEEPER,
  "cmrm9gfar000tjf9y4r8r2yg2", // Sierra Technical Services
  "cmrm9gfb7000vjf9y61uwcfjg", // Wichita State University
  "cmrm9gfc8000zjf9ybektz13h", // AeroVironment
  "cmrm9gfcs0011jf9yjehm5grp", // Kratos
  "cmrm9gfd90013jf9y8kho4wwa", // Northrop Grumman
  "cmrm9gfdp0015jf9y2cwghv9q", // NextGen Aeronautics
  "cmrm9gfe40017jf9ytcu6o4vv", // General Atomics
  "cmrm9gfej0019jf9y0ufd720g", // Lockheed Martin
  "cmrm9gfez001bjf9y6y7kkst5", // BAE Systems
  "cmrm9gffi001djf9yxznf49oy", // Blue Force Technologies
  "cmrm9gffy001fjf9y6w520mt7", // Voly Defense Solutions
  "cmrm9gfgd001hjf9ybyx09wpt", // Autonodyne
  "cmrm9gfgt001jjf9yb8q0k2i5", // Fregata Systems
];
const DELETE = COLLAPSE.filter((id) => id !== KEEPER);

const SUMMARY_NAME = "Skyborg SPEAD — initial vendor kick-off awards (14 companies)";
const SUMMARY_DESC =
  "Fourteen initial Skyborg Prototyping, Experimentation & Autonomy Development (SPEAD) " +
  "kick-off awards (~$4K each, 2020) covering: Boeing, Kratos, Northrop Grumman, General Atomics, " +
  "AeroVironment, Lockheed Martin, BAE Systems, Sierra Technical Services, Wichita State University, " +
  "NextGen Aeronautics, Blue Force Technologies, Voly Defense Solutions, Autonodyne, and Fregata Systems. " +
  "Substantial follow-on SPEAD awards are tracked as separate events.";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("No DIRECT_URL/DATABASE_URL. Run: set -a && source .env.vercel.local && set +a");
  process.exit(1);
}
const sql = neon(url);
const apply = process.argv.includes("--apply");

const rows = await sql`
  select id, "contractNumber" cn, "contractValue" cv, "awardedTo"
  from "Milestone" where id = any(${COLLAPSE})`;
if (rows.length !== COLLAPSE.length) {
  console.error(`Expected ${COLLAPSE.length} rows, found ${rows.length}. Aborting (data changed?).`);
  process.exit(1);
}
const total = rows.reduce((s, r) => s + (r.cv ?? 0), 0);
console.log(`Collapsing ${COLLAPSE.length} kick-off awards (sum $${total.toLocaleString()}) into 1 event.`);
console.log(`Keeper: ${KEEPER}\nDeleting ${DELETE.length} rows.`);
console.log(`New value on summary event: $${total.toLocaleString()}`);

if (!apply) {
  console.log("\n(dry-run) pass --apply to perform the collapse.");
  process.exit(0);
}

// Repurpose the keeper as the summary event.
await sql`
  update "Milestone" set
    name = ${SUMMARY_NAME},
    description = ${SUMMARY_DESC},
    "contractNumber" = null,
    "contractValue" = ${total},
    "awardedTo" = null,
    "eventType" = 'AWARD',
    "eventDate" = '2020-07-23'
  where id = ${KEEPER}`;

// Delete the other 13 (no tag/FK refs — verified beforehand).
const del = await sql`delete from "Milestone" where id = any(${DELETE}) returning id`;
console.log(`\nRewrote keeper + deleted ${del.length} row(s).`);

#!/usr/bin/env node
/**
 * One-time re-triage: apply the new "non-milestone framing" gate (lib/verify.ts
 * isNonMilestoneFraming) to already-APPROVED news items. Anything whose title
 * reads as a visit / media package / ceremony / competition result — not a
 * deployment/testing/award milestone — drops to PENDING for a human. Procurement
 * awards are left alone (their titles are contract descriptions, not framing).
 * The framing lists below MIRROR lib/verify.ts — keep them in sync.
 *
 * USAGE:
 *   set -a && source .env.vercel.local && set +a
 *   node scripts/retriage-framing.mjs           # dry-run (lists matches)
 *   node scripts/retriage-framing.mjs --apply
 */
import { neon } from "@neondatabase/serverless";

const NON_MILESTONE_PHRASES = [
  "video:", "audio:", "watch:", "photos:", "gallery:", "b-roll", "photo essay",
  "image gallery", "in photos", "livestream", "live stream", "voices from",
  "star of", "meet-and-greet", "meet and greet",
  "ribbon-cutting", "ribbon cutting", "change of command", "retirement ceremony",
  "hall of fame", "distinguished visitor", "guest speaker", "award ceremony",
  "commander's call", "town hall",
  "challenge winners", "take top spots", "top spots", "announces winners",
  "winners of",
];
const NON_MILESTONE_WORDS = [
  "visits", "visit", "tours", "celebrates", "celebrating", "podcast", "episode",
  "actor", "actress", "celebrity", "netflix", "hollywood", "autograph", "uso",
  "graduation", "commencement",
];
const hasWord = (t, k) =>
  new RegExp(`(?<!\\w)${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\w)`).test(t);
function isNonMilestoneFraming(title) {
  const t = (title ?? "").toLowerCase();
  if (NON_MILESTONE_PHRASES.some((p) => t.includes(p))) return true;
  return NON_MILESTONE_WORDS.some((w) => hasWord(t, w));
}

const REASON =
  "framing-retriage: title reads as a visit/media/ceremony/competition — not a deployment/testing milestone (moved to PENDING)";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("No DIRECT_URL/DATABASE_URL. Run: set -a && source .env.vercel.local && set +a");
  process.exit(1);
}
const sql = neon(url);
const apply = process.argv.includes("--apply");

// Only news/RSS items — skip procurement contracts (their names are contract
// descriptions, and framing words there would be coincidental).
const rows = await sql`
  select id, name, "sourceName" from "Milestone"
  where "entryStatus" = 'APPROVED' and category <> 'PROCUREMENT_CONTRACT'`;
const hits = rows.filter((r) => isNonMilestoneFraming(r.name));

console.log(`Scanned ${rows.length} approved non-procurement items; ${hits.length} trip framing:`);
for (const h of hits) console.log(`  [${h.sourceName}] ${h.name}`);

if (!apply) {
  console.log("\n(dry-run) pass --apply to move these to PENDING.");
  process.exit(0);
}

const ids = hits.map((h) => h.id);
const res = ids.length
  ? await sql`update "Milestone" set "entryStatus"='PENDING', "verifyReason"=${REASON}
              where id = any(${ids}) and "entryStatus"='APPROVED' returning id`
  : [];
console.log(`\nMoved ${res.length} item(s) → PENDING.`);

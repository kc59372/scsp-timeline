#!/usr/bin/env node
/**
 * One-time backfill: strip HTML/links and decode HTML entities in every stored
 * Milestone.description (and Program.description). Going forward the ingest
 * route cleans on write (lib/ingest.ts → lib/clean.ts); this fixes rows ingested
 * before that. The cleaning logic below MIRRORS lib/clean.ts — keep them in sync.
 *
 * USAGE:
 *   set -a && source .env.vercel.local && set +a
 *   node scripts/clean-descriptions.mjs            # dry-run (counts + samples)
 *   node scripts/clean-descriptions.mjs --apply     # perform the updates
 */
import { neon } from "@neondatabase/serverless";

// ── cleaning (mirror of lib/clean.ts) ────────────────────────────────────────
const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…", eacute: "é",
  egrave: "è", agrave: "à", ccedil: "ç", ouml: "ö",
  uuml: "ü", auml: "ä", deg: "°", frac12: "½",
  trade: "™", reg: "®", copy: "©", bull: "•",
  middot: "·", euro: "€", pound: "£", cent: "¢",
  times: "×", hyphen: "-", ensp: " ", emsp: " ", thinsp: " ",
};
function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}
function cleanText(input) {
  if (!input) return "";
  let s = input;
  s = s.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " ");
  s = s.replace(/<img\b[^>]*>/gi, " ");
  s = s.replace(/<(?:br|p|div|li|ul|ol|tr|td|h[1-6])\b[^>]*>/gi, " ");
  s = s.replace(/<\/(?:p|div|li|ul|ol|tr|td|h[1-6])>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  s = s.replace(/\bhttps?:\/\/\S+/gi, " ");
  s = s.replace(/\bwww\.\S+/gi, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// ── migration ────────────────────────────────────────────────────────────────
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("No DIRECT_URL/DATABASE_URL. Run: set -a && source .env.vercel.local && set +a");
  process.exit(1);
}
const sql = neon(url);
const apply = process.argv.includes("--apply");

async function cleanTable(table) {
  const rows = await sql.query(`select id, description from "${table}" where description is not null`);
  const changed = [];
  for (const r of rows) {
    const cleaned = cleanText(r.description);
    if (cleaned !== r.description) changed.push({ id: r.id, before: r.description, after: cleaned });
  }
  console.log(`\n=== ${table}: ${changed.length}/${rows.length} rows need cleaning ===`);
  for (const c of changed.slice(0, 3)) {
    console.log(`  - ${c.id}`);
    console.log(`    before: ${c.before.slice(0, 90).replace(/\n/g, " ")}`);
    console.log(`    after : ${c.after.slice(0, 90)}`);
  }
  if (apply) {
    for (const c of changed) {
      await sql.query(`update "${table}" set description = $1 where id = $2`, [c.after, c.id]);
    }
    console.log(`  applied ${changed.length} update(s).`);
  }
  return changed.length;
}

const m = await cleanTable("Milestone");
const p = await cleanTable("Program");
console.log(`\nTotal rows ${apply ? "updated" : "needing update"}: ${m + p}`);
if (!apply) console.log("(dry-run) pass --apply to write.");

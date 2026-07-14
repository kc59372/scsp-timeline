#!/usr/bin/env node
/**
 * query-neon.mjs — run read-only SQL against the Neon production DB over HTTPS.
 *
 * WHY THIS EXISTS: many sandboxed/dev networks reset the TLS handshake on the
 * raw Postgres port (5432), so `psql`, `prisma`, and `pg` all fail with
 * "connection closed" / ECONNRESET even though `nc host 5432` reports the TCP
 * port open. HTTPS (443) is not blocked, and Neon's serverless driver runs
 * queries over 443 — so this works where the Postgres wire protocol does not.
 * See docs/QUERYING_NEON.md for the full story.
 *
 * USAGE (always load the Neon creds first):
 *   set -a && source .env.vercel.local && set +a
 *   node scripts/query-neon.mjs "select count(*) from \"Milestone\""
 *   node scripts/query-neon.mjs --file path/to/query.sql
 *   node scripts/query-neon.mjs --report            # canned status summary
 *
 * ENV: reads DIRECT_URL (preferred) or DATABASE_URL. The HTTP driver needs the
 * DIRECT (non-pooler) endpoint. Keep this READ-ONLY — it's a diagnostic tool.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("No DIRECT_URL/DATABASE_URL set. Run: set -a && source .env.vercel.local && set +a");
  process.exit(1);
}
const sql = neon(url);

const args = process.argv.slice(2);

async function report() {
  const status = await sql`select "entryStatus", count(*)::int as n from "Milestone" group by 1 order by n desc`;
  console.log("=== Milestone by entryStatus ===");
  for (const r of status) console.log(`${r.entryStatus.padEnd(9)} ${r.n}`);

  const span = await sql`select to_char(min("createdAt"),'YYYY-MM-DD HH24:MI') as earliest,
    to_char(max("createdAt"),'YYYY-MM-DD HH24:MI') as latest, count(*)::int as n from "Milestone"`;
  console.log(`\ncreatedAt span: ${span[0].earliest} → ${span[0].latest} (${span[0].n} rows)`);

  const recent = await sql`select to_char("createdAt",'MM-DD HH24:MI') as ts, "entryStatus",
    coalesce("sourceName",'?') as src, "name", "verifyReason"
    from "Milestone" order by "createdAt" desc limit 15`;
  console.log("\n=== 15 most recently created ===");
  for (const m of recent) {
    console.log(`[${m.ts}] ${(m.entryStatus || "").padEnd(9)} ${m.src.slice(0, 16).padEnd(16)} ${(m.name || "").slice(0, 48)}`);
    if (m.verifyReason) console.log(`           ${m.verifyReason.slice(0, 90)}`);
  }
}

async function runRaw(query) {
  // neon() tagged-template also exposes .query(text) for a plain string.
  const rows = await sql.query(query);
  console.log(JSON.stringify(rows, null, 2));
}

try {
  if (args.length === 0 || args[0] === "--report") {
    await report();
  } else if (args[0] === "--file") {
    await runRaw(readFileSync(args[1], "utf8"));
  } else {
    await runRaw(args.join(" "));
  }
} catch (e) {
  console.error("query failed:", e.message);
  process.exit(1);
}

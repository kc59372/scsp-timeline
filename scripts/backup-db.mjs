#!/usr/bin/env node
/**
 * backup-db.mjs — snapshot the Neon production DB to a git-friendly JSON file.
 *
 * WHY JSON (not pg_dump): sandboxed/dev networks reset the TLS handshake on the
 * raw Postgres port (5432), so pg_dump/psql fail here (see scripts/query-neon.mjs
 * and docs/QUERYING_NEON.md). Neon's serverless driver runs over HTTPS (443),
 * which works. The data is public .mil/.gov timeline content, so a committed
 * JSON snapshot is fine (repo policy only blocks raw *.sql.gz dumps).
 *
 * USAGE (load Neon creds first):
 *   set -a && source .env.vercel.local && set +a
 *   node scripts/backup-db.mjs                 # -> backups/db-backup-latest.json (+ timestamped copy)
 *   node scripts/backup-db.mjs --no-timestamp  # only overwrite the latest file
 *
 * Reads DIRECT_URL (preferred) or DATABASE_URL. Read-only.
 * Restore: feed the arrays back through Prisma / a seed importer.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("No DIRECT_URL/DATABASE_URL set. Run: set -a && source .env.vercel.local && set +a");
  process.exit(1);
}
const sql = neon(url);
const withTimestamp = !process.argv.includes("--no-timestamp");

const OUT_DIR = "backups";

async function main() {
  // Discover every user table in the public schema (incl. Prisma implicit
  // join tables like _MilestoneToTag and the _prisma_migrations ledger).
  const tables = (
    await sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name`
  ).map((r) => r.table_name);

  const data = {};
  const counts = {};
  for (const t of tables) {
    // Identifier can't be parameterized; quote it to preserve case.
    const rows = await sql.query(`select * from "${t}"`);
    data[t] = rows;
    counts[t] = rows.length;
    console.log(`  ${t.padEnd(24)} ${rows.length} rows`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const snapshot = {
    exportedAt: new Date().toISOString(),
    source: url.replace(/:\/\/[^@]*@/, "://<redacted>@"), // strip credentials
    tableCounts: counts,
    tables: data,
  };
  const json = JSON.stringify(snapshot, null, 2);

  mkdirSync(OUT_DIR, { recursive: true });
  const latest = join(OUT_DIR, "db-backup-latest.json");
  writeFileSync(latest, json);
  console.log(`\nWrote ${latest} (${(json.length / 1024).toFixed(0)} KB)`);
  if (withTimestamp) {
    const dated = join(OUT_DIR, `db-backup-${stamp}.json`);
    writeFileSync(dated, json);
    console.log(`Wrote ${dated}`);
  }
}

main().catch((e) => {
  console.error("backup failed:", e.message);
  process.exit(1);
});

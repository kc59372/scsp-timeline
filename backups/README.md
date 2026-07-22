# Database backups

Git-friendly JSON snapshots of the Neon production database (public .mil/.gov
timeline data — no PII, no user accounts, so it's safe to commit).

## Why JSON instead of `pg_dump`

Sandboxed/dev networks reset the TLS handshake on the raw Postgres port (5432),
so `pg_dump`/`psql`/`prisma` fail here with `ECONNRESET`. Neon's serverless
driver runs over HTTPS (443), which works — so the backup script talks to the DB
the same way [`scripts/query-neon.mjs`](../scripts/query-neon.mjs) does. See
[`docs/QUERYING_NEON.md`](../docs/QUERYING_NEON.md) for the full story.

> Note: the repo's `.gitignore` blocks raw `*.sql.gz` dumps by policy. These JSON
> snapshots are intentionally not caught by that rule and are fine to commit.

## Files

- `db-backup-latest.json` — rolling "latest" snapshot, overwritten each run.
- `db-backup-<ISO-timestamp>.json` — timestamped copies (one per run unless
  `--no-timestamp` is passed).

## Format

```jsonc
{
  "exportedAt": "2026-07-22T13:35:33.000Z",
  "source": "postgres://<redacted>@...neon.tech/...",  // credentials stripped
  "tableCounts": { "Milestone": 1137, "Program": 17, "Tag": 0, ... },
  "tables": {
    "Milestone":          [ { ...row }, ... ],
    "Program":            [ ... ],
    "Tag":                [ ... ],
    "_MilestoneToTag":    [ ... ],   // Prisma implicit join table
    "_prisma_migrations": [ ... ]    // migration ledger
  }
}
```

Every `public`-schema table is captured, including the Prisma implicit join
table and the migration ledger, so the snapshot is a complete point-in-time copy.

## Creating a backup

```bash
set -a && source .env.vercel.local && set +a   # load Neon creds (DIRECT_URL)
node scripts/backup-db.mjs                       # -> latest + timestamped copy
node scripts/backup-db.mjs --no-timestamp        # -> overwrite latest only
```

The script is read-only. It reads `DIRECT_URL` (preferred) or `DATABASE_URL`.

## Restoring

There's no automated importer yet. To restore, load a snapshot and write the
arrays back through Prisma. Restore parents before children so foreign keys
resolve: **Program → Milestone → Tag → `_MilestoneToTag`**. Sketch:

```js
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const { tables } = JSON.parse(readFileSync("backups/db-backup-latest.json", "utf8"));

await prisma.program.createMany({ data: tables.Program, skipDuplicates: true });
await prisma.milestone.createMany({ data: tables.Milestone, skipDuplicates: true });
// Tag + _MilestoneToTag relations if/when populated.
```

Restoring into a non-empty database can collide on unique keys (`Program.slug`,
the Milestone dedup hash). Restore into a fresh/empty DB, or reconcile first.
Skip `_prisma_migrations` unless you're rebuilding the schema too — run
`prisma migrate deploy` for that instead.

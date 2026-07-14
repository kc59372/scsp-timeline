# Querying the Neon production database

## TL;DR

The raw Postgres port (**5432**) is unreachable from many dev/sandboxed
networks — the TLS handshake gets reset even though the TCP port looks open — so
`psql`, `prisma`, and the `pg` driver all fail. **Query over HTTPS (443)
instead**, using Neon's serverless driver:

```bash
set -a && source .env.vercel.local && set +a      # load DIRECT_URL / DATABASE_URL
node scripts/query-neon.mjs --report               # canned status summary
node scripts/query-neon.mjs "select count(*) from \"Milestone\""
node scripts/query-neon.mjs --file some/query.sql
```

If `@neondatabase/serverless` isn't installed:
`npm install @neondatabase/serverless --no-save`.

## Why the normal path fails

Symptom, seen with every Postgres-wire client:

```
# prisma / pg
Error opening a TLS connection: connection closed via error
Error: read ECONNRESET   (during the TLS handshake)
```

...yet the TCP port reports open:

```
$ nc -z neon-host 5432   →   succeeded!
```

TCP connects, but the TLS handshake on 5432 is reset by the network path (not by
Neon, and not by the Claude sandbox — it reproduces with the sandbox disabled).
HTTPS on **443 is not blocked** (e.g. `curl https://scsp-timeline.vercel.app`
returns 200), and Neon's serverless driver tunnels SQL over 443 — so it works
where the wire protocol does not.

## Connection details

- Credentials live in **`.env.vercel.local`** (git-ignored): `DIRECT_URL`,
  `DATABASE_URL`, plus `INGEST_TOKEN`, admin creds, etc.
- The **HTTP driver needs `DIRECT_URL`** (the non-pooler endpoint,
  `ep-...c-9.us-east-1.aws.neon.tech`, *without* `-pooler`). `query-neon.mjs`
  prefers `DIRECT_URL` and falls back to `DATABASE_URL`.
- `.env` → local Docker Postgres (`localhost:5432`); `.env.production` → the old
  docker-compose host (`db:5432`). **Neither is Neon** — always use
  `.env.vercel.local` for prod.

## Alternatives (when even 443-to-Neon is blocked)

- **Deployed API over HTTPS** — `GET https://scsp-timeline.vercel.app/api/milestones`
  returns APPROVED rows publicly. `?status=PENDING|REJECTED|all` works but is
  admin-session-gated (needs the plaintext admin password, not just the hash).

## Reading `verifyReason` vs `entryStatus` (gotcha)

`verifyReason` records the **verifier's original ingest-time verdict** (e.g.
`rule-relevant: AI/autonomy keyword relevance`, which maps to PENDING). It is
**not** rewritten when an admin later approves/rejects the row. So a `REJECTED`
row can legitimately show a `rule-relevant`/PENDING-style reason — that means
"the verifier queued it, then a human changed the status." To tell an
ingest-time decision from a later human one, compare `updatedAt` to `createdAt`
(a bulk admin action shows many rows sharing one `updatedAt` minute).

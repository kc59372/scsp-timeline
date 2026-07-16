# US Military AI Adoption Timeline

An interactive tracker of US military AI adoption for policymakers and
developers. It surfaces military AI milestones — procurement contracts, fielded
systems, policy directives, and technology developments — as **program lifecycle
tracks** (request → award → test → fielding → deployment), with category
filtering and an adoption-velocity view.

**Scope:** 2016–2026, US-focused. **Sources:** official **.mil / .gov** and
public-domain DoD media only. **Live:** https://scsp-timeline.vercel.app.

---

## Design

The core idea is that a system's adoption is a **lifecycle**, not a single
event:

- A **`Program`** is a system or initiative (e.g. *Maven Smart System*).
- A **`Milestone`** is one dated **event** in that program's lifecycle, tagged
  with an **`EventType`** (`RD_START → SOLICITATION → AWARD → TEST → FIELDING →
  DEPLOYMENT`, plus `POLICY` / `OTHER`).
- A program's `systemStatus` is derived from its furthest-along event.
- Events auto-link into a program when a scraper is confident (via a stable
  `programSlug`); looser matches land ungrouped for an admin to **merge**.

The public timeline renders each program as one lifecycle track and standalone
events as individual cards. `/program/[id]` shows the full adoption profile;
`/system/[id]` shows a single event. Milestones are color-coded by mission
domain (`Category`) — palette in [docs/CATEGORY_COLORS.md](./docs/CATEGORY_COLORS.md),
source of truth [`lib/categories.ts`](./lib/categories.ts). An
**adoption-velocity** chart plots milestones per year to convey how fast
adoption is accelerating.

## Methods (data ingestion)

All sources are official **.mil / .gov** or public-domain DoD media — commercial
news feeds are excluded to avoid copyright issues.

| Source | Reach |
|---|---|
| **SAM.gov** — solicitations + awards | 2016→present (chunked ≤1yr/call) |
| **USAspending.gov** — DoD contract awards | 2016→present |
| **DVIDS** — DoD news / press releases | 2016→present |
| **Congress.gov** — AI legislation | recent (title search) |
| **SBIR.gov** — DoD SBIR/STTR AI awards | historical |
| **af / army / navy / spaceforce / darpa / defense / gao** (RSS) | recent (~1yr) |

Scraped items flow through a **verification gate** ([`lib/verify.ts`](./lib/verify.ts))
that sets each entry's review status instead of blanket-queuing everything:
entries naming a curated program auto-approve, news is triaged (approve /
review / reject) against a curated rubric, and clearly-irrelevant items are
auto-rejected. Nothing publishes without clearing that gate. Full per-source
notes: **[scrapers/README.md](./scrapers/README.md)**.

## Development

- **Frontend:** Next.js 14 (App Router) + React 18 + Tailwind CSS + TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Auth (admin):** NextAuth.js — a single shared team credential
- **Scrapers:** Python 3 (`urllib` + `feedparser`) — see [`scrapers/`](./scrapers/)
- **Hosting:** Vercel + Neon Postgres; daily scrape via GitHub Actions

### Quick start

```bash
npm install
cp .env.example .env          # defaults match the local Docker Postgres below
docker compose up -d          # local Postgres 16 on :5432
npx prisma migrate dev        # apply schema
npx prisma db seed            # load verified US seed data (idempotent, resets tables)
npm run dev                   # http://localhost:3000
```

Common commands: `npm run db:studio` (DB browser), `npm run db:reset` (drop +
migrate + seed), `npm run build` (production build).

To run the scrapers locally:

```bash
python3 -m venv scrapers/.venv
scrapers/.venv/bin/pip install -r scrapers/requirements.txt
set -a; source .env; set +a
scrapers/.venv/bin/python scrapers/backfill.py --fixtures --dry-run  # offline smoke test
scrapers/.venv/bin/python scrapers/backfill.py --limit 200           # live → /api/ingest
```

### Admin

The review queue lives at `/admin` (auth-gated). Scraped entries arrive as
`PENDING` and never appear publicly until approved. Reviewers can approve/reject
(individually or in bulk), edit any field, and merge events into a program to
build a lifecycle. Auth is one shared credential for the whole team
(`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`); generate the hash with
`scripts/hash_password.ts`.

## Deployment

Live on **Vercel + Neon Postgres**; scrapers run daily via GitHub Actions and
POST to a token-protected `/api/ingest`. A shared review queue means one
deployment + one database — teammates use the same URL and shared admin login.
Full runbook: **[DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md)**. A Docker Compose stack
(`docker-compose.prod.yml`) remains in-repo as a self-host fallback.

## Data

Seed data lives in [`prisma/seed.ts`](./prisma/seed.ts), drawn from the team's
verified research. **No fabricated data** — unknown fields are left null. The
seeded set (3 program lifecycles + contracts + policy directives) is the
baseline; the scrapers grow it from live sources.

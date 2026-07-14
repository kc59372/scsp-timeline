# US Military AI Adoption Timeline

A US military AI adoption tracker for policymakers and developers. It surfaces
military AI milestones — procurement contracts, fielded systems, policy
directives, and technology developments — as **program lifecycle tracks**
(request → award → test → fielding → deployment), with filtering and an
adoption-velocity view. Scope: **2016–2026, US-focused**, sourced only from
official **.mil / .gov** (and public-domain DoD) sources.

See [CLAUDE.md](./CLAUDE.md) for the full product spec, schema, and build
history. Visual design reference: [SCSP Space Race](https://www.scsp.ai/space-race/).

## Status

| Phase | Scope | State |
|---|---|---|
| 1 — Foundation | Next.js + Prisma scaffold, Docker Postgres | ✅ Done |
| 2 — Seed Data | US systems, contracts, policy directives | ✅ Done |
| 3 — Scrapers | `.mil`/`.gov`-only ingestion roster + backfill | ✅ Done |
| 4 — Frontend | Timeline, program tracks, filters, velocity chart | ✅ Done |
| 5 — Admin | Review queue, merge-by-program, edit, auth, API | ✅ Done |
| 6 — Deploy | Docker self-host + scheduled scraping | ✅ Done |
| + | **Program lifecycle model** (events grouped into programs) | ✅ Done |
| + | **Historical backfill** to 2016 (SAM.gov, USAspending, DVIDS) | ✅ Done |

The previous static-HTML prototype is archived under [`legacy/`](./legacy/).

## Data model: programs & lifecycle events

The core idea is that a system's adoption is a **lifecycle**, not a single
event. So:

- A **`Program`** is a system/initiative (e.g. *Maven Smart System*).
- A **`Milestone`** is a single dated **event** in that program's lifecycle,
  tagged with an **`EventType`** (`RD_START → SOLICITATION → AWARD → TEST →
  FIELDING → DEPLOYMENT`, plus `POLICY`/`OTHER`).
- Scrapers assign a stable `programSlug` so events auto-link into a program when
  confident (SAM.gov/USAspending); looser matches land **ungrouped** and an
  admin **merges** them into the right program from the review queue.
- A program's `systemStatus` is derived from its furthest-along event.

Standalone events (no program) still render as individual cards. The public
timeline renders each program as one lifecycle track; `/program/[id]` shows the
full adoption profile.

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + React 18 + Tailwind CSS + TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Auth (admin):** NextAuth.js — a single shared credential (see below)
- **Scrapers:** Python 3 (`urllib` + `feedparser`) — see [`scrapers/`](./scrapers/)
- **Local DB / deploy:** Docker Compose (Postgres 16; prod stack adds the web app)

## Data ingestion (scrapers)

All sources are official **.mil / .gov** or public-domain DoD media — commercial
news feeds were removed to avoid copyright issues. Everything scraped lands as
`PENDING` for admin review; nothing auto-publishes.

| Source | Reach | Key? |
|---|---|---|
| **SAM.gov** — solicitations + awards | 2016→present (chunked ≤1yr/call) | free key |
| **USAspending.gov** — DoD contract awards | 2016→present | none |
| **DVIDS** — DoD news / press releases | 2016→present (historical) | free public key |
| **Congress.gov** — AI legislation | recent (title search) | free key |
| **SBIR.gov** — DoD SBIR/STTR AI awards | historical | none (rate-limited) |
| **af / army / navy / spaceforce / darpa / defense / gao** (RSS) | recent (~last ~1yr at `max=500`) | none |

`scrapers/backfill.py` runs the whole roster in one pass. Full setup, per-source
notes, and the historical-data rationale live in
**[`scrapers/README.md`](./scrapers/README.md)**.

## Deployment

**Live on Vercel + Neon Postgres: https://scsp-timeline.vercel.app.** Scrapers
run on a schedule via GitHub Actions (or locally); `/api/ingest` is protected by
a shared `INGEST_TOKEN`. A **shared review queue = one deployment + one
database** — teammates access the same URL with the shared admin login.

News triage: the deployment has no `ANTHROPIC_API_KEY`, so the automated scrape
triages news with a deterministic keyword fallback. For higher-quality triage we
periodically **rerun the scraper locally with Claude Code as the triage engine**
(dry-run scrape → Claude classifies news via the `lib/verify.ts` 3-bucket rubric
→ ingest to Neon).

- **[DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md)** — the Vercel + Neon runbook (current).
- **[DEPLOY.md](./DEPLOY.md)** — the Docker self-host runbook (fallback).
- **[DEPLOY_WITH_CLAUDE.md](./DEPLOY_WITH_CLAUDE.md)** — a paste-able prompt to
  have Claude Code perform the Docker deploy on a host machine.

## Local Setup

### Prerequisites
- Node.js 18+ and npm
- **Docker Desktop** (for local Postgres) — https://www.docker.com/products/docker-desktop/
- Python 3.11+ (only if running scrapers locally)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
The default `DATABASE_URL` already matches the Docker Postgres below — no edits
needed for basic local dev. (Scraper API keys are optional; add them to `.env`
to run those scrapers locally.)

### 3. Start Postgres
```bash
docker compose up -d
```
Runs Postgres 16 on `localhost:5432` (db `scsp_timeline`, user `scsp`).

### 4. Apply the schema
```bash
npx prisma migrate dev
```

### 5. Seed the database
```bash
npx prisma db seed
```
Loads the verified US research data as **3 program lifecycle tracks** (Maven,
GenAI.mil, Manta Ray) plus standalone contracts and policy directives, and
prints counts. The seed is idempotent but **destructive** — re-running resets
the milestone + program tables.

### 6. Run the app
```bash
npm run dev
```
Open http://localhost:3000.

### 7. (Optional) Run the scrapers locally
```bash
python3 -m venv scrapers/.venv
scrapers/.venv/bin/pip install -r scrapers/requirements.txt
set -a; source .env; set +a                       # loads any API keys + INGEST_URL
scrapers/.venv/bin/python scrapers/backfill.py --fixtures --dry-run   # offline smoke test
scrapers/.venv/bin/python scrapers/backfill.py --limit 200            # live fetch → POST to /api/ingest
```

## Useful Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `docker compose up -d` | Start local Postgres |
| `docker compose down` | Stop Postgres (keeps data volume) |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio (DB browser) |
| `npm run db:reset` | Drop, re-migrate, and re-seed |
| `scrapers/.venv/bin/python scrapers/backfill.py --fixtures --dry-run` | Offline scraper smoke test |

## Admin Dashboard

The internal review queue lives at `/admin` (auth-gated). Scraped entries arrive
as `PENDING` and never appear publicly until an admin approves them. Reviewers
can approve/reject (individually or in bulk), edit any field, set an event's
type/date, and **merge selected events into a program** to build a lifecycle.

Auth is a **single shared credential** (one login for the whole team — not
per-user), set via env:

```bash
# 1. generate a bcrypt hash for your chosen password
npx ts-node scripts/hash_password.ts 'your-password'

# 2. set in .env
ADMIN_EMAIL="admin@scsp.ai"
ADMIN_PASSWORD_HASH="<paste hash>"
NEXTAUTH_SECRET="<openssl rand -base64 32>"
```

> **⚠️ bcrypt hashes contain `$` — escaping differs by environment:**
> - **Local shell `.env`** (this file): escape each `$` as `\$` (e.g. `\$2b\$10\$…`).
> - **docker-compose `env_file` (`.env.production`)**: escape each `$` as `$$` —
>   Compose interpolates `env_file` values, so an unescaped hash is silently
>   mangled and login fails. `scripts/hash_password.ts` prints the `$$`-escaped
>   form on stderr for convenience.

Then visit http://localhost:3000/admin and sign in.

## Data

Seed data lives in [`prisma/seed.ts`](./prisma/seed.ts), drawn from the team's
research (CLAUDE.md tables + `legacy/data.json`). **No fabricated data** —
unknown fields are left null.

Known gaps flagged by the seed run:
- **Procurement:** only the contracts listed in CLAUDE.md are seeded manually;
  the rest come from the SAM.gov / USAspending scrapers.
- **Policy:** several directives lack a source URL in the repo (`sourceUrl` =
  null). Sources must be added before entries go public.

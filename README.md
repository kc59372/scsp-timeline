# US Military AI Adoption Timeline

A US military AI adoption tracker for policymakers and developers. Surfaces
military AI milestones — procurement contracts, fielded systems, policy
directives, and technology developments — with filtering, comparison, and trend
analysis. Scope: 2016–2026, US-focused.

See [CLAUDE.md](./CLAUDE.md) for the full product spec, schema, and phased build
plan. Visual design reference: [SCSP Space Race](https://www.scsp.ai/space-race/).

## Status

| Phase | Scope | State |
|---|---|---|
| 1 — Foundation | Next.js + Prisma scaffold, Docker Postgres | ✅ Done |
| 2 — Seed Data | US systems, contracts, policy directives | ✅ Done |
| 3 — Scrapers | SAM.gov, defense news, af.mil | ⏳ Planned |
| 4 — Frontend | Timeline, filters, velocity chart | ⏳ Planned |
| 5 — Admin | Review queue, edit, auth, API | ✅ Done |
| 6 — Deploy | GitHub Actions, Vercel + Railway | ⏳ Planned |

The previous static-HTML prototype is archived under [`legacy/`](./legacy/).

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + React 18 + Tailwind CSS + TypeScript
- **Database:** PostgreSQL via Prisma ORM
- **Auth (admin):** NextAuth.js (added in Phase 5)
- **Local DB:** Docker Compose (Postgres 16)

## Local Setup

### Prerequisites

- Node.js 18+ and npm
- **Docker Desktop** (for local Postgres) — https://www.docker.com/products/docker-desktop/

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

The default `DATABASE_URL` in `.env.example` already matches the Docker
Postgres credentials below, so no edits are needed for local dev.

### 3. Start Postgres

```bash
docker compose up -d
```

This runs Postgres 16 on `localhost:5432` (db `scsp_timeline`, user `scsp`).

### 4. Apply the schema

```bash
npx prisma migrate dev --name init
```

(Generates the Prisma client and applies migrations under `prisma/migrations/`.)

### 5. Seed the database

```bash
npx prisma db seed
```

Loads the verified US research data and prints milestone counts by category.
The seed is idempotent — re-running it resets and reloads the milestone table.

### 6. Run the app

```bash
npm run dev
```

Open http://localhost:3000.

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

## Admin Dashboard

The internal review queue lives at `/admin` (auth-gated). Scraped entries arrive
as `PENDING` and never appear publicly until an admin approves them.

Set up the shared admin credential in `.env`:

```bash
# 1. generate a bcrypt hash for your chosen password
npx ts-node scripts/hash_password.ts 'your-password'

# 2. set in .env
ADMIN_EMAIL="admin@scsp.ai"
ADMIN_PASSWORD_HASH="<paste hash>"
NEXTAUTH_SECRET="<random secret, e.g. openssl rand -base64 32>"
```

> **Note:** bcrypt hashes contain `$` (e.g. `$2b$10$…`). In a local `.env`,
> Next.js expands `$`, which corrupts the hash — escape each one as `\$2b\$10\$…`.
> On hosting platforms (Vercel, etc.) env vars are set verbatim — no escaping.

Then visit http://localhost:3000/admin and sign in. From the queue you can
approve / reject (individually or in bulk) and edit any field before approving.

## Data

Seed data lives in [`prisma/seed.ts`](./prisma/seed.ts), drawn from the team's
research (CLAUDE.md tables + `legacy/data.json`). **No fabricated data** —
unknown fields are left null.

Known gaps flagged by the seed run:
- **Procurement:** only the 5 contracts listed in CLAUDE.md are seeded. The full
  procurement spreadsheet is not in the repo.
- **Policy:** several directives lack a source URL in the repo (`sourceUrl` =
  null). Sources must be added before entries go public.

## Data Sources (Phase 3 targets)

SAM.gov (procurement), af.mil/News, Breaking Defense / DefenseScoop / C4ISRNET
(defense news RSS), DARPA.mil, Congress.gov.

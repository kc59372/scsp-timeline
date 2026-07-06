# Deployment Runbook

Self-host the SCSP Military AI Timeline with Docker (host-agnostic — VPS, Fly,
a bare server, etc.). The stack is the Next.js app + Postgres, plus a scheduled
scraper that feeds the review queue.

## Prerequisites
- A host with Docker + Docker Compose.
- A domain (optional but recommended) with TLS terminated by a reverse proxy
  (nginx/Caddy/Traefik) in front of the app on port 3000. TLS/DNS are out of
  scope here — terminate however you normally do.

## 1. Configure environment

```bash
cp .env.production.example .env.production
```

Fill in `.env.production`:
- `POSTGRES_PASSWORD` — a strong password.
- `DATABASE_URL` — must use host `db` and the same password, e.g.
  `postgresql://scsp:<password>@db:5432/scsp_timeline?schema=public`
- `NEXT_PUBLIC_SITE_URL` and `NEXTAUTH_URL` — your public URL (e.g. `https://timeline.example.org`).
- `NEXTAUTH_SECRET` — `openssl rand -base64 32`.
- `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` — generate the hash:
  `npx ts-node scripts/hash_password.ts '<password>'`
  ⚠️ **Escape every `$` in the hash as `$$`** — Docker Compose interpolates
  `env_file` values, so an unescaped bcrypt hash is mangled and login fails
  silently. The script prints the ready-to-paste `$$`-escaped form on stderr.
- `INGEST_TOKEN` — `openssl rand -hex 32`. **Required** so `/api/ingest` is not
  open to the public.

`.env.production` is gitignored — never commit it.

## 2. Build & start

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

On start, the web container runs `prisma migrate deploy` (via the entrypoint)
then launches the app. The DB has **no host port** (internal to the compose
network) so it won't clash with the dev compose.

Check it's up:
```bash
curl -f http://localhost:3000/api/milestones   # → {"items":[],...} until seeded
docker compose -f docker-compose.prod.yml logs -f web
```

## 3. Seed once (first deploy only)

Seeding is **destructive** (`prisma/seed.ts` clears the milestone table), so it
is NOT run automatically. Run it one time against the production DB:

```bash
docker compose -f docker-compose.prod.yml exec web npx prisma db seed
```

After this the public timeline at `/` and `/timeline` shows the curated seed
entries — 3 program lifecycle tracks (Maven, GenAI.mil, Manta Ray) plus the
standalone contracts and policy directives. Do **not** re-run seed after you've
approved scraped data — it clears the milestone + program tables and would wipe it.

## 4. Schedule the scrapers

Two options:

**A) GitHub Actions (recommended)** — [.github/workflows/scrape.yml](.github/workflows/scrape.yml)
runs the whole `.mil`/`.gov` roster via `scrapers/backfill.py` daily at 06:00 UTC
(and on demand). Set repo **Settings → Secrets and variables → Actions**:
- `INGEST_URL` = `https://<your-domain>/api/ingest` **(required — without it the
  scrapers default to `localhost` on the runner and the job fails)**
- `INGEST_TOKEN` = same value as in `.env.production` **(required)**
- `SAM_GOV_API_KEY` = free key from api.sam.gov (optional; `sam_gov` skips if unset)
- `CONGRESS_API_KEY` = free key from api.congress.gov (optional; `congress_gov` skips if unset)

USAspending.gov and the `.mil` RSS scrapers need **no key**. Trigger a manual run
from the Actions tab to test. Note: scheduled workflows run from the repo's
**default branch**, so this file must be merged there for the cron to fire.

**B) System cron on the host** — if you don't use GitHub, run the same roster
runner:
```cron
0 6 * * *  cd /path/to/repo && INGEST_URL=https://<domain>/api/ingest INGEST_TOKEN=<token> SAM_GOV_API_KEY=<key> CONGRESS_API_KEY=<key> scrapers/.venv/bin/python scrapers/backfill.py --limit 200
```
`backfill.py` runs every scraper in one pass; ones missing an optional key are
reported and skipped without aborting the rest.

## 5. Smoke test (post-deploy)

- [ ] `GET /api/milestones` returns APPROVED entries (after seeding).
- [ ] Public `/` and `/timeline` render; `/system/<id>` opens a profile.
- [ ] `/admin` redirects to `/admin/login`; logging in with the admin
      credential reaches the review queue.
- [ ] `POST /api/ingest` **without** the token → 401; **with**
      `Authorization: Bearer <INGEST_TOKEN>` → 200.
- [ ] Run the scrape workflow → new rows appear as PENDING in `/admin`;
      approving one makes it appear publicly.

## Updating a deployment

```bash
git pull
docker compose -f docker-compose.prod.yml up --build -d   # re-runs migrate deploy
```
New migrations apply automatically on container start. Seed is never re-run.

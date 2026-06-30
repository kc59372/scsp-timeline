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
  (No `$`-escaping needed in this container env file — unlike a local shell `.env`.)
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

After this the public timeline at `/` and `/timeline` shows the 16 curated
entries. Do **not** re-run seed after you've approved scraped data — it would
wipe it.

## 4. Schedule the scrapers

Two options:

**A) GitHub Actions (recommended)** — [.github/workflows/scrape.yml](.github/workflows/scrape.yml)
runs daily at 06:00 UTC (and on demand). Set repo **Settings → Secrets and
variables → Actions**:
- `INGEST_URL` = `https://<your-domain>/api/ingest`
- `INGEST_TOKEN` = same value as in `.env.production`
- `SAM_GOV_API_KEY` = your free key (optional)

Trigger a manual run from the Actions tab to test.

**B) System cron on the host** — if you don't use GitHub:
```cron
0 6 * * *  cd /path/to/repo && INGEST_URL=https://<domain>/api/ingest INGEST_TOKEN=<token> SAM_GOV_API_KEY=<key> scrapers/.venv/bin/python scrapers/news_rss.py
```
(Repeat per scraper, or wrap them in a small shell script.)

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

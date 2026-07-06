# Deploy with Claude Code

A copy-paste prompt for having **Claude Code** deploy this app on a host machine,
plus the context needed to do it right. For the manual runbook, see
[DEPLOY.md](./DEPLOY.md).

## Read this first (the important bits)

- **One shared deployment, one database.** A shared review queue only works if
  the app is deployed **once** on a reachable host (a VPS/cloud VM, or a machine
  that stays online) — not separately on each laptop, or the queues wouldn't be
  shared. Teammates then just open the URL; they don't run anything.
- **One shared admin login.** Auth is a single shared credential
  (`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH`), not per-user. Whoever deploys sets it
  once; share the password via a team password manager (e.g. 1Password).
- **Secrets don't go in `.env.production` except the app's own.** Scraper API
  keys belong in **GitHub Actions secrets** (for the scheduled scrape), not the
  web app's env file.
- **bcrypt `$` escaping:** in the docker-compose `env_file` (`.env.production`),
  every `$` in `ADMIN_PASSWORD_HASH` must be escaped as `$$`, or login silently
  fails. `scripts/hash_password.ts` prints the `$$`-escaped form.
- **Public URL / TLS / DNS is yours to provide** — Claude can build and run the
  stack, but it can't provision a server or domain.

## API keys (optional, for the daily scrape)

The scrapers run without keys except these (all free). USAspending.gov, DVIDS,
and the `.mil` RSS feeds that use no key still run regardless.

| Secret | Where to get it | Powers |
|---|---|---|
| `SAM_GOV_API_KEY` | https://open.gsa.gov/api/get-opportunities-public-api/ | SAM.gov solicitations + awards |
| `CONGRESS_API_KEY` | https://api.congress.gov/sign-up/ | AI legislation |
| `DVIDS_API_KEY` | https://api.dvidshub.net (use the **public** `key-…`) | historical DoD news |

---

## The prompt (paste into Claude Code on the host)

````
Deploy the SCSP US Military AI Adoption Timeline as a shared, team-accessible
instance using its Docker Compose setup. This is a SINGLE shared deployment (one
Postgres DB) that my coworkers will all reach via one URL and one shared admin
login — do NOT set up per-user accounts, and do NOT run a copy per laptop.

1. Clone and enter the repo on the deploy branch:
   git clone https://github.com/kc59372/scsp-timeline.git
   cd scsp-timeline
   git checkout main   # (or feat/phase-6-deploy if not yet merged)

2. Requirements: Docker + Docker Compose running (`docker info`). A public
   domain with DNS pointing at this host is assumed for TLS in step 5.

3. Create .env.production from the example, with GENERATED secrets:
   cp .env.production.example .env.production
   - POSTGRES_USER=scsp and POSTGRES_DB=scsp_timeline (exact — the db
     healthcheck hardcodes them)
   - POSTGRES_PASSWORD = output of `openssl rand -hex 16`
   - DATABASE_URL = postgresql://scsp:<that password>@db:5432/scsp_timeline?schema=public
   - NEXTAUTH_SECRET = `openssl rand -base64 32`
   - INGEST_TOKEN = `openssl rand -hex 32`   (REQUIRED — locks /api/ingest)
   - ADMIN_EMAIL = the shared team login (e.g. timeline-admin@scsp.ai)
   - ADMIN_PASSWORD_HASH = run `npx ts-node scripts/hash_password.ts '<shared password>'`
     and paste the "$$"-escaped form it prints on stderr (NOT the raw hash).
     Docker Compose interpolates env_file values, so an unescaped bcrypt hash is
     mangled and login fails. Verify in step 6.
   - NEXT_PUBLIC_SITE_URL and NEXTAUTH_URL = the public https URL.

4. Launch:  docker compose -f docker-compose.prod.yml up --build -d
   (auto-runs `prisma migrate deploy`; serves on port 3000). Wait until
   `curl -f http://localhost:3000/api/milestones` returns JSON.

5. TLS: put Caddy/nginx in front, terminating HTTPS for the domain and proxying
   to localhost:3000. Point DNS at this host.

6. Seed ONCE (first deploy only — destructive, wipes the tables):
   docker compose -f docker-compose.prod.yml exec web npx prisma db seed
   Then verify admin login works:
   docker compose -f docker-compose.prod.yml exec -T web node -e 'const b=require("bcryptjs");console.log(b.compareSync("<shared password>", process.env.ADMIN_PASSWORD_HASH))'
   It MUST print true. If false, the hash wasn't "$$"-escaped — fix .env.production
   and `docker compose -f docker-compose.prod.yml up -d --force-recreate web`.

7. Smoke test (see DEPLOY.md checklist): /admin redirects to login; login with
   the shared creds reaches the queue; POST /api/ingest without the token → 401,
   with `Authorization: Bearer <INGEST_TOKEN>` → 200; /timeline renders.

8. Enable the daily scrape — set GitHub repo secrets (Settings → Secrets →
   Actions), then merge the deploy branch to `main` (scheduled workflows run
   from the default branch):
     INGEST_URL       = https://<domain>/api/ingest
     INGEST_TOKEN     = same as .env.production
     SAM_GOV_API_KEY  = <optional>
     CONGRESS_API_KEY = <optional>
     DVIDS_API_KEY    = <optional public key>
   Trigger the "Scheduled Scrape" workflow manually from the Actions tab to test;
   new entries should appear as PENDING in /admin.

Report back: the public URL, and confirm the smoke tests + the login check
passed. Do NOT commit .env.production (it is gitignored). Keep the shared
password in a team password manager.
````

---

## After it's live

- Give teammates: **the URL + the shared email/password**. That's all they need —
  no setup on their end.
- The daily scrape (06:00 UTC) tops up the `PENDING` queue from the live
  `.mil`/`.gov` sources. Reviewers approve/reject and merge events into program
  lifecycles from `/admin`.
- To pull the full historical backlog immediately, trigger the workflow manually
  (or run `scrapers/backfill.py --limit 500` on the host with the keys set).

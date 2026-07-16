# Deploy on Vercel + Neon (free)

The simplest way to put this app on a live URL your team can open — no server,
domain, or TLS to manage. **Vercel** hosts the Next.js app (free Hobby tier),
**Neon** provides free serverless Postgres, and the daily scrape keeps running on
**GitHub Actions** (free). One shared deployment, one database, one shared admin
login — teammates just open the URL.

> **Note on "free":** Vercel's Hobby tier is free but its terms are for
> personal/non-commercial use. For a small internal SCSP tool this works to get
> going; if usage grows or you want it clearly licensed for org use, upgrade to
> Vercel Pro. Neon's free tier has no such restriction. There are no paid cron
> jobs — the scraper runs on GitHub Actions, not Vercel Cron.

For the Docker self-host route instead, see [DEPLOY.md](./DEPLOY.md).

---

## 1. Create the database (Neon)

1. Sign up at https://neon.tech (free; sign in with GitHub).
2. Create a project (any name, e.g. `scsp-timeline`). Region: pick one near you.
3. Open **Connection Details**. You need **two** connection strings:
   - **Pooled** (with `-pooler` in the host) → this is `DATABASE_URL`.
   - **Direct** (toggle *Connection pooling* OFF) → this is `DIRECT_URL`.
   Both are secrets. Keep them handy for step 2 and step 3.

## 2. Schema + seed (no laptop DB access needed)

Corporate networks with a TLS proxy (Zscaler/Netskope) block the raw Postgres
port, so `prisma migrate`/`db seed` can't reach Neon from a work laptop. This
setup works around that entirely:

- **Schema:** the Vercel build runs `prisma migrate deploy` automatically (its
  `build` script is `prisma generate && prisma migrate deploy && next build`), so
  tables are created on every deploy from Vercel's network. Nothing to run by hand.
- **Seed data (one time):** after the first successful deploy, load the curated
  seed over HTTPS via the token-gated route (step 5) — no direct DB connection.

If you *are* on an unproxied network, the classic path still works from the repo
root: `DATABASE_URL=<neon DIRECT url> DIRECT_URL=<neon DIRECT url> npx prisma db seed`.
**Never re-run seed** after approving scraped data — it clears the tables.

## 3. Deploy the app (Vercel)

1. Sign up at https://vercel.com with your GitHub account.
2. **Add New… → Project** → import `kc59372/scsp-timeline`.
   - Set the **Production Branch** to `main` (Settings → Git), and make sure your
     deploy commits are merged to `main`.
3. Before the first deploy, add **Environment Variables** (Settings → Environment
   Variables), all for **Production**:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** connection string (`-pooler` host) |
   | `DIRECT_URL` | Neon **direct** connection string |
   | `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | your Vercel URL, e.g. `https://scsp-timeline.vercel.app` |
   | `NEXT_PUBLIC_SITE_URL` | same Vercel URL |
   | `ADMIN_EMAIL` | shared team login, e.g. `timeline-admin@scsp.ai` |
   | `ADMIN_PASSWORD_HASH` | **raw** bcrypt hash — single `$`, NOT `$$`-escaped (that escaping is a Docker-only quirk; Vercel does not interpolate) |
   | `INGEST_TOKEN` | `openssl rand -hex 32` — locks `/api/ingest` |
   | `ANTHROPIC_API_KEY` | *(optional — leave unset to stay free; ambiguous scraped entries then default to PENDING)* |

   Generate the password hash with: `npx ts-node scripts/hash_password.ts '<password>'`
   and paste the **raw** hash it prints (not the `$$` version).
4. **Deploy.** Vercel runs `prisma generate && next build` automatically. When it
   finishes, open the URL — the timeline should render the seed data.
5. If you guessed the URL wrong in step 3, update `NEXTAUTH_URL` /
   `NEXT_PUBLIC_SITE_URL` to the real deployed URL and **redeploy**.

## 4. Enable the daily scrape (GitHub Actions)

In the GitHub repo → **Settings → Secrets and variables → Actions**, add:

- `INGEST_URL` = `https://<your-vercel-url>/api/ingest`
- `INGEST_TOKEN` = same value as the Vercel env var
- `SAM_GOV_API_KEY`, `CONGRESS_API_KEY`, `DVIDS_API_KEY` = optional (free)

Scheduled workflows run from the **default branch**, so the workflow file must be
on `main`. Trigger "Scheduled Scrape" manually from the **Actions** tab to test —
new rows appear as PENDING in `/admin`.

## 5. Seed the curated data (one time, over HTTPS)

After the first deploy the tables exist but are empty. Load the seed via the
token-gated route (works through a TLS proxy — it's just HTTPS):

```bash
curl -X POST https://<your-vercel-url>/api/admin/seed \
  -H "Authorization: Bearer <INGEST_TOKEN>"
# → {"seeded":true,"programs":3,"milestones":...}
```

It refuses to run if the DB already has rows (409) so it can't wipe approved
data; pass `?force=true` only to intentionally re-seed a fresh DB.

## 6. Smoke test

- [ ] Public `/` and `/timeline` render the seed entries.
- [ ] `/admin` redirects to login; the shared credential reaches the review queue.
- [ ] `POST /api/ingest` without the token → 401; with `Authorization: Bearer
      <INGEST_TOKEN>` → 200.

## Updating later

Push to `main` → Vercel auto-deploys. **Production** builds run
`npx prisma migrate deploy` automatically — the build script gates it on
`VERCEL_ENV=production` via `scripts/migrate-if-prod.sh`, so committed migrations
apply on the production deploy. **Preview** (branch/PR) builds skip migrations
and therefore need no DB credentials (DB env vars stay Production-scoped); a
preview must never apply its branch's migrations to the shared prod DB. If you
prefer to apply a migration by hand instead, use `npx prisma migrate deploy`
(step 2's export + that one command). Seed is never re-run.

## Give your team

Just the **URL + shared email/password** (store the password in 1Password). No
setup on their end.

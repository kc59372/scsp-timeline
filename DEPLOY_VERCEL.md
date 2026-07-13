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

## 2. Load the schema + seed data (one time)

Run against Neon from your laptop (in the repo root). The pooled URL can't run
migrations, so use the **direct** URL for both here:

```bash
export DATABASE_URL="<neon DIRECT url>"
export DIRECT_URL="<neon DIRECT url>"
npx prisma migrate deploy        # creates all tables
npx prisma db seed               # loads curated seed data (destructive; first time only)
```

`npx prisma studio` (optional) confirms rows exist. **Never re-run seed** after
you've approved scraped data — it clears the tables.

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

## 5. Smoke test

- [ ] Public `/` and `/timeline` render the seed entries.
- [ ] `/admin` redirects to login; the shared credential reaches the review queue.
- [ ] `POST /api/ingest` without the token → 401; with `Authorization: Bearer
      <INGEST_TOKEN>` → 200.

## Updating later

Push to `main` → Vercel auto-deploys. New Prisma migrations must be applied
against Neon with `npx prisma migrate deploy` (step 2's export + that one command)
— Vercel's build does not run migrations. Seed is never re-run.

## Give your team

Just the **URL + shared email/password** (store the password in 1Password). No
setup on their end.

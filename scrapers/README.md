# Scrapers — historical .mil/.gov ingestion pipeline

Python scrapers that backfill US military AI **lifecycle events** from official
**.mil / .gov** sources and POST them to the app's `/api/ingest` endpoint.
Nothing else is scraped — commercial news feeds were removed to avoid copyright
issues. **Everything ingested lands as `PENDING`** for admin review; nothing
auto-publishes.

## The lifecycle model

Each scraped row is a single dated **event** in a program's lifecycle. The
server groups events into a **Program** (e.g. "Project Maven") so the timeline
can show a system progress from request → award → test → fielding → deployment.

| Field emitted | Meaning |
|---|---|
| `programName` / `programSlug` | which program this event belongs to (server upserts the Program by slug) |
| `eventType` | `RD_START`, `SOLICITATION`, `AWARD`, `TEST`, `FIELDING`, `DEPLOYMENT`, `POLICY`, `OTHER` |
| `eventDate` | when this event happened |

- **SAM.gov & SBIR** carry a reliable key (solicitation number / award title),
  so their events **auto-link** into programs on ingest.
- **RSS news items** (a headline is an unreliable key) are emitted **ungrouped**;
  an admin merges them into the right program from the review queue
  ("Merge into program").

## Scraper roster

| Scraper | Source (host) | Default event type |
|---|---|---|
| `sam_gov.py` | SAM.gov Opportunities API (`api.sam.gov`) — needs key | `AWARD` / `SOLICITATION` |
| `usaspending_gov.py` | USAspending.gov award API (`api.usaspending.gov`) — **no key, historical to 2016** | `AWARD` |
| `darpa_archive.py` | darpa.mil news archive (`/json/news.json`) — **no key, historical to 2016**; in the backfill roster | `RD_START` (→ `TEST`) |
| `darpa_mil.py` | darpa.mil news (RSS) — recent-only (~50 items); superseded by `darpa_archive.py` | `RD_START` (→ `TEST`) |
| `af_mil.py` | af.mil news (RSS) | `FIELDING` |
| `army_mil.py` | army.mil news (RSS) | `FIELDING` |
| `navy_mil.py` | navy.mil news (RSS) — feed URL unverified (yields none) | `FIELDING` |
| `spaceforce_mil.py` | spaceforce.mil news (RSS) | `FIELDING` |
| `defense_gov.py` | defense.gov DoD News (RSS) | `OTHER` |
| `gao_gov.py` | gao.gov reports (RSS) | `POLICY` |
| `dvids_gov.py` | DVIDS news API (`api.dvidshub.net`) — **historical news to 2016**, needs key | inferred |
| `congress_gov.py` | Congress.gov API (`api.congress.gov`) | `POLICY` |
| `sbir_gov.py` | SBIR.gov awards API (open) | `RD_START` |
| `rss.py` | shared RSS machinery (relevance + category + event-type inference) | — |
| `utils.py` | shared helpers (dates, dedup, POST, `program_slug`) | — |
| `backfill.py` | runs the whole roster in one pass (2016→present) | — |

Event type and category are inferred per item from the text and always land
`PENDING`, so a wrong guess is cheap — the admin corrects it on review.

## Setup

```bash
python3 -m venv scrapers/.venv
scrapers/.venv/bin/pip install -r scrapers/requirements.txt
```

## Environment

| Variable | Used by | Notes |
|---|---|---|
| `SAM_GOV_API_KEY` | `sam_gov.py` | Free key — https://open.gsa.gov/api/get-opportunities-public-api/ |
| `CONGRESS_API_KEY` | `congress_gov.py` | Free key — https://api.congress.gov/sign-up/ |
| `DVIDS_API_KEY` | `dvids_gov.py` | Free **public** key — https://api.dvidshub.net (pass the `key-…` public key) |
| `INGEST_URL` | all | Defaults to `http://localhost:3000/api/ingest` |
| `INGEST_TOKEN` | all | Bearer token for `/api/ingest` in production (see DEPLOY_VERCEL.md) |

`gao_gov.py`, the `*.mil` RSS scrapers, and `sbir_gov.py` need **no key**.
Read these from the environment (`set -a; source .env; set +a`).

## Common flags (all scrapers + backfill)

| Flag | Effect |
|---|---|
| `--fixtures` | Read saved sample payloads from `fixtures/` instead of the network (no key) |
| `--dry-run` | Print normalized JSON to stdout; **do not** POST |
| `--limit N` | Cap items fetched/emitted (default 50; backfill default 200) |

`sam_gov.py` also takes `--posted-from MM/DD/YYYY` / `--posted-to`,
`--recent-days N` (search only the last N days — overrides `--posted-from`), and
`--max-requests N` (hard cap on `api.sam.gov` calls this run; default **8** to
stay under the free key's low daily quota; `0` = uncapped).
`backfill.py` also takes `--only sam_gov,darpa_mil` to run a subset.

## Usage

Offline smoke test (no network, no DB, no keys):

```bash
scrapers/.venv/bin/python scrapers/backfill.py --fixtures --dry-run
# or a single scraper:
scrapers/.venv/bin/python scrapers/darpa_mil.py --fixtures --dry-run
```

Full historical backfill (requires `npm run dev` + Postgres running):

```bash
set -a; source .env; set +a            # SAM_GOV_API_KEY, CONGRESS_API_KEY, INGEST_URL
scrapers/.venv/bin/python scrapers/backfill.py --limit 200
```

## Dedup & review gate

- **Within a run:** `utils.local_dedupe` drops dupes by
  `(programSlug, eventType, eventDate, sourceUrl)` for events, else `(name, devStartDate)`.
- **Authoritative:** the server computes the same event hash and upserts on it,
  so re-running a scraper updates rather than duplicates.
- The ingest response summarizes each run: `{ received, inserted, skipped, errors }`.

## Fixtures

`fixtures/` holds committed sample payloads (one per scraper) so the pipeline is
testable offline and in CI. Each RSS sample deliberately includes an irrelevant
item to exercise the relevance filter, and a mix of event-type keywords
(awarded / tested / fielded / deployed) to exercise event-type inference.

## Historical backfill (to 2016) & the HTML-scraping question

RSS feeds are **recent-only** (last ~50 articles), so the `.mil` news scrapers
cannot reach 2016. Historical depth comes from the two **award APIs**:

- **`usaspending_gov.py`** — the no-key historical backbone. DoD AI contract
  awards 2016→present, with amount / recipient / agency / date. Enforces a 2016
  floor client-side (the API's time filter keys on action date, so some
  period-of-performance start dates predate the window and are dropped).
- **`sam_gov.py`** — richer (solicitations + awards) but needs a free key.

For historical **news / press releases** (pre-2026), two sources reach back to
2016 where the recent-only RSS feeds cannot:

- **`dvids_gov.py`** — the DVIDS API (official DoD public-domain media),
  searchable back to 2016 (needs the free public key).
- **`darpa_archive.py`** — DARPA is a Drupal 10 site that publishes its *entire*
  news archive as a single public JSON document (`/json/news.json`, no key) —
  the same data its React "news board" renders client-side. This reaches 2016
  (and earlier), so it supersedes the recent-only RSS feed (`darpa_mil.py`) and
  is the DARPA entry in `backfill.py`. It's an ~11 MB download; server-side
  dedup makes daily re-runs cheap (re-ingesting is a no-op). For a one-time full
  historical pull run it directly: `darpa_archive.py --since 2016-01-01
  --until 2026-12-31 --limit 1000`.

`sam_gov.py` chunks its date range into ≤1-year windows (the SAM API rejects
longer ranges with HTTP 400).

### SAM.gov daily quota (important)

SAM.gov's free (non-federal) key has a **hard, low daily request quota** (429,
code 900804, resets 00:00 UTC). The heaviest consumer is the per-notice
description fetch — **one extra `api.sam.gov` call for every opportunity** — so a
naive 2016→present pull trips the quota fast (it did on 2026-07-13). Two guards:

- **`--max-requests N`** (default **8**) — a hard per-run budget counting *every*
  `api.sam.gov` call (search pages + each description fetch). When exhausted the
  run stops gracefully with a partial result, same as an actual 429.
- **`--recent-days N`** — scan only new notices, so periodic reruns stay cheap.

`backfill.py` therefore runs SAM as `--recent-days 30 --max-requests 8` (routine,
quota-safe). The one-time 2016→present historical pull is already done; to repeat
it, run `sam_gov.py --posted-from 01/01/2016 --max-requests 0` across several UTC
days (quota resets daily). **USAspending.gov** (no key, no quota) is the primary
historical source for DoD contract awards; SAM is supplementary.

Direct HTML scraping of the sites' search/archive pages was investigated and is
**not viable** without a headless browser: defense.gov / af.mil / gao.gov return
Akamai `403 Access Denied` to plain HTTP (even with a browser UA), and
army.mil's listing paginates via JS (no URL-addressable pages). USAspending.gov
(procurement) and DVIDS (news) replace that need.

## Out of scope (later phases)

- Public timeline lifecycle-track rendering (groups events per program) → Phase D.
- Scheduled runs via GitHub Actions cron → `.github/workflows/scrape.yml`.

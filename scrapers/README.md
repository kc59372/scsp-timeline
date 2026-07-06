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
| `darpa_mil.py` | darpa.mil news (RSS) | `RD_START` (→ `TEST`) |
| `af_mil.py` | af.mil news (RSS) | `FIELDING` |
| `army_mil.py` | army.mil news (RSS) | `FIELDING` |
| `navy_mil.py` | navy.mil news (RSS) — feed URL unverified (yields none) | `FIELDING` |
| `spaceforce_mil.py` | spaceforce.mil news (RSS) | `FIELDING` |
| `defense_gov.py` | defense.gov DoD News (RSS) | `OTHER` |
| `gao_gov.py` | gao.gov reports (RSS) | `POLICY` |
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
| `INGEST_URL` | all | Defaults to `http://localhost:3000/api/ingest` |
| `INGEST_TOKEN` | all | Bearer token for `/api/ingest` in production (see DEPLOY.md) |

`gao_gov.py`, the `*.mil` RSS scrapers, and `sbir_gov.py` need **no key**.
Read these from the environment (`set -a; source .env; set +a`).

## Common flags (all scrapers + backfill)

| Flag | Effect |
|---|---|
| `--fixtures` | Read saved sample payloads from `fixtures/` instead of the network (no key) |
| `--dry-run` | Print normalized JSON to stdout; **do not** POST |
| `--limit N` | Cap items fetched/emitted (default 50; backfill default 200) |

`sam_gov.py` also takes `--posted-from MM/DD/YYYY` / `--posted-to`.
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

Direct HTML scraping of the sites' search/archive pages was investigated and is
**not viable** without a headless browser: defense.gov / af.mil / gao.gov return
Akamai `403 Access Denied` to plain HTTP (even with a browser UA), and
army.mil's listing paginates via JS (no URL-addressable pages). USAspending.gov
replaces that need for procurement data.

## Out of scope (later phases)

- Public timeline lifecycle-track rendering (groups events per program) → Phase D.
- Scheduled runs via GitHub Actions cron → `.github/workflows/scrape.yml`.

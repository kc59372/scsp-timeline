# Scrapers — data ingestion pipeline

Python scrapers that pull US military AI milestones from public defense sources
and POST them to the app's `/api/ingest` endpoint. **Everything ingested lands
as `PENDING`** for admin review (Phase 5) — nothing auto-publishes.

| Scraper | Source | Output category |
|---|---|---|
| `sam_gov.py` | SAM.gov Opportunities API (`api.sam.gov`) | `PROCUREMENT_CONTRACT` |
| `news_rss.py` | Breaking Defense, DefenseScoop, C4ISRNET, af.mil, DARPA (RSS) | inferred from content |
| `af_mil.py` | af.mil official news (RSS) | inferred from content |
| `utils.py` | shared helpers (dates, dedup, POST, fixtures) | — |

## Setup

```bash
python3 -m venv scrapers/.venv
scrapers/.venv/bin/pip install -r scrapers/requirements.txt
```

## Environment

| Variable | Used by | Notes |
|---|---|---|
| `SAM_GOV_API_KEY` | `sam_gov.py` | Free key — https://open.gsa.gov/api/get-opportunities-public-api/ |
| `INGEST_URL` | all | Defaults to `http://localhost:3000/api/ingest` |

These are read from the process environment. For local runs, export them or
source the project `.env` (e.g. `set -a; source .env; set +a`).

## Common flags (all scrapers)

| Flag | Effect |
|---|---|
| `--fixtures` | Read saved sample payloads from `fixtures/` instead of the network (no key needed) |
| `--dry-run` | Print normalized JSON to stdout; **do not** POST |
| `--limit N` | Cap items fetched/emitted (default 50) |

## Usage

Offline smoke test (no network, no DB, no API key):

```bash
scrapers/.venv/bin/python scrapers/sam_gov.py  --fixtures --dry-run
scrapers/.venv/bin/python scrapers/news_rss.py --fixtures --dry-run
scrapers/.venv/bin/python scrapers/af_mil.py   --fixtures --dry-run
```

Live ingest (requires `npm run dev` + Postgres running):

```bash
# from fixtures, but actually POST to the running app:
scrapers/.venv/bin/python scrapers/news_rss.py --fixtures

# live network fetch + POST:
export SAM_GOV_API_KEY=your_key_here
scrapers/.venv/bin/python scrapers/sam_gov.py --limit 100
```

## Dedup & review gate

- **Within a run:** `utils.local_dedupe` drops obvious dupes by `(name, devStartDate)`.
- **Authoritative:** the server computes `dedupeHash = sha256(name|devStartDate)`
  and upserts on it, so re-running a scraper updates rather than duplicates.
- The ingest response summarizes each run: `{ received, inserted, skipped, errors }`.

## Fixtures

`fixtures/` holds committed sample payloads (one per scraper) so the pipeline is
testable offline and in CI:

- `sam_gov.json` — sample Opportunities API response
- `news_rss.xml` — sample defense-news RSS
- `af_mil.xml` — sample af.mil RSS

Each sample deliberately includes an irrelevant item to exercise the relevance
filter.

## Out of scope (later phases)

- Scheduled runs via GitHub Actions cron → Phase 6 (`.github/workflows/scrape.yml`).
- Admin review UI for `PENDING` entries → Phase 5.

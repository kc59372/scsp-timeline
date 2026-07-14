"""Shared utilities for the SCSP Military AI Timeline scrapers.

Provides:
  * normalize_date     — parse messy/partial dates → ISO date string (or None)
  * to_milestone       — build a dict matching the Milestone ingest schema
  * local_dedupe       — within-run dedup by (name, devStartDate)
  * post_batch         — POST items to /api/ingest (or print, in --dry-run)
  * load_fixture       — read a saved sample payload from scrapers/fixtures/
  * add_common_args    — shared --fixtures / --dry-run / --limit CLI flags

The server (/api/ingest) is the authoritative dedup + review gate; everything
sent here lands as PENDING regardless of what we set.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Iterable
from urllib import error as urlerror
from urllib import request as urlrequest

from dateutil import parser as dateparser

FIXTURES_DIR = Path(__file__).parent / "fixtures"
INGEST_URL = os.environ.get("INGEST_URL", "http://localhost:3000/api/ingest")
INGEST_TOKEN = os.environ.get("INGEST_TOKEN")  # bearer token for /api/ingest (prod)

# Identify ourselves politely. Several .gov WAFs (e.g. Akamai in front of
# api.congress.gov) return 403 to the default "Python-urllib" User-Agent, so
# every outbound request must set this.
USER_AGENT = "scsp-timeline-scraper/1.0 (US military AI adoption timeline; contact: admin)"

# Valid Category enum values (mirror of prisma/schema.prisma).
CATEGORIES = {
    "UNMANNED_SYSTEMS", "COMMAND_CONTROL", "ISR", "LOGISTICS_SUSTAINMENT",
    "CYBER", "TARGETING", "POLICY_DIRECTIVE", "PROCUREMENT_CONTRACT",
    "TRAINING_SIMULATION", "MEDICAL", "SPACE", "RESEARCH_DEVELOPMENT",
}

# Valid EventType enum values (mirror of prisma/schema.prisma). A milestone is a
# single dated event in a program's lifecycle; the server derives the program's
# systemStatus from its furthest-along event.
EVENT_TYPES = {
    "RD_START", "SOLICITATION", "AWARD", "TEST",
    "FIELDING", "DEPLOYMENT", "POLICY", "OTHER",
}


def program_slug(value: str) -> str:
    """Normalize a program label → stable slug (mirror of lib/ingest.programSlug).

    Used for cross-source entity resolution: events whose slug matches auto-link
    to the same Program on ingest; the rest are merged by an admin.
    """
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower())
    return slug.strip("-")

_MONTHS = (
    "january february march april may june july august september "
    "october november december jan feb mar apr jun jul aug sep sept oct nov dec"
).split()


def normalize_date(value: str | None) -> str | None:
    """Best-effort parse of partial/ranged dates → 'YYYY-MM-DD' (UTC), or None.

    Handles: year-only ('2020'), month+year ('Feb 2024', 'February 2024'),
    ranges ('Feb–Mar 2024' → start), and full dates. Returns None on failure
    rather than guessing — callers should leave the field null.
    """
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None

    # Full ISO date/datetime (YYYY-MM-DD[...]) — parse directly. Must come BEFORE
    # the range split below, whose hyphen separator would otherwise chop
    # "2020-09-29" down to just its year.
    m_iso = re.match(r"(\d{4})-(\d{2})-(\d{2})", text)
    if m_iso:
        return f"{m_iso.group(1)}-{m_iso.group(2)}-{m_iso.group(3)}"

    # Range: take the part before an en/em dash or "to".
    text = re.split(r"\s*(?:–|—|-{1,2}|\bto\b)\s*", text, maxsplit=1)[0].strip()

    # Year only.
    if re.fullmatch(r"(19|20)\d{2}", text):
        return f"{text}-01-01"

    # Month + year (no day) → first of month.
    m = re.fullmatch(r"([A-Za-z]+)\.?\s+((19|20)\d{2})", text)
    if m and m.group(1).lower() in _MONTHS:
        try:
            dt = dateparser.parse(f"1 {m.group(1)} {m.group(2)}")
            return dt.strftime("%Y-%m-%d")
        except (ValueError, OverflowError):
            return None

    try:
        dt = dateparser.parse(text, default=dateparser.parse("2000-01-01"))
        return dt.strftime("%Y-%m-%d")
    except (ValueError, OverflowError, TypeError):
        return None


def program_significance(program: Any) -> int:
    """Significance by known-project relevance, NOT contract dollar value.

    An entry that maps to a curated program (a named, tracked project) is
    significant (4); one that names no known program is not (2). This is the
    single source of truth for how scrapers score significance — money is
    deliberately not a factor (a $9B award naming no known program is not
    automatically "significant").
    """
    return 4 if program else 2


def to_milestone(
    *,
    name: str,
    category: str,
    source_url: str,
    source_name: str,
    description: str = "",
    actor: str | None = None,
    subcategory: str | None = None,
    program_name: str | None = None,
    program_slug_value: str | None = None,
    event_type: str | None = None,
    event_date: str | None = None,
    dev_start_date: str | None = None,
    procurement_date: str | None = None,
    test_date: str | None = None,
    test_location: str | None = None,
    fielding_date: str | None = None,
    deployment_date: str | None = None,
    system_status: str | None = None,
    additional_sources: list[str] | None = None,
    contract_number: str | None = None,
    contract_value: float | None = None,
    issuing_agency: str | None = None,
    awarded_to: str | None = None,
    significance: int = 1,
) -> dict[str, Any]:
    """Build a normalized milestone/event dict for /api/ingest.

    Lifecycle grouping: pass `program_name` (and optionally `program_slug_value`
    to override the derived slug) plus an `event_type`, and the server upserts
    the parent Program and links this event to it. `event_date` is the
    stage-agnostic date this event occurred.

    entryStatus is intentionally omitted — the server forces PENDING.
    Only non-null fields are included to keep payloads tidy.
    """
    if category not in CATEGORIES:
        raise ValueError(f"unknown category: {category}")
    if event_type is not None and event_type not in EVENT_TYPES:
        raise ValueError(f"unknown event_type: {event_type}")

    # Derive the program slug from the explicit override, else the program name.
    slug = program_slug_value or (program_slug(program_name) if program_name else None)

    item: dict[str, Any] = {
        "name": name.strip(),
        "category": category,
        "sourceUrl": source_url,
        "sourceName": source_name,
        "description": description or "",
        "significance": significance,
        "additionalSources": additional_sources or [],
    }
    optional = {
        "actor": actor,
        "subcategory": subcategory,
        "programName": program_name,
        "programSlug": slug,
        "eventType": event_type,
        "eventDate": event_date,
        "devStartDate": dev_start_date,
        "procurementDate": procurement_date,
        "testDate": test_date,
        "testLocation": test_location,
        "fieldingDate": fielding_date,
        "deploymentDate": deployment_date,
        "systemStatus": system_status,
        "contractNumber": contract_number,
        "contractValue": contract_value,
        "issuingAgency": issuing_agency,
        "awardedTo": awarded_to,
    }
    for key, val in optional.items():
        if val is not None:
            item[key] = val
    return item


def local_dedupe(items: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop within-run duplicates, mirroring the server's dedup key.

    For lifecycle events (have programSlug + eventType) the key is
    (programSlug, eventType, eventDate, sourceUrl) so distinct stages of the
    same program survive; otherwise it falls back to (lower(name), devStartDate).
    """
    seen: set[tuple[str, ...]] = set()
    out: list[dict[str, Any]] = []
    for it in items:
        if it.get("programSlug") and it.get("eventType"):
            key = (
                str(it.get("programSlug")),
                str(it.get("eventType")),
                str(it.get("eventDate") or ""),
                str(it.get("sourceUrl") or ""),
            )
        else:
            key = (str(it.get("name", "")).strip().lower(), str(it.get("devStartDate") or ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out


def load_fixture(name: str) -> str:
    """Read a saved sample payload from scrapers/fixtures/<name>."""
    path = FIXTURES_DIR / name
    return path.read_text(encoding="utf-8")


def post_batch(
    items: list[dict[str, Any]],
    *,
    dry_run: bool = False,
    url: str | None = None,
    max_retries: int = 3,
    delay: float = 1.0,
) -> dict[str, Any]:
    """POST items to the ingest endpoint, or print them when dry_run.

    Returns the parsed ingest summary, or a synthetic summary in dry-run.
    """
    if dry_run:
        print(json.dumps(items, indent=2, ensure_ascii=False))
        print(f"\n[dry-run] {len(items)} item(s) NOT posted.", file=sys.stderr)
        return {"dry_run": True, "received": len(items)}

    if not items:
        print("[ingest] nothing to post.", file=sys.stderr)
        return {"received": 0, "inserted": 0, "skipped": 0, "errors": []}

    target = url or INGEST_URL
    payload = json.dumps(items).encode("utf-8")
    headers = {"Content-Type": "application/json", "User-Agent": USER_AGENT}
    if INGEST_TOKEN:
        headers["Authorization"] = f"Bearer {INGEST_TOKEN}"

    last_err: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            req = urlrequest.Request(
                target,
                data=payload,
                headers=headers,
                method="POST",
            )
            with urlrequest.urlopen(req, timeout=30) as resp:
                summary = json.loads(resp.read().decode("utf-8"))
            print(f"[ingest] {target} -> {json.dumps(summary)}", file=sys.stderr)
            return summary
        except (urlerror.URLError, TimeoutError) as e:  # network/transient
            last_err = e
            print(f"[ingest] attempt {attempt}/{max_retries} failed: {e}", file=sys.stderr)
            time.sleep(delay * attempt)  # linear backoff

    raise RuntimeError(f"failed to POST to {target}: {last_err}")


def add_common_args(parser: argparse.ArgumentParser) -> None:
    """Attach the shared --fixtures / --dry-run / --limit flags."""
    parser.add_argument(
        "--fixtures", action="store_true",
        help="Read saved sample payloads from scrapers/fixtures/ instead of the network.",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print normalized JSON; do NOT POST to the ingest endpoint.",
    )
    parser.add_argument(
        "--limit", type=int, default=50,
        help="Max items to fetch/emit (default: 50).",
    )


def polite_sleep(seconds: float = 1.0) -> None:
    """Crawl-delay between network requests."""
    time.sleep(seconds)

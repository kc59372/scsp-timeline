#!/usr/bin/env python3
"""USAspending.gov — historical DoD AI contract awards → AWARD events.

The open USAspending.gov award-search API (no key required) is our historical
procurement backbone when a SAM.gov key isn't available: it returns federal
contract awards back to 2008, with recipient, amount, agency, and start date.
We filter to DoD AI/autonomy contracts from 2016 onward.

Each award is emitted UNGROUPED (an AWARD event with no program) — an admin
merges it into the right program from the review queue (e.g. folding a Palantir
Maven award into the Maven Smart System lifecycle).

Usage:
  python scrapers/usaspending_gov.py --fixtures --dry-run
  python scrapers/usaspending_gov.py --since 01/01/2016 --limit 200
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from typing import Any
from urllib import request as urlrequest

import utils

API_URL = "https://api.usaspending.gov/api/v2/search/spending_by_award/"
KEYWORDS = ["artificial intelligence", "machine learning", "autonomous", "unmanned"]
AWARD_URL = "https://www.usaspending.gov/award/{}"
CONTRACT_TYPES = ["A", "B", "C", "D"]  # definitive/purchase-order/delivery-order/BPA-call contracts
PAGE_SIZE = 100
FIELDS = [
    "Award ID", "Recipient Name", "Award Amount", "Awarding Agency",
    "Awarding Sub Agency", "Start Date", "Description",
]


def _iso(mmddyyyy: str) -> str:
    """MM/DD/YYYY → YYYY-MM-DD for the API's time_period filter."""
    return datetime.strptime(mmddyyyy, "%m/%d/%Y").strftime("%Y-%m-%d")


def _significance(amount: float | None) -> int:
    if amount is None:
        return 3
    if amount >= 1_000_000_000:
        return 5
    if amount >= 100_000_000:
        return 4
    if amount >= 10_000_000:
        return 3
    return 2


def map_award(aw: dict[str, Any]) -> dict[str, Any]:
    desc = (aw.get("Description") or "").strip()
    award_id = aw.get("Award ID")
    recipient = aw.get("Recipient Name") or "Unknown recipient"
    amount = aw.get("Award Amount")
    gid = aw.get("generated_internal_id")

    name = desc[:120] if desc else f"DoD AI contract {award_id or ''}".strip()
    return utils.to_milestone(
        name=name,
        category="PROCUREMENT_CONTRACT",
        actor=recipient,
        description=desc,
        source_url=AWARD_URL.format(gid) if gid else "https://www.usaspending.gov/",
        source_name="USAspending.gov",
        event_type="AWARD",
        event_date=utils.normalize_date(aw.get("Start Date")),
        procurement_date=utils.normalize_date(aw.get("Start Date")),
        contract_number=award_id,
        contract_value=float(amount) if isinstance(amount, (int, float)) else None,
        issuing_agency=aw.get("Awarding Sub Agency") or aw.get("Awarding Agency"),
        awarded_to=recipient,
        significance=_significance(amount if isinstance(amount, (int, float)) else None),
    )


def fetch_live(since: str, until: str, limit: int) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = []
    page = 1
    while len(collected) < limit:
        body = {
            "filters": {
                "keywords": KEYWORDS,
                "award_type_codes": CONTRACT_TYPES,
                "time_period": [{"start_date": _iso(since), "end_date": _iso(until)}],
                "agencies": [{"type": "awarding", "tier": "toptier", "name": "Department of Defense"}],
            },
            "fields": FIELDS,
            "limit": PAGE_SIZE,
            "page": page,
            "sort": "Award Amount",
            "order": "desc",
        }
        req = urlrequest.Request(
            API_URL,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": utils.USER_AGENT},
            method="POST",
        )
        try:
            with urlrequest.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"[usaspending] page {page} failed: {e}", file=sys.stderr)
            break
        results = data.get("results") or []
        collected.extend(results)
        print(f"[usaspending] page {page}: +{len(results)} ({len(collected)} total)", file=sys.stderr)
        if not (data.get("page_metadata") or {}).get("hasNext"):
            break
        page += 1
        utils.polite_sleep(1.0)
    return collected[:limit]


def main() -> int:
    parser = argparse.ArgumentParser(description="USAspending.gov DoD AI awards scraper")
    utils.add_common_args(parser)
    parser.add_argument("--since", default="01/01/2016", help="MM/DD/YYYY (default 01/01/2016)")
    parser.add_argument(
        "--until",
        default=datetime.now(timezone.utc).strftime("%m/%d/%Y"),
        help="MM/DD/YYYY (default: today)",
    )
    args = parser.parse_args()

    if args.fixtures:
        raw = json.loads(utils.load_fixture("usaspending_gov.json"))
        awards = (raw.get("results") or [])[: args.limit]
    else:
        awards = fetch_live(args.since, args.until, args.limit)

    # Enforce the project's 2016 floor. USAspending's time_period filters on
    # action date, but the displayed Start Date (period-of-performance start) can
    # predate the window, so drop events whose date is before --since's year.
    floor_year = datetime.strptime(args.since, "%m/%d/%Y").year
    mapped = [m for m in (map_award(a) for a in awards) if _in_scope(m, floor_year)]
    items = utils.local_dedupe(mapped)
    print(f"[usaspending] {len(items)} event(s) prepared (>= {floor_year}).", file=sys.stderr)
    utils.post_batch(items, dry_run=args.dry_run)
    return 0


def _in_scope(milestone: dict[str, Any], floor_year: int) -> bool:
    """Keep only events dated on/after the floor year (drop undated + pre-floor)."""
    ed = milestone.get("eventDate")
    return bool(ed) and int(ed[:4]) >= floor_year


if __name__ == "__main__":
    raise SystemExit(main())

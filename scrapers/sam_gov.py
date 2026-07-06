#!/usr/bin/env python3
"""SAM.gov procurement scraper — official Opportunities API (api.sam.gov).

Searches AI/autonomy-related federal contract opportunities and emits them as
normalized PROCUREMENT_CONTRACT milestones for /api/ingest.

Usage:
  python scrapers/sam_gov.py --fixtures --dry-run     # offline, no key, prints
  python scrapers/sam_gov.py                          # live fetch + POST
  python scrapers/sam_gov.py --posted-from 01/01/2023 --limit 100

Requires SAM_GOV_API_KEY in the environment for live runs (free key from
https://open.gsa.gov/api/get-opportunities-public-api/).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Any
from urllib import parse as urlparse
from urllib import request as urlrequest

import utils

API_URL = "https://api.sam.gov/opportunities/v2/search"
KEYWORDS = ["artificial intelligence", "machine learning", "autonomous", "unmanned"]
PAGE_SIZE = 100


def _money(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace("$", "").replace(",", ""))
    except ValueError:
        return None


def _program_key(op: dict[str, Any]) -> str:
    """Stable program key for a SAM.gov notice.

    A solicitation and its later award share a solicitation number, so keying on
    it auto-links those lifecycle stages under one Program. Fall back to the
    notice title, then the notice ID.
    """
    return (
        op.get("solicitationNumber")
        or op.get("title")
        or op.get("noticeId")
        or "sam-gov-notice"
    )


def map_opportunity(op: dict[str, Any]) -> dict[str, Any]:
    """Map one SAM.gov opportunity record → normalized lifecycle event.

    Award notices (have an award amount/awardee) become AWARD events; everything
    else (solicitations, sources-sought, RFIs) becomes a SOLICITATION event.
    Both link to the same Program via the solicitation number.
    """
    award = op.get("award") if isinstance(op.get("award"), dict) else None
    awardee = (award.get("awardee") or {}).get("name") if award else None
    amount = _money(award.get("amount")) if award else None
    is_award = bool(award and (amount or awardee))

    title = op.get("title") or op.get("noticeId") or "Untitled SAM.gov notice"
    posted = utils.normalize_date(op.get("postedDate"))

    return utils.to_milestone(
        name=title,
        category="PROCUREMENT_CONTRACT",
        actor=op.get("fullParentPathName") or "US Government",
        description=op.get("description") or op.get("type") or "",
        source_url=op.get("uiLink") or f"https://sam.gov/opp/{op.get('noticeId', '')}/view",
        source_name="SAM.gov",
        program_name=title,
        program_slug_value=utils.program_slug(_program_key(op)),
        event_type="AWARD" if is_award else "SOLICITATION",
        event_date=posted,
        # Keep the stage-specific date populated too, for the profile view.
        procurement_date=posted,
        contract_number=op.get("solicitationNumber") or op.get("noticeId"),
        contract_value=amount,
        issuing_agency=op.get("fullParentPathName") or op.get("organizationType"),
        awarded_to=awardee,
        significance=4 if is_award else 3,
    )


def fetch_live(api_key: str, posted_from: str, posted_to: str, limit: int) -> list[dict[str, Any]]:
    """Paginate the Opportunities API across all keywords up to `limit` items."""
    collected: list[dict[str, Any]] = []
    for keyword in KEYWORDS:
        offset = 0
        while len(collected) < limit:
            params = {
                "api_key": api_key,
                "q": keyword,
                "postedFrom": posted_from,
                "postedTo": posted_to,
                "limit": min(PAGE_SIZE, limit - len(collected)),
                "offset": offset,
            }
            url = f"{API_URL}?{urlparse.urlencode(params)}"
            req = urlrequest.Request(url, headers={"Accept": "application/json", "User-Agent": utils.USER_AGENT})
            with urlrequest.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))

            page = data.get("opportunitiesData") or []
            collected.extend(page)
            total = int(data.get("totalRecords") or 0)
            offset += len(page)
            if not page or offset >= total:
                break
            utils.polite_sleep(1.0)
    return collected[:limit]


def main() -> int:
    parser = argparse.ArgumentParser(description="SAM.gov procurement scraper")
    utils.add_common_args(parser)
    parser.add_argument("--posted-from", default="01/01/2016", help="MM/DD/YYYY")
    parser.add_argument(
        "--posted-to",
        default=datetime.now(timezone.utc).strftime("%m/%d/%Y"),
        help="MM/DD/YYYY (default: today)",
    )
    args = parser.parse_args()

    if args.fixtures:
        raw = json.loads(utils.load_fixture("sam_gov.json"))
        opportunities = (raw.get("opportunitiesData") or [])[: args.limit]
    else:
        api_key = os.environ.get("SAM_GOV_API_KEY")
        if not api_key:
            print("ERROR: SAM_GOV_API_KEY not set (or use --fixtures).", file=sys.stderr)
            return 2
        opportunities = fetch_live(api_key, args.posted_from, args.posted_to, args.limit)

    items = utils.local_dedupe(map_opportunity(op) for op in opportunities)
    print(f"[sam_gov] {len(items)} milestone(s) prepared.", file=sys.stderr)
    utils.post_batch(items, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

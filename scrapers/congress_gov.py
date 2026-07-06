#!/usr/bin/env python3
"""congress.gov — AI-related defense legislation → POLICY events.

Uses the official Congress.gov API (api.congress.gov) to pull bills matching
AI/autonomy defense keywords and emits each as a POLICY lifecycle event. Policy
items are standalone (not grouped under a system program).

Requires CONGRESS_API_KEY for live runs (free key from https://api.congress.gov/sign-up/).

Usage:
  python scrapers/congress_gov.py --fixtures --dry-run     # offline, no key
  python scrapers/congress_gov.py                          # live fetch + POST
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any
from urllib import parse as urlparse
from urllib import request as urlrequest

import utils

API_URL = "https://api.congress.gov/v3/bill"
# The Congress v3 /bill endpoint has NO keyword search (a `query` param 403s),
# so we page recent bills (newest first) and relevance-filter titles ourselves.
# NOTE: this matches bill TITLES only (the API list view carries no subject),
# so recall is limited — many AI bills don't say "AI" in the title.
#
# Phrases are case-insensitive; the bare "AI" acronym is matched CASE-SENSITIVE
# (uppercase only) so titled names like "Ms. Chang Ai Bae" don't false-positive.
_PHRASES = re.compile(
    r"(?<!\w)(artificial intelligence|machine learning|autonomous|autonomy|unmanned|drone)(?!\w)",
    re.IGNORECASE,
)
_ACRONYM = re.compile(r"(?<!\w)AI(?!\w)")  # case-sensitive
PAGE_SIZE = 250        # API max
MAX_PAGES = 40         # scan cap: 40 × 250 = 10k most-recently-updated bills


def _relevant(text: str) -> bool:
    text = text or ""
    return bool(_PHRASES.search(text) or _ACRONYM.search(text))


def map_bill(bill: dict[str, Any]) -> dict[str, Any] | None:
    title = bill.get("title") or ""
    if not title or not _relevant(title):
        return None
    number = bill.get("number")
    bill_type = (bill.get("type") or "").lower()
    congress = bill.get("congress")
    url = bill.get("url") or (
        f"https://www.congress.gov/bill/{congress}th-congress/{bill_type}/{number}"
        if congress and bill_type and number
        else "https://www.congress.gov/"
    )
    latest = bill.get("latestAction") or {}
    action_date = utils.normalize_date(latest.get("actionDate") or bill.get("updateDate"))

    return utils.to_milestone(
        name=title,
        category="POLICY_DIRECTIVE",
        actor="U.S. Congress",
        description=latest.get("text") or f"{bill_type.upper()} {number} ({congress}th Congress)",
        source_url=url,
        source_name="Congress.gov",
        event_type="POLICY",
        event_date=action_date,
        significance=3,
    )


def fetch_live(api_key: str, limit: int) -> list[dict[str, Any]]:
    """Page recent bills (newest first), keeping only AI/autonomy-relevant titles."""
    matches: list[dict[str, Any]] = []
    for page in range(MAX_PAGES):
        params = {
            "api_key": api_key,
            "limit": PAGE_SIZE,
            "offset": page * PAGE_SIZE,
            "format": "json",
            "sort": "updateDate+desc",
        }
        url = f"{API_URL}?{urlparse.urlencode(params)}"
        req = urlrequest.Request(url, headers={"Accept": "application/json", "User-Agent": utils.USER_AGENT})
        try:
            with urlrequest.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"[congress_gov] page {page} failed: {e}", file=sys.stderr)
            break
        bills = data.get("bills") or []
        if not bills:
            break
        matches.extend(b for b in bills if _relevant(b.get("title") or ""))
        print(f"[congress_gov] scanned {(page + 1) * PAGE_SIZE} bills, {len(matches)} AI-relevant so far", file=sys.stderr)
        if len(matches) >= limit:
            break
        utils.polite_sleep(0.5)
    return matches[:limit]


def main() -> int:
    parser = argparse.ArgumentParser(description="Congress.gov AI legislation scraper")
    utils.add_common_args(parser)
    args = parser.parse_args()

    if args.fixtures:
        raw = json.loads(utils.load_fixture("congress_gov.json"))
        bills = (raw.get("bills") or [])[: args.limit]
    else:
        api_key = os.environ.get("CONGRESS_API_KEY")
        if not api_key:
            print("ERROR: CONGRESS_API_KEY not set (or use --fixtures).", file=sys.stderr)
            return 2
        bills = fetch_live(api_key, args.limit)

    items = utils.local_dedupe(m for m in (map_bill(b) for b in bills) if m)
    print(f"[congress_gov] {len(items)} event(s) prepared.", file=sys.stderr)
    utils.post_batch(items, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

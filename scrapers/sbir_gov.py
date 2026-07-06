#!/usr/bin/env python3
"""sbir.gov — DoD SBIR/STTR AI awards → early-stage RD_START events.

Uses the open SBIR.gov awards API (no key required) to pull DoD small-business
AI/autonomy research awards. These are the earliest lifecycle stage, so each is
emitted as an RD_START event, grouped by the award title so a firm's Phase I and
Phase II awards for the same effort link under one Program.

Usage:
  python scrapers/sbir_gov.py --fixtures --dry-run
  python scrapers/sbir_gov.py --limit 100
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any
from urllib import parse as urlparse
from urllib import request as urlrequest

import utils

API_URL = "https://api.www.sbir.gov/public/api/awards"
KEYWORDS = ["artificial intelligence", "machine learning", "autonomous"]


def _money(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace("$", "").replace(",", ""))
    except ValueError:
        return None


def map_award(aw: dict[str, Any]) -> dict[str, Any] | None:
    title = aw.get("award_title") or aw.get("topic_title")
    firm = aw.get("firm")
    if not title:
        return None
    date = utils.normalize_date(aw.get("proposal_award_date") or aw.get("award_year"))
    branch = aw.get("branch") or aw.get("agency") or "DoD"

    return utils.to_milestone(
        name=title,
        category="RESEARCH_DEVELOPMENT",
        actor=firm or branch,
        description=(aw.get("abstract") or "")[:2000],
        source_url=aw.get("award_link") or "https://www.sbir.gov/awards",
        source_name="SBIR.gov",
        program_name=title,
        event_type="RD_START",
        event_date=date,
        contract_number=aw.get("contract"),
        contract_value=_money(aw.get("award_amount")),
        issuing_agency=branch,
        awarded_to=firm,
        significance=2,
    )


def fetch_live(limit: int) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = []
    for keyword in KEYWORDS:
        params = {"agency": "DOD", "keyword": keyword, "rows": min(100, limit), "format": "json"}
        url = f"{API_URL}?{urlparse.urlencode(params)}"
        req = urlrequest.Request(url, headers={"Accept": "application/json", "User-Agent": utils.USER_AGENT})
        try:
            with urlrequest.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            print(f"[sbir_gov] '{keyword}' failed: {e}", file=sys.stderr)
            continue
        # API returns either a bare list or {"data": [...]}.
        rows = data if isinstance(data, list) else (data.get("data") or [])
        collected.extend(rows)
        utils.polite_sleep(1.0)
        if len(collected) >= limit:
            break
    return collected[:limit]


def main() -> int:
    parser = argparse.ArgumentParser(description="SBIR.gov DoD AI awards scraper")
    utils.add_common_args(parser)
    args = parser.parse_args()

    if args.fixtures:
        raw = json.loads(utils.load_fixture("sbir_gov.json"))
        awards = (raw if isinstance(raw, list) else raw.get("data") or [])[: args.limit]
    else:
        awards = fetch_live(args.limit)

    items = utils.local_dedupe(m for m in (map_award(a) for a in awards) if m)
    print(f"[sbir_gov] {len(items)} event(s) prepared.", file=sys.stderr)
    utils.post_batch(items, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

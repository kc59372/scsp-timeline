#!/usr/bin/env python3
"""DVIDS — historical DoD news / press releases → lifecycle events.

DVIDS (Defense Visual Information Distribution Service, api.dvidshub.net) is the
DoD's official media service. Its news articles are US-government public-domain
content and, unlike the services' own RSS feeds (recent-only), it exposes a
searchable historical archive back many years — our source for pre-2026 news.

Note: dvidshub.net is a .net domain, but the content is official DoD public
domain. Requires DVIDS_API_KEY (the public key, e.g. "key-...") for live runs.

Each article is emitted UNGROUPED (event with no program); category and event
type are inferred from the text, and an admin merges it into a program.

Usage:
  python scrapers/dvids_gov.py --fixtures --dry-run
  python scrapers/dvids_gov.py --since 2016-01-01 --limit 200
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any
from urllib import parse as urlparse
from urllib import request as urlrequest

import rss  # relevance + category + event-type inference
import utils

API_URL = "https://api.dvidshub.net/search"
KEYWORDS = ["artificial intelligence", "machine learning", "autonomous", "unmanned"]
PAGE_SIZE = 50  # DVIDS max_results cap


def map_result(r: dict[str, Any]) -> dict[str, Any] | None:
    title = r.get("title")
    url = r.get("url")
    if not title or not url:
        return None
    summary = r.get("short_description") or ""
    haystack = f"{title} {summary}"
    if not rss.is_relevant(haystack):
        return None

    branch = r.get("branch") or "DoD"
    return utils.to_milestone(
        name=title,
        category=rss.infer_category(haystack),
        actor=r.get("unit_name") or branch,
        description=summary,
        source_url=url,
        source_name=f"DVIDS ({branch})",
        event_type=rss.infer_event_type(haystack, "OTHER"),
        event_date=utils.normalize_date(r.get("date_published") or r.get("date")),
        significance=2,
    )


def fetch_live(api_key: str, since: str, limit: int) -> list[dict[str, Any]]:
    """Page DVIDS news across keywords, deduped by article id, up to `limit`."""
    by_id: dict[str, dict[str, Any]] = {}
    for keyword in KEYWORDS:
        page = 1
        while len(by_id) < limit:
            params = {
                "q": keyword,
                "type": "news",
                "from_date": f"{since}T00:00:00Z",
                "sort": "publishdate",
                "max_results": PAGE_SIZE,
                "page": page,
                "api_key": api_key,
            }
            url = f"{API_URL}?{urlparse.urlencode(params)}"
            req = urlrequest.Request(url, headers={"Accept": "application/json", "User-Agent": utils.USER_AGENT})
            try:
                with urlrequest.urlopen(req, timeout=45) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
            except Exception as e:
                print(f"[dvids] '{keyword}' page {page} failed: {e}", file=sys.stderr)
                break
            results = data.get("results") or []
            for r in results:
                if r.get("id"):
                    by_id[str(r["id"])] = r
            info = data.get("page_info") or {}
            total = int(info.get("total_results") or 0)
            print(f"[dvids] '{keyword}' page {page}: {len(by_id)} unique so far", file=sys.stderr)
            if not results or page * PAGE_SIZE >= total:
                break
            page += 1
            utils.polite_sleep(1.0)
    return list(by_id.values())[:limit]


def main() -> int:
    parser = argparse.ArgumentParser(description="DVIDS historical DoD AI news scraper")
    utils.add_common_args(parser)
    parser.add_argument("--since", default="2016-01-01", help="YYYY-MM-DD (default 2016-01-01)")
    args = parser.parse_args()

    if args.fixtures:
        raw = json.loads(utils.load_fixture("dvids_gov.json"))
        results = (raw.get("results") or [])[: args.limit]
    else:
        api_key = os.environ.get("DVIDS_API_KEY")
        if not api_key:
            print("ERROR: DVIDS_API_KEY not set (or use --fixtures).", file=sys.stderr)
            return 2
        results = fetch_live(api_key, args.since, args.limit)

    items = utils.local_dedupe(m for m in (map_result(r) for r in results) if m)
    print(f"[dvids] {len(items)} event(s) prepared.", file=sys.stderr)
    utils.post_batch(items, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

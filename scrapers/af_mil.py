#!/usr/bin/env python3
"""af.mil official Air Force news scraper.

af.mil exposes an RSS feed for articles, which is far more stable than scraping
the HTML. We pull the news feed, keep AI/autonomy-relevant items, and emit them
as normalized milestones for /api/ingest. Category is inferred (reusing the
news_rss heuristics); everything lands PENDING for review.

Usage:
  python scrapers/af_mil.py --fixtures --dry-run
  python scrapers/af_mil.py
"""
from __future__ import annotations

import argparse
import sys
from typing import Any

import feedparser

import news_rss  # reuse relevance + category inference
import utils

SOURCE_NAME = "af.mil News"
# af.mil ArticleCS RSS endpoint (Site=1 is the main af.mil site).
AF_MIL_RSS = "https://www.af.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=1&max=50"


def parse(content_or_url: str) -> list[dict[str, Any]]:
    parsed = feedparser.parse(content_or_url)
    out: list[dict[str, Any]] = []
    for entry in parsed.entries:
        item = news_rss.map_entry(entry, SOURCE_NAME)
        if item:
            out.append(item)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="af.mil news scraper")
    utils.add_common_args(parser)
    args = parser.parse_args()

    if args.fixtures:
        content = utils.load_fixture("af_mil.xml")
        items = parse(content)
    else:
        try:
            items = parse(AF_MIL_RSS)
        except Exception as e:
            print(f"[af_mil] feed failed: {e}", file=sys.stderr)
            items = []

    items = utils.local_dedupe(items)[: args.limit]
    print(f"[af_mil] {len(items)} milestone(s) prepared.", file=sys.stderr)
    utils.post_batch(items, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

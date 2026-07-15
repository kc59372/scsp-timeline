#!/usr/bin/env python3
"""darpa.mil news ARCHIVE — historical DARPA AI/autonomy news → lifecycle events.

The DARPA RSS feed (darpa_mil.py) is recent-only (~last 50 items), so it can't
reach the project's 2016 floor. But darpa.mil (a Drupal 10 site) publishes its
COMPLETE news archive as a single public JSON document — /json/news.json — the
same data its React "news board" renders client-side. No key required. This
scraper reads that archive, so DARPA coverage goes back to 2016 (and earlier)
like the award APIs, instead of being capped at the RSS window.

Each article → one lifecycle event. DARPA is where programs START, so the
default event type is RD_START; content keywords (flight test, demonstration…)
override it (rss.infer_event_type). Category is inferred, or adopted from a
matched curated program. Program grouping via the registry; unmatched items land
ungrouped for admin merge (a headline is an unreliable entity key).

Usage:
  python scrapers/darpa_archive.py --fixtures --dry-run
  python scrapers/darpa_archive.py --since 2016-01-01 --until 2026-12-31 --limit 1000
"""
from __future__ import annotations

import argparse
import html
import json
import re
import sys
from typing import Any
from urllib import request as urlrequest

import rss  # relevance + category + event-type inference
import utils
from programs import match_program  # curated cross-source program registry

ARCHIVE_URL = "https://www.darpa.mil/json/news.json"
BASE = "https://www.darpa.mil"
SOURCE = "DARPA News"
DEFAULT_EVENT_TYPE = "RD_START"

_TAG_RE = re.compile(r"<[^>]+>")


def _text(markup: str) -> str:
    """Strip HTML tags + decode entities (&rsquo;, &ndash;…) → plain text."""
    return " ".join(html.unescape(_TAG_RE.sub(" ", markup or "")).split())


def map_record(r: dict[str, Any]) -> dict[str, Any] | None:
    """Map one /json/news.json record → normalized lifecycle event (or None)."""
    title = (r.get("title") or "").strip()
    node = r.get("view_node") or ""
    if not title or not node:
        return None
    summary = _text(r.get("summary") or r.get("summary_trimmed") or "")
    body = _text(r.get("body") or "")
    topics = (r.get("field_research_topics") or "").replace("|", " ")
    haystack = f"{title} {summary} {body} {topics}"
    if not rss.is_relevant(haystack):
        return None

    url = node if node.startswith("http") else f"{BASE}{node}"
    # Cross-source grouping via the curated registry; unknown → ungrouped.
    program = match_program(haystack)
    return utils.to_milestone(
        name=title,
        category=program["category"] if program else rss.infer_category(haystack),
        actor="DARPA",
        description=summary or body[:500],
        source_url=url,
        source_name=SOURCE,
        program_name=program["name"] if program else None,
        program_slug_value=program["slug"] if program else None,
        event_type=rss.infer_event_type(haystack, DEFAULT_EVENT_TYPE),
        event_date=utils.normalize_date(r.get("field_publish_date__raw")),
        # Significance by known-project relevance, not recency.
        significance=utils.program_significance(program),
    )


def fetch_live() -> list[dict[str, Any]]:
    req = urlrequest.Request(
        ARCHIVE_URL, headers={"Accept": "application/json", "User-Agent": utils.USER_AGENT}
    )
    with urlrequest.urlopen(req, timeout=90) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data if isinstance(data, list) else []


def _in_window(m: dict[str, Any], since: str, until: str) -> bool:
    """Keep only events whose date falls in [since, until] (drop undated)."""
    ed = m.get("eventDate")
    return bool(ed) and since <= ed[:10] <= until


def main() -> int:
    parser = argparse.ArgumentParser(description="DARPA news archive scraper (historical)")
    utils.add_common_args(parser)
    parser.add_argument("--since", default="2016-01-01", help="YYYY-MM-DD (default 2016-01-01)")
    parser.add_argument("--until", default="2026-12-31", help="YYYY-MM-DD (default 2026-12-31)")
    args = parser.parse_args()

    if args.fixtures:
        raw = json.loads(utils.load_fixture("darpa_archive.json"))
    else:
        raw = fetch_live()

    mapped = [
        m for m in (map_record(r) for r in raw) if m and _in_window(m, args.since, args.until)
    ]
    items = utils.local_dedupe(mapped)[: args.limit]
    print(
        f"[darpa_archive] {len(items)} event(s) prepared ({args.since}..{args.until}).",
        file=sys.stderr,
    )
    utils.post_batch(items, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

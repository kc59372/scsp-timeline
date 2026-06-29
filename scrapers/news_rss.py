#!/usr/bin/env python3
"""Defense-news RSS scraper.

Pulls recent AI-related items from defense-news feeds and emits them as
normalized milestones (category inferred from content) for /api/ingest.
Category inference is heuristic — everything lands as PENDING for human review.

Usage:
  python scrapers/news_rss.py --fixtures --dry-run
  python scrapers/news_rss.py
"""
from __future__ import annotations

import argparse
import re
import sys
from typing import Any

import feedparser

import utils

# US defense-news + official feeds (from CLAUDE.md Subagent 2 sources).
FEEDS = [
    ("Breaking Defense", "https://breakingdefense.com/feed/"),
    ("DefenseScoop", "https://defensescoop.com/feed/"),
    ("C4ISRNET", "https://www.c4isrnet.com/arc/outboundfeeds/rss/"),
    ("af.mil News", "https://www.af.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=1"),
    ("DARPA News", "https://www.darpa.mil/rss/news"),
]

# Only keep items that look AI/autonomy-relevant.
RELEVANCE = (
    "ai", "artificial intelligence", "machine learning", "autonomous",
    "autonomy", "unmanned", "drone", "algorithm", "generative",
)

# Ordered keyword → Category rules (first match wins).
# NOTE: bare "intelligence" is deliberately NOT an ISR keyword — it collides
# with "artificial intelligence". ISR relies on surveillance/reconnaissance/isr.
CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("UNMANNED_SYSTEMS", ["unmanned", "drone", "uuv", "usv", "uav", "underwater", "robot"]),
    ("POLICY_DIRECTIVE", ["policy", "directive", "executive order", "strategy", "memorandum", "guidance"]),
    ("PROCUREMENT_CONTRACT", ["contract", "award", "procurement", "rfi", "solicitation", "ota"]),
    ("ISR", ["isr", "surveillance", "reconnaissance"]),
    ("COMMAND_CONTROL", ["command and control", "c2", "battle management", "jadc2"]),
    ("CYBER", ["cyber", "electronic warfare", "signals"]),
    ("TARGETING", ["targeting", "sensor-to-shooter", "fires"]),
    ("LOGISTICS_SUSTAINMENT", ["logistics", "sustainment", "maintenance", "supply"]),
    ("TRAINING_SIMULATION", ["wargame", "training", "simulation", "exercise", "tabletop"]),
    ("SPACE", ["space", "satellite", "orbital"]),
    ("MEDICAL", ["medical", "casualty", "health"]),
]
DEFAULT_CATEGORY = "RESEARCH_DEVELOPMENT"


def _has_word(text: str, keyword: str) -> bool:
    """Whole-word/phrase match so 'ai' doesn't hit 'airshow', 'maintenance'."""
    return re.search(rf"(?<!\w){re.escape(keyword)}(?!\w)", text) is not None


def is_relevant(text: str) -> bool:
    t = text.lower()
    return any(_has_word(t, k) for k in RELEVANCE)


def infer_category(text: str) -> str:
    t = text.lower()
    for category, keywords in CATEGORY_RULES:
        if any(_has_word(t, k) for k in keywords):
            return category
    return DEFAULT_CATEGORY


def map_entry(entry: Any, source_name: str) -> dict[str, Any] | None:
    title = getattr(entry, "title", None) or entry.get("title")
    link = getattr(entry, "link", None) or entry.get("link")
    if not title or not link:
        return None

    summary = getattr(entry, "summary", "") or entry.get("summary", "") or ""
    haystack = f"{title} {summary}"
    if not is_relevant(haystack):
        return None

    published = (
        getattr(entry, "published", None)
        or getattr(entry, "updated", None)
        or (entry.get("published") if hasattr(entry, "get") else None)
    )

    return utils.to_milestone(
        name=title,
        category=infer_category(haystack),
        actor=source_name,
        description=summary,
        source_url=link,
        source_name=source_name,
        dev_start_date=utils.normalize_date(published),
        significance=2,
    )


def parse_feed(content_or_url: str, source_name: str) -> list[dict[str, Any]]:
    parsed = feedparser.parse(content_or_url)
    out: list[dict[str, Any]] = []
    for entry in parsed.entries:
        item = map_entry(entry, source_name)
        if item:
            out.append(item)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Defense-news RSS scraper")
    utils.add_common_args(parser)
    args = parser.parse_args()

    items: list[dict[str, Any]] = []
    if args.fixtures:
        content = utils.load_fixture("news_rss.xml")
        items = parse_feed(content, "Defense News (fixture)")
    else:
        for source_name, url in FEEDS:
            try:
                items.extend(parse_feed(url, source_name))
            except Exception as e:  # one bad feed shouldn't kill the run
                print(f"[news_rss] {source_name} failed: {e}", file=sys.stderr)
            utils.polite_sleep(1.0)

    items = utils.local_dedupe(items)[: args.limit]
    print(f"[news_rss] {len(items)} milestone(s) prepared.", file=sys.stderr)
    utils.post_batch(items, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

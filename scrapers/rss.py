#!/usr/bin/env python3
"""Shared RSS machinery for the .mil/.gov agency scrapers.

Every agency scraper (af_mil, army_mil, navy_mil, defense_gov, darpa_mil,
gao_gov) is a thin config over this module: it supplies a list of (label, feed)
pairs and a default event type, and calls `run()`.

Design notes:
  * Sources are restricted to official .mil/.gov feeds — no commercial news
    (copyright). `assert_gov_source` enforces this at parse time.
  * Category is inferred from the item text (heuristic → PENDING for review).
  * Event type is inferred from the text, falling back to the source's default.
  * Program grouping is intentionally left empty for RSS items — a headline is
    an unreliable entity key, so these land ungrouped and an admin merges them
    into the right lifecycle from the review queue.
"""
from __future__ import annotations

import argparse
import re
import sys
from typing import Any, Iterable
from urllib.parse import urlparse

import feedparser

import utils
from programs import match_program  # curated cross-source program registry

# Only keep items that look AI/autonomy-relevant. "ai" is handled separately as
# a CASE-SENSITIVE acronym (see _AI_ACRONYM) so coincidental lowercase "ai"
# tokens (names, foreign words) don't false-positive.
RELEVANCE = (
    "artificial intelligence", "machine learning", "autonomous",
    "autonomy", "unmanned", "drone", "counter-uas", "algorithm",
    "generative", "neural",
)
_AI_ACRONYM = re.compile(r"(?<!\w)AI(?!\w)")  # case-sensitive uppercase acronym

# Entertainment/ceremony uses of "drone" (light shows) are not military AI.
# An item that only matches via one of these is skipped unless it also carries
# a stronger AI/autonomy signal.
NEGATIVE_CONTEXT = ("drone show", "drone light", "light show")

# Ordered keyword → Category rules (first match wins). Bare "intelligence" is
# deliberately NOT an ISR keyword — it collides with "artificial intelligence".
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

# Ordered keyword → EventType rules (first match wins). Used to place a news
# item on the lifecycle; falls back to the source's default_event_type.
EVENT_TYPE_RULES: list[tuple[str, list[str]]] = [
    # TEST is checked before FIELDING/DEPLOYMENT: an "operational test" is a
    # test, not a deployment. Bare "operational" is intentionally NOT a
    # deployment keyword — it co-occurs with testing too often.
    ("TEST", ["test", "tested", "trial", "demonstration", "evaluation", "flight test", "prototype"]),
    ("DEPLOYMENT", ["deployed", "deploys", "deployment", "in theater", "in combat"]),
    ("FIELDING", ["fielded", "fielding", "delivered", "delivery", "initial operating capability", "ioc"]),
    ("AWARD", ["awarded", "award", "contract", "wins", "selected for"]),
    ("SOLICITATION", ["solicitation", "rfi", "request for", "broad agency announcement", "baa"]),
    ("POLICY", ["policy", "directive", "strategy", "memorandum", "guidance", "executive order"]),
    ("RD_START", ["research", "program launch", "kicks off", "begins", "new program"]),
]


def _has_word(text: str, keyword: str) -> bool:
    """Whole-word/phrase match so 'ai' doesn't hit 'airshow', 'maintenance'."""
    return re.search(rf"(?<!\w){re.escape(keyword)}(?!\w)", text) is not None


def is_relevant(text: str) -> bool:
    t = text.lower()
    # Strong signal = any relevance term other than the broad "drone", or the
    # uppercase "AI" acronym. Used to rescue negative-context items that are
    # genuinely about military AI.
    strong = _AI_ACRONYM.search(text) is not None or any(
        _has_word(t, k) for k in RELEVANCE if k != "drone"
    )
    if any(neg in t for neg in NEGATIVE_CONTEXT) and not strong:
        return False  # e.g. a recreational "drone show", not military AI
    return strong or _has_word(t, "drone")


# Stricter accept set for PROCUREMENT (SAM.gov / USAspending). The award APIs are
# searched with broad keywords incl. "unmanned", which returns many routine
# platform-support awards (spare parts, maintenance, base ops for unmanned
# systems) that are NOT AI milestones. For contracts we therefore require a real
# AI/autonomy signal and deliberately DROP bare "unmanned" and "drone" — an
# unmanned-platform contract only counts if it also names autonomy/AI. This is
# what keeps the admin queue from filling with keyword-noise contracts.
PROCUREMENT_RELEVANCE = (
    "artificial intelligence", "machine learning", "autonomous", "autonomy",
    "counter-uas", "counter uas", "algorithm", "generative", "neural",
    "computer vision", "deep learning", "large language model", "predictive analytics",
    "autonomy software", "autonomous system",
)


def is_relevant_procurement(text: str) -> bool:
    """Whole-word AI/autonomy relevance for contracts (stricter than is_relevant).

    Accepts only on a genuine AI/autonomy term or the uppercase "AI" acronym;
    bare "unmanned"/"drone" do NOT qualify on their own (too noisy for awards).
    """
    t = text.lower()
    return _AI_ACRONYM.search(text) is not None or any(
        _has_word(t, k) for k in PROCUREMENT_RELEVANCE
    )


def infer_category(text: str) -> str:
    t = text.lower()
    for category, keywords in CATEGORY_RULES:
        if any(_has_word(t, k) for k in keywords):
            return category
    return DEFAULT_CATEGORY


def infer_event_type(text: str, default: str) -> str:
    t = text.lower()
    for event_type, keywords in EVENT_TYPE_RULES:
        if any(_has_word(t, k) for k in keywords):
            return event_type
    return default


def assert_gov_source(url: str) -> None:
    """Guard: only official .mil/.gov hosts are allowed (copyright policy)."""
    host = (urlparse(url).hostname or "").lower()
    if not (host.endswith(".mil") or host.endswith(".gov") or host in {"mil", "gov"}):
        raise ValueError(f"refusing non-.mil/.gov source: {host or url}")


def map_entry(entry: Any, source_name: str, default_event_type: str) -> dict[str, Any] | None:
    title = getattr(entry, "title", None) or (entry.get("title") if hasattr(entry, "get") else None)
    link = getattr(entry, "link", None) or (entry.get("link") if hasattr(entry, "get") else None)
    if not title or not link:
        return None

    summary = getattr(entry, "summary", "") or (entry.get("summary", "") if hasattr(entry, "get") else "") or ""
    haystack = f"{title} {summary}"
    if not is_relevant(haystack):
        return None

    published = (
        getattr(entry, "published", None)
        or getattr(entry, "updated", None)
        or (entry.get("published") if hasattr(entry, "get") else None)
    )
    event_date = utils.normalize_date(published)

    # Cross-source grouping: if the headline/summary names a known program, link
    # this event to it and adopt the program's canonical category. Unknown
    # programs stay ungrouped (program_* = None) for admin merge.
    program = match_program(haystack)

    return utils.to_milestone(
        name=title,
        category=program["category"] if program else infer_category(haystack),
        actor=source_name,
        description=summary,
        source_url=link,
        source_name=source_name,
        program_name=program["name"] if program else None,
        program_slug_value=program["slug"] if program else None,
        event_type=infer_event_type(haystack, default_event_type),
        event_date=event_date,
        # Significance by known-project relevance (4 if it names a tracked
        # program, else 2), not by any money or recency signal.
        significance=utils.program_significance(program),
    )


def parse_feed(content_or_url: str, source_name: str, default_event_type: str) -> list[dict[str, Any]]:
    # agent= sets the User-Agent for URL fetches (ignored for fixture strings);
    # some .mil/.gov WAFs 403 the default feedparser UA.
    parsed = feedparser.parse(content_or_url, agent=utils.USER_AGENT)
    out: list[dict[str, Any]] = []
    for entry in parsed.entries:
        item = map_entry(entry, source_name, default_event_type)
        if item:
            out.append(item)
    return out


def run(
    scraper_id: str,
    feeds: Iterable[tuple[str, str]],
    *,
    default_event_type: str,
    fixture: str | None = None,
    argv: list[str] | None = None,
) -> int:
    """Standard main() for an RSS-backed agency scraper."""
    parser = argparse.ArgumentParser(description=f"{scraper_id} .mil/.gov RSS scraper")
    utils.add_common_args(parser)
    args = parser.parse_args(argv)

    items: list[dict[str, Any]] = []
    if args.fixtures:
        if not fixture:
            print(f"[{scraper_id}] no fixture configured.", file=sys.stderr)
            return 2
        content = utils.load_fixture(fixture)
        items = parse_feed(content, f"{scraper_id} (fixture)", default_event_type)
    else:
        for source_name, url in feeds:
            try:
                assert_gov_source(url)
                items.extend(parse_feed(url, source_name, default_event_type))
            except Exception as e:  # one bad feed shouldn't kill the run
                print(f"[{scraper_id}] {source_name} failed: {e}", file=sys.stderr)
            utils.polite_sleep(1.0)

    items = utils.local_dedupe(items)[: args.limit]
    print(f"[{scraper_id}] {len(items)} event(s) prepared.", file=sys.stderr)
    utils.post_batch(items, dry_run=args.dry_run)
    return 0

#!/usr/bin/env python3
"""Curated program registry + matcher for cross-source lifecycle grouping.

Loads `programs.json` (the single source of truth) and matches scraped item text
against known US military AI/autonomy programs. A match lets a scraper emit a
stable `programSlug` so events from any source (SAM.gov, USAspending, DVIDS,
service RSS) collapse into one Program track. No match → the item stays
ungrouped and an admin merges it from the review queue.

Matching is deliberately precise (the original design avoided grouping on
headlines because arbitrary extraction is unreliable — a *curated* set is not):
  * `aliases` match case-insensitively as whole words/phrases.
  * `acronyms` match case-SENSITIVELY as whole words, so a lowercase coincidence
    or an ambiguous code (e.g. "CCA" = Circuit Card Assembly) can't false-hit.
First registry entry with any hit wins (keep specific programs earlier).

The TypeScript migration (scripts/backfill_programs) mirrors this logic against
the same JSON.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

_REGISTRY_PATH = Path(__file__).parent / "programs.json"


@lru_cache(maxsize=1)
def _registry() -> list[dict[str, Any]]:
    data = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
    return data.get("programs", [])


def _has_phrase(text_lower: str, phrase: str) -> bool:
    """Whole-word/phrase, case-insensitive (text already lowercased)."""
    return re.search(rf"(?<!\w){re.escape(phrase.lower())}(?!\w)", text_lower) is not None


def _has_acronym(text: str, acronym: str) -> bool:
    """Whole-word, CASE-SENSITIVE (original-case text)."""
    return re.search(rf"(?<!\w){re.escape(acronym)}(?!\w)", text) is not None


def program_query_terms() -> list[str]:
    """Registry-driven search terms for program-focused scraping.

    Returns one high-signal phrase per program (its first alias, else first
    acronym, else name), deduped. Used by the searchable scrapers (DVIDS,
    USAspending, SAM) via --program-focus so they pull coverage of the tracked
    programs specifically — not just the generic AI/autonomy keywords. Prefers
    the descriptive alias over a bare acronym to keep API queries low-noise.
    """
    seen: set[str] = set()
    out: list[str] = []
    for e in _registry():
        term = (e.get("aliases") or [None])[0] or (e.get("acronyms") or [None])[0] or e.get("name")
        if term and term.lower() not in seen:
            seen.add(term.lower())
            out.append(term)
    return out


def match_program(text: str) -> dict[str, Any] | None:
    """Return the registry entry whose alias/acronym appears in `text`, else None.

    The returned dict has: slug, name, category (plus aliases/acronyms). Callers
    pass slug → program_slug_value, name → program_name, category → the event's
    category (so a program's events share one canonical category/colour).
    """
    if not text:
        return None
    lower = text.lower()
    for entry in _registry():
        if any(_has_phrase(lower, a) for a in entry.get("aliases", [])):
            return entry
        if any(_has_acronym(text, a) for a in entry.get("acronyms", [])):
            return entry
    return None


if __name__ == "__main__":  # tiny CLI: echo the matched program for a phrase
    import sys

    hit = match_program(" ".join(sys.argv[1:]))
    print(hit["slug"] if hit else "(no match)")

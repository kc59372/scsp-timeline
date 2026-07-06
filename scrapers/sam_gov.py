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
import re
import sys
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest

import utils
from programs import match_program  # curated cross-source program registry
from rss import is_relevant  # shared whole-word AI/autonomy relevance gate

API_URL = "https://api.sam.gov/opportunities/v2/search"
KEYWORDS = ["artificial intelligence", "machine learning", "autonomous", "unmanned"]
PAGE_SIZE = 100

_TAG_RE = re.compile(r"<[^>]+>")


class SamQuotaExceeded(Exception):
    """Raised when SAM.gov returns its daily-quota 429 (code 900804).

    SAM.gov's public key has a hard daily request quota; once hit, every further
    call fails until the next UTC-midnight reset. We abort the run rather than
    burn time on doomed calls.
    """


def _looks_like_url(text: str) -> bool:
    return text.strip().lower().startswith(("http://", "https://"))


def _resolve_description(raw: str, api_key: str | None) -> str:
    """Return plain-text notice context.

    SAM.gov's `description` field is a *URL* to the notice text
    (api.sam.gov/.../noticedesc?noticeid=…), not the text itself. Fetch it,
    strip HTML, and return plain text so entries carry real context and can be
    relevance-checked on content — not just the cryptic FSC-coded title. A
    non-URL value (e.g. offline fixtures) is returned as-is; a fetch failure or
    missing key yields "" (the caller then falls back to a title-only check).
    """
    raw = (raw or "").strip()
    if not raw:
        return ""
    if not _looks_like_url(raw):
        return raw
    if not api_key:
        return ""
    url = raw + ("&" if "?" in raw else "?") + urlparse.urlencode({"api_key": api_key})
    req = urlrequest.Request(url, headers={"Accept": "application/json", "User-Agent": utils.USER_AGENT})
    try:
        with urlrequest.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urlerror.HTTPError as e:  # noqa: PERF203
        if e.code == 429:  # daily quota exhausted — abort, don't hammer
            raise SamQuotaExceeded("SAM.gov daily quota exceeded (HTTP 429)") from e
        print(f"[sam_gov] description fetch failed: {e}", file=sys.stderr)
        return ""
    except Exception as e:  # a bad description fetch shouldn't drop the notice
        print(f"[sam_gov] description fetch failed: {e}", file=sys.stderr)
        return ""
    body = data.get("description") if isinstance(data, dict) else None
    return " ".join(_TAG_RE.sub(" ", str(body)).split()) if body else ""


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


def map_opportunity(op: dict[str, Any], description: str) -> dict[str, Any]:
    """Map one SAM.gov opportunity record → normalized lifecycle event.

    Award notices (have an award amount/awardee) become AWARD events; everything
    else (solicitations, sources-sought, RFIs) becomes a SOLICITATION event.
    Both link to the same Program via the solicitation number. `description` is
    the resolved plain-text notice context (see `_resolve_description`).
    """
    award = op.get("award") if isinstance(op.get("award"), dict) else None
    awardee = (award.get("awardee") or {}).get("name") if award else None
    amount = _money(award.get("amount")) if award else None
    is_award = bool(award and (amount or awardee))

    title = op.get("title") or op.get("noticeId") or "Untitled SAM.gov notice"
    posted = utils.normalize_date(op.get("postedDate"))

    # A curated program name is a stronger, cross-source entity key than the
    # solicitation number: it unifies this contract with the program's news and
    # other contracts. Fall back to the solicitation number (links a
    # solicitation to its later award) when no known program is named.
    program = match_program(f"{title} {description}")

    return utils.to_milestone(
        name=title,
        category=program["category"] if program else "PROCUREMENT_CONTRACT",
        actor=op.get("fullParentPathName") or "US Government",
        description=description or op.get("type") or "",
        source_url=op.get("uiLink") or f"https://sam.gov/opp/{op.get('noticeId', '')}/view",
        source_name="SAM.gov",
        program_name=program["name"] if program else title,
        program_slug_value=program["slug"] if program else utils.program_slug(_program_key(op)),
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


def _date_windows(posted_from: str, posted_to: str) -> list[tuple[str, str]]:
    """Split [posted_from, posted_to] into ≤1-year MM/DD/YYYY windows.

    The SAM.gov Opportunities API rejects ranges longer than one year (HTTP 400),
    so a historical 2016→present backfill must be chunked.
    """
    start = datetime.strptime(posted_from, "%m/%d/%Y")
    end = datetime.strptime(posted_to, "%m/%d/%Y")
    windows: list[tuple[str, str]] = []
    while start <= end:
        # 364 days keeps each window strictly under the 1-year limit.
        win_end = min(start + timedelta(days=364), end)
        windows.append((start.strftime("%m/%d/%Y"), win_end.strftime("%m/%d/%Y")))
        start = win_end + timedelta(days=1)
    return windows


def fetch_live(api_key: str, posted_from: str, posted_to: str, limit: int) -> list[dict[str, Any]]:
    """Paginate the Opportunities API across all keywords and ≤1-year windows."""
    collected: list[dict[str, Any]] = []
    windows = _date_windows(posted_from, posted_to)
    for win_from, win_to in windows:
        for keyword in KEYWORDS:
            offset = 0
            while len(collected) < limit:
                params = {
                    "api_key": api_key,
                    "q": keyword,
                    "postedFrom": win_from,
                    "postedTo": win_to,
                    "limit": min(PAGE_SIZE, limit - len(collected)),
                    "offset": offset,
                }
                url = f"{API_URL}?{urlparse.urlencode(params)}"
                req = urlrequest.Request(url, headers={"Accept": "application/json", "User-Agent": utils.USER_AGENT})
                try:
                    with urlrequest.urlopen(req, timeout=30) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                except Exception as e:  # one bad window/keyword shouldn't kill the run
                    print(f"[sam_gov] {keyword} {win_from}-{win_to} failed: {e}", file=sys.stderr)
                    break
                page = data.get("opportunitiesData") or []
                collected.extend(page)
                total = int(data.get("totalRecords") or 0)
                offset += len(page)
                if not page or offset >= total:
                    break
                utils.polite_sleep(1.0)
            if len(collected) >= limit:
                return collected[:limit]
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
        api_key = None
        raw = json.loads(utils.load_fixture("sam_gov.json"))
        opportunities = (raw.get("opportunitiesData") or [])[: args.limit]
    else:
        api_key = os.environ.get("SAM_GOV_API_KEY")
        if not api_key:
            print("ERROR: SAM_GOV_API_KEY not set (or use --fixtures).", file=sys.stderr)
            return 2
        opportunities = fetch_live(api_key, args.posted_from, args.posted_to, args.limit)

    # SAM.gov's `q` search matches loosely (e.g. "machine" in "machining"), so
    # apply the shared whole-word relevance gate on title + fetched notice text
    # (moderate bar: a hit in either keeps the notice). This also enriches each
    # entry with real description context in place of the raw notice-desc URL.
    mapped: list[dict[str, Any]] = []
    dropped = 0
    quota_hit = False
    for op in opportunities:
        title = op.get("title") or op.get("noticeId") or ""
        try:
            description = _resolve_description(op.get("description") or "", api_key)
        except SamQuotaExceeded as e:
            print(f"[sam_gov] {e} — stopping early with what we have.", file=sys.stderr)
            quota_hit = True
            break
        if not args.fixtures:
            utils.polite_sleep(0.5)  # throttle the notice-desc endpoint
        if not is_relevant(f"{title} {description}"):
            dropped += 1
            continue
        mapped.append(map_opportunity(op, description))

    items = utils.local_dedupe(mapped)
    note = " [quota hit — partial]" if quota_hit else ""
    print(
        f"[sam_gov] {len(items)} milestone(s) prepared "
        f"({dropped} dropped as not AI-relevant of {len(opportunities)} fetched){note}.",
        file=sys.stderr,
    )
    utils.post_batch(items, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

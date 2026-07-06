#!/usr/bin/env python3
"""Historical backfill runner — populate the timeline from .mil/.gov sources.

Runs the full scraper roster in one pass so the review queue fills with the
lifecycle events (solicitation → award → test → fielding → deployment) of past
US military AI programs, back to 2016. Everything lands PENDING for admin review
and program-merge.

Sources (all official .mil/.gov — no commercial news):
  sam_gov      SAM.gov contracts (solicitations + awards)   → 2016→present (needs key)
  usaspending_gov  USAspending.gov DoD AI contract awards   → 2016→present (no key)
  dvids_gov    DVIDS DoD news / press releases              → 2016→present (needs key)
  darpa_mil    DARPA programs / news                         → RD_START, TEST
  af_mil       af.mil news                                   → fielding/deploy
  army_mil     army.mil news                                 → fielding/deploy
  navy_mil     navy.mil news                                 → fielding/deploy
  spaceforce_mil spaceforce.mil news                          → fielding/deploy
  defense_gov  DoD News (defense.gov)                        → mixed
  gao_gov      GAO oversight reports                         → policy
  congress_gov Congress.gov AI legislation                   → policy
  sbir_gov     SBIR/STTR DoD AI awards                        → RD_START

Usage:
  python scrapers/backfill.py --fixtures --dry-run    # offline smoke test
  python scrapers/backfill.py --limit 200             # live fetch + POST
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).parent

# (script, extra args). sam_gov gets the historical start date.
ROSTER: list[tuple[str, list[str]]] = [
    ("sam_gov.py", ["--posted-from", "01/01/2016"]),
    ("usaspending_gov.py", ["--since", "01/01/2016"]),
    ("dvids_gov.py", ["--since", "2016-01-01", "--limit", "500"]),
    ("darpa_mil.py", []),
    ("af_mil.py", []),
    ("army_mil.py", []),
    ("navy_mil.py", []),
    ("spaceforce_mil.py", []),
    ("defense_gov.py", []),
    ("gao_gov.py", []),
    ("congress_gov.py", []),
    ("sbir_gov.py", []),
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Historical .mil/.gov backfill runner")
    parser.add_argument("--fixtures", action="store_true", help="Use offline fixtures for every scraper.")
    parser.add_argument("--dry-run", action="store_true", help="Print normalized JSON; do not POST.")
    parser.add_argument("--limit", type=int, default=200, help="Per-scraper item cap (default 200).")
    parser.add_argument(
        "--only",
        default="",
        help="Comma-separated scraper names to run (e.g. 'sam_gov,darpa_mil'); default all.",
    )
    args = parser.parse_args()

    only = {s.strip() for s in args.only.split(",") if s.strip()}
    common = ["--limit", str(args.limit)]
    if args.fixtures:
        common.append("--fixtures")
    if args.dry_run:
        common.append("--dry-run")

    failures: list[str] = []
    for script, extra in ROSTER:
        name = script.removesuffix(".py")
        if only and name not in only:
            continue
        cmd = [sys.executable, str(HERE / script), *common, *extra]
        print(f"\n=== backfill: {name} ===", file=sys.stderr)
        result = subprocess.run(cmd)
        if result.returncode != 0:
            failures.append(name)
            print(f"[backfill] {name} exited {result.returncode}", file=sys.stderr)

    print(f"\n[backfill] done. {len(ROSTER) - len(failures)} ok, {len(failures)} failed.", file=sys.stderr)
    if failures:
        print(f"[backfill] failed: {', '.join(failures)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

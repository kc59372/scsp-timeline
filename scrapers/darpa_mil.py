#!/usr/bin/env python3
"""darpa.mil — DARPA news (AI/autonomy programs → lifecycle events).

Thin config over rss.py. DARPA is where programs *start*, so the default event
type is RD_START; content keywords (e.g. "flight test", "demonstration")
override it to TEST for maturation milestones.

Usage:
  python scrapers/darpa_mil.py --fixtures --dry-run
  python scrapers/darpa_mil.py
"""
import rss

SOURCE = "DARPA News"
FEEDS = [(SOURCE, "https://www.darpa.mil/rss.xml")]

if __name__ == "__main__":
    raise SystemExit(rss.run("darpa_mil", FEEDS, default_event_type="RD_START", fixture="darpa_mil.xml"))

#!/usr/bin/env python3
"""defense.gov — DoD News (AI/autonomy items → lifecycle events).

Thin config over rss.py. DoD News spans the whole lifecycle, so the default
event type is OTHER; content keywords (test/award/fielded/…) refine it.

Usage:
  python scrapers/defense_gov.py --fixtures --dry-run
  python scrapers/defense_gov.py
"""
import rss

SOURCE = "DoD News (defense.gov)"
# defense.gov DNN ArticleCS RSS. ContentType=1 is the main DoD News feed (rich
# in AI/autonomy items); ContentType=800 is human-interest and yields none.
FEEDS = [(SOURCE, "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=500")]

if __name__ == "__main__":
    raise SystemExit(rss.run("defense_gov", FEEDS, default_event_type="OTHER", fixture="defense_gov.xml"))

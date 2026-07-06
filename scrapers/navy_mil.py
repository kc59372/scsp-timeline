#!/usr/bin/env python3
"""navy.mil — official U.S. Navy news (AI/autonomy items → lifecycle events).

Thin config over rss.py. Default event type FIELDING; content keywords override.

Usage:
  python scrapers/navy_mil.py --fixtures --dry-run
  python scrapers/navy_mil.py
"""
import rss

SOURCE = "navy.mil News"
# TODO: verify feed URL. navy.mil's ArticleCS endpoint responds 200 but returns
# an empty feed for the Site/ContentType combos tried (Site=1, Site=1054) — the
# correct Site id for Navy News Service still needs confirming. Until then this
# scraper yields nothing (the roster tolerates that).
FEEDS = [(SOURCE, "https://www.navy.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=1054&max=500")]

if __name__ == "__main__":
    raise SystemExit(rss.run("navy_mil", FEEDS, default_event_type="FIELDING", fixture="navy_mil.xml"))

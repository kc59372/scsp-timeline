#!/usr/bin/env python3
"""army.mil — official U.S. Army news (AI/autonomy items → lifecycle events).

Thin config over rss.py. Default event type FIELDING; content keywords override.

Usage:
  python scrapers/army_mil.py --fixtures --dry-run
  python scrapers/army_mil.py
"""
import rss

SOURCE = "army.mil News"
# Army News Service RSS (static/1.xml = Army.mil news).
FEEDS = [(SOURCE, "https://www.army.mil/rss/static/1.xml")]

if __name__ == "__main__":
    raise SystemExit(rss.run("army_mil", FEEDS, default_event_type="FIELDING", fixture="army_mil.xml"))

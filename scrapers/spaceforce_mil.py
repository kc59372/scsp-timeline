#!/usr/bin/env python3
"""spaceforce.mil — U.S. Space Force news (AI/autonomy items → lifecycle events).

Thin config over rss.py. Default event type FIELDING; content keywords override.
Category is inferred per item (much of this feed maps to SPACE / ISR).

Usage:
  python scrapers/spaceforce_mil.py --fixtures --dry-run
  python scrapers/spaceforce_mil.py
"""
import rss

SOURCE = "Space Force News"
# Space Force DNN ArticleCS RSS (Site=1060 is the main spaceforce.mil site).
FEEDS = [(SOURCE, "https://www.spaceforce.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=1060&max=500")]

if __name__ == "__main__":
    raise SystemExit(rss.run("spaceforce_mil", FEEDS, default_event_type="FIELDING", fixture="spaceforce_mil.xml"))

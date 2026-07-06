#!/usr/bin/env python3
"""af.mil — official U.S. Air Force news (AI/autonomy items → lifecycle events).

Thin config over rss.py. Service-site announcements most often report a system
being fielded/deployed, so the default event type is FIELDING (content keywords
override it — e.g. a "flight test" story becomes TEST).

Usage:
  python scrapers/af_mil.py --fixtures --dry-run
  python scrapers/af_mil.py
"""
import rss

SOURCE = "af.mil News"
# af.mil DNN ArticleCS RSS (Site=1 is the main af.mil site).
FEEDS = [(SOURCE, "https://www.af.mil/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=1&max=500")]

if __name__ == "__main__":
    raise SystemExit(rss.run("af_mil", FEEDS, default_event_type="FIELDING", fixture="af_mil.xml"))

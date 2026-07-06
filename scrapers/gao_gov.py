#!/usr/bin/env python3
"""gao.gov — GAO oversight reports (AI/autonomy items → POLICY events).

Thin config over rss.py. GAO reports are oversight/policy artifacts, so the
default event type is POLICY. Relevance filtering keeps only AI/autonomy items.

Usage:
  python scrapers/gao_gov.py --fixtures --dry-run
  python scrapers/gao_gov.py
"""
import rss

SOURCE = "GAO Reports"
FEEDS = [(SOURCE, "https://www.gao.gov/rss/reports.xml")]

if __name__ == "__main__":
    raise SystemExit(rss.run("gao_gov", FEEDS, default_event_type="POLICY", fixture="gao_gov.xml"))

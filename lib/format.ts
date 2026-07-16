/**
 * Display helpers for milestones — date formatting, primary-date selection,
 * and the dev-cycle meter (ported from legacy/app.js computeDevelopmentMeter).
 */
import type { Milestone } from "./milestones";
import { cleanText } from "./clean";

// Scraped items carry the *feed* name in `actor` (e.g. "af.mil News",
// "DoD News (defense.gov)", "DVIDS (Army)"). On a policymaker-facing card we
// want the plain owning organization instead. Exact feed labels map here;
// "DVIDS (X)" is handled by pattern; everything else (real awardee/org names on
// procurement events) passes through untouched.
const ACTOR_LABELS: Record<string, string> = {
  "af.mil News": "Air Force",
  "DoD News (defense.gov)": "DoD",
  "DARPA News": "DARPA",
  "Space Force News": "Space Force",
};

const DVIDS_BRANCH: Record<string, string> = {
  "air force": "Air Force",
  army: "Army",
  navy: "Navy",
  marines: "Marines",
  "space force": "Space Force",
  joint: "Joint Force",
};

/** Clean owning-organization label for a milestone's `actor` (feed → org). */
export function displayActor(actor: string | null | undefined): string {
  const a = (actor ?? "").trim();
  if (!a) return "";
  if (ACTOR_LABELS[a]) return ACTOR_LABELS[a];
  const dvids = a.match(/^DVIDS\s*\(([^)]+)\)$/i);
  if (dvids) {
    const branch = dvids[1].trim();
    return DVIDS_BRANCH[branch.toLowerCase()] ?? branch;
  }
  return a;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Format an ISO date string for display. Research dates are often month- or
 * year-precision only; we render "Mon YYYY" (or "YYYY" for Jan-1 dates, which
 * our seed uses to encode year-only values). Never fabricates day precision.
 */
export function formatMilestoneDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = d.getUTCMonth();
  const year = d.getUTCFullYear();
  // Jan 1 is our year-only sentinel from the seed/scrapers.
  if (month === 0 && d.getUTCDate() === 1) return String(year);
  return `${MONTHS[month]} ${year}`;
}

/** First known date, latest-stage first — used as the timeline anchor. */
export function primaryDateIso(m: Milestone): string | null {
  return (
    m.eventDate ??
    m.deploymentDate ??
    m.fieldingDate ??
    m.testDate ??
    m.procurementDate ??
    m.devStartDate ??
    null
  );
}

/** Year used for grouping/sorting; null if the milestone has no dates. */
export function primaryYear(m: Milestone): number | null {
  const iso = primaryDateIso(m);
  if (!iso) return null;
  const y = new Date(iso).getUTCFullYear();
  return Number.isNaN(y) ? null : y;
}

export interface DevCycle {
  years: number;
  bars: number; // 1–5
}

/**
 * Dev-cycle meter: span from devStartDate to the primary date, scaled to 1–5
 * bars (2 years per bar, 10+ years = full). Ported from legacy/app.js.
 */
export function devCycle(m: Milestone): DevCycle | null {
  if (!m.devStartDate) return null;
  const start = new Date(m.devStartDate).getUTCFullYear();
  const endIso = primaryDateIso(m);
  const end = endIso ? new Date(endIso).getUTCFullYear() : start;
  const years = Math.max(0, end - start);
  const bars = Math.max(1, Math.min(5, Math.ceil(years / 2) || 1));
  return { years, bars };
}

// Acronyms that must stay upper-cased when we de-scream a raw contract title.
const ACRONYMS = new Set([
  "AI", "ML", "ISR", "C2", "C4ISR", "UAS", "UAV", "UUV", "USV", "USG", "DOD",
  "JAIC", "CDAO", "ATR", "IR", "ADA", "US", "USA", "GPS", "EW", "T&E", "R&D",
  "AMSTC", "TETRAS", "JWCC", "OTA", "RFI", "RFP", "II", "III", "IV",
]);

/**
 * De-SCREAM a raw all-caps contract description into sentence-ish Title Case,
 * preserving known acronyms. Leaves already mixed-case (author-clean) names
 * untouched, so seed contract names pass through unchanged.
 */
function prettyCase(s: string): string {
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (!letters) return s;
  const upperShare = s.replace(/[^A-Z]/g, "").length / letters.length;
  if (upperShare < 0.8) return s; // already mixed-case — leave it alone
  return s.replace(/[A-Za-z]+/g, (w) =>
    ACRONYMS.has(w.toUpperCase())
      ? w.toUpperCase()
      : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );
}

/**
 * Build a scannable title for a procurement contract. USAspending awards arrive
 * as raw ALL-CAPS descriptions with government boilerplate prefixes, truncated
 * mid-word at the 120-char scrape cap (e.g. "IGF::OT::IGF AUTONOMOUS AND
 * AUTOMATED WEAPON SYSTEM DESIG"). We strip the boilerplate, de-scream to Title
 * Case, and fix mid-word truncation with an ellipsis. The full untouched text
 * still lives in `description`, shown in the card body. Idempotent on clean
 * seed names.
 */
export function contractTitle(name: string): string {
  const raw = name.trim();
  let s = raw
    .replace(/^IGF::[A-Z]{2,3}::IGF\s+/i, "")
    .replace(/^THE CONTRACTOR SHALL(?:\s+PERFORM)?\s+/i, "")
    .replace(/^THIS (?:WORK )?EFFORT (?:IS |WILL )?(?:TO )?(?:INVESTIGATE |PROVIDE )?/i, "")
    .replace(/^CONTRACT TO\s+/i, "")
    .replace(/^\d+\s*MONTH\b.*?OP\.?\s*EST\.?\s*/i, "") // "12MONTH BASE PERIOD 12MONTH OP. EST "
    .trim();
  s = prettyCase(s);
  // The scrape caps names at 120 chars, often mid-word — trim the partial
  // trailing word and mark the elision.
  if (raw.length >= 118 && !/[.!?]$/.test(raw)) {
    s = s.replace(/\s+\S*$/, "").replace(/[,;:]+$/, "") + "…";
  }
  return s || raw;
}

/**
 * Display title for any milestone — cleans up raw scraped procurement titles,
 * passes everything else through untouched.
 */
export function displayName(m: Milestone): string {
  // A procurement award (raw ALL-CAPS scraped title) is identified by its
  // contract fields, not the category — categories are now real mission domains.
  if (m.contractNumber != null || m.contractValue != null) return contractTitle(m.name);
  return cleanText(m.name) || m.name;
}

/** Description with all HTML/links stripped and entities decoded, for display. */
export function displayDescription(text: string | null | undefined): string {
  return cleanText(text);
}

/** "$1.4B" / "$99.0M" / "$14.78M" style for contract values (raw USD in). */
export function formatUsd(value: number | null): string | null {
  if (value == null) return null;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

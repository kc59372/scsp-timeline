/**
 * Display helpers for milestones — date formatting, primary-date selection,
 * and the dev-cycle meter (ported from legacy/app.js computeDevelopmentMeter).
 */
import type { Milestone } from "./milestones";

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

/** "$1.4B" / "$99.0M" / "$14.78M" style for contract values (raw USD in). */
export function formatUsd(value: number | null): string | null {
  if (value == null) return null;
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

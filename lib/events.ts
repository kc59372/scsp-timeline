/**
 * EventType display metadata — labels + ordering for the lifecycle stages.
 * Mirrors the EventType enum in prisma/schema.prisma (source of truth).
 */

/** Ordered by lifecycle maturity so selects/timelines read chronologically. */
export const EVENT_TYPES = [
  "RD_START",
  "SOLICITATION",
  "AWARD",
  "TEST",
  "FIELDING",
  "DEPLOYMENT",
  "POLICY",
  "OTHER",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

const EVENT_TYPE_LABELS: Record<string, string> = {
  RD_START: "R&D Start",
  SOLICITATION: "Solicitation",
  AWARD: "Award",
  TEST: "Test / Evaluation",
  FIELDING: "Fielding",
  DEPLOYMENT: "Deployment",
  POLICY: "Policy / Directive",
  OTHER: "Other",
};

export function eventTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return EVENT_TYPE_LABELS[type] ?? type;
}

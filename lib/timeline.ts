/**
 * Timeline entry model — turns a flat list of milestone *events* into a mix of
 * standalone cards and program lifecycle tracks for the public timeline.
 *
 * An event with a `programId` clusters with its siblings into one ProgramEntry
 * (rendered as a request → award → test → deployment track); an event without a
 * program renders as a standalone MilestoneEntry (an individual card).
 */
import type { Milestone, Program } from "./milestones";
import { primaryYear, primaryDateIso } from "./format";
import { EVENT_TYPES } from "./events";

export interface MilestoneEntry {
  kind: "milestone";
  id: string;
  year: number | null;
  milestone: Milestone;
}

export interface ProgramEntry {
  kind: "program";
  id: string;
  year: number | null;
  program: Program;
  events: Milestone[]; // ordered by lifecycle (date, then event-type maturity)
}

export type TimelineEntry = MilestoneEntry | ProgramEntry;

const EVENT_RANK = new Map<string, number>(EVENT_TYPES.map((t, i) => [t, i]));

/** Lifecycle order: by date, then by event-type maturity, then name. */
export function orderEvents(events: Milestone[]): Milestone[] {
  return [...events].sort((a, b) => {
    const da = primaryDateIso(a);
    const db = primaryDateIso(b);
    if (da && db && da !== db) return da < db ? -1 : 1;
    if (da && !db) return -1;
    if (!da && db) return 1;
    const ra = EVENT_RANK.get(a.eventType ?? "") ?? 99;
    const rb = EVENT_RANK.get(b.eventType ?? "") ?? 99;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Group events into timeline entries. Programs anchor at their earliest event
 * year so the track reads chronologically from program inception.
 */
export function buildTimelineEntries(milestones: Milestone[]): TimelineEntry[] {
  const byProgram = new Map<string, Milestone[]>();
  const entries: TimelineEntry[] = [];

  for (const m of milestones) {
    if (m.programId && m.program) {
      const list = byProgram.get(m.programId) ?? [];
      list.push(m);
      byProgram.set(m.programId, list);
    } else {
      entries.push({ kind: "milestone", id: m.id, year: primaryYear(m), milestone: m });
    }
  }

  for (const [programId, group] of byProgram) {
    const events = orderEvents(group);
    const years = events.map((e) => primaryYear(e)).filter((v): v is number => v != null);
    entries.push({
      kind: "program",
      id: programId,
      year: years.length ? Math.min(...years) : null,
      program: group[0].program!,
      events,
    });
  }

  return entries;
}

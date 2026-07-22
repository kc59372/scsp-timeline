/**
 * Data access for the PUBLIC pages — one switch between two backends:
 *
 *  - Default (the live Vercel app): read over HTTP via lib/milestones.ts
 *    (→ /api → Prisma). Fully dynamic, live data. This is the deployed site.
 *  - STATIC_EXPORT=1 (the flat-HTML backup): read the frozen data/snapshot.json
 *    at build time via lib/snapshot.ts, so the export needs no server or DB.
 *
 * Public pages import ONLY from here, so switching backends never touches the
 * page code. lib/snapshot.ts (which uses `fs`) is lazy-imported so it is never
 * pulled into the live/dynamic runtime — only when actually exporting.
 *
 * Server-only module: do not import from a "use client" component.
 */
import {
  fetchMilestones,
  fetchMilestone,
  fetchProgram,
  type Milestone,
  type MilestonesResponse,
  type ProgramWithEvents,
} from "./milestones";

const STATIC = process.env.STATIC_EXPORT === "1";

export async function loadMilestones(
  params: { category?: string; page?: number; pageSize?: number | "all" } = {},
): Promise<MilestonesResponse> {
  if (STATIC) return (await import("./snapshot")).getMilestones(params);
  return fetchMilestones(params);
}

export async function loadMilestone(id: string): Promise<Milestone | null> {
  if (STATIC) return (await import("./snapshot")).getMilestone(id);
  return fetchMilestone(id);
}

export async function loadProgram(id: string): Promise<ProgramWithEvents | null> {
  if (STATIC) return (await import("./snapshot")).getProgram(id);
  return fetchProgram(id);
}

/**
 * generateStaticParams sources for the dynamic routes. In the live app these
 * return [] so the routes stay on-demand dynamic (unchanged behavior); only the
 * static export enumerates every id to pre-render one HTML file per entry.
 */
export async function staticMilestoneParams(): Promise<{ id: string }[]> {
  if (!STATIC) return [];
  return (await import("./snapshot")).allMilestoneIds().map((id) => ({ id }));
}

export async function staticProgramParams(): Promise<{ id: string }[]> {
  if (!STATIC) return [];
  return (await import("./snapshot")).allProgramIds().map((id) => ({ id }));
}

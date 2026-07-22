/**
 * Build-time data source for the STATIC HTML export.
 *
 * The dynamic app reads live data over HTTP via lib/milestones.ts (→ /api →
 * Prisma). A static export has no server at runtime, so the public pages read a
 * frozen JSON snapshot (data/snapshot.json) here instead. Regenerate the
 * snapshot from the live site with `node scripts/snapshot.mjs`.
 *
 * This module uses `fs` and must only be imported by SERVER components
 * (the public page.tsx files) — never a "use client" component.
 */
import fs from "fs";
import path from "path";
import type { Milestone, MilestonesResponse, ProgramWithEvents } from "./milestones";

let cache: Milestone[] | null = null;

/** All approved milestones from the committed snapshot (cached per build). */
function allMilestones(): Milestone[] {
  if (!cache) {
    const raw = fs.readFileSync(path.join(process.cwd(), "data", "snapshot.json"), "utf8");
    const data = JSON.parse(raw) as { items: Milestone[] };
    cache = data.items.filter((m) => m.entryStatus === "APPROVED");
  }
  return cache;
}

/** Snapshot equivalent of fetchMilestones() — same shape the pages expect. */
export function getMilestones(
  params: { category?: string; page?: number; pageSize?: number | "all" } = {},
): MilestonesResponse {
  let items = allMilestones();
  if (params.category) items = items.filter((m) => m.category === params.category);
  const total = items.length;

  const pageSize = params.pageSize ?? "all";
  if (pageSize !== "all") {
    const page = params.page ?? 1;
    items = items.slice((page - 1) * pageSize, page * pageSize);
    return { items, total, page, pageSize };
  }
  return { items, total, page: 1, pageSize: total };
}

/** Snapshot equivalent of fetchMilestone(id). */
export function getMilestone(id: string): Milestone | null {
  return allMilestones().find((m) => m.id === id) ?? null;
}

/** Snapshot equivalent of fetchProgram(id): program meta + its approved events. */
export function getProgram(id: string): ProgramWithEvents | null {
  const events = allMilestones().filter((m) => m.programId === id);
  if (events.length === 0) return null;
  // Program metadata is embedded on each event's `program` relation.
  const meta = events.find((e) => e.program)?.program;
  if (!meta) return null;
  return { ...meta, events };
}

/** All milestone ids — for generateStaticParams on /system/[id]. */
export function allMilestoneIds(): string[] {
  return allMilestones().map((m) => m.id);
}

/** All distinct program ids — for generateStaticParams on /program/[id]. */
export function allProgramIds(): string[] {
  return [...new Set(allMilestones().map((m) => m.programId).filter((x): x is string => !!x))];
}

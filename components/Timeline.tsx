"use client";

import type { Milestone } from "@/lib/milestones";
import { buildTimelineEntries, type TimelineEntry } from "@/lib/timeline";
import { MilestoneCard } from "./MilestoneCard";
import { ProgramCard } from "./ProgramCard";

/**
 * Vertical spine timeline grouped by year. Events belonging to a program render
 * as one lifecycle track (ProgramCard); standalone events render as cards. Each
 * year header shows a count (density indicator).
 */
export function Timeline({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return (
      <div className="py-16 text-center font-mono text-sm text-gray-500">
        No entries matching the selected filters.
      </div>
    );
  }

  const entries = buildTimelineEntries(milestones);

  // Group by anchor year (undated → "Undated" bucket at the end).
  const groups = new Map<string, TimelineEntry[]>();
  for (const e of entries) {
    const key = e.year == null ? "Undated" : String(e.year);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === "Undated") return 1;
    if (b === "Undated") return -1;
    return Number(a) - Number(b);
  });

  return (
    <div className="relative mt-8 pl-8 before:absolute before:bottom-0 before:left-[3px] before:top-0 before:w-0.5 before:bg-edge">
      {sortedKeys.map((year) => {
        const items = groups.get(year)!;
        return (
          <div key={year} className="relative mb-14 last:mb-8">
            <div className="relative z-10 mb-6 -ml-[2.7rem] inline-flex items-center gap-2 rounded bg-ink px-3 py-1 font-mono text-sm font-bold tracking-wide text-white shadow-sm">
              <span>{year}</span>
              <span className="text-xs font-normal text-white/70">
                · {items.length} {items.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            <div className="flex flex-col gap-6">
              {items.map((entry) => (
                <div
                  key={entry.id}
                  className={`relative before:absolute before:-left-8 before:top-5 before:z-[5] before:h-2 before:w-2 before:-translate-x-[3px] before:rounded-full before:border-2 before:border-paper ${entry.kind === "program" ? "before:bg-accent before:shadow-[0_0_0_4px_rgba(179,25,66,0.18)]" : "before:bg-blue-400 before:shadow-[0_0_0_4px_rgba(59,130,246,0.15)]"}`}
                >
                  {entry.kind === "program" ? (
                    <ProgramCard program={entry.program} events={entry.events} />
                  ) : (
                    <MilestoneCard milestone={entry.milestone} />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

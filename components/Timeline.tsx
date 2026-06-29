"use client";

import type { Milestone } from "@/lib/milestones";
import { primaryYear } from "@/lib/format";
import { MilestoneCard } from "./MilestoneCard";

/**
 * Vertical spine timeline grouped by year. Ports the legacy spine + year-pill
 * layout to Tailwind. Each year header shows a count (density indicator).
 */
export function Timeline({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return (
      <div className="py-16 text-center font-mono text-sm text-gray-500">
        No entries matching the selected filters.
      </div>
    );
  }

  // Group by year (undated → "Undated" bucket at the end).
  const groups = new Map<string, Milestone[]>();
  for (const m of milestones) {
    const y = primaryYear(m);
    const key = y == null ? "Undated" : String(y);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
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
            <div className="relative z-10 mb-6 -ml-[2.7rem] inline-flex items-center gap-2 rounded border border-edge bg-ink px-3 py-1 font-mono text-sm font-bold tracking-wide text-gray-100 shadow-lg shadow-black/80">
              <span>{year}</span>
              <span className="text-xs font-normal text-gray-500">
                · {items.length} {items.length === 1 ? "entry" : "entries"}
              </span>
            </div>
            <div className="flex flex-col gap-6">
              {items.map((m) => (
                <div
                  key={m.id}
                  className="relative before:absolute before:-left-8 before:top-5 before:z-[5] before:h-2 before:w-2 before:-translate-x-[3px] before:rounded-full before:border-2 before:border-ink before:bg-blue-400 before:shadow-[0_0_0_4px_rgba(59,130,246,0.15)]"
                >
                  <MilestoneCard milestone={m} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

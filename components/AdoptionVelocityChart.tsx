"use client";

import type { Milestone } from "@/lib/milestones";
import { primaryYear } from "@/lib/format";

const START_YEAR = 2016;
const END_YEAR = 2026;

/**
 * Hand-rolled adoption-velocity bar chart: milestones per year, 2016–2026.
 * No charting dependency — plain divs + Tailwind. Recomputes from whatever
 * (possibly filtered) set it's handed, so it tracks the active filters.
 */
export function AdoptionVelocityChart({ milestones }: { milestones: Milestone[] }) {
  const years = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);
  const counts = new Map<number, number>(years.map((y) => [y, 0]));
  for (const m of milestones) {
    const y = primaryYear(m);
    if (y != null && counts.has(y)) counts.set(y, counts.get(y)! + 1);
  }
  const max = Math.max(1, ...Array.from(counts.values()));

  return (
    <div className="rounded-lg border border-edge bg-panel p-5">
      <div className="mb-1 font-mono text-xs uppercase tracking-[0.1em] text-signal">
        Adoption Velocity
      </div>
      <p className="mb-5 text-sm text-gray-400">
        Tracked US military AI milestones per year — the pace of adoption over time.
      </p>
      <div className="flex h-44 items-end gap-1.5 sm:gap-2">
        {years.map((y) => {
          const c = counts.get(y)!;
          const pct = (c / max) * 100;
          return (
            <div key={y} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="font-mono text-[0.65rem] text-gray-400">{c || ""}</span>
              <div
                className="w-full rounded-t bg-gradient-to-t from-blue-600 to-signal transition-all"
                style={{ height: `${Math.max(pct, c > 0 ? 4 : 0)}%` }}
                title={`${y}: ${c} milestone(s)`}
              />
              <span className="font-mono text-[0.6rem] text-gray-500">
                {`'${String(y).slice(2)}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

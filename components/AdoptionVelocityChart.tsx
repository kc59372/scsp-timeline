"use client";

import { useState } from "react";
import type { Milestone } from "@/lib/milestones";
import { primaryYear } from "@/lib/format";
import { categoryColor, categoryLabel } from "@/lib/categories";

const START_YEAR = 2016;
const END_YEAR = 2026;
const CHART_HEIGHT_PX = 150; // tallest bar (max-count year)

interface Slice {
  category: string;
  count: number;
}

/** SVG donut: one gapped arc per category slice, total in the hole. */
function CategoryDonut({ slices, total }: { slices: Slice[]; total: number }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const GAP = slices.length > 1 ? 3 : 0; // 2px-ish surface gap between slices
  let offset = 0;

  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" role="img" aria-label="Category share">
      {/* track */}
      <circle cx="50" cy="50" r={R} fill="none" stroke="var(--donut-track, #e5e7eb)" strokeWidth="14" />
      <g transform="rotate(-90 50 50)">
        {slices.map((s) => {
          const frac = s.count / total;
          const dash = Math.max(0, frac * C - GAP);
          const seg = (
            <circle
              key={s.category}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={categoryColor(s.category)}
              strokeWidth="14"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-offset}
            >
              <title>{`${categoryLabel(s.category)}: ${s.count} (${Math.round(frac * 100)}%)`}</title>
            </circle>
          );
          offset += frac * C;
          return seg;
        })}
      </g>
      <text x="50" y="47" textAnchor="middle" className="fill-ink font-mono" style={{ fontSize: "16px", fontWeight: 700 }}>
        {total}
      </text>
      <text x="50" y="60" textAnchor="middle" className="fill-gray-500 font-mono" style={{ fontSize: "7px" }}>
        {total === 1 ? "EVENT" : "EVENTS"}
      </text>
    </svg>
  );
}

/**
 * Hand-rolled adoption-velocity bar chart: milestones per year, 2016–2026.
 * Hovering (or clicking, to pin) a year bar pops out a donut breaking that
 * year's events down by category, with a labeled legend + percentages.
 * Recomputes from whatever (possibly filtered) set it's handed.
 */
export function AdoptionVelocityChart({ milestones }: { milestones: Milestone[] }) {
  const [hoverYear, setHoverYear] = useState<number | null>(null);
  const [pinnedYear, setPinnedYear] = useState<number | null>(null);
  const activeYear = hoverYear ?? pinnedYear;

  const years = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i);
  const counts = new Map<number, number>(years.map((y) => [y, 0]));
  const byCategory = new Map<number, Map<string, number>>(years.map((y) => [y, new Map()]));
  for (const m of milestones) {
    const y = primaryYear(m);
    if (y != null && counts.has(y)) {
      counts.set(y, counts.get(y)! + 1);
      const cat = byCategory.get(y)!;
      cat.set(m.category, (cat.get(m.category) ?? 0) + 1);
    }
  }
  const max = Math.max(1, ...Array.from(counts.values()));

  const slicesFor = (y: number): Slice[] =>
    Array.from(byCategory.get(y)!.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count); // largest slice first

  return (
    <div className="rounded-lg border border-edge bg-panel p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-signal">Adoption Velocity</span>
        <span className="font-mono text-[0.65rem] text-gray-500">hover a year for category share</span>
      </div>
      <p className="mb-5 text-sm text-gray-600">
        Tracked US military AI milestones per year — the pace of adoption over time.
      </p>
      {/* Pixel heights (not %) so bars render reliably regardless of flex
          height resolution; bars bottom-align and grow upward. */}
      <div className="flex items-end gap-1.5 sm:gap-2">
        {years.map((y, i) => {
          const c = counts.get(y)!;
          const h = c > 0 ? Math.max(6, Math.round((c / max) * CHART_HEIGHT_PX)) : 0;
          const isActive = activeYear === y;
          // Keep the popover on-screen: anchor left for the first years, right
          // for the last, centered otherwise.
          const anchor =
            i <= 1 ? "left-0" : i >= years.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2";

          return (
            <div
              key={y}
              className="relative flex flex-1 flex-col items-center gap-1"
              onMouseEnter={() => setHoverYear(y)}
              onMouseLeave={() => setHoverYear(null)}
            >
              {/* pop-out donut */}
              {isActive && c > 0 && (
                <div
                  className={`absolute bottom-[calc(100%+0.75rem)] z-20 ${anchor} w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-edge bg-panel p-4 shadow-xl shadow-black/10`}
                >
                  <div className="mb-2 font-mono text-[0.65rem] uppercase tracking-wide text-gray-500">
                    {y} · category share
                  </div>
                  <div className="flex items-center gap-3">
                    <CategoryDonut slices={slicesFor(y)} total={c} />
                    <ul className="min-w-0 flex-1 space-y-1">
                      {slicesFor(y).map((s) => (
                        <li key={s.category} className="flex items-start gap-2 text-[0.7rem] text-gray-700">
                          <span
                            className="mt-[3px] h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: categoryColor(s.category) }}
                          />
                          <span className="min-w-0 flex-1 break-words leading-tight">{categoryLabel(s.category)}</span>
                          <span className="shrink-0 whitespace-nowrap font-mono font-semibold tabular-nums text-ink">
                            {s.count} · {Math.round((s.count / c) * 100)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <span className="font-mono text-[0.65rem] text-gray-600">{c || ""}</span>
              {c > 0 ? (
                <button
                  type="button"
                  onClick={() => setPinnedYear((p) => (p === y ? null : y))}
                  aria-label={`${y}: ${c} milestone(s) — show category share`}
                  className={`w-full rounded-t bg-gradient-to-t from-brand to-accent transition-all hover:opacity-90 ${
                    isActive ? "ring-2 ring-accent ring-offset-1 ring-offset-panel" : ""
                  }`}
                  style={{ height: `${h}px` }}
                />
              ) : (
                <div className="w-full" style={{ height: "0px" }} />
              )}
              <span className="font-mono text-[0.6rem] text-gray-500">{`'${String(y).slice(2)}`}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

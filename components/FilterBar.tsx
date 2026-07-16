"use client";

import { categoryLabel, categoryColor, categoryFg } from "@/lib/categories";

export interface FilterState {
  search: string;
  category: string | "all";
  fromYear: number;
  toYear: number;
}

interface Props {
  availableCategories: string[];
  state: FilterState;
  minYear: number;
  maxYear: number;
  resultCount: number;
  onChange: (next: FilterState) => void;
}

/** Search box + category pills + a 2016–2026 year-range control (sidebar). */
export function FilterBar({ availableCategories, state, minYear, maxYear, resultCount, onChange }: Props) {
  const pills: { key: string; label: string }[] = [
    { key: "all", label: "All Programs" },
    ...availableCategories.map((c) => ({ key: c, label: categoryLabel(c) })),
  ];

  return (
    <section className="space-y-6">
      <div>
        <label
          htmlFor="timeline-search"
          className="mb-3 block font-mono text-xs uppercase tracking-[0.1em] text-gray-500"
        >
          Search
        </label>
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="m14 14 3.5 3.5" strokeLinecap="round" />
          </svg>
          <input
            id="timeline-search"
            type="search"
            value={state.search}
            onChange={(e) => onChange({ ...state, search: e.target.value })}
            placeholder="Name, org, contract…"
            className="w-full rounded-lg border border-edge bg-panel py-2 pl-9 pr-8 text-sm text-ink placeholder:text-gray-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {state.search && (
            <button
              type="button"
              onClick={() => onChange({ ...state, search: "" })}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 hover:bg-raise hover:text-ink"
            >
              ×
            </button>
          )}
        </div>
        <div className="mt-2 font-mono text-[0.65rem] text-gray-500">
          {resultCount} {resultCount === 1 ? "match" : "matches"}
        </div>
      </div>

      <div>
      <div className="mb-3 font-mono text-xs uppercase tracking-[0.1em] text-gray-500">
        Filter by Category
      </div>
      <div className="flex flex-wrap gap-2">
        {pills.map((p) => {
          const active = state.category === p.key;
          const isAll = p.key === "all";
          const color = isAll ? null : categoryColor(p.key);

          // Active pill: solid category fill (accent for "All"). Inactive pill:
          // neutral chip with a category-colored dot so the color reads at a glance.
          const style =
            active && color
              ? { backgroundColor: color, borderColor: color, color: categoryFg(p.key) }
              : undefined;

          return (
            <button
              key={p.key}
              onClick={() => onChange({ ...state, category: active && !isAll ? "all" : p.key })}
              style={style}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                active
                  ? isAll
                    ? "border-accent bg-accent/15 text-ink"
                    : ""
                  : "border-edge bg-panel text-gray-600 hover:border-grey hover:bg-raise hover:text-ink"
              }`}
            >
              {color && (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: active ? categoryFg(p.key) : color }}
                />
              )}
              {p.label}
            </button>
          );
        })}
      </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between font-mono text-xs uppercase tracking-[0.1em] text-gray-500">
          <span>Year Range</span>
          <span className="text-signal">{state.fromYear} – {state.toYear}</span>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex flex-1 items-center gap-2">
            <span className="font-mono text-[0.65rem] text-gray-500">From</span>
            <input
              type="range"
              min={minYear}
              max={maxYear}
              value={state.fromYear}
              onChange={(e) => {
                const v = Number(e.target.value);
                onChange({ ...state, fromYear: Math.min(v, state.toYear) });
              }}
              className="w-full accent-blue-500"
            />
          </label>
          <label className="flex flex-1 items-center gap-2">
            <span className="font-mono text-[0.65rem] text-gray-500">To</span>
            <input
              type="range"
              min={minYear}
              max={maxYear}
              value={state.toYear}
              onChange={(e) => {
                const v = Number(e.target.value);
                onChange({ ...state, toYear: Math.max(v, state.fromYear) });
              }}
              className="w-full accent-blue-500"
            />
          </label>
        </div>
      </div>
    </section>
  );
}

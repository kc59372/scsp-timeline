"use client";

import { categoryLabel } from "@/lib/categories";

export interface FilterState {
  category: string | "all";
  fromYear: number;
  toYear: number;
}

interface Props {
  availableCategories: string[];
  state: FilterState;
  minYear: number;
  maxYear: number;
  onChange: (next: FilterState) => void;
}

/** Category pills + a 2016–2026 year-range control. */
export function FilterBar({ availableCategories, state, minYear, maxYear, onChange }: Props) {
  const pills: { key: string; label: string }[] = [
    { key: "all", label: "All Programs" },
    ...availableCategories.map((c) => ({ key: c, label: categoryLabel(c) })),
  ];

  return (
    <section className="my-8">
      <div className="mb-3 font-mono text-xs uppercase tracking-[0.1em] text-gray-500">
        Filter by Category
      </div>
      <div className="flex flex-wrap gap-2">
        {pills.map((p) => {
          const active = state.category === p.key;
          return (
            <button
              key={p.key}
              onClick={() => onChange({ ...state, category: active && p.key !== "all" ? "all" : p.key })}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                active
                  ? "border-accent bg-accent/15 text-ink"
                  : "border-edge bg-panel text-gray-600 hover:border-grey hover:bg-raise hover:text-ink"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
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

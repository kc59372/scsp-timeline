"use client";

import { useMemo, useState } from "react";
import type { Milestone } from "@/lib/milestones";
import { compareCategories } from "@/lib/categories";
import { primaryYear } from "@/lib/format";
import { FilterBar, type FilterState } from "./FilterBar";
import { AdoptionVelocityChart } from "./AdoptionVelocityChart";
import { Timeline } from "./Timeline";

const MIN_YEAR = 2016;
const MAX_YEAR = 2026;

/**
 * Client wrapper that owns filter state and applies it to the (small) dataset
 * in-memory, so the chart + timeline both react to the active filters.
 */
export function TimelineExplorer({ initialData }: { initialData: Milestone[] }) {
  const [state, setState] = useState<FilterState>({
    category: "all",
    fromYear: MIN_YEAR,
    toYear: MAX_YEAR,
  });

  const availableCategories = useMemo(
    () => Array.from(new Set(initialData.map((m) => m.category))).sort(compareCategories),
    [initialData],
  );

  const filtered = useMemo(() => {
    return initialData.filter((m) => {
      if (state.category !== "all" && m.category !== state.category) return false;
      const y = primaryYear(m);
      if (y != null && (y < state.fromYear || y > state.toYear)) return false;
      return true;
    });
  }, [initialData, state]);

  return (
    <div>
      <FilterBar
        availableCategories={availableCategories}
        state={state}
        minYear={MIN_YEAR}
        maxYear={MAX_YEAR}
        onChange={setState}
      />
      <div className="my-8">
        <AdoptionVelocityChart milestones={filtered} />
      </div>
      <Timeline milestones={filtered} />
    </div>
  );
}

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
/** Lowercased, whitespace-joined bag of a milestone's searchable text. */
function haystack(m: Milestone): string {
  return [
    m.name,
    m.description,
    m.actor,
    m.subcategory,
    m.awardedTo,
    m.issuingAgency,
    m.contractNumber,
    m.sourceName,
    m.program?.name,
    m.program?.description,
    ...m.tags.map((t) => t.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function TimelineExplorer({ initialData }: { initialData: Milestone[] }) {
  const [state, setState] = useState<FilterState>({
    search: "",
    category: "all",
    fromYear: MIN_YEAR,
    toYear: MAX_YEAR,
  });

  const availableCategories = useMemo(
    () => Array.from(new Set(initialData.map((m) => m.category))).sort(compareCategories),
    [initialData],
  );

  // Precompute searchable text once per record.
  const indexed = useMemo(
    () => initialData.map((m) => ({ m, text: haystack(m) })),
    [initialData],
  );

  const filtered = useMemo(() => {
    // AND across whitespace-separated terms; each term must appear somewhere.
    const terms = state.search.toLowerCase().split(/\s+/).filter(Boolean);
    return indexed
      .filter(({ m, text }) => {
        if (state.category !== "all" && m.category !== state.category) return false;
        const y = primaryYear(m);
        if (y != null && (y < state.fromYear || y > state.toYear)) return false;
        if (terms.length && !terms.every((t) => text.includes(t))) return false;
        return true;
      })
      .map(({ m }) => m);
  }, [indexed, state]);

  return (
    <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:items-start">
      <aside className="lg:sticky lg:top-8 lg:w-72 lg:shrink-0">
        <FilterBar
          availableCategories={availableCategories}
          state={state}
          minYear={MIN_YEAR}
          maxYear={MAX_YEAR}
          resultCount={filtered.length}
          onChange={setState}
        />
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-8">
          <AdoptionVelocityChart milestones={filtered} />
        </div>
        <Timeline milestones={filtered} />
      </div>
    </div>
  );
}

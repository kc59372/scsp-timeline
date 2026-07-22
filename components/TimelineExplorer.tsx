"use client";

import { useEffect, useMemo, useState } from "react";
import type { Milestone } from "@/lib/milestones";
import { compareCategories } from "@/lib/categories";
import { primaryYear } from "@/lib/format";
import { FilterBar, type FilterState } from "./FilterBar";
import { AdoptionVelocityChart } from "./AdoptionVelocityChart";
import { Timeline } from "./Timeline";
import { SiteSidebar } from "./SiteSidebar";

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

export function TimelineExplorer({
  initialData,
  initialSearch = "",
}: {
  initialData: Milestone[];
  initialSearch?: string;
}) {
  const [state, setState] = useState<FilterState>({
    search: initialSearch,
    category: "all",
    fromYear: MIN_YEAR,
    toYear: MAX_YEAR,
  });

  // Hydrate the search box from the URL's `?q=` on mount. In the static export
  // there are no server-side searchParams, so deep links are applied here.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setState((s) => (s.search ? s : { ...s, search: q }));
  }, []);

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
    // Only bound by year once the user narrows past the full 2016–2026 extent, so
    // the default view still counts approved events dated outside the window
    // (e.g. the 2014 Third Offset Strategy) — keeping the match count aligned
    // with the site-wide total. The charts keep their fixed 2016–2026 axis.
    const boundLo = state.fromYear > MIN_YEAR;
    const boundHi = state.toYear < MAX_YEAR;
    return indexed
      .filter(({ m, text }) => {
        if (state.category !== "all" && m.category !== state.category) return false;
        const y = primaryYear(m);
        if (y != null) {
          if (boundLo && y < state.fromYear) return false;
          if (boundHi && y > state.toYear) return false;
        }
        if (terms.length && !terms.every((t) => text.includes(t))) return false;
        return true;
      })
      .map(({ m }) => m);
  }, [indexed, state]);

  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
      <SiteSidebar
        search={state.search}
        onSearchChange={(v) => setState((s) => ({ ...s, search: v }))}
      />
      <div className="min-w-0 flex-1">
        <div className="mb-8">
          <AdoptionVelocityChart milestones={filtered} />
        </div>
        {/* Search + category + year filters, kept in the flow under the chart so
            they persist as you filter. */}
        <div className="mb-8 rounded-lg border border-edge bg-panel p-5">
          <FilterBar
            availableCategories={availableCategories}
            state={state}
            minYear={MIN_YEAR}
            maxYear={MAX_YEAR}
            resultCount={filtered.length}
            onChange={setState}
          />
        </div>
        <Timeline milestones={filtered} />
      </div>
    </div>
  );
}

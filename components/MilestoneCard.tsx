"use client";

import { useState } from "react";
import Link from "next/link";
import type { Milestone } from "@/lib/milestones";
import { categoryColor, categoryLabel, pillStyle, textStyle } from "@/lib/categories";
import { formatMilestoneDate, primaryDateIso, devCycle, formatUsd, displayName, displayActor, displayDescription } from "@/lib/format";

/** Expandable timeline card. */
export function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const [expanded, setExpanded] = useState(false);
  const color = categoryColor(milestone.category);
  // The dev-cycle meter is a system-maturity signal; it's meaningless for a
  // policy/directive milestone, so suppress it there.
  const meter = milestone.category === "POLICY_DIRECTIVE" ? null : devCycle(milestone);
  const dateLabel = formatMilestoneDate(primaryDateIso(milestone));
  const value = formatUsd(milestone.contractValue);
  const description = displayDescription(milestone.description);

  return (
    <article
      onClick={() => setExpanded((v) => !v)}
      style={{ borderLeftColor: color, borderLeftWidth: "4px" }}
      className="group cursor-pointer overflow-hidden rounded-lg border border-edge bg-panel p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-raise hover:shadow-lg hover:shadow-black/5"
    >
      {/* pre-header */}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.1em]" style={textStyle(milestone.category)}>
          {categoryLabel(milestone.category)}
        </span>
        <span className="flex items-center gap-1 font-mono text-xs text-gray-500 transition-colors group-hover:text-accent">
          Details
          <svg
            width="10" height="6" viewBox="0 0 10 6" fill="none"
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          >
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      {/* title → profile */}
      <h3 className="mb-2 text-lg font-semibold leading-snug text-ink">
        <Link
          href={`/system/${milestone.id}`}
          onClick={(e) => e.stopPropagation()}
          className="hover:text-accent hover:underline"
        >
          {displayName(milestone)}
        </Link>
      </h3>

      {/* meta */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <span className="font-medium">{displayActor(milestone.actor)}</span>
        {dateLabel && (
          <>
            <span className="text-gray-400">·</span>
            <span className="font-mono text-xs text-gray-500">{dateLabel}</span>
          </>
        )}
      </div>

      <p className="mb-5 text-sm leading-relaxed text-gray-600 line-clamp-3">
        {description}
      </p>

      {/* footer */}
      <div className="mt-4 flex items-center justify-between border-t border-edge pt-4">
        <span
          className="rounded border px-2.5 py-1 font-mono text-[0.7rem] font-semibold uppercase tracking-wide"
          style={pillStyle(milestone.category)}
        >
          {categoryLabel(milestone.category)}
        </span>
        {value ? (
          <span className="font-mono text-xs text-gray-600">{value}</span>
        ) : meter ? (
          <div className="flex items-center gap-2" title={`Development span: ${meter.years} year(s)`}>
            <span className="font-mono text-[0.65rem] uppercase text-gray-500">Dev Cycle</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={`h-3 w-1.5 rounded-sm ${i < meter.bars ? "bg-accent" : "bg-edge"}`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* expandable detail */}
      <div className={`grid transition-all duration-300 ${expanded ? "mt-4 grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-dashed border-edge pt-4">
            <p className="text-sm leading-relaxed text-ink">{description}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import type { Milestone } from "@/lib/milestones";
import { categoryStyle, categoryLabel } from "@/lib/categories";
import { formatMilestoneDate, primaryDateIso, devCycle, formatUsd } from "@/lib/format";

/** Expandable timeline card. Ports legacy .timeline-card markup to Tailwind. */
export function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const [expanded, setExpanded] = useState(false);
  const style = categoryStyle(milestone.category);
  const meter = devCycle(milestone);
  const dateLabel = formatMilestoneDate(primaryDateIso(milestone));
  const value = formatUsd(milestone.contractValue);

  const sources = [
    ...(milestone.sourceUrl
      ? [{ url: milestone.sourceUrl, label: milestone.sourceName ?? milestone.sourceUrl }]
      : []),
    ...milestone.additionalSources.map((url) => ({ url, label: url })),
  ];

  return (
    <article
      onClick={() => setExpanded((v) => !v)}
      className="group cursor-pointer overflow-hidden rounded-lg border border-edge bg-panel p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:bg-[#162032] hover:shadow-xl hover:shadow-black/30"
    >
      {/* pre-header */}
      <div className="mb-2 flex items-center justify-between">
        <span className={`font-mono text-[0.7rem] font-bold uppercase tracking-[0.1em] ${style.text}`}>
          United States · {categoryLabel(milestone.category)}
        </span>
        <span className="flex items-center gap-1 font-mono text-xs text-gray-500 transition-colors group-hover:text-blue-400">
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
      <h3 className="mb-2 text-lg font-semibold leading-snug text-gray-100">
        <Link
          href={`/system/${milestone.id}`}
          onClick={(e) => e.stopPropagation()}
          className="hover:text-blue-400 hover:underline"
        >
          {milestone.name}
        </Link>
      </h3>

      {/* meta */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-400">
        <span className="font-medium">{milestone.actor}</span>
        {dateLabel && (
          <>
            <span className="text-gray-600">·</span>
            <span className="font-mono text-xs text-gray-500">{dateLabel}</span>
          </>
        )}
      </div>

      <p className="mb-5 text-sm leading-relaxed text-gray-400 line-clamp-3">
        {milestone.description}
      </p>

      {/* footer */}
      <div className="mt-4 flex items-center justify-between border-t border-edge pt-4">
        <span className={`rounded px-2.5 py-1 font-mono text-[0.7rem] font-semibold uppercase tracking-wide ${style.pill}`}>
          {categoryLabel(milestone.category)}
        </span>
        {value ? (
          <span className="font-mono text-xs text-gray-400">{value}</span>
        ) : meter ? (
          <div className="flex items-center gap-2" title={`Development span: ${meter.years} year(s)`}>
            <span className="font-mono text-[0.65rem] uppercase text-gray-500">Dev Cycle</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={`h-3 w-1.5 rounded-sm ${i < meter.bars ? "bg-blue-400" : "bg-edge"}`}
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
            <p className="mb-4 text-sm leading-relaxed text-gray-200">{milestone.description}</p>
            {sources.length > 0 && (
              <div className="rounded-md border border-edge bg-black/30 p-3">
                <div className="mb-2 font-mono text-[0.7rem] font-bold uppercase tracking-wide text-gray-500">
                  Verified Public Sources
                </div>
                <ul className="flex flex-col gap-1.5">
                  {sources.map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        <span className="break-all">{s.label}</span>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="shrink-0">
                          <path d="M3.5 1.5H10.5M10.5 1.5V8.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

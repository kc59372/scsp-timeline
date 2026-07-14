"use client";

import Link from "next/link";
import type { Milestone, Program } from "@/lib/milestones";
import { categoryStyle, categoryLabel } from "@/lib/categories";
import { eventTypeLabel } from "@/lib/events";
import { formatMilestoneDate, primaryDateIso, formatUsd } from "@/lib/format";

/**
 * A program rendered as a lifecycle track: request → award → test → deployment.
 * Each stage links to its event's profile; the title links to the program page.
 */
export function ProgramCard({ program, events }: { program: Program; events: Milestone[] }) {
  const style = categoryStyle(program.category);

  const years = events
    .map((e) => primaryDateIso(e))
    .filter((v): v is string => v != null)
    .map((iso) => new Date(iso).getUTCFullYear());
  const span =
    years.length >= 2 && Math.min(...years) !== Math.max(...years)
      ? `${Math.min(...years)}–${Math.max(...years)}`
      : years.length
        ? String(years[0])
        : null;

  const totalValue = events.reduce((sum, e) => sum + (e.contractValue ?? 0), 0);

  return (
    <article className="overflow-hidden rounded-lg border border-edge bg-panel p-6 transition-all duration-200 hover:border-accent/40 hover:bg-raise">
      {/* pre-header */}
      <div className="mb-2 flex items-center justify-between">
        <span className={`font-mono text-[0.7rem] font-bold uppercase tracking-[0.1em] ${style.text}`}>
          {categoryLabel(program.category)}
        </span>
        <span className="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-wide text-gray-500">
          <span className="rounded bg-accent/10 px-2 py-0.5 text-accent">Program</span>
          {program.systemStatus && <span>{program.systemStatus}</span>}
        </span>
      </div>

      {/* title → program profile */}
      <h3 className="mb-2 text-lg font-semibold leading-snug text-ink">
        <Link href={`/program/${program.id}`} className="hover:text-accent hover:underline">
          {program.name}
        </Link>
      </h3>

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <span className="font-medium">{program.actor}</span>
        {span && (
          <>
            <span className="text-gray-400">·</span>
            <span className="font-mono text-xs text-gray-500">{span}</span>
          </>
        )}
        <span className="text-gray-400">·</span>
        <span className="font-mono text-xs text-gray-500">
          {events.length} {events.length === 1 ? "stage" : "stages"}
        </span>
      </div>

      {/* lifecycle track */}
      <ol className="flex flex-wrap items-stretch gap-2">
        {events.map((e, i) => (
          <li key={e.id} className="flex items-center gap-2">
            <Link
              href={`/system/${e.id}`}
              className="group flex min-w-[8.5rem] flex-col gap-1 rounded-md border border-edge bg-mist px-3 py-2 hover:border-accent/50"
            >
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-gray-700 group-hover:text-accent">
                  {eventTypeLabel(e.eventType)}
                </span>
              </span>
              <span className="font-mono text-[0.65rem] text-gray-500">
                {formatMilestoneDate(primaryDateIso(e)) ?? "date unknown"}
              </span>
              {e.contractValue != null && (
                <span className="font-mono text-[0.65rem] text-gray-600">{formatUsd(e.contractValue)}</span>
              )}
            </Link>
            {i < events.length - 1 && (
              <span className="font-mono text-gray-400" aria-hidden>
                →
              </span>
            )}
          </li>
        ))}
      </ol>

      {/* footer */}
      {totalValue > 0 && (
        <div className="mt-4 flex items-center justify-end border-t border-edge pt-4 font-mono text-xs text-gray-600">
          Total contract value · {formatUsd(totalValue)}
        </div>
      )}
    </article>
  );
}

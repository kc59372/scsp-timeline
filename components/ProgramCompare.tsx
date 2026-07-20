"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import type { Milestone, Program } from "@/lib/milestones";
import {
  categoryColor,
  categoryLabel,
  pillStyle,
} from "@/lib/categories";
import { EVENT_TYPES, eventTypeLabel } from "@/lib/events";
import {
  displayActor,
  displayDescription,
  formatMilestoneDate,
  formatUsd,
  primaryDateIso,
  primaryYear,
} from "@/lib/format";
import { orderEvents } from "@/lib/timeline";

/** A program bundled with its ordered lifecycle events, ready to compare. */
export interface CompareProgram {
  program: Program;
  events: Milestone[];
}

const EVENT_RANK = new Map<string, number>(EVENT_TYPES.map((t, i) => [t, i]));

/** Lifecycle stages surfaced as their own comparison rows. */
const STAGE_ROWS: { type: string; label: string }[] = [
  { type: "RD_START", label: "R&D Start" },
  { type: "SOLICITATION", label: "Solicitation" },
  { type: "AWARD", label: "Award" },
  { type: "TEST", label: "Test / Evaluation" },
  { type: "FIELDING", label: "Fielding" },
  { type: "DEPLOYMENT", label: "Deployment" },
];

/** Derived, comparable facts for one program. */
interface Metrics {
  firstYear: number | null;
  lastYear: number | null;
  span: string | null;
  spanYears: number | null;
  stages: number;
  totalValue: number;
  largestValue: number;
  furthest: string | null; // event type of the furthest-along stage
  sources: number;
  stageDate: (type: string) => string | null;
}

function computeMetrics(events: Milestone[]): Metrics {
  const years = events
    .map((e) => primaryYear(e))
    .filter((v): v is number => v != null);
  const firstYear = years.length ? Math.min(...years) : null;
  const lastYear = years.length ? Math.max(...years) : null;

  const totalValue = events.reduce((s, e) => s + (e.contractValue ?? 0), 0);
  const largestValue = events.reduce(
    (m, e) => Math.max(m, e.contractValue ?? 0),
    0,
  );

  let furthest: string | null = null;
  let furthestRank = -1;
  for (const e of events) {
    const r = EVENT_RANK.get(e.eventType ?? "") ?? -1;
    if (r > furthestRank) {
      furthestRank = r;
      furthest = e.eventType ?? null;
    }
  }

  const srcSet = new Set<string>();
  for (const e of events) {
    if (e.sourceUrl) srcSet.add(e.sourceUrl);
    for (const s of e.additionalSources ?? []) srcSet.add(s);
  }

  const stageDate = (type: string): string | null => {
    const dates = events
      .filter((e) => e.eventType === type)
      .map((e) => primaryDateIso(e))
      .filter((v): v is string => v != null)
      .sort();
    return dates[0] ?? null;
  };

  return {
    firstYear,
    lastYear,
    span:
      firstYear != null && lastYear != null
        ? firstYear === lastYear
          ? String(firstYear)
          : `${firstYear}–${lastYear}`
        : null,
    spanYears:
      firstYear != null && lastYear != null ? lastYear - firstYear : null,
    stages: events.length,
    totalValue,
    largestValue,
    furthest,
    sources: srcSet.size,
    stageDate,
  };
}

const EMPTY = <span className="text-gray-400">—</span>;

/** A single comparison row spec. */
interface Row {
  key: string;
  label: string;
  render: (col: CompareProgram, m: Metrics) => ReactNode;
  /** Comparable primitive used for the highlight-differences toggle. */
  cmp: (col: CompareProgram, m: Metrics) => string | number | null;
}

const OVERVIEW_ROWS: Row[] = [
  {
    key: "category",
    label: "Category",
    cmp: (c) => c.program.category,
    render: (c) => (
      <span
        className="inline-block rounded border px-2.5 py-1 font-mono text-[0.7rem] font-semibold uppercase tracking-wide"
        style={pillStyle(c.program.category)}
      >
        {categoryLabel(c.program.category)}
      </span>
    ),
  },
  {
    key: "actor",
    label: "Developer",
    cmp: (c) => displayActor(c.program.actor) || null,
    render: (c) => displayActor(c.program.actor) || EMPTY,
  },
  {
    key: "status",
    label: "System Status",
    cmp: (c) => c.program.systemStatus,
    render: (c) =>
      c.program.systemStatus ? (
        <span className="font-mono text-xs uppercase tracking-wide">
          {c.program.systemStatus}
        </span>
      ) : (
        EMPTY
      ),
  },
  {
    key: "focus",
    label: "Focus Area",
    cmp: (c) => c.program.subcategory,
    render: (c) => c.program.subcategory || EMPTY,
  },
];

const TIMELINE_ROWS: Row[] = [
  {
    key: "first",
    label: "First Activity",
    cmp: (_c, m) => m.firstYear,
    render: (_c, m) => (m.firstYear != null ? String(m.firstYear) : EMPTY),
  },
  {
    key: "last",
    label: "Latest Activity",
    cmp: (_c, m) => m.lastYear,
    render: (_c, m) => (m.lastYear != null ? String(m.lastYear) : EMPTY),
  },
  {
    key: "span",
    label: "Time Span",
    cmp: (_c, m) => m.spanYears,
    render: (_c, m) =>
      m.span ? (
        <span>
          {m.span}
          {m.spanYears != null && m.spanYears > 0 && (
            <span className="ml-1.5 font-mono text-xs text-gray-500">
              ({m.spanYears} yr{m.spanYears === 1 ? "" : "s"})
            </span>
          )}
        </span>
      ) : (
        EMPTY
      ),
  },
  {
    key: "furthest",
    label: "Furthest Stage",
    cmp: (_c, m) => m.furthest,
    render: (_c, m) =>
      m.furthest ? (
        <span className="font-mono text-xs font-semibold uppercase tracking-wide">
          {eventTypeLabel(m.furthest)}
        </span>
      ) : (
        EMPTY
      ),
  },
  {
    key: "stages",
    label: "Lifecycle Stages",
    cmp: (_c, m) => m.stages,
    render: (_c, m) => (
      <span>
        {m.stages} <span className="text-gray-500">tracked</span>
      </span>
    ),
  },
];

const PROCUREMENT_ROWS: Row[] = [
  {
    key: "total",
    label: "Total Contract Value",
    cmp: (_c, m) => m.totalValue,
    render: (_c, m) =>
      m.totalValue > 0 ? (
        <span className="font-semibold">{formatUsd(m.totalValue)}</span>
      ) : (
        EMPTY
      ),
  },
  {
    key: "largest",
    label: "Largest Single Award",
    cmp: (_c, m) => m.largestValue,
    render: (_c, m) => (m.largestValue > 0 ? formatUsd(m.largestValue) : EMPTY),
  },
];

const SOURCING_ROWS: Row[] = [
  {
    key: "sources",
    label: "Distinct Sources",
    cmp: (_c, m) => m.sources,
    render: (_c, m) => (m.sources > 0 ? String(m.sources) : EMPTY),
  },
];

const STAGE_DATE_ROWS: Row[] = STAGE_ROWS.map((s) => ({
  key: `stage-${s.type}`,
  label: s.label,
  cmp: (_c: CompareProgram, m: Metrics) => m.stageDate(s.type),
  render: (_c: CompareProgram, m: Metrics) => {
    const iso = m.stageDate(s.type);
    return iso ? formatMilestoneDate(iso) : EMPTY;
  },
}));

const SECTIONS: { title: string; rows: Row[] }[] = [
  { title: "Overview", rows: OVERVIEW_ROWS },
  { title: "Adoption Timeline", rows: TIMELINE_ROWS },
  { title: "Procurement", rows: PROCUREMENT_ROWS },
  { title: "Lifecycle Milestones", rows: STAGE_DATE_ROWS },
  { title: "Sourcing", rows: SOURCING_ROWS },
];

const MAX_COLUMNS = 4;
const MIN_COLUMNS = 2;

export function ProgramCompare({ programs }: { programs: CompareProgram[] }) {
  const byId = useMemo(() => {
    const map = new Map<string, CompareProgram>();
    for (const p of programs) map.set(p.program.id, p);
    return map;
  }, [programs]);

  // Default columns: the most significant programs, ordered by significance
  // then by number of tracked stages (matches the homepage "Main Projects").
  const defaultIds = useMemo(() => {
    return [...programs]
      .sort(
        (a, b) =>
          b.program.significance - a.program.significance ||
          b.events.length - a.events.length ||
          a.program.name.localeCompare(b.program.name),
      )
      .slice(0, 3)
      .map((p) => p.program.id);
  }, [programs]);

  const [selected, setSelected] = useState<string[]>(defaultIds);
  const [highlight, setHighlight] = useState(false);

  const sortedOptions = useMemo(
    () =>
      [...programs].sort((a, b) =>
        a.program.name.localeCompare(b.program.name),
      ),
    [programs],
  );

  const columns = selected
    .map((id) => byId.get(id))
    .filter((c): c is CompareProgram => c != null);

  const metrics = columns.map((c) => computeMetrics(orderEvents(c.events)));

  function setColumn(index: number, id: string) {
    setSelected((prev) => {
      const next = [...prev];
      next[index] = id;
      return next;
    });
  }

  function addColumn() {
    const used = new Set(selected);
    const next = sortedOptions.find((p) => !used.has(p.program.id));
    if (next) setSelected((prev) => [...prev, next.program.id]);
  }

  function removeColumn(index: number) {
    setSelected((prev) => prev.filter((_, i) => i !== index));
  }

  const gridCols = `minmax(9.5rem, 12rem) repeat(${columns.length}, minmax(11rem, 1fr))`;

  return (
    <div>
      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Compare up to {MAX_COLUMNS} programs side by side across their
          category, adoption timeline, and procurement footprint.
        </p>
        <label className="flex cursor-pointer select-none items-center gap-2 font-mono text-xs uppercase tracking-wide text-gray-600">
          <input
            type="checkbox"
            checked={highlight}
            onChange={(e) => setHighlight(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent"
          />
          Highlight differences
        </label>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[40rem]" style={{ gridTemplateColumns: gridCols }}>
          {/* ── Header row: program pickers ── */}
          <div className="sticky left-0 z-20 border-b border-edge bg-paper" />
          {columns.map((col, i) => {
            const color = categoryColor(col.program.category);
            const used = new Set(selected);
            return (
              <div
                key={`head-${i}`}
                className="border-b border-l border-edge bg-panel"
                style={{ borderTop: `3px solid ${color}` }}
              >
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="inline-block rounded border px-2 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wide"
                      style={pillStyle(col.program.category)}
                    >
                      {categoryLabel(col.program.category)}
                    </span>
                    {columns.length > MIN_COLUMNS && (
                      <button
                        type="button"
                        onClick={() => removeColumn(i)}
                        aria-label={`Remove ${col.program.name}`}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-raise hover:text-accent"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <Link
                    href={`/program/${col.program.id}`}
                    className="text-base font-semibold leading-snug text-ink hover:text-accent hover:underline"
                  >
                    {col.program.name}
                  </Link>

                  {/* Program switcher */}
                  <select
                    value={col.program.id}
                    onChange={(e) => setColumn(i, e.target.value)}
                    aria-label={`Choose program for column ${i + 1}`}
                    className="w-full rounded-md border border-edge bg-paper px-2 py-1.5 font-mono text-xs text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  >
                    {sortedOptions.map((p) => {
                      const disabled =
                        p.program.id !== col.program.id &&
                        used.has(p.program.id);
                      return (
                        <option
                          key={p.program.id}
                          value={p.program.id}
                          disabled={disabled}
                        >
                          {p.program.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            );
          })}

          {/* ── Sections ── */}
          {SECTIONS.map((section) => (
            <SectionBlock
              key={section.title}
              title={section.title}
              rows={section.rows}
              columns={columns}
              metrics={metrics}
              highlight={highlight}
            />
          ))}
        </div>
      </div>

      {/* Add column */}
      {columns.length < MAX_COLUMNS && sortedOptions.length > columns.length && (
        <button
          type="button"
          onClick={addColumn}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-dashed border-edge bg-panel px-4 py-2.5 font-mono text-xs uppercase tracking-wide text-gray-600 transition-colors hover:border-accent/50 hover:text-accent"
        >
          <span className="text-base leading-none">+</span> Add program
        </button>
      )}
    </div>
  );
}

/** One labeled section of comparison rows, rendered inline into the parent grid. */
function SectionBlock({
  title,
  rows,
  columns,
  metrics,
  highlight,
}: {
  title: string;
  rows: Row[];
  columns: CompareProgram[];
  metrics: Metrics[];
  highlight: boolean;
}) {
  return (
    <>
      {/* Section header spans the full grid width */}
      <div
        className="sticky left-0 z-10 border-b border-edge bg-ink px-4 py-2 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-white"
        style={{ gridColumn: "1 / -1" }}
      >
        {title}
      </div>

      {rows.map((row) => {
        // Compare each column's comparable value. A row with a single column
        // can't differ; otherwise it "differs" when the values aren't all equal
        // (a missing value counts as a difference from a present one).
        const values = columns.map((c, i) => row.cmp(c, metrics[i]));
        const comparable = values.length > 1;
        const allSame = comparable && values.every((v) => v === values[0]);
        // When highlighting: fade identical rows, and emphasize differing ones
        // (rows where every column is empty have nothing to highlight).
        const anyPresent = values.some((v) => v != null);
        const dimmed = highlight && allSame && anyPresent;
        const differing = highlight && comparable && !allSame && anyPresent;

        return (
          <div key={row.key} className="contents">
            <div
              className={`sticky left-0 z-10 flex items-center border-b border-edge px-4 py-3 font-mono text-[0.7rem] uppercase tracking-wide ${
                differing
                  ? "border-l-2 border-l-accent bg-accent/5 font-semibold text-accent"
                  : dimmed
                    ? "bg-paper text-gray-300"
                    : "bg-paper text-gray-500"
              }`}
            >
              {row.label}
            </div>
            {columns.map((col, i) => (
              <div
                key={`${row.key}-${i}`}
                className={`flex items-center border-b border-l border-edge px-4 py-3 text-sm ${
                  differing
                    ? "bg-accent/5 text-ink"
                    : dimmed
                      ? "bg-panel/40 text-gray-300"
                      : "bg-paper text-ink"
                }`}
              >
                {row.render(col, metrics[i])}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

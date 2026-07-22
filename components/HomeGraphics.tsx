"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Milestone } from "@/lib/milestones";
import { primaryDateIso, primaryYear, formatUsd, formatMilestoneDate, displayName } from "@/lib/format";
import { categoryColor, categoryLabel, compareCategories } from "@/lib/categories";
import { AdoptionVelocityChart } from "./AdoptionVelocityChart";

const START_YEAR = 2016;
const END_YEAR = 2026;

// The single quarter this breakdown card spotlights: 2026 Q2 (Apr–Jun).
const QUARTER_YEAR = 2026;
const QUARTER_INDEX = 1; // 0=Q1, 1=Q2, 2=Q3, 3=Q4

/**
 * Homepage graphics: the adoption-velocity bar chart on top (full width), with
 * the line-chart view of the same trend and an overall category-share donut for
 * the entire dataset underneath. All recompute from whatever set they're handed.
 */
export function HomeGraphics({ milestones }: { milestones: Milestone[] }) {
  return (
    <div className="flex flex-col gap-6">
      <AdoptionVelocityChart milestones={milestones} />
      <div className="grid gap-6 lg:grid-cols-2">
        <VelocityLineChart milestones={milestones} />
        <CategoryShareDonut milestones={milestones} />
      </div>
      <QuarterlyBreakdown milestones={milestones} />
    </div>
  );
}

/** Milestones whose primary date falls in the given calendar quarter. */
function inQuarter(milestones: Milestone[], year: number, qIndex: number): Milestone[] {
  return milestones.filter((m) => {
    const iso = primaryDateIso(m);
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    return d.getUTCFullYear() === year && Math.floor(d.getUTCMonth() / 3) === qIndex;
  });
}

/** Count milestones per category, sorted by count (ties broken by category order). */
function countByCategory(milestones: Milestone[]): Slice[] {
  const byCat = new Map<string, number>();
  for (const m of milestones) byCat.set(m.category, (byCat.get(m.category) ?? 0) + 1);
  return Array.from(byCat.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || compareCategories(a.category, b.category));
}

interface Trend {
  dir: "up" | "down" | "flat";
  text: string;
}

/**
 * Spotlight card: a plain-language summary of the quarter (2026 Q2) — bulleted
 * big takeaways plus notable trends, all derived from the milestone data (and
 * compared against the prior quarter for direction) rather than hand-written,
 * so it stays accurate as new data lands.
 */
function QuarterlyBreakdown({ milestones }: { milestones: Milestone[] }) {
  const { takeaways, trends, topEvents, total } = useMemo(() => {
    const q = inQuarter(milestones, QUARTER_YEAR, QUARTER_INDEX);
    const total = q.length;
    if (total === 0)
      return { takeaways: [] as string[], trends: [] as Trend[], topEvents: [] as Milestone[], total };

    const cats = countByCategory(q);
    const top = cats[0];

    // Top 3 events of the quarter — most significant first, breaking ties by
    // contract value (bigger first) then recency of the primary date.
    const topEvents = [...q]
      .sort((a, b) => {
        if (b.significance !== a.significance) return b.significance - a.significance;
        const av = a.contractValue ?? -1;
        const bv = b.contractValue ?? -1;
        if (bv !== av) return bv - av;
        const ad = primaryDateIso(a) ?? "";
        const bd = primaryDateIso(b) ?? "";
        return bd.localeCompare(ad);
      })
      .slice(0, 3);

    // Contract awards this quarter (events carrying a dollar value).
    const awards = q.filter((m) => m.contractValue != null);
    const totalValue = awards.reduce((sum, m) => sum + (m.contractValue ?? 0), 0);
    const biggest = awards.reduce<Milestone | null>(
      (best, m) => (best == null || (m.contractValue ?? 0) > (best.contractValue ?? 0) ? m : best),
      null,
    );

    // Systems reaching the field this quarter.
    const fielded = q.filter(
      (m) =>
        m.eventType === "FIELDING" ||
        m.eventType === "DEPLOYMENT" ||
        m.systemStatus === "FIELDED",
    ).length;

    const takeaways: string[] = [];
    takeaways.push(`${total} tracked AI milestone${total === 1 ? "" : "s"} dated in Q2 2026.`);
    if (top) {
      takeaways.push(
        `${categoryLabel(top.category)} leads the quarter with ${top.count} of ${total} events (${Math.round((top.count / total) * 100)}%).`,
      );
    }
    if (awards.length > 0) {
      takeaways.push(
        `${awards.length} contract award${awards.length === 1 ? "" : "s"} totaling ${formatUsd(totalValue)} in obligated value.`,
      );
    }
    if (biggest && biggest.contractValue != null) {
      takeaways.push(`Largest award: ${displayName(biggest)} (${formatUsd(biggest.contractValue)}).`);
    }
    if (fielded > 0) {
      takeaways.push(`${fielded} system${fielded === 1 ? "" : "s"} reached fielding or deployment.`);
    }

    // Notable trends — compare against the prior quarter (2026 Q1).
    const prevQIndex = (QUARTER_INDEX + 3) % 4;
    const prevYear = prevQIndex === 3 ? QUARTER_YEAR - 1 : QUARTER_YEAR;
    const prev = inQuarter(milestones, prevYear, prevQIndex);
    const prevLabel = `Q${prevQIndex + 1} ${prevYear}`;

    const trends: Trend[] = [];
    const delta = total - prev.length;
    if (prev.length === 0) {
      trends.push({ dir: "up", text: `New activity this quarter — no tracked milestones in ${prevLabel}.` });
    } else {
      const pct = Math.round((delta / prev.length) * 100);
      const dir: Trend["dir"] = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
      const word = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
      trends.push({
        dir,
        text: `Milestone volume ${word} ${delta === 0 ? "" : `${Math.abs(pct)}% `}vs ${prevLabel} (${prev.length} → ${total}).`,
      });
    }

    // Category momentum: which domain gained the most events vs the prior quarter.
    const prevByCat = new Map(countByCategory(prev).map((s) => [s.category, s.count]));
    let mover: { category: string; gain: number } | null = null;
    for (const s of cats) {
      const gain = s.count - (prevByCat.get(s.category) ?? 0);
      if (mover == null || gain > mover.gain) mover = { category: s.category, gain };
    }
    if (mover && mover.gain > 0) {
      trends.push({
        dir: "up",
        text: `${categoryLabel(mover.category)} is the fastest-growing domain (+${mover.gain} vs ${prevLabel}).`,
      });
    }

    // Concentration: flag when one domain dominates the quarter.
    if (top && top.count / total >= 0.4) {
      trends.push({
        dir: "flat",
        text: `Activity is concentrated — ${categoryLabel(top.category)} alone is ${Math.round((top.count / total) * 100)}% of the quarter.`,
      });
    }

    return { takeaways, trends, topEvents, total };
  }, [milestones]);

  return (
    <div className="rounded-lg border border-edge bg-panel p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-signal">Q2 2026 Summary</span>
        <span className="font-mono text-[0.65rem] text-gray-500">Apr–Jun 2026</span>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        The quarter in brief — the big takeaways and how the numbers are moving.
      </p>

      {total === 0 ? (
        <p className="py-4 text-sm text-gray-500">No milestones dated in Q2 2026 yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h4 className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-ink">Takeaways</h4>
            <ul className="space-y-2">
              {takeaways.map((t, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-snug text-gray-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-signal" aria-hidden />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {trends.length > 0 && (
            <div>
              <h4 className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-ink">Notable Trends</h4>
              <ul className="space-y-2">
                {trends.map((t, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-snug text-gray-700">
                    <span
                      className={`mt-0.5 shrink-0 font-mono text-xs font-bold ${
                        t.dir === "up" ? "text-signal" : t.dir === "down" ? "text-brand" : "text-gray-400"
                      }`}
                      aria-hidden
                    >
                      {t.dir === "up" ? "▲" : t.dir === "down" ? "▼" : "—"}
                    </span>
                    <span>{t.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {topEvents.length > 0 && (
            <div className="border-t border-edge pt-4 sm:col-span-2">
              <h4 className="mb-2 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-ink">Top Events</h4>
              <ol className="space-y-2">
                {topEvents.map((m, i) => {
                  const dateLabel = formatMilestoneDate(primaryDateIso(m));
                  const value = formatUsd(m.contractValue);
                  return (
                    <li key={m.id}>
                      <Link
                        href={`/system/${m.id}`}
                        className="group flex items-start gap-3 rounded-md p-2 -mx-2 transition-colors hover:bg-raise"
                      >
                        <span className="mt-0.5 shrink-0 font-mono text-sm font-bold tabular-nums text-gray-400">
                          {i + 1}
                        </span>
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-sm"
                          style={{ backgroundColor: categoryColor(m.category) }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink group-hover:text-signal">
                            {displayName(m)}
                          </span>
                          <span className="block truncate font-mono text-[0.7rem] text-gray-500">
                            {categoryLabel(m.category)}
                            {dateLabel ? ` · ${dateLabel}` : ""}
                            {value ? ` · ${value}` : ""}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** SVG line/area chart: tracked milestones per year, 2016–2026. */
function VelocityLineChart({ milestones }: { milestones: Milestone[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const years = useMemo(
    () => Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i),
    [],
  );

  const counts = useMemo(() => {
    const map = new Map<number, number>(years.map((y) => [y, 0]));
    for (const m of milestones) {
      const y = primaryYear(m);
      if (y != null && map.has(y)) map.set(y, map.get(y)! + 1);
    }
    return map;
  }, [milestones, years]);

  const max = Math.max(1, ...Array.from(counts.values()));

  // Least-squares linear trend over the per-year counts: `slope` is the average
  // change in milestones per year (the quantified "adoption velocity").
  const trend = useMemo(() => {
    const ys = years.map((yr) => counts.get(yr)!);
    const n = ys.length;
    const xbar = (n - 1) / 2;
    const ybar = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xbar) * (ys[i] - ybar);
      den += (i - xbar) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    return { slope, intercept: ybar - slope * xbar };
  }, [counts, years]);

  // viewBox geometry (padding leaves room for axis labels + the pop-up boxes).
  const W = 640;
  const H = 260;
  const padL = 34;
  const padR = 16;
  const padT = 30;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const x = (i: number) => padL + (years.length === 1 ? 0 : (i / (years.length - 1)) * plotW);
  const y = (c: number) => padT + plotH - (c / max) * plotH;
  const clampY = (c: number) => Math.min(padT + plotH, Math.max(padT, y(c)));

  const points = years.map((yr, i) => ({ yr, i, c: counts.get(yr)!, cx: x(i), cy: y(counts.get(yr)!) }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.cx} ${p.cy}`).join(" ");
  const areaPath = `${linePath} L ${x(years.length - 1)} ${padT + plotH} L ${padL} ${padT + plotH} Z`;

  // Trend line endpoints (clamped into the plot so a steep fit stays on-canvas).
  const trendY0 = clampY(trend.intercept);
  const trendY1 = clampY(trend.intercept + trend.slope * (years.length - 1));

  // Horizontal gridlines at a few round-ish values.
  const ticks = 4;
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((max / ticks) * i));

  return (
    <div className="rounded-lg border border-edge bg-panel p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-signal">Adoption Velocity</span>
        <span className="shrink-0 font-mono text-[0.7rem] font-semibold tabular-nums text-ink">
          {trend.slope >= 0 ? "▲ +" : "▼ "}
          {trend.slope.toFixed(1)}
          <span className="font-normal text-gray-500"> / yr</span>
        </span>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        Tracked US military AI milestones per year — the pace of adoption over time. The dashed
        line is the least-squares trend; its slope is the average change per year.
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Milestones per year, 2016–2026">
        <defs>
          <linearGradient id="velocityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#B31942" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#B31942" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* gridlines + y labels */}
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#E3E6E9" strokeWidth="1" />
            <text x={padL - 8} y={y(v) + 3} textAnchor="end" className="fill-gray-400 font-mono" style={{ fontSize: "9px" }}>
              {v}
            </text>
          </g>
        ))}

        {/* area + line */}
        <path d={areaPath} fill="url(#velocityFill)" />
        <path d={linePath} fill="none" stroke="#B31942" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* least-squares trend line */}
        <line
          x1={x(0)}
          y1={trendY0}
          x2={x(years.length - 1)}
          y2={trendY1}
          stroke="#00334E"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          opacity="0.55"
        />

        {/* points + x labels + hover targets */}
        {points.map((p) => {
          // Tooltip box geometry — larger, and kept inside the viewBox so the
          // top-most point's box isn't clipped (flip below when there's no room
          // above; clamp x to the left/right edges).
          const bw = 56;
          const bh = 26;
          const above = p.cy - (bh + 10) >= 0;
          const by = above ? p.cy - (bh + 8) : p.cy + 8;
          const bx = Math.min(Math.max(p.cx - bw / 2, 2), W - bw - 2);
          return (
          <g key={p.yr}>
            {hover === p.yr && p.c > 0 && (
              <g>
                <rect x={bx} y={by} width={bw} height={bh} rx="4" fill="#00334E" />
                <text
                  x={bx + bw / 2}
                  y={by + bh / 2 + 5}
                  textAnchor="middle"
                  className="fill-white font-mono"
                  style={{ fontSize: "15px", fontWeight: 700 }}
                >
                  {p.c}
                </text>
              </g>
            )}
            <circle
              cx={p.cx}
              cy={p.cy}
              r={hover === p.yr ? 5 : 3.5}
              fill="#B31942"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <text x={p.cx} y={H - 10} textAnchor="middle" className="fill-gray-500 font-mono" style={{ fontSize: "9px" }}>
              {`'${String(p.yr).slice(2)}`}
            </text>
            {/* invisible wide hover target */}
            <rect
              x={p.cx - plotW / (years.length - 1) / 2}
              y={padT}
              width={plotW / (years.length - 1)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(p.yr)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
          );
        })}
      </svg>
    </div>
  );
}

interface Slice {
  category: string;
  count: number;
}

/** Overall category-share donut for the whole dataset, with a labeled legend. */
function CategoryShareDonut({ milestones }: { milestones: Milestone[] }) {
  const { slices, total } = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const m of milestones) byCat.set(m.category, (byCat.get(m.category) ?? 0) + 1);
    const slices: Slice[] = Array.from(byCat.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count || compareCategories(a.category, b.category));
    return { slices, total: milestones.length };
  }, [milestones]);

  const R = 42;
  const C = 2 * Math.PI * R;
  const GAP = slices.length > 1 ? 3 : 0;
  let offset = 0;

  return (
    <div className="rounded-lg border border-edge bg-panel p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-signal">Category Share</span>
        <span className="font-mono text-[0.65rem] text-gray-500">all milestones</span>
      </div>
      <p className="mb-4 text-sm text-gray-600">Distribution across mission domains.</p>

      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0" role="img" aria-label="Category share of all milestones">
          <circle cx="50" cy="50" r={R} fill="none" stroke="#E3E6E9" strokeWidth="14" />
          <g transform="rotate(-90 50 50)">
            {slices.map((s) => {
              const frac = total ? s.count / total : 0;
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

        <ul className="min-w-0 flex-1 space-y-1">
          {slices.map((s) => (
            <li key={s.category} className="flex items-center gap-2 text-[0.72rem] text-gray-700">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: categoryColor(s.category) }} />
              <span className="min-w-0 flex-1 truncate leading-tight">{categoryLabel(s.category)}</span>
              <span className="shrink-0 whitespace-nowrap font-mono font-semibold tabular-nums text-ink">
                {s.count} · {total ? Math.round((s.count / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { Milestone } from "@/lib/milestones";
import { primaryYear } from "@/lib/format";
import { categoryColor, categoryLabel, compareCategories } from "@/lib/categories";
import { AdoptionVelocityChart } from "./AdoptionVelocityChart";

const START_YEAR = 2016;
const END_YEAR = 2026;

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

  // viewBox geometry (padding leaves room for axis labels).
  const W = 640;
  const H = 240;
  const padL = 34;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const x = (i: number) => padL + (years.length === 1 ? 0 : (i / (years.length - 1)) * plotW);
  const y = (c: number) => padT + plotH - (c / max) * plotH;

  const points = years.map((yr, i) => ({ yr, i, c: counts.get(yr)!, cx: x(i), cy: y(counts.get(yr)!) }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.cx} ${p.cy}`).join(" ");
  const areaPath = `${linePath} L ${x(years.length - 1)} ${padT + plotH} L ${padL} ${padT + plotH} Z`;

  // Horizontal gridlines at a few round-ish values.
  const ticks = 4;
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((max / ticks) * i));

  return (
    <div className="rounded-lg border border-edge bg-panel p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-mono text-xs uppercase tracking-[0.1em] text-signal">Adoption Velocity</span>
        <span className="font-mono text-[0.65rem] text-gray-500">milestones per year</span>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        Tracked US military AI milestones per year — the pace of adoption over time.
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

        {/* points + x labels + hover targets */}
        {points.map((p) => (
          <g key={p.yr}>
            {hover === p.yr && p.c > 0 && (
              <g>
                <rect x={p.cx - 20} y={p.cy - 26} width="40" height="18" rx="3" fill="#00334E" />
                <text x={p.cx} y={p.cy - 13} textAnchor="middle" className="fill-white font-mono" style={{ fontSize: "10px", fontWeight: 700 }}>
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
        ))}
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

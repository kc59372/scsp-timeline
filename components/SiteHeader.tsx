import Link from "next/link";
import { fetchMilestones } from "@/lib/milestones";

/** Tiny line-symbols placed inside the floating cards, drawn in `color`. */
function CardSymbol({ kind, cx, cy, color }: { kind: string; cx: number; cy: number; color: string }) {
  const s = { stroke: color, strokeWidth: 2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "drone": {
      const d = 9;
      const rot: [number, number][] = [[cx - d, cy - d], [cx + d, cy - d], [cx - d, cy + d], [cx + d, cy + d]];
      return (
        <g {...s}>
          {rot.map(([x, y], i) => (
            <g key={i}>
              <line x1={cx} y1={cy} x2={x} y2={y} />
              <circle cx={x} cy={y} r="4" />
            </g>
          ))}
          <rect x={cx - 3} y={cy - 3} width="6" height="6" rx="1.5" fill={color} stroke="none" />
        </g>
      );
    }
    case "chip":
      return (
        <g {...s}>
          <rect x={cx - 9} y={cy - 9} width="18" height="18" rx="3" />
          {[-4, 0, 4].map((o) => (
            <g key={o}>
              <line x1={cx + o} y1={cy - 9} x2={cx + o} y2={cy - 13} />
              <line x1={cx + o} y1={cy + 9} x2={cx + o} y2={cy + 13} />
              <line x1={cx - 9} y1={cy + o} x2={cx - 13} y2={cy + o} />
              <line x1={cx + 9} y1={cy + o} x2={cx + 13} y2={cy + o} />
            </g>
          ))}
          <circle cx={cx} cy={cy} r="2.5" fill={color} stroke="none" />
        </g>
      );
    case "satellite":
      return (
        <g {...s}>
          <rect x={cx - 5} y={cy - 6} width="10" height="12" rx="2" />
          <rect x={cx - 17} y={cy - 4} width="8" height="8" rx="1" />
          <rect x={cx + 9} y={cy - 4} width="8" height="8" rx="1" />
          <line x1={cx - 9} y1={cy} x2={cx - 5} y2={cy} />
          <line x1={cx + 5} y1={cy} x2={cx + 9} y2={cy} />
          <line x1={cx} y1={cy - 6} x2={cx} y2={cy - 12} />
          <circle cx={cx} cy={cy - 13} r="2" />
        </g>
      );
    case "radar":
    default:
      return (
        <g {...s}>
          <circle cx={cx} cy={cy} r="11" />
          <circle cx={cx} cy={cy} r="6" />
          <line x1={cx} y1={cy} x2={cx + 9} y2={cy - 7} />
          <circle cx={cx} cy={cy} r="2" fill={color} stroke="none" />
        </g>
      );
  }
}

/**
 * Translucent timeline graphic — a spine with milestone points and floating
 * cards branching off, each holding a small symbol (drone, chip, satellite,
 * radar). Red cards + white symbols read as high-contrast accents on the navy
 * header field.
 */
function TimelineGraphic({ className }: { className?: string }) {
  const spineY = 110;
  const cardW = 62;
  const cardH = 48;

  const nodes: {
    x: number;
    dir: -1 | 1;
    icon: string;
    cardFill: string;
    cardOp: number;
    blend: boolean;
    sym: string;
    dot: string;
  }[] = [
    { x: 45, dir: -1, icon: "drone", cardFill: "#B31942", cardOp: 0.88, blend: false, sym: "#FFFFFF", dot: "#B31942" },
    { x: 115, dir: 1, icon: "chip", cardFill: "#B31942", cardOp: 0.88, blend: false, sym: "#FFFFFF", dot: "#B31942" },
    { x: 185, dir: -1, icon: "satellite", cardFill: "#B31942", cardOp: 0.88, blend: false, sym: "#FFFFFF", dot: "#B31942" },
    { x: 255, dir: 1, icon: "radar", cardFill: "#B31942", cardOp: 0.88, blend: false, sym: "#FFFFFF", dot: "#B31942" },
  ];

  return (
    <svg viewBox="0 0 300 220" className={className} aria-hidden>
      {/* spine */}
      <line x1="8" y1={spineY} x2="292" y2={spineY} stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />

      {nodes.map((n) => {
        const cardCy = spineY + n.dir * 66;
        const cardY = cardCy - cardH / 2;
        const stemEnd = cardCy - (n.dir * cardH) / 2;
        return (
          <g key={n.x}>
            {/* stem */}
            <line x1={n.x} y1={spineY} x2={n.x} y2={stemEnd} stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />
            {/* card */}
            <rect
              x={n.x - cardW / 2}
              y={cardY}
              width={cardW}
              height={cardH}
              rx="8"
              fill={n.cardFill}
              fillOpacity={n.cardOp}
              stroke="#FFFFFF"
              strokeOpacity="0.4"
              style={n.blend ? { mixBlendMode: "multiply" } : undefined}
            />
            <CardSymbol kind={n.icon} cx={n.x} cy={cardCy} color={n.sym} />
            {/* node on the spine */}
            <circle cx={n.x} cy={spineY} r="6" fill="#FFFFFF" />
            <circle cx={n.x} cy={spineY} r="2.5" fill={n.dot} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Full-width editorial hero across the top of every page — SCSP report style:
 * a saturated red field (#B31942 → #851432), a large white uppercase title, a
 * bold white deck, a light CTA button, and a translucent timeline graphic on the side.
 * `total` shows the verified-milestone count; pages that already fetched
 * milestones pass it in, otherwise the header fetches the count itself.
 */
export async function SiteHeader({ total }: { total?: number }) {
  const count = total ?? (await fetchMilestones()).total;

  return (
    <header
      className="relative overflow-hidden"
      style={{
        background: "radial-gradient(130% 130% at 25% -10%, #0A3161 0%, #00334E 60%, #002238 100%)",
      }}
    >
      <div className="relative mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-10 sm:py-12">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-3 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.2em]">
            <span className="rounded px-2.5 py-1 text-white" style={{ backgroundColor: "#B31942" }}>
              2016 – 2026
            </span>
            <span style={{ color: "rgba(240,240,240,0.75)" }}>US Military AI Adoption</span>
          </p>

          <h1 className="mt-4 max-w-3xl text-3xl font-bold uppercase leading-[0.98] tracking-tight text-white sm:text-4xl lg:text-5xl">
            <Link href="/" className="transition-opacity hover:opacity-90">
              US Military AI Adoption Timeline
            </Link>
          </h1>

          <p className="mt-4 max-w-xl text-base font-semibold leading-snug text-white sm:text-lg">
            Tracking US military AI milestones — fielded systems, policy directives,
            and technology developments.
          </p>

          <p
            className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.18em]"
            style={{ color: "rgba(240,240,240,0.6)" }}
          >
            {count.toLocaleString()} verified milestones · Built for policymakers &amp; developers
          </p>

          <Link
            href="/timeline"
            className="mt-6 inline-block rounded-md bg-white px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.18em] shadow-lg shadow-black/10 transition-colors hover:bg-[#F0F0F0]"
            style={{ color: "#00334E" }}
          >
            Explore the Timeline →
          </Link>
        </div>

        {/* Translucent timeline graphic (desktop only) */}
        <div className="hidden shrink-0 lg:block">
          <TimelineGraphic className="h-48 w-64 xl:h-56 xl:w-72" />
        </div>
      </div>
    </header>
  );
}

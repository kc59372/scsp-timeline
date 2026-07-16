import Link from "next/link";
import { fetchMilestones } from "@/lib/milestones";
import { buildTimelineEntries, type ProgramEntry } from "@/lib/timeline";
import { primaryDateIso } from "@/lib/format";
import { HomeGraphics } from "@/components/HomeGraphics";
import { MilestoneCard } from "@/components/MilestoneCard";
import { ProgramCard } from "@/components/ProgramCard";
import { SiteSidebar } from "@/components/SiteSidebar";

export const metadata = {
  title: "US Military AI Adoption Timeline",
};

export default async function Home() {
  const { items, total } = await fetchMilestones();

  // Recent events: latest-dated standalone events (programs get their own section).
  const recent = [...items]
    .filter((m) => primaryDateIso(m) != null)
    .sort((a, b) => (primaryDateIso(a)! < primaryDateIso(b)! ? 1 : -1))
    .slice(0, 6);

  // Main projects: the most significant program lifecycle tracks.
  const programs = (
    buildTimelineEntries(items).filter((e) => e.kind === "program") as ProgramEntry[]
  )
    .sort(
      (a, b) =>
        b.program.significance - a.program.significance ||
        b.events.length - a.events.length,
    )
    .slice(0, 4);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-12 lg:flex-row lg:items-start lg:gap-12">
      {/* ── Persistent site sidebar ── */}
      <SiteSidebar total={total} />

      {/* ── Main column: graphics, recent events, main projects ── */}
      <div className="min-w-0 flex-1 space-y-14">
        <section>
          <h2 className="mb-5 text-xl font-bold tracking-tight text-ink">Graphics</h2>
          <HomeGraphics milestones={items} />
        </section>

        <section>
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-xl font-bold tracking-tight text-ink">Recent Events</h2>
            <Link href="/timeline" className="font-mono text-xs text-accent hover:underline">
              View all →
            </Link>
          </div>
          {recent.length ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {recent.map((m) => (
                <MilestoneCard key={m.id} milestone={m} />
              ))}
            </div>
          ) : (
            <p className="font-mono text-sm text-gray-500">No events yet.</p>
          )}
        </section>

        <section>
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-xl font-bold tracking-tight text-ink">Main Projects</h2>
            <Link href="/timeline" className="font-mono text-xs text-accent hover:underline">
              View all →
            </Link>
          </div>
          {programs.length ? (
            <div className="flex flex-col gap-6">
              {programs.map((p) => (
                <ProgramCard key={p.id} program={p.program} events={p.events} />
              ))}
            </div>
          ) : (
            <p className="font-mono text-sm text-gray-500">No program tracks yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}

import { fetchMilestones } from "@/lib/milestones";
import { buildTimelineEntries, type ProgramEntry } from "@/lib/timeline";
import { SiteSidebar } from "@/components/SiteSidebar";
import { SiteHeader } from "@/components/SiteHeader";
import { ProgramCompare, type CompareProgram } from "@/components/ProgramCompare";

export const metadata = {
  title: "Comparison Tool — US Military AI Adoption",
};

export default async function ComparePage() {
  // One approved-milestone pull rebuilds every program lifecycle track client-
  // side (no per-program fetch), matching the homepage's program grouping.
  const { items, total } = await fetchMilestones({ pageSize: 1000 });

  const programs: CompareProgram[] = (
    buildTimelineEntries(items).filter((e) => e.kind === "program") as ProgramEntry[]
  )
    .sort(
      (a, b) =>
        b.program.significance - a.program.significance ||
        b.events.length - a.events.length,
    )
    .map((e) => ({ program: e.program, events: e.events }));

  return (
    <>
      <SiteHeader total={total} />
      <main className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-12 lg:flex-row lg:items-start lg:gap-12">
        {/* ── Persistent site sidebar ── */}
        <SiteSidebar />

        {/* ── Main column: comparison tool ── */}
        <div className="min-w-0 flex-1">
          <div className="mb-6">
            <span className="font-mono text-xs uppercase tracking-[0.2em] text-signal">
              Comparison Tool
            </span>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">
              Compare programs side by side
            </h2>
          </div>

          {programs.length >= 2 ? (
            <ProgramCompare programs={programs} />
          ) : (
            <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-lg border border-dashed border-edge bg-panel p-12 text-center">
              <p className="max-w-md text-sm leading-relaxed text-gray-600">
                At least two program lifecycle tracks are needed to compare.
                Approve more scraped events into programs to unlock this view.
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

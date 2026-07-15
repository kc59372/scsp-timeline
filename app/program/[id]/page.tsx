import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProgram } from "@/lib/milestones";
import { categoryStyle, categoryLabel } from "@/lib/categories";
import { eventTypeLabel } from "@/lib/events";
import { orderEvents } from "@/lib/timeline";
import { formatMilestoneDate, primaryDateIso, formatUsd, displayActor, displayDescription } from "@/lib/format";

export default async function ProgramProfile({ params }: { params: { id: string } }) {
  const program = await fetchProgram(params.id);
  if (!program) notFound();

  const style = categoryStyle(program.category);
  const events = orderEvents(program.events);

  const totalValue = events.reduce((sum, e) => sum + (e.contractValue ?? 0), 0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/timeline" className="font-mono text-xs text-gray-500 hover:text-accent">
        ← Back to timeline
      </Link>

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <span className={`rounded px-2.5 py-1 font-mono text-[0.7rem] font-semibold uppercase tracking-wide ${style.pill}`}>
            {categoryLabel(program.category)}
          </span>
          <span className="rounded bg-accent/10 px-2 py-0.5 font-mono text-[0.7rem] uppercase tracking-wide text-accent">
            Program
          </span>
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{program.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <span className="font-medium">{displayActor(program.actor)}</span>
          {program.systemStatus && (
            <>
              <span className="text-gray-400">·</span>
              <span className="font-mono text-xs uppercase text-gray-500">{program.systemStatus}</span>
            </>
          )}
          {program.subcategory && (
            <>
              <span className="text-gray-400">·</span>
              <span>{program.subcategory}</span>
            </>
          )}
        </div>
      </div>

      {program.description && (
        <p className="mt-6 leading-relaxed text-ink">{displayDescription(program.description)}</p>
      )}

      {/* lifecycle track */}
      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Adoption Lifecycle</h2>
          <span className="font-mono text-xs text-gray-500">
            {events.length} {events.length === 1 ? "stage" : "stages"}
            {totalValue > 0 && ` · ${formatUsd(totalValue)} total`}
          </span>
        </div>

        <ol className="relative flex flex-col gap-5 pl-6 before:absolute before:bottom-2 before:left-[3px] before:top-2 before:w-0.5 before:bg-edge">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className={`absolute -left-6 top-1.5 h-2.5 w-2.5 -translate-x-[3px] rounded-full border-2 border-paper ${style.dot}`} />
              <div className="rounded-lg border border-edge bg-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`font-mono text-[0.7rem] font-bold uppercase tracking-wide ${style.text}`}>
                    {eventTypeLabel(e.eventType)}
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {formatMilestoneDate(primaryDateIso(e)) ?? "date unknown"}
                  </span>
                </div>
                <h3 className="mt-1 font-semibold text-ink">
                  <Link href={`/system/${e.id}`} className="hover:text-accent hover:underline">
                    {e.name}
                  </Link>
                </h3>
                {e.description && (
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{displayDescription(e.description)}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.7rem] text-gray-500">
                  {e.contractNumber && <span>Contract {e.contractNumber}</span>}
                  {e.contractValue != null && <span>{formatUsd(e.contractValue)}</span>}
                  {e.awardedTo && <span>Awarded to {e.awardedTo}</span>}
                  {e.testLocation && <span>Location: {e.testLocation}</span>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
